"""Polaris 會員 v2：驗證碼註冊、重設密碼、登入後驗證。In-memory SQLite；不碰站台資料、不寄信。"""
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from flask import Flask
from flask_jwt_extended import JWTManager
from sqlalchemy import BigInteger, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles

from core.backend_engine.factory import db, limiter
from core.backend_engine.models import User
from sites.Polaris_Parent.backend.extensions import member_account
from sites.Polaris_Parent.backend.extensions.member_account import service
from sites.Polaris_Parent.backend.models import MemberEmailCode, MemberEmailVerification

GOOD_PW = 'Secret123'


@compiles(JSONB, 'sqlite')
def _jsonb_on_sqlite(type_, compiler, **kw):  # users 表有 JSONB 欄位，測試庫以 JSON 代替
    return 'JSON'


@compiles(BigInteger, 'sqlite')
def _bigint_on_sqlite(type_, compiler, **kw):  # SQLite 只有 INTEGER 主鍵會自動遞增
    return 'INTEGER'


def _make_app():
    app = Flask(__name__)
    app.config.update(SQLALCHEMY_DATABASE_URI='sqlite://', RATELIMIT_ENABLED=False, TESTING=True,
                      SECRET_KEY='test-only', JWT_SECRET_KEY='test-only-jwt-secret-key-32bytes!',
                      JWT_TOKEN_LOCATION=['cookies'], JWT_COOKIE_CSRF_PROTECT=False)
    JWTManager(app)
    db.init_app(app)
    limiter.init_app(app)
    app.register_blueprint(member_account.bp, url_prefix='/api/v1')
    return app


class MemberAccountTests(unittest.TestCase):
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
        self.tables = [User.__table__, MemberEmailCode.__table__, MemberEmailVerification.__table__]
        for t in self.tables:
            t.create(db.engine)
        self.client = self.app.test_client()
        self.sent = []  # (email, kind, code)
        p1 = patch.object(service, 'send_code_email', side_effect=lambda e, p, c: self.sent.append((e, p, c)))
        p2 = patch.object(service, 'send_already_member_email',
                          side_effect=lambda e: self.sent.append((e, 'already_member', None)))
        p1.start(), p2.start()
        self.addCleanup(p1.stop)
        self.addCleanup(p2.stop)

    def tearDown(self):
        db.session.remove()
        for t in reversed(self.tables):
            t.drop(db.engine)
        self.ctx.pop()

    # ── helpers ──────────────────────────────────────────────────────────
    def post(self, path, **body):
        return self.client.post(f'/api/v1/member/{path}', json=body)

    def last_code(self):
        return self.sent[-1][2]

    def make_member(self, email='old@example.com'):
        u = User(username=email, email=email, role='member', is_active=True)
        u.set_password(GOOD_PW)
        db.session.add(u)
        db.session.commit()
        return u

    def age_codes(self, seconds):
        """把所有驗證碼往前推，模擬時間經過（避開重寄冷卻）。"""
        for row in MemberEmailCode.query.all():
            row.created_at = row.created_at - timedelta(seconds=seconds)
        db.session.commit()

    # ── 註冊 ─────────────────────────────────────────────────────────────
    def test_register_with_code_creates_verified_member_and_logs_in(self):
        r = self.post('email-code', email=' New@Example.com ', purpose='register')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(self.sent[-1][:2], ('new@example.com', 'register'))
        stored = MemberEmailCode.query.one()
        self.assertNotEqual(stored.code_hash, self.last_code())  # 不存明碼

        r = self.post('register', email='new@example.com', code=self.last_code(), password=GOOD_PW)
        self.assertEqual(r.status_code, 201, r.get_json())
        self.assertIn('access_token_cookie', r.headers.get('Set-Cookie', ''))
        user = User.query.filter_by(username='new@example.com').one()
        self.assertTrue(service.is_email_verified(user.id, 'new@example.com'))

        status = self.client.get('/api/v1/member/verification').get_json()
        self.assertTrue(status['email_verified'])

    def test_register_rejects_wrong_code_and_locks_after_max_attempts(self):
        self.post('email-code', email='a@example.com', purpose='register')
        good = self.last_code()
        wrong = '000000' if good != '000000' else '111111'
        for _ in range(service.MAX_ATTEMPTS):
            r = self.post('register', email='a@example.com', code=wrong, password=GOOD_PW)
            self.assertEqual(r.status_code, 400)
        r = self.post('register', email='a@example.com', code=good, password=GOOD_PW)
        self.assertEqual(r.status_code, 400)
        self.assertIn('錯誤次數過多', r.get_json()['error'])
        self.assertEqual(User.query.count(), 0)

    def test_expired_code_rejected(self):
        self.post('email-code', email='a@example.com', purpose='register')
        row = MemberEmailCode.query.one()
        row.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        db.session.commit()
        r = self.post('register', email='a@example.com', code=self.last_code(), password=GOOD_PW)
        self.assertEqual(r.status_code, 400)
        self.assertIn('已失效', r.get_json()['error'])

    def test_new_code_invalidates_old_one(self):
        self.post('email-code', email='a@example.com', purpose='register')
        first = self.last_code()
        self.age_codes(61)
        self.post('email-code', email='a@example.com', purpose='register')
        second = self.last_code()
        if first != second:
            r = self.post('register', email='a@example.com', code=first, password=GOOD_PW)
            self.assertEqual(r.status_code, 400)
        r = self.post('register', email='a@example.com', code=second, password=GOOD_PW)
        self.assertEqual(r.status_code, 201)

    def test_code_is_single_use(self):
        self.post('email-code', email='a@example.com', purpose='register')
        code = self.last_code()
        self.assertEqual(self.post('register', email='a@example.com', code=code, password=GOOD_PW).status_code, 201)
        r = self.post('register', email='a@example.com', code=code, password=GOOD_PW)
        self.assertEqual(r.status_code, 400)

    def test_weak_password_rejected_before_consuming_code(self):
        self.post('email-code', email='a@example.com', purpose='register')
        r = self.post('register', email='a@example.com', code=self.last_code(), password='short')
        self.assertEqual(r.status_code, 400)
        self.assertIsNone(MemberEmailCode.query.one().consumed_at)

    def test_resend_cooldown_and_hourly_limit(self):
        self.post('email-code', email='a@example.com', purpose='register')
        r = self.post('email-code', email='a@example.com', purpose='register')
        self.assertEqual(r.status_code, 429)
        self.assertGreater(r.get_json()['retry_after'], 0)
        for _ in range(service.HOURLY_LIMIT - 1):
            self.age_codes(61)
            self.assertEqual(self.post('email-code', email='a@example.com', purpose='register').status_code, 200)
        self.age_codes(61)
        self.assertEqual(self.post('email-code', email='a@example.com', purpose='register').status_code, 429)

    # ── 防枚舉 ───────────────────────────────────────────────────────────
    def test_register_code_for_existing_member_sends_notice_not_code(self):
        self.make_member('old@example.com')
        r_existing = self.post('email-code', email='old@example.com', purpose='register')
        r_new = self.post('email-code', email='fresh@example.com', purpose='register')
        self.assertEqual(r_existing.get_json(), r_new.get_json())
        self.assertEqual(self.sent[0], ('old@example.com', 'already_member', None))

    def test_reset_code_for_unknown_email_sends_nothing_but_same_response(self):
        r_unknown = self.post('email-code', email='nobody@example.com', purpose='reset')
        self.make_member('old@example.com')
        r_known = self.post('email-code', email='old@example.com', purpose='reset')
        self.assertEqual(r_unknown.get_json(), r_known.get_json())
        self.assertEqual([s[0] for s in self.sent], ['old@example.com'])

    # ── 重設密碼 ─────────────────────────────────────────────────────────
    def test_password_reset_changes_password_and_marks_verified(self):
        user = self.make_member('old@example.com')
        self.assertFalse(service.is_email_verified(user.id, 'old@example.com'))
        self.post('email-code', email='old@example.com', purpose='reset')
        r = self.post('password-reset', email='old@example.com', code=self.last_code(), password='NewSecret456')
        self.assertEqual(r.status_code, 200, r.get_json())
        db.session.refresh(user)
        self.assertTrue(user.check_password('NewSecret456'))
        self.assertTrue(service.is_email_verified(user.id, 'old@example.com'))

    def test_register_code_cannot_be_used_for_reset(self):
        self.make_member('old@example.com')
        service.issue_code('old@example.com', 'register')  # 不同用途的碼
        r = self.post('password-reset', email='old@example.com', code='123456', password='NewSecret456')
        self.assertEqual(r.status_code, 400)

    # ── 登入後驗證（舊入口建立、未驗證的帳號）───────────────────────────
    def test_logged_in_member_can_verify_email(self):
        user = self.make_member('old@example.com')
        self.post('email-code', email='old@example.com', purpose='reset')
        self.post('password-reset', email='old@example.com', code=self.last_code(), password='NewSecret456')
        MemberEmailVerification.query.delete()
        db.session.commit()
        self.assertFalse(self.client.get('/api/v1/member/verification').get_json()['email_verified'])

        r = self.post('email-code', purpose='verify')
        self.assertEqual(r.status_code, 200, r.get_json())
        r = self.post('verify-email', code=self.last_code())
        self.assertEqual(r.status_code, 200, r.get_json())
        self.assertTrue(service.is_email_verified(user.id, 'old@example.com'))

    def test_verify_requires_login(self):
        self.assertEqual(self.post('email-code', purpose='verify').status_code, 401)
        self.assertEqual(self.post('verify-email', code='123456').status_code, 401)

    def test_changed_email_is_not_verified(self):
        user = self.make_member('old@example.com')
        service.mark_verified(user.id, 'old@example.com')
        db.session.commit()
        self.assertFalse(service.is_email_verified(user.id, 'other@example.com'))


if __name__ == '__main__':
    unittest.main()
