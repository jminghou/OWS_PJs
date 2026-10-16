"""階段 0 第 7 步：真實使用者 IP、Turnstile、限流儲存設定、健康檢查降級、存命盤需登入。"""
import json
import unittest
from unittest.mock import patch

from flask import Flask, jsonify
from flask_jwt_extended import JWTManager

from core.backend_engine import security


def _app(**cfg):
    app = Flask(__name__)
    app.config.update(cfg)
    return app


class ClientIpTests(unittest.TestCase):
    def ip(self, headers=None, environ=None, **cfg):
        app = _app(**cfg)
        with app.test_request_context('/', headers=headers or {}, environ_base=environ or {'REMOTE_ADDR': '100.64.0.5'}):
            return security.client_ip()

    def test_default_uses_remote_addr(self):
        self.assertEqual(self.ip({'X-Forwarded-For': '1.1.1.1'}), '100.64.0.5')

    def test_one_hop_takes_rightmost_entry_added_by_edge(self):
        # 偽造的左段不會被採用
        self.assertEqual(self.ip({'X-Forwarded-For': '6.6.6.6, 203.0.113.7'}, CLIENT_IP_PROXY_HOPS=1), '203.0.113.7')

    def test_edge_secret_trusts_one_more_hop(self):
        h = {'X-Forwarded-For': '198.51.100.9, 76.76.21.21', 'X-OWS-Edge-Secret': 's3cret'}
        self.assertEqual(self.ip(h, CLIENT_IP_PROXY_HOPS=1, EDGE_PROXY_SECRET='s3cret'), '198.51.100.9')

    def test_wrong_edge_secret_is_ignored(self):
        h = {'X-Forwarded-For': '198.51.100.9, 76.76.21.21', 'X-OWS-Edge-Secret': 'guess'}
        self.assertEqual(self.ip(h, CLIENT_IP_PROXY_HOPS=1, EDGE_PROXY_SECRET='s3cret'), '76.76.21.21')

    def test_missing_header_falls_back(self):
        self.assertEqual(self.ip({}, CLIENT_IP_PROXY_HOPS=1), '100.64.0.5')


class _Resp:
    def __init__(self, body):
        self.body = body

    def read(self):
        return json.dumps(self.body).encode()

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


class TurnstileTests(unittest.TestCase):
    def client(self, **cfg):
        app = _app(**cfg)

        @app.route('/form', methods=['POST'])
        @security.require_turnstile
        def form():
            return jsonify({'success': True})
        return app.test_client()

    def test_skipped_without_secret(self):
        with patch('urllib.request.urlopen') as urlopen:
            self.assertEqual(self.client().post('/form', json={}).status_code, 200)
        urlopen.assert_not_called()

    def test_missing_token_rejected(self):
        r = self.client(TURNSTILE_SECRET_KEY='k').post('/form', json={})
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.get_json()['errors'], {'turnstile': 'failed'})

    def test_valid_token_passes_and_sends_secret(self):
        with patch('urllib.request.urlopen', return_value=_Resp({'success': True})) as urlopen:
            r = self.client(TURNSTILE_SECRET_KEY='k').post('/form', json={}, headers={'X-Turnstile-Token': 'tok'})
        self.assertEqual(r.status_code, 200)
        sent = urlopen.call_args[0][0].data.decode()
        self.assertIn('secret=k', sent)
        self.assertIn('response=tok', sent)

    def test_invalid_token_rejected(self):
        with patch('urllib.request.urlopen', return_value=_Resp({'success': False, 'error-codes': ['invalid-input-response']})):
            r = self.client(TURNSTILE_SECRET_KEY='k').post('/form', json={'turnstile_token': 'bad'})
        self.assertEqual(r.status_code, 400)

    def test_verify_service_down_fails_closed(self):
        import urllib.error
        with patch('urllib.request.urlopen', side_effect=urllib.error.URLError('down')):
            r = self.client(TURNSTILE_SECRET_KEY='k').post('/form', json={}, headers={'X-Turnstile-Token': 'tok'})
        self.assertEqual(r.status_code, 400)


class RateLimiterStorageTests(unittest.TestCase):
    def test_redis_url_set_before_init(self):
        from core.backend_engine import factory
        app = _app(REDIS_URL='redis://example:6379/0', REDIS_AVAILABLE=True)
        with patch.object(factory.limiter, 'init_app') as init_app:
            factory._configure_rate_limiter(app)
        init_app.assert_called_once()
        self.assertEqual(app.config['RATELIMIT_STORAGE_URI'], 'redis://example:6379/0')
        self.assertTrue(app.config['RATELIMIT_IN_MEMORY_FALLBACK_ENABLED'])

    def test_no_redis_keeps_memory_storage(self):
        from core.backend_engine import factory
        app = _app(REDIS_URL='redis://example:6379/0', REDIS_AVAILABLE=False)
        with patch.object(factory.limiter, 'init_app'):
            factory._configure_rate_limiter(app)
        self.assertNotIn('RATELIMIT_STORAGE_URI', app.config)


class HealthTests(unittest.TestCase):
    def client(self, failed, **cfg):
        from core.backend_engine.blueprints.main import bp
        app = _app(**cfg)
        app.register_blueprint(bp)
        if failed:
            app.extensions['ows_failed_modules'] = ['x.y: ImportError']
        return app.test_client()

    def test_healthy(self):
        self.assertEqual(self.client(False, HEALTH_FAIL_ON_MODULE_ERROR=True).get('/health').status_code, 200)

    def test_degraded_when_module_failed_and_enabled(self):
        r = self.client(True, HEALTH_FAIL_ON_MODULE_ERROR=True).get('/health')
        self.assertEqual((r.status_code, r.get_json()['status']), (503, 'degraded'))

    def test_failure_ignored_when_not_enabled(self):
        self.assertEqual(self.client(True).get('/health').status_code, 200)


class SaveAndRegisterTests(unittest.TestCase):
    def test_requires_login(self):
        from sites.Polaris_Parent.backend.extensions import astrology
        app = _app(JWT_SECRET_KEY='t' * 32, JWT_TOKEN_LOCATION=['headers'])
        JWTManager(app)
        app.register_blueprint(astrology.bp, url_prefix='/api/v1/astrology')
        with patch.object(astrology, '_PUBLIC_SERVICE_TOKEN', 'x'), \
                patch.object(astrology, '_ziwei_save_and_register') as ziwei:
            r = app.test_client().post('/api/v1/astrology/save-and-register', json={
                'year': 2000, 'month': 1, 'day': 1, 'hour': 1, 'gender': '男', 'email': 'victim@example.com'})
        self.assertEqual(r.status_code, 401)
        ziwei.assert_not_called()


if __name__ == '__main__':
    unittest.main()
