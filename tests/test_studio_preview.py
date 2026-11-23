"""Studio 網站預覽連結：工作草稿套正式版型、不改正式文章、撤銷／過期／封存即失效。In-memory SQLite。"""
import time
import unittest
from unittest.mock import patch

from flask import Flask
from flask_jwt_extended import JWTManager, create_access_token
from sqlalchemy import BigInteger, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles

from core.backend_engine.blueprints.api import contents as core_contents
from core.backend_engine.factory import db, limiter
from core.backend_engine.models import Category, Content, Setting, Tag, User, content_tags
from core.backend_engine.services.rbac import RBACService
from packages.studio import api as _studio_api  # noqa: F401  註冊路由
from packages.studio.blueprint import studio_bp
from packages.studio.models import StudioDocument, StudioProject


@compiles(JSONB, 'sqlite')
def _jsonb_on_sqlite(type_, compiler, **kw):
    return 'JSON'


@compiles(BigInteger, 'sqlite')
def _bigint_on_sqlite(type_, compiler, **kw):
    return 'INTEGER'


def _make_app():
    app = Flask(__name__)
    app.config.update(SQLALCHEMY_DATABASE_URI='sqlite://', RATELIMIT_ENABLED=False, TESTING=True,
                      SECRET_KEY='test-only', JWT_SECRET_KEY='test-only-jwt-secret-key-32bytes!',
                      JWT_TOKEN_LOCATION=['headers'])
    JWTManager(app)
    db.init_app(app)
    limiter.init_app(app)
    app.register_blueprint(studio_bp, url_prefix='/api/v1/studio')
    return app


class StudioPreviewTests(unittest.TestCase):
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
        self.tables = [User.__table__, Setting.__table__, Category.__table__, Tag.__table__, Content.__table__, content_tags,
                       StudioProject.__table__, StudioDocument.__table__]
        for t in self.tables:
            t.create(db.engine)
        for p in (patch.object(RBACService, 'get_user_permissions', return_value={'studio.write', 'contents.update'}),
                  patch.object(core_contents, 'is_i18n_enabled', return_value=False)):
            p.start()
            self.addCleanup(p.stop)

        self.editor = User(username='editor', email='editor@example.com', role='admin', is_active=True)
        self.editor.set_password('Secret123')
        old_cat, new_cat = Category(code='old', slugs={'zh-TW': '舊分類'}), Category(code='new', slugs={'zh-TW': '新分類'})
        self.tag = Tag(code='kids', slugs={'zh-TW': '孩子'})
        db.session.add_all([self.editor, old_cat, new_cat, self.tag])
        db.session.flush()
        self.content = Content(title='正式標題', content='正式內文', slug='live-post', status='published',
                               author_id=self.editor.id, category_id=old_cat.id, language='zh-TW')
        project = StudioProject(title='專案', slug='project')
        db.session.add_all([self.content, project])
        db.session.flush()
        self.doc = StudioDocument(project_id=project.id, platform='blog', title='草稿標題', body='<p>草稿內文</p>',
                                  content_id=self.content.id, stage='write',
                                  attributes={'article_settings': {'summary': '草稿摘要', 'category_id': new_cat.id,
                                                                   'tag_ids': [self.tag.id]}})
        db.session.add(self.doc)
        db.session.commit()
        self.client = self.app.test_client()

    def tearDown(self):
        db.session.remove()
        for t in reversed(self.tables):
            t.drop(db.engine)
        self.ctx.pop()

    def auth(self):
        return {'Authorization': f'Bearer {create_access_token(identity=str(self.editor.id))}'}

    def link(self, doc=None):
        res = self.client.post(f'/api/v1/studio/documents/{(doc or self.doc).id}/preview-link', headers=self.auth())
        self.assertEqual(res.status_code, 200, res.get_json())
        return res.get_json()['token']

    def add_japanese(self):
        content = Content(title='日本語の記事', content='本文', slug='live-post-ja', status='draft',
                          author_id=self.editor.id, language='ja', original_id=self.content.id)
        db.session.add(content)
        db.session.flush()
        doc = StudioDocument(project_id=self.doc.project_id, platform='blog', title='日本語の下書き', body='<p>下書き</p>',
                             content_id=content.id, stage='write', language='ja', work_id=self.doc.work_id)
        db.session.add(doc)
        db.session.commit()
        return doc

    def view(self, token):
        return self.client.get(f'/api/v1/studio/preview/{token}')

    def test_preview_shows_working_draft_without_touching_live_article(self):
        res = self.view(self.link())
        self.assertEqual(res.status_code, 200)
        self.assertIn('noindex', res.headers['X-Robots-Tag'])
        self.assertIn('no-store', res.headers['Cache-Control'])
        data = res.get_json()
        self.assertEqual((data['title'], data['content'], data['summary']), ('草稿標題', '<p>草稿內文</p>', '草稿摘要'))
        self.assertEqual(data['category']['name'], '新分類')
        self.assertEqual([t['name'] for t in data['tags']], ['孩子'])
        self.assertEqual(data['preview']['website_status'], 'published')

        db.session.expire_all()
        live = db.session.get(Content, self.content.id)
        self.assertEqual((live.title, live.content, live.summary, live.category.code, live.tags),
                         ('正式標題', '正式內文', None, 'old', []))

    def test_link_requires_login(self):
        res = self.client.post(f'/api/v1/studio/documents/{self.doc.id}/preview-link')
        self.assertEqual(res.status_code, 401)

    def test_revoked_tampered_expired_and_archived_links_are_not_found(self):
        token = self.link()
        self.assertEqual(self.view(token + 'x').status_code, 404)
        with patch('itsdangerous.timed.time.time', return_value=time.time() + 8 * 24 * 3600):
            self.assertEqual(self.view(token).status_code, 404)

        self.client.delete(f'/api/v1/studio/documents/{self.doc.id}/preview-link', headers=self.auth())
        self.assertEqual(self.view(token).status_code, 404)

        fresh = self.link()
        self.assertEqual(self.view(fresh).status_code, 200)
        db.session.get(StudioDocument, self.doc.id).stage = 'archived'
        db.session.commit()
        self.assertEqual(self.view(fresh).status_code, 404)

    def test_language_versions_get_prefixed_paths_and_switch_links(self):
        ja = self.add_japanese()
        res = self.client.post(f'/api/v1/studio/documents/{ja.id}/preview-link', headers=self.auth()).get_json()
        self.assertTrue(res['path'].startswith('/ja/preview/'))
        zh = self.client.post(f'/api/v1/studio/documents/{self.doc.id}/preview-link', headers=self.auth()).get_json()
        self.assertTrue(zh['path'].startswith('/preview/'))

        data = self.view(res['token']).get_json()
        self.assertEqual((data['title'], data['preview']['language']), ('日本語の下書き', 'ja'))
        versions = {v['language']: v['path'] for v in data['preview']['versions']}
        self.assertEqual(set(versions), {'zh-TW', 'ja'})
        zh_token = versions['zh-TW'].rsplit('/', 1)[1]
        self.assertEqual(self.view(zh_token).get_json()['title'], '草稿標題')

    def test_revoking_any_language_revokes_the_whole_article(self):
        ja = self.add_japanese()
        ja_token, zh_token = self.link(ja), self.link()
        self.client.delete(f'/api/v1/studio/documents/{self.doc.id}/preview-link', headers=self.auth())
        self.assertEqual(self.view(ja_token).status_code, 404)
        self.assertEqual(self.view(zh_token).status_code, 404)

    def test_new_links_reuse_nonce_so_earlier_links_keep_working(self):
        first = self.link()
        self.link()
        self.assertEqual(self.view(first).status_code, 200)


if __name__ == '__main__':
    unittest.main()
