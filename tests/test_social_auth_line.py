"""LINE 登入、待完成票（Email 驗證碼補信箱／連結既有會員）、會員中心加連與解除。LINE API 以 mock 代替。"""
import unittest
from urllib.parse import parse_qs, urlparse
from unittest.mock import patch

from flask import Flask
from flask_jwt_extended import JWTManager, create_access_token
from sqlalchemy import BigInteger, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles

from core.backend_engine.factory import db, limiter
from core.backend_engine.models import User
from packages.social_auth import api  # noqa: F401  註冊路由
from packages.social_auth.blueprint import social_auth_bp
from packages.social_auth.models import SocialIdentity
from packages.social_auth.providers import google, line
from sites.Polaris_Parent.backend.extensions import member_account  # noqa: F401  登記 Polaris 掛勾（含驗證碼）
from sites.Polaris_Parent.backend.extensions.member_account import service as ma_service
from sites.Polaris_Parent.backend.models import MemberEmailCode, MemberEmailVerification

FRONT = 'http://front.test'


@compiles(JSONB, 'sqlite')
def _jsonb_on_sqlite(type_, compiler, **kw):
    return 'JSON'


@compiles(BigInteger, 'sqlite')
def _bigint_on_sqlite(type_, compiler, **kw):
    return 'INTEGER'


def _make_app(**extra):
    app = Flask(__name__)
    app.config.update(SQLALCHEMY_DATABASE_URI='sqlite://', RATELIMIT_ENABLED=False, TESTING=True,
                      SECRET_KEY='test-only', JWT_SECRET_KEY='test-only-jwt-secret-key-32bytes!',
                      JWT_TOKEN_LOCATION=['cookies'], JWT_COOKIE_CSRF_PROTECT=False,
                      GOOGLE_CLIENT_ID='gid', LINE_CHANNEL_ID='1650000000', LINE_CHANNEL_SECRET='line-secret',
                      LINE_REDIRECT_URI='http://localhost/api/v1/social-auth/line/callback', FRONTEND_URL=FRONT,
                      **extra)
    JWTManager(app)
    db.init_app(app)
    limiter.init_app(app)
    app.register_blueprint(social_auth_bp, url_prefix='/api/v1/social-auth')
    return app


class LineTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = _make_app()

    def setUp(self):
        self.ctx = self.app.app_context()
        self.ctx.push()
        with db.engine.begin() as conn:
            for schema in ('blog', 'account'):
                if schema not in conn.execute(text('PRAGMA database_list')).scalars(1).all():
                    conn.execute(text(f"ATTACH DATABASE ':memory:' AS {schema}"))
        self.tables = [User.__table__, SocialIdentity.__table__, MemberEmailVerification.__table__,
                       MemberEmailCode.__table__]
        for t in self.tables:
            t.create(db.engine)
        self.client = self.app.test_client()
        self.claims = {'sub': 'U-line-1', 'aud': '1650000000', 'iss': 'https://access.line.me',
                       'name': '林媽媽', 'picture': 'https://profile.line-scdn.net/p1', 'email': 'mom@yahoo.com.tw'}
        self.posts = []
        p1 = patch.object(line, '_post', side_effect=self._fake_post)
        self.sent = []
        p2 = patch.object(ma_service, 'send_code_email', side_effect=lambda e, p, c: self.sent.append((e, c)))
        p1.start(), p2.start()
        self.addCleanup(p1.stop)
        self.addCleanup(p2.stop)

    def tearDown(self):
        db.session.remove()
        for t in reversed(self.tables):
            t.drop(db.engine)
        self.ctx.pop()

    def _fake_post(self, url, data):
        self.posts.append((url, data))
        if url == line.TOKEN_URL:
            return 200, {'id_token': 'idt', 'access_token': 'at'}
        assert data['nonce'] == self.flow_nonce, 'nonce 要原樣交給 LINE 驗證'
        claims = dict(self.claims)
        if claims.get('email') is None:
            claims.pop('email', None)
        return 200, claims

    # ── helpers ──────────────────────────────────────────────────────────
    def start(self, query='?next=/report/checkout'):
        res = self.client.get(f'/api/v1/social-auth/line/start{query}')
        q = parse_qs(urlparse(res.headers['Location']).query)
        self.flow_nonce = q.get('nonce', [None])[0]
        self.flow_state = q.get('state', [None])[0]
        return res, q

    def callback(self, **params):
        params.setdefault('code', 'auth-code')
        params.setdefault('state', self.flow_state)
        res = self.client.get('/api/v1/social-auth/line/callback', query_string=params)
        loc = urlparse(res.headers['Location'])
        return res, loc, {k: v[0] for k, v in parse_qs(loc.query).items()}

    def line_login(self, **claims):
        self.claims.update(claims)
        self.start()
        return self.callback()

    def make_member(self, email, password=True):
        u = User(username=email, email=email, role='member', is_active=True)
        if password:
            u.set_password('Secret123')
        else:
            u.set_unusable_password()
        db.session.add(u)
        db.session.commit()
        return u

    def has_login_cookie(self, res):
        return any(h.startswith('access_token_cookie=') for h in res.headers.getlist('Set-Cookie'))

    def login_as(self, user):
        self.client.set_cookie('access_token_cookie', create_access_token(identity=str(user.id)))

    # ── start ────────────────────────────────────────────────────────────
    def test_start_redirects_to_line_with_pkce(self):
        res, q = self.start()
        self.assertEqual(res.status_code, 302)
        self.assertTrue(res.headers['Location'].startswith(line.AUTHORIZE_URL))
        self.assertEqual(q['client_id'], ['1650000000'])
        self.assertEqual(q['code_challenge_method'], ['S256'])
        self.assertEqual(q['scope'], ['profile openid email'])
        self.assertTrue(any(h.startswith('sa_line_flow=') and 'HttpOnly' in h for h in res.headers.getlist('Set-Cookie')))

    def test_unconfigured_line_is_hidden_and_start_bounces(self):
        app = _make_app()
        app.config['LINE_CHANNEL_SECRET'] = ''
        with app.app_context():
            c = app.test_client()
            self.assertNotIn('line', c.get('/api/v1/social-auth/providers').get_json()['providers'])
            res = c.get('/api/v1/social-auth/line/start')
            self.assertIn('reason=line_unavailable', res.headers['Location'])

    def test_providers_lists_line(self):
        self.assertIn('line', self.client.get('/api/v1/social-auth/providers').get_json()['providers'])

    # ── callback ─────────────────────────────────────────────────────────
    def test_new_email_registers_and_returns_to_frontend(self):
        res, loc, q = self.line_login()
        self.assertEqual(f'{loc.scheme}://{loc.netloc}{loc.path}', f'{FRONT}/login/social')
        self.assertEqual(q, {'status': 'ok', 'new': '1', 'next': '/report/checkout'})
        self.assertTrue(self.has_login_cookie(res))
        user = User.query.one()
        self.assertEqual(user.username, 'mom@yahoo.com.tw')
        self.assertFalse(user.has_usable_password)
        self.assertEqual(user.avatar, 'https://profile.line-scdn.net/p1')
        self.assertTrue(ma_service.is_email_verified(user.id, 'mom@yahoo.com.tw'))
        # token 交換有帶 PKCE verifier 與 channel secret
        token_call = self.posts[0][1]
        self.assertEqual(token_call['client_secret'], 'line-secret')
        self.assertTrue(token_call['code_verifier'])

    def test_second_login_is_direct(self):
        self.line_login()
        _, _, q = self.line_login()
        self.assertEqual(q['status'], 'ok')
        self.assertNotIn('new', q)
        self.assertEqual(User.query.count(), 1)

    def test_state_mismatch_and_cancel(self):
        self.start()
        _, _, q = self.callback(state='forged')
        self.assertEqual(q, {'status': 'error', 'reason': 'expired'})
        self.start()
        _, _, q = self.callback(error='access_denied', code='')
        self.assertEqual(q['reason'], 'cancelled')
        self.assertEqual(User.query.count(), 0)

    def test_open_redirect_next_is_dropped(self):
        self.start('?next=//evil.example')
        _, _, q = self.callback()
        self.assertNotIn('next', q)

    # ── 沒給信箱 → 補信箱 ──────────────────────────────────────────────────
    def test_missing_email_asks_for_email_then_creates_member(self):
        res, _, q = self.line_login(email=None)
        self.assertEqual(q['status'], 'pending')
        self.assertFalse(self.has_login_cookie(res))
        self.assertEqual(User.query.count(), 0)
        info = self.client.get('/api/v1/social-auth/ticket').get_json()
        self.assertEqual((info['reason'], info['email'], info['provider']), ('email_missing', None, 'line'))

        r = self.client.post('/api/v1/social-auth/ticket/email-code', json={'email': 'New.Mom@Example.com'})
        self.assertEqual(r.status_code, 200, r.get_json())
        email, code = self.sent[-1]
        self.assertEqual(email, 'new.mom@example.com')
        bad = self.client.post('/api/v1/social-auth/ticket/complete', json={'email': email, 'code': '000000'})
        self.assertEqual(bad.status_code, 400)
        r = self.client.post('/api/v1/social-auth/ticket/complete', json={'email': email, 'code': code})
        self.assertEqual(r.status_code, 201, r.get_json())
        self.assertTrue(self.has_login_cookie(r))
        user = User.query.one()
        self.assertEqual(user.username, 'new.mom@example.com')
        self.assertTrue(ma_service.is_email_verified(user.id, email))
        self.assertEqual(SocialIdentity.query.one().user_id, user.id)
        # 票用掉了，下次 LINE 直接登入
        self.assertEqual(self.client.get('/api/v1/social-auth/ticket').status_code, 404)
        _, _, q = self.line_login(email=None)
        self.assertEqual(q['status'], 'ok')

    def test_missing_email_can_join_existing_google_member(self):
        g = self.make_member('dad@gmail.com', password=False)
        db.session.add(SocialIdentity(user_id=g.id, provider='google', subject='g-1', created_at=g.created_at or __import__('datetime').datetime.utcnow()))
        db.session.commit()
        self.line_login(email=None)
        self.client.post('/api/v1/social-auth/ticket/email-code', json={'email': 'dad@gmail.com'})
        r = self.client.post('/api/v1/social-auth/ticket/complete', json={'email': 'dad@gmail.com', 'code': self.sent[-1][1]})
        self.assertEqual(r.status_code, 200, r.get_json())
        self.assertEqual(User.query.count(), 1)
        self.assertEqual(sorted(i.provider for i in SocialIdentity.query.filter_by(user_id=g.id)), ['google', 'line'])

    # ── 信箱已是會員 → 驗證後連結 ─────────────────────────────────────────
    def test_existing_email_needs_code_sent_to_that_email_only(self):
        member = self.make_member('mom@yahoo.com.tw')
        _, _, q = self.line_login()
        self.assertEqual(q['status'], 'pending')
        info = self.client.get('/api/v1/social-auth/ticket').get_json()
        self.assertEqual((info['reason'], info['email']), ('needs_link', 'mom@yahoo.com.tw'))
        # 就算改填別的信箱，也只會寄到既有會員的信箱
        self.client.post('/api/v1/social-auth/ticket/email-code', json={'email': 'attacker@evil.test'})
        self.assertEqual(self.sent[-1][0], 'mom@yahoo.com.tw')
        r = self.client.post('/api/v1/social-auth/ticket/complete',
                             json={'email': 'attacker@evil.test', 'code': self.sent[-1][1]})
        self.assertEqual(r.status_code, 200, r.get_json())
        self.assertEqual(SocialIdentity.query.one().user_id, member.id)
        self.assertTrue(db.session.get(User, member.id).check_password('Secret123'))  # 原密碼照用

    def test_google_non_gmail_conflict_also_gets_ticket(self):
        self.make_member('teacher@school.example')
        with patch.object(google, '_verify_token', return_value={
                'iss': 'accounts.google.com', 'sub': 'g-9', 'email': 'teacher@school.example', 'email_verified': True}):
            r = self.client.post('/api/v1/social-auth/google', json={'credential': 'x'})
        self.assertEqual(r.status_code, 409)
        self.assertEqual(r.get_json()['code'], 'needs_link')
        info = self.client.get('/api/v1/social-auth/ticket').get_json()
        self.assertEqual((info['provider'], info['email']), ('google', 'teacher@school.example'))

    # ── 會員中心：加連、解除 ──────────────────────────────────────────────
    def test_link_line_from_member_center(self):
        member = self.make_member('someone@gmail.com')
        self.login_as(member)
        self.claims['email'] = 'different@line.me'
        self.start('?mode=link&next=/account?tab=login')
        _, _, q = self.callback()
        self.assertEqual(q, {'status': 'linked', 'provider': 'line', 'next': '/account?tab=login'})
        self.assertEqual(SocialIdentity.query.one().user_id, member.id)
        self.assertEqual(User.query.count(), 1)

    def test_link_requires_login(self):
        res, _ = self.start('?mode=link')
        self.assertIn('reason=login_required', res.headers['Location'])

    def test_link_conflict_when_line_belongs_to_someone_else(self):
        self.line_login()  # LINE 帳號已屬於 mom@yahoo.com.tw
        other = self.make_member('other@gmail.com')
        self.login_as(other)
        self.start('?mode=link')
        _, _, q = self.callback()
        self.assertEqual(q['reason'], 'link_conflict')

    def test_link_google_from_member_center(self):
        member = self.make_member('someone@hotmail.com')
        self.login_as(member)
        with patch.object(google, '_verify_token', return_value={
                'iss': 'accounts.google.com', 'sub': 'g-5', 'email': 'other@gmail.com', 'email_verified': True}):
            r = self.client.post('/api/v1/social-auth/me/link/google', json={'credential': 'x'})
        self.assertEqual(r.status_code, 200, r.get_json())
        self.assertEqual([i['provider'] for i in r.get_json()['identities']], ['google'])

    def test_unlink_last_method_is_refused(self):
        self.line_login()
        user = User.query.one()
        self.login_as(user)
        r = self.client.delete('/api/v1/social-auth/me/identities/line')
        self.assertEqual(r.status_code, 409)
        user.set_password('Secret123')
        db.session.commit()
        r = self.client.delete('/api/v1/social-auth/me/identities/line')
        self.assertEqual(r.status_code, 200, r.get_json())
        self.assertEqual(SocialIdentity.query.count(), 0)


if __name__ == '__main__':
    unittest.main()
