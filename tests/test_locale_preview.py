"""語言上線：公開語言設定、語言預覽通行證（簽發／驗證／過期／停用／權限）。In-memory SQLite。"""
import time
import unittest
from unittest.mock import patch

from flask import Flask
from flask_jwt_extended import JWTManager, create_access_token
from sqlalchemy import BigInteger, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles

from core.backend_engine.blueprints.api import bp as api_bp
from core.backend_engine.factory import cache, db, limiter
from core.backend_engine.models import Setting, User
from core.backend_engine.services.rbac import RBACService


@compiles(JSONB, 'sqlite')
def _jsonb_on_sqlite(type_, compiler, **kw):
    return 'JSON'


@compiles(BigInteger, 'sqlite')
def _bigint_on_sqlite(type_, compiler, **kw):
    return 'INTEGER'


SITE = ['zh-TW', 'zh-CN', 'en', 'ja', 'es', 'no', 'ko']


def _make_app():
    app = Flask(__name__)
    app.config.update(SQLALCHEMY_DATABASE_URI='sqlite://', RATELIMIT_ENABLED=False, TESTING=True,
                      SECRET_KEY='test-only', JWT_SECRET_KEY='test-only-jwt-secret-key-32bytes!',
                      JWT_TOKEN_LOCATION=['headers'], CACHE_TYPE='NullCache')
    JWTManager(app)
    db.init_app(app)
    limiter.init_app(app)
    cache.init_app(app)
    app.register_blueprint(api_bp, url_prefix='/api/v1')
    return app


class LocalePreviewTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = _make_app()

    def setUp(self):
        self.ctx = self.app.app_context()
        self.ctx.push()
        with db.engine.begin() as conn:
            attached = conn.execute(text('PRAGMA database_list')).scalars(1).all()
            for schema in ('blog', 'account'):
                if schema not in attached:
                    conn.execute(text(f"ATTACH DATABASE ':memory:' AS {schema}"))
        self.tables = [User.__table__, Setting.__table__]
        for t in self.tables:
            t.create(db.engine)
        self.perms = {'contents.update', 'settings.update'}
        p = patch.object(RBACService, 'get_user_permissions', side_effect=lambda uid: self.perms)
        p.start()
        self.addCleanup(p.stop)
        self.user = User(username='editor', email='editor@example.com', role='admin', is_active=True)
        self.user.set_password('Secret123')
        db.session.add(self.user)
        db.session.commit()
        self.client = self.app.test_client()

    def tearDown(self):
        db.session.remove()
        for t in reversed(self.tables):
            t.drop(db.engine)
        self.ctx.pop()

    def auth(self):
        return {'Authorization': f'Bearer {create_access_token(identity=str(self.user.id))}'}

    def put_settings(self, **extra):
        body = {'enabled': True, 'default_language': 'zh-TW', 'languages': SITE, 'language_names': {}, **extra}
        return self.client.put('/api/v1/settings/i18n', json=body, headers=self.auth())

    def settings(self):
        return self.client.get('/api/v1/settings/i18n').get_json()

    def verify(self, token):
        return self.client.get('/api/v1/locale-preview/verify', query_string={'token': token})

    # ---- 公開語言 ----

    def test_sites_without_gate_keep_old_behaviour(self):
        self.assertEqual(self.settings()['public_languages'], ['zh-TW'])       # 多語言關閉
        self.put_settings()
        s = self.settings()
        self.assertEqual((s['public_languages'], s['locale_gate']), (SITE, False))

    def test_public_languages_are_a_subset_and_always_include_default(self):
        self.assertEqual(self.put_settings(public_languages=['en', 'fr']).status_code, 200)
        s = self.settings()
        self.assertEqual((s['languages'], s['public_languages'], s['locale_gate']), (SITE, ['zh-TW', 'en'], True))
        self.assertEqual(self.put_settings(public_languages='en').status_code, 400)

    # ---- 通行證 ----

    def test_staff_pass_verifies_for_all_languages(self):
        res = self.client.post('/api/v1/locale-preview/pass', headers=self.auth())
        self.assertEqual(res.status_code, 200)
        body = self.verify(res.get_json()['token']).get_json()
        self.assertEqual((body['ok'], body['kind'], body['languages']), (True, 'staff', None))

    def test_pass_requires_login_and_editing_permission(self):
        self.assertEqual(self.client.post('/api/v1/locale-preview/pass').status_code, 401)
        self.perms = {'contents.read'}
        self.assertEqual(self.client.post('/api/v1/locale-preview/pass', headers=self.auth()).status_code, 403)

    def test_invite_is_limited_to_site_languages_and_days(self):
        self.put_settings(public_languages=['zh-TW'])
        ok = self.client.post('/api/v1/locale-preview/invites', json={'languages': ['ja'], 'days': 3}, headers=self.auth())
        self.assertEqual(ok.status_code, 200)
        self.assertEqual(self.verify(ok.get_json()['token']).get_json()['languages'], ['ja'])
        for bad in [{'languages': ['fr'], 'days': 3}, {'languages': [], 'days': 3},
                    {'languages': ['ja'], 'days': 30}, {'languages': ['ja'], 'days': '3'}]:
            with self.subTest(bad=bad):
                self.assertEqual(self.client.post('/api/v1/locale-preview/invites', json=bad, headers=self.auth()).status_code, 400)
        self.perms = {'contents.update'}
        self.assertEqual(self.client.post('/api/v1/locale-preview/invites', json={'languages': ['ja'], 'days': 3},
                                          headers=self.auth()).status_code, 403)

    def test_tampered_expired_and_revoked_passes_fail(self):
        token = self.client.post('/api/v1/locale-preview/pass', headers=self.auth()).get_json()['token']
        self.assertEqual(self.verify(token + 'x').status_code, 404)
        self.assertEqual(self.verify('').status_code, 404)
        with patch('core.backend_engine.blueprints.api.locale_preview.time.time', return_value=time.time() + 13 * 3600):
            self.assertEqual(self.verify(token).status_code, 404)
        self.assertEqual(self.verify(token).status_code, 200)
        self.assertEqual(self.client.post('/api/v1/locale-preview/revoke-all', headers=self.auth()).status_code, 200)
        self.assertEqual(self.verify(token).status_code, 404)
        fresh = self.client.post('/api/v1/locale-preview/pass', headers=self.auth()).get_json()['token']
        self.assertEqual(self.verify(fresh).status_code, 200)


if __name__ == '__main__':
    unittest.main()
