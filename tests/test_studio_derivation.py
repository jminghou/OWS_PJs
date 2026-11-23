"""Studio 平台衍生：主體 → 社群版本的血緣、「主體已更新」提醒、指定主體的規則。In-memory SQLite。"""
import unittest
from unittest.mock import patch

from flask_jwt_extended import create_access_token
from sqlalchemy import BigInteger, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles

from core.backend_engine.blueprints.api import contents as core_contents
from core.backend_engine.factory import db
from core.backend_engine.models import Category, Content, Setting, Tag, User, content_tags
from core.backend_engine.services.rbac import RBACService
from packages.studio.models import (
    StudioCard, StudioCardRef, StudioDocument, StudioDocumentMedia, StudioProject, StudioPublishEvent,
    StudioPublishRequest, StudioRevision, StudioSource, StudioTag, StudioTagging,
)


@compiles(JSONB, 'sqlite')
def _jsonb_on_sqlite(type_, compiler, **kw):
    return 'JSON'


@compiles(BigInteger, 'sqlite')
def _bigint_on_sqlite(type_, compiler, **kw):
    return 'INTEGER'
from tests.test_studio_preview import _make_app


class StudioDerivationTests(unittest.TestCase):
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
                       StudioProject.__table__, StudioDocument.__table__, StudioRevision.__table__, StudioCard.__table__,
                       StudioCardRef.__table__, StudioSource.__table__, StudioTag.__table__, StudioTagging.__table__,
                       StudioDocumentMedia.__table__, StudioPublishRequest.__table__, StudioPublishEvent.__table__]
        for t in self.tables:
            t.create(db.engine)
        for p in (patch.object(RBACService, 'get_user_permissions', return_value={'studio.write', 'contents.update'}),
                  patch.object(core_contents, 'is_i18n_enabled', return_value=False),
                  patch('packages.studio.api.languages.language_options', return_value={
                      'default_language': 'zh-TW', 'languages': ['zh-TW', 'en'], 'language_names': {}, 'enabled': True})):
            p.start()
            self.addCleanup(p.stop)
        self.editor = User(username='editor', email='editor@example.com', role='admin', is_active=True)
        self.editor.set_password('Secret123')
        db.session.add(self.editor)
        db.session.flush()
        self.project = StudioProject(title='專案', slug='project')
        self.other = StudioProject(title='別的專案', slug='other')
        db.session.add_all([self.project, self.other])
        db.session.commit()
        self.client = self.app.test_client()

    def tearDown(self):
        db.session.remove()
        for t in reversed(self.tables):
            t.drop(db.engine)
        self.ctx.pop()

    def auth(self):
        return {'Authorization': f'Bearer {create_access_token(identity=str(self.editor.id))}'}

    def create(self, platform, project=None, **extra):
        res = self.client.post(f'/api/v1/studio/projects/{(project or self.project).id}/documents',
                               json={'platform': platform, 'title': f'{platform} 版', **extra}, headers=self.auth())
        self.assertEqual(res.status_code, 201, res.get_json())
        return res.get_json()['document']

    def project_docs(self):
        res = self.client.get(f'/api/v1/studio/projects/{self.project.id}', headers=self.auth())
        self.assertEqual(res.status_code, 200, res.get_json())
        return {d['id']: d for d in res.get_json()['documents']}

    def test_social_version_attaches_to_the_only_blog_main_and_flags_main_edits(self):
        blog = self.create('blog')
        fb = self.create('facebook')
        self.assertEqual(fb['derived_from_id'], blog['id'])
        self.assertEqual(fb['main_document']['id'], blog['id'])
        self.assertFalse(fb['derived_changed'])

        # 主體看得到自己散出去的版本
        main = self.client.get(f'/api/v1/studio/documents/{blog["id"]}', headers=self.auth()).get_json()
        self.assertEqual([d['id'] for d in main['derived_documents']], [fb['id']])

        # 主體改了 → 衍生版本標示過期
        res = self.client.post(f'/api/v1/studio/documents/{blog["id"]}/autosave', json={'body': '<p>新段落</p>'}, headers=self.auth())
        self.assertEqual(res.status_code, 200, res.get_json())
        self.assertTrue(self.project_docs()[fb['id']]['derived_changed'])

        res = self.client.post(f'/api/v1/studio/documents/{fb["id"]}/derived-reviewed', headers=self.auth())
        self.assertEqual(res.status_code, 200, res.get_json())
        self.assertFalse(self.project_docs()[fb['id']]['derived_changed'])

    def test_translation_of_a_derived_version_traces_back_to_the_main(self):
        blog = self.create('blog')
        ig = self.create('instagram')
        # 翻譯端點用 Postgres advisory lock，SQLite 跑不了；直接建出翻譯端點會建的那筆資料
        db.session.add(StudioDocument(project_id=self.project.id, platform='instagram', work_id=ig['work_id'],
                                      language='en', title='IG en', body='', translation_source_id=ig['id']))
        db.session.commit()
        en_id = StudioDocument.query.filter_by(work_id=ig['work_id'], language='en').one().id
        en = self.client.get(f'/api/v1/studio/documents/{en_id}', headers=self.auth()).get_json()
        self.assertIsNone(en['derived_from_id'])
        self.assertEqual(en['main_document']['id'], blog['id'])
        self.assertEqual(self.project_docs()[en['id']]['main_id'], blog['id'])
        main = self.client.get(f'/api/v1/studio/documents/{blog["id"]}', headers=self.auth()).get_json()
        self.assertEqual(sorted(d['id'] for d in main['derived_documents']), sorted([ig['id'], en['id']]))

    def test_explicit_null_keeps_a_version_independent(self):
        self.create('blog')
        threads = self.create('threads', derived_from_id=None)
        self.assertIsNone(threads['derived_from_id'])
        self.assertIsNone(threads['main_document'])

    def test_main_rules(self):
        blog = self.create('blog')
        fb = self.create('facebook')
        far = self.create('blog', project=self.other)

        def set_main(doc, main_id):
            return self.client.put(f'/api/v1/studio/documents/{doc["id"]}/derivation',
                                   json={'derived_from_id': main_id}, headers=self.auth())

        self.assertEqual(set_main(fb, far['id']).status_code, 422)       # 跨專案
        self.assertEqual(set_main(blog, fb['id']).status_code, 422)      # 衍生版本不能當主體
        self.assertEqual(set_main(blog, blog['id']).status_code, 422)    # 不能衍生自自己
        nl = self.create('newsletter', derived_from_id=None)
        self.assertEqual(set_main(blog, nl['id']).status_code, 422)      # 已有衍生版本的主體不能改掛別人

        res = set_main(fb, None)                                         # 解除 → 獨立
        self.assertEqual(res.status_code, 200, res.get_json())
        self.assertIsNone(res.get_json()['document']['derived_from_id'])
        res = set_main(fb, blog['id'])
        self.assertEqual(res.get_json()['document']['derived_from_id'], blog['id'])

    def test_deleting_the_main_leaves_derived_versions_independent(self):
        main = StudioDocument(project_id=self.project.id, platform='newsletter', title='主體', body='x')
        db.session.add(main)
        db.session.commit()
        fb = self.create('facebook', derived_from_id=main.id)
        self.assertEqual(fb['derived_from_id'], main.id)
        res = self.client.delete(f'/api/v1/studio/documents/{main.id}', headers=self.auth())
        self.assertEqual(res.status_code, 200, res.get_json())
        db.session.expire_all()
        # SQLite 測試庫沒開 FK，正式 Postgres 由 ON DELETE SET NULL 處理；這裡確認介面不會因主體消失而壞掉
        res = self.client.get(f'/api/v1/studio/documents/{fb["id"]}', headers=self.auth())
        self.assertEqual(res.status_code, 200, res.get_json())
        self.assertIsNone(res.get_json()['main_document'])


if __name__ == '__main__':
    unittest.main()
