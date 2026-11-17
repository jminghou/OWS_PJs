"""重寄設定密碼信的同一信箱冷卻。In-memory SQLite + SimpleCache；不寄信、不碰站台資料。"""
import time
import unittest
from unittest.mock import patch

from flask import Flask
from flask_jwt_extended import JWTManager
from sqlalchemy import BigInteger, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles

from core.backend_engine.blueprints import api as core_api
from core.backend_engine.blueprints.api import member_auth
from core.backend_engine.factory import cache, db, limiter, throttle_cache
from core.backend_engine.models import User

GOOD_PW = 'Secret123'
URL = '/api/v1/auth/member/resend-set-password'
LEGACY_URL = '/api/v1/astrology/resend-set-password'


@compiles(JSONB, 'sqlite')
def _jsonb_on_sqlite(type_, compiler, **kw):  # users 表有 JSONB 欄位，測試庫以 JSON 代替
    return 'JSON'


@compiles(BigInteger, 'sqlite')
def _bigint_on_sqlite(type_, compiler, **kw):  # SQLite 只有 INTEGER 主鍵會自動遞增
    return 'INTEGER'


def _make_app():
    app = Flask(__name__)
    app.config.update(SQLALCHEMY_DATABASE_URI='sqlite://', RATELIMIT_ENABLED=False, TESTING=True,
                      MEMBER_AUTH_ENABLED=True,
                      SECRET_KEY='test-only', JWT_SECRET_KEY='test-only-jwt-secret-key-32bytes!',
                      JWT_TOKEN_LOCATION=['cookies'], JWT_COOKIE_CSRF_PROTECT=False)
    JWTManager(app)
    db.init_app(app)
    limiter.init_app(app)
    cache.init_app(app, config={'CACHE_TYPE': 'SimpleCache', 'CACHE_KEY_PREFIX': 'test_cache:'})
    throttle_cache.init_app(app, config={'CACHE_TYPE': 'SimpleCache', 'CACHE_KEY_PREFIX': 'test_throttle:'})
    app.register_blueprint(core_api.bp, url_prefix='/api/v1')
    try:  # astrology 舊路由別名指到同一個 view；載入失敗就略過別名測試
        from sites.Polaris_Parent.backend.extensions import astrology
        app.register_blueprint(astrology.bp, url_prefix='/api/v1/astrology')
        app.config['_HAS_LEGACY_ALIAS'] = True
    except Exception:  # pragma: no cover
        app.config['_HAS_LEGACY_ALIAS'] = False
    return app


class ResendSetPasswordCooldownTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = _make_app()

    def setUp(self):
        self.ctx = self.app.app_context()
        self.ctx.push()
        throttle_cache.clear()  # 每個 case 從乾淨的冷卻狀態開始
        cache.clear()
        with db.engine.begin() as conn:
            for schema in ('blog', 'account'):
                if schema not in conn.execute(text('PRAGMA database_list')).scalars(1).all():
                    conn.execute(text(f"ATTACH DATABASE ':memory:' AS {schema}"))
        User.__table__.create(db.engine)
        self.client = self.app.test_client()
        self.sent = []  # (user_id, email)
        p = patch.object(member_auth, 'send_set_password_email',
                         side_effect=lambda uid, e: self.sent.append((uid, e)))
        p.start()
        self.addCleanup(p.stop)

    def tearDown(self):
        throttle_cache.clear()
        cache.clear()
        self.app.config.pop('RESEND_SET_PASSWORD_COOLDOWN_SECONDS', None)
        db.session.remove()
        User.__table__.drop(db.engine)
        self.ctx.pop()

    # ── helpers ──────────────────────────────────────────────────────────
    def post(self, email, url=URL):
        return self.client.post(url, json={'email': email})

    def make_member(self, email='old@example.com', active=True):
        u = User(username=email, email=email, role='member', is_active=active)
        u.set_password(GOOD_PW)
        db.session.add(u)
        db.session.commit()
        return u

    def assertSameResponse(self, a, b):
        self.assertEqual(a.status_code, b.status_code)
        self.assertEqual(a.get_json(), b.get_json())

    # ── cases ────────────────────────────────────────────────────────────
    def test_first_request_sends_one_email(self):
        user = self.make_member('old@example.com')
        r = self.post('old@example.com')
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.get_json()['success'])
        self.assertEqual(self.sent, [(user.id, 'old@example.com')])

    def test_same_email_within_cooldown_not_resent_and_identical_response(self):
        self.make_member('old@example.com')
        first = self.post('old@example.com')
        second = self.post('  OLD@Example.COM ')  # 大小寫/空白差異視為同一信箱
        self.assertEqual(len(self.sent), 1)
        self.assertSameResponse(first, second)
        self.assertEqual(second.status_code, 200)

    def test_unknown_email_same_response_and_no_send(self):
        self.make_member('old@example.com')
        r_known = self.post('old@example.com')
        r_unknown = self.post('nobody@example.com')
        self.assertSameResponse(r_known, r_unknown)
        self.assertEqual([s[1] for s in self.sent], ['old@example.com'])

    def test_unknown_email_also_takes_cooldown(self):
        """冷卻對未註冊 email 一視同仁：先搶鎖、才查會員。"""
        self.post('later@example.com')
        user = self.make_member('later@example.com')
        r = self.post('later@example.com')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(self.sent, [])
        throttle_cache.clear()
        self.post('later@example.com')
        self.assertEqual(self.sent, [(user.id, 'later@example.com')])

    def test_inactive_member_not_sent(self):
        self.make_member('off@example.com', active=False)
        r = self.post('off@example.com')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(self.sent, [])

    def test_different_emails_independent(self):
        a = self.make_member('a@example.com')
        b = self.make_member('b@example.com')
        self.post('a@example.com')
        self.post('b@example.com')
        self.post('a@example.com')
        self.assertEqual(self.sent, [(a.id, 'a@example.com'), (b.id, 'b@example.com')])

    def test_can_resend_after_cooldown(self):
        self.make_member('old@example.com')
        self.app.config['RESEND_SET_PASSWORD_COOLDOWN_SECONDS'] = 1
        self.post('old@example.com')
        self.post('old@example.com')
        self.assertEqual(len(self.sent), 1)
        # 不實際等待：直接移除冷卻鍵，模擬時間經過
        throttle_cache.clear()
        self.post('old@example.com')
        self.assertEqual(len(self.sent), 2)

    def test_cooldown_survives_response_cache_clear(self):
        """api blueprint 寫入成功後會 cache.clear()；冷卻鍵不能放在那裡被一起清掉。"""
        self.make_member('old@example.com')
        self.post('old@example.com')
        cache.clear()
        self.post('old@example.com')
        self.assertEqual(len(self.sent), 1)

    def test_expired_but_unpruned_key_does_not_block(self):
        """SimpleCache 的 add 不看過期；過期殘留鍵不可讓信箱永久被擋。"""
        self.make_member('old@example.com')
        self.app.config['RESEND_SET_PASSWORD_COOLDOWN_SECONDS'] = 1
        self.post('old@example.com')
        self.post('old@example.com')
        self.assertEqual(len(self.sent), 1)
        later = time.time() + 5
        with patch('cachelib.simple.time', return_value=later):
            self.post('old@example.com')
            self.assertEqual(len(self.sent), 2)
            self.post('old@example.com')  # 新的冷卻已生效
            self.assertEqual(len(self.sent), 2)

    def test_cooldown_key_is_hashed_and_uses_configured_timeout(self):
        self.make_member('old@example.com')
        self.app.config['RESEND_SET_PASSWORD_COOLDOWN_SECONDS'] = 42
        with patch.object(throttle_cache, 'add', return_value=True) as add:
            self.post('Old@Example.com')
        key = add.call_args.args[0]
        self.assertTrue(key.startswith('resend_set_pw:'))
        self.assertNotIn('example', key.lower())
        self.assertEqual(add.call_args.kwargs.get('timeout'), 42)

    def test_default_cooldown_is_600(self):
        self.assertEqual(member_auth.RESEND_SET_PASSWORD_COOLDOWN, 600)
        with patch.object(throttle_cache, 'add', return_value=True) as add:
            self.post('x@example.com')
        self.assertEqual(add.call_args.kwargs.get('timeout'), 600)

    def test_invalid_email_still_400(self):
        for bad in ('', 'not-an-email', 'a@b'):
            r = self.post(bad)
            self.assertEqual(r.status_code, 400, bad)
            self.assertFalse(r.get_json()['success'])
        self.assertEqual(self.sent, [])

    def test_cache_failure_fails_open(self):
        user = self.make_member('old@example.com')
        with patch.object(throttle_cache, 'add', side_effect=RuntimeError('redis down')):
            r1 = self.post('old@example.com')
            r2 = self.post('old@example.com')
        self.assertEqual(r1.status_code, 200)
        self.assertSameResponse(r1, r2)
        self.assertEqual(self.sent, [(user.id, 'old@example.com')] * 2)

    def test_legacy_astrology_alias_shares_cooldown(self):
        if not self.app.config.get('_HAS_LEGACY_ALIAS'):
            self.skipTest('astrology 擴充無法載入')
        self.make_member('old@example.com')
        r_new = self.post('old@example.com')
        r_legacy = self.post('old@example.com', url=LEGACY_URL)
        self.assertSameResponse(r_new, r_legacy)
        self.assertEqual(len(self.sent), 1)


if __name__ == '__main__':
    unittest.main()
