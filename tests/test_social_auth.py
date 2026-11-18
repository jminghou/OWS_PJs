"""Social Auth 模組（Google 登入）＋Polaris 掛勾。In-memory SQLite；Google 驗證以 mock 代替，不連外。"""
import unittest
from unittest.mock import patch

from flask import Flask
from flask_jwt_extended import JWTManager
from sqlalchemy import BigInteger, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles

from core.backend_engine.factory import db, limiter
from core.backend_engine.models import User
from packages.social_auth import api  # noqa: F401  註冊路由
from packages.social_auth.blueprint import social_auth_bp
from packages.social_auth.models import SocialIdentity
from packages.social_auth.providers import google
from sites.Polaris_Parent.backend.extensions import member_account  # noqa: F401  登記 Polaris 掛勾
from sites.Polaris_Parent.backend.extensions.member_account import service as ma_service
from sites.Polaris_Parent.backend.models import MemberEmailVerification

GOOD_PW = 'Secret123'
CLIENT_ID = 'test-client.apps.googleusercontent.com'


@compiles(JSONB, 'sqlite')
def _jsonb_on_sqlite(type_, compiler, **kw):
    return 'JSON'


@compiles(BigInteger, 'sqlite')
def _bigint_on_sqlite(type_, compiler, **kw):
    return 'INTEGER'


def _make_app(client_id=CLIENT_ID):
    app = Flask(__name__)
    app.config.update(SQLALCHEMY_DATABASE_URI='sqlite://', RATELIMIT_ENABLED=False, TESTING=True,
                      SECRET_KEY='test-only', JWT_SECRET_KEY='test-only-jwt-secret-key-32bytes!',
                      JWT_TOKEN_LOCATION=['cookies'], JWT_COOKIE_CSRF_PROTECT=False,
                      GOOGLE_CLIENT_ID=client_id)
    JWTManager(app)
    db.init_app(app)
    limiter.init_app(app)
    app.register_blueprint(social_auth_bp, url_prefix='/api/v1/social-auth')
    return app


def claims(sub='g-1', email='new.parent@gmail.com', **extra):
    base = {'iss': 'https://accounts.google.com', 'aud': CLIENT_ID, 'sub': sub, 'email': email,
            'email_verified': True, 'name': '王小明', 'picture': 'https://lh3.googleusercontent.com/a/pic1'}
    base.update(extra)
    return base


class SocialAuthTests(unittest.TestCase):
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
        self.tables = [User.__table__, SocialIdentity.__table__, MemberEmailVerification.__table__]
        for t in self.tables:
            t.create(db.engine)
        self.client = self.app.test_client()
        self.claims = claims()
        patcher = patch.object(google, '_verify_token', side_effect=self._fake_verify)
        patcher.start()
        self.addCleanup(patcher.stop)

    def tearDown(self):
        db.session.remove()
        for t in reversed(self.tables):
            t.drop(db.engine)
        self.ctx.pop()

    def _fake_verify(self, credential, audience):
        assert audience == CLIENT_ID
        if credential == 'bad':
            raise ValueError('Token expired')
        return self.claims

    def sign_in(self, **override):
        if override:
            self.claims = claims(**override)
        return self.client.post('/api/v1/social-auth/google', json={'credential': 'token'})

    def make_member(self, email, password=GOOD_PW, **kw):
        u = User(username=email, email=email, role='member', is_active=True, **kw)
        u.set_password(password)
        db.session.add(u)
        db.session.commit()
        return u

    def has_auth_cookie(self, res):
        return any('access_token_cookie=' in h for h in res.headers.getlist('Set-Cookie'))

    # ── providers ────────────────────────────────────────────────────────
    def test_providers_lists_google_with_client_id(self):
        res = self.client.get('/api/v1/social-auth/providers')
        self.assertEqual(res.get_json()['providers'], {'google': {'client_id': CLIENT_ID}})

    def test_unconfigured_google_is_hidden_and_404(self):
        app = _make_app(client_id='')
        with app.app_context():
            c = app.test_client()
            self.assertEqual(c.get('/api/v1/social-auth/providers').get_json()['providers'], {})
            self.assertEqual(c.post('/api/v1/social-auth/google', json={'credential': 'x'}).status_code, 404)

    # ── 註冊 ──────────────────────────────────────────────────────────────
    def test_new_email_registers_and_signs_in(self):
        res = self.sign_in()
        self.assertEqual(res.status_code, 201, res.get_json())
        self.assertTrue(res.get_json()['is_new'])
        self.assertTrue(self.has_auth_cookie(res))

        user = User.query.filter_by(username='new.parent@gmail.com').one()
        self.assertEqual(user.role, 'member')
        self.assertFalse(user.has_usable_password)
        self.assertFalse(user.check_password(GOOD_PW))
        self.assertEqual(user.avatar, 'https://lh3.googleusercontent.com/a/pic1')
        self.assertEqual(user.get_attribute('avatar_source'), 'google')
        self.assertEqual(user.get_attribute('display_name'), '王小明')
        ident = SocialIdentity.query.one()
        self.assertEqual((ident.user_id, ident.provider, ident.subject), (user.id, 'google', 'g-1'))
        # Polaris 掛勾：信箱記為已驗證，結帳不必再收驗證碼
        self.assertTrue(ma_service.is_email_verified(user.id, 'new.parent@gmail.com'))

    def test_email_is_normalised(self):
        self.sign_in(email='  Mixed.Case@Gmail.com ')
        self.assertEqual(User.query.one().username, 'mixed.case@gmail.com')

    # ── 再次登入 ──────────────────────────────────────────────────────────
    def test_same_subject_signs_in_without_duplicating_and_refreshes_avatar(self):
        self.sign_in()
        res = self.sign_in(picture='https://lh3.googleusercontent.com/a/pic2')
        self.assertEqual(res.status_code, 200)
        self.assertFalse(res.get_json()['is_new'])
        self.assertEqual(User.query.count(), 1)
        self.assertEqual(SocialIdentity.query.count(), 1)
        self.assertEqual(User.query.one().avatar, 'https://lh3.googleusercontent.com/a/pic2')

    def test_subject_is_the_key_even_after_google_email_changes(self):
        self.sign_in()
        res = self.sign_in(email='renamed@gmail.com')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(User.query.count(), 1)
        self.assertEqual(User.query.one().username, 'new.parent@gmail.com')  # 不跟著改本站信箱

    def test_uploaded_avatar_is_not_overwritten(self):
        self.sign_in()
        user = User.query.one()
        user.avatar = 'https://cdn.example/me.png'
        user.attributes = {**user.attributes, 'avatar_source': 'upload'}
        db.session.commit()
        self.sign_in(picture='https://lh3.googleusercontent.com/a/pic9')
        self.assertEqual(User.query.one().avatar, 'https://cdn.example/me.png')

    # ── 既有會員 ──────────────────────────────────────────────────────────
    def test_gmail_existing_member_is_linked_automatically(self):
        member = self.make_member('old@gmail.com')
        res = self.sign_in(email='old@gmail.com', sub='g-old')
        self.assertEqual(res.status_code, 200, res.get_json())
        self.assertEqual(SocialIdentity.query.one().user_id, member.id)
        user = db.session.get(User, member.id)
        self.assertTrue(user.has_usable_password)
        self.assertTrue(user.check_password(GOOD_PW))  # 原本的密碼照樣能用

    def test_workspace_domain_existing_member_is_linked(self):
        self.make_member('teacher@school.edu.tw')
        res = self.sign_in(email='teacher@school.edu.tw', hd='school.edu.tw')
        self.assertEqual(res.status_code, 200)

    def test_other_domain_existing_member_needs_link(self):
        self.make_member('parent@yahoo.com.tw')
        res = self.sign_in(email='parent@yahoo.com.tw')
        self.assertEqual(res.status_code, 409)
        self.assertEqual(res.get_json()['code'], 'needs_link')
        self.assertEqual(SocialIdentity.query.count(), 0)
        self.assertFalse(self.has_auth_cookie(res))

    def test_member_already_linked_to_another_google_account_needs_link(self):
        self.sign_in(email='old@gmail.com', sub='g-a')
        res = self.sign_in(email='old@gmail.com', sub='g-b')
        self.assertEqual(res.status_code, 409)
        self.assertEqual(SocialIdentity.query.count(), 1)

    def test_existing_avatar_of_unknown_source_is_kept_on_link(self):
        self.make_member('old@gmail.com', avatar='https://cdn.example/own.png')
        self.sign_in(email='old@gmail.com')
        self.assertEqual(User.query.one().avatar, 'https://cdn.example/own.png')

    def test_disabled_member_is_rejected(self):
        self.sign_in()
        user = User.query.one()
        user.is_active = False
        db.session.commit()
        res = self.sign_in()
        self.assertEqual(res.status_code, 403)
        self.assertFalse(self.has_auth_cookie(res))

    # ── 無效憑證 ──────────────────────────────────────────────────────────
    def test_invalid_token_is_rejected(self):
        res = self.client.post('/api/v1/social-auth/google', json={'credential': 'bad'})
        self.assertEqual(res.status_code, 400)
        self.assertEqual(User.query.count(), 0)

    def test_missing_credential_is_rejected(self):
        self.assertEqual(self.client.post('/api/v1/social-auth/google', json={}).status_code, 400)

    def test_unverified_email_is_rejected(self):
        self.assertEqual(self.sign_in(email_verified=False).status_code, 400)
        self.assertEqual(User.query.count(), 0)

    def test_wrong_issuer_is_rejected(self):
        self.assertEqual(self.sign_in(iss='https://evil.example').status_code, 400)

    # ── 密碼狀態（方案 A）────────────────────────────────────────────────
    def test_setting_password_later_marks_password_set(self):
        self.sign_in()
        user = User.query.one()
        user.set_password(GOOD_PW)
        db.session.commit()
        user = User.query.one()
        self.assertTrue(user.has_usable_password)
        self.assertTrue(user.check_password(GOOD_PW))

    def test_ordinary_set_password_does_not_touch_attributes(self):
        u = User(username='plain@example.com', email='plain@example.com')
        u.set_password(GOOD_PW)
        self.assertIsNone(u.attributes)
        self.assertTrue(u.has_usable_password)

    def test_my_identities(self):
        res = self.sign_in()
        cookie = [h for h in res.headers.getlist('Set-Cookie') if h.startswith('access_token_cookie=')][0]
        token = cookie.split(';')[0].split('=', 1)[1]
        self.client.set_cookie('access_token_cookie', token)
        body = self.client.get('/api/v1/social-auth/me/identities').get_json()
        self.assertFalse(body['password_set'])
        self.assertEqual([i['provider'] for i in body['identities']], ['google'])


if __name__ == '__main__':
    unittest.main()
