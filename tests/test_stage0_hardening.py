"""階段 0 收斂：Resend 寄信、私有儲存不准在正式站退回容器磁碟、Polaris 關閉通用訂單路由。"""
import json
import os
import tempfile
import unittest
from unittest.mock import patch

from flask import Flask
from flask_mail import Message

from core.backend_engine.factory import mail
from core.backend_engine.mailer import MailSendError
from sites.Polaris_Parent.backend.extensions.report_orders import private_storage


class _FakeResponse:
    def __init__(self, body=b'{"id": "email_1"}'):
        self.body = body

    def read(self):
        return self.body

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


class ResendMailTests(unittest.TestCase):
    def setUp(self):
        self.app = Flask(__name__)
        self.app.config.update(MAIL_DEFAULT_SENDER='親紫之間 <noreply@polaris-parent.com>', MAIL_SUPPRESS_SEND=False)
        mail.init_app(self.app)
        self.ctx = self.app.app_context()
        self.ctx.push()
        self.addCleanup(self.ctx.pop)

    def test_uses_resend_api_when_key_set(self):
        self.app.config['RESEND_API_KEY'] = 're_test'
        with patch('urllib.request.urlopen', return_value=_FakeResponse()) as urlopen:
            mail.send(Message(subject='驗證碼', recipients=['a@example.test'], body='123456'))
        req = urlopen.call_args[0][0]
        self.assertEqual(req.full_url, 'https://api.resend.com/emails')
        self.assertEqual(req.get_header('Authorization'), 'Bearer re_test')
        payload = json.loads(req.data)
        self.assertEqual(payload, {'from': '親紫之間 <noreply@polaris-parent.com>', 'to': ['a@example.test'],
                                   'subject': '驗證碼', 'text': '123456'})

    def test_http_error_raises_so_callers_log_failure(self):
        import urllib.error
        self.app.config['RESEND_API_KEY'] = 're_test'
        err = urllib.error.HTTPError('https://api.resend.com/emails', 403, 'Forbidden', {}, None)
        err.read = lambda: b'{"message":"domain not verified"}'
        with patch('urllib.request.urlopen', side_effect=err):
            with self.assertRaises(MailSendError) as ctx:
                mail.send(Message(subject='x', recipients=['a@example.test'], body='y'))
        self.assertIn('403', str(ctx.exception))

    def test_falls_back_to_smtp_without_key(self):
        self.app.config['RESEND_API_KEY'] = None
        with patch('flask_mail.Mail.send') as smtp_send, patch('urllib.request.urlopen') as urlopen:
            mail.send(Message(subject='x', recipients=['a@example.test'], body='y'))
        smtp_send.assert_called_once()
        urlopen.assert_not_called()


class PrivateStorageGuardTests(unittest.TestCase):
    def _app(self, **cfg):
        app = Flask(__name__, instance_path=tempfile.mkdtemp())
        app.config.update(cfg)
        return app

    def test_production_without_bucket_refuses_local_disk(self):
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop('PRIVATE_UPLOAD_DIR', None)
            os.environ.pop('PRIVATE_GCS_BUCKET_NAME', None)
            with self._app(IS_DEV_MODE=False, TESTING=False).app_context():
                with self.assertRaises(private_storage.StorageError):
                    private_storage.save('reports/x.pdf', b'%PDF-', 'application/pdf')

    def test_dev_mode_still_uses_local_disk(self):
        with self._app(IS_DEV_MODE=True).app_context():
            size, _ = private_storage.save('reports/x.pdf', b'%PDF-', 'application/pdf')
            self.assertEqual(size, 5)
            self.assertEqual(private_storage.read('reports/x.pdf'), b'%PDF-')

    def test_explicit_dir_allowed_in_production(self):
        with tempfile.TemporaryDirectory() as tmp:
            with self._app(IS_DEV_MODE=False, PRIVATE_UPLOAD_DIR=tmp).app_context():
                private_storage.save('a/b.bin', b'xy', 'application/octet-stream')
                self.assertTrue(os.path.isfile(os.path.join(tmp, 'a', 'b.bin')))


class GenericOrdersSwitchTests(unittest.TestCase):
    def _client(self, enabled):
        from flask_jwt_extended import JWTManager
        from packages.commerce.blueprint import commerce_bp
        import packages.commerce.api.orders  # noqa: F401  註冊路由

        app = Flask(__name__)
        app.config.update(JWT_SECRET_KEY='t' * 32, IS_DEV_MODE=True, COMMERCE_GENERIC_ORDERS_ENABLED=enabled)
        JWTManager(app)
        app.register_blueprint(commerce_bp, url_prefix='/api/v1', name=f'commerce_{enabled}')
        return app.test_client()

    def test_disabled_returns_404(self):
        c = self._client(False)
        self.assertEqual(c.post('/api/v1/orders', json={}).status_code, 404)
        self.assertEqual(c.get('/api/v1/orders').status_code, 404)
        self.assertEqual(c.post('/api/v1/webhooks/mock-payment', json={}).status_code, 404)

    def test_enabled_keeps_auth_requirement(self):
        c = self._client(True)
        self.assertEqual(c.post('/api/v1/orders', json={}).status_code, 401)

    def test_polaris_config_disables_generic_orders(self):
        from sites.Polaris_Parent.backend.config import Config
        self.assertFalse(Config.COMMERCE_GENERIC_ORDERS_ENABLED)


if __name__ == '__main__':
    unittest.main()


class ConsultTimeZoneTests(unittest.TestCase):
    """解讀時間的解析與信件顯示不能依伺服器時區（Railway 與 CI 是 UTC、本機是台灣）。"""

    def test_parse_normalises_to_utc_and_naive_means_taiwan(self):
        from datetime import datetime, timezone
        from sites.Polaris_Parent.backend.extensions.report_orders.physical import _parse_dt
        expected = datetime(2026, 10, 20, 6, 0, tzinfo=timezone.utc)
        for value in ('2026-10-20T14:00:00+08:00', '2026-10-20T06:00:00Z', '2026-10-20T14:00'):
            self.assertEqual(_parse_dt(value), expected, value)
        self.assertIsNone(_parse_dt('not a date'))

    def test_format_shows_taiwan_time_for_aware_and_naive_utc(self):
        from datetime import datetime, timezone
        from sites.Polaris_Parent.backend.extensions.report_orders.notify import _fmt_time
        self.assertEqual(_fmt_time(datetime(2026, 10, 20, 6, 0, tzinfo=timezone.utc)), '2026-10-20 14:00')
        self.assertEqual(_fmt_time(datetime(2026, 10, 20, 6, 0)), '2026-10-20 14:00')   # SQLite 讀回的無時區值
        self.assertEqual(_fmt_time(None), '-')
