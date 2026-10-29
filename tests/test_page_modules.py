"""產品管理「模組管理」（2026-10-28）：商品頁內容區塊改成可共用的模組，商品依位置引用，一種語言一筆。"""

from unittest.mock import patch

from core.backend_engine.factory import cache, db
from core.backend_engine.models import Category, Tag
from core.backend_engine.services.rbac import RBACService
from packages.commerce.models import Product, product_tags
from sites.Polaris_Parent.backend.models import PageModule

from tests.test_report_orders import _Base, _make_app

PERMS = {'products.read', 'products.create', 'products.update', 'products.delete', 'page_modules.manage'}


class PageModuleTests(_Base):
    @classmethod
    def setUpClass(cls):
        cls.app = _make_app()
        cache.init_app(cls.app, config={'CACHE_TYPE': 'NullCache'})
        import packages.commerce.api.orders, packages.commerce.api.payment_methods, packages.commerce.api.products  # noqa: E401,F401
        from packages.commerce.blueprint import commerce_bp
        from sites.Polaris_Parent.backend.extensions import page_modules
        cls.app.register_blueprint(commerce_bp, url_prefix='/api/v1', name='commerce_page_modules')
        cls.app.register_blueprint(page_modules.bp, url_prefix='/api/v1')

    def setUp(self):
        super().setUp()
        for t in (Category.__table__, Tag.__table__, product_tags, PageModule.__table__):
            t.create(db.engine, checkfirst=True)
            self.tables.append(t)
        self.admin = self.make_user('admin@example.test', verified=True)
        p = patch.object(RBACService, 'get_user_permissions',
                         side_effect=lambda uid: PERMS if int(uid) == self.admin.id else set())
        p.start()
        self.addCleanup(p.stop)
        self.product = Product.query.filter_by(product_id='natal-report-digital', language='zh-TW').one()

    def api(self, method, path, body=None):
        return getattr(self.client, method)(f'/api/v1/admin/page-modules{path}', json=body, headers=self.headers(self.admin))

    def products(self, method, path, body=None):
        return getattr(self.client, method)(f'/api/v1/admin/products{path}', json=body, headers=self.headers(self.admin))

    def create(self, type_='faq', name='常見問題（通用）', data=None):
        r = self.api('post', '', {'type': type_, 'name': name, 'data': data or {'items': [{'q': '問', 'a': '答'}]}})
        self.assertEqual(r.status_code, 201, r.get_json())
        return r.get_json()['module']

    def use(self, product, **refs):
        product.attributes = {**(product.attributes or {}), 'report_modules': refs}
        db.session.commit()

    def add_language(self, language='en', currency='USD'):
        r = self.products('post', '', {'copy_from': self.product.id, 'language': language, 'currency': currency})
        self.assertEqual(r.status_code, 201, r.get_json())
        p = db.session.get(Product, r.get_json()['id'])
        self.products('put', f'/{p.id}', {'price': 49, 'name': 'Natal Report', 'language': language})
        self.products('post', f'/{p.id}/translation-confirm')
        return p

    def test_create_generates_key_and_public_read(self):
        m = self.create()
        self.assertTrue(m['module_key'].startswith('faq-'))
        r = self.client.get(f"/api/v1/page-modules?keys={m['module_key']},missing&language=zh-TW")
        mods = r.get_json()['modules']
        self.assertEqual(list(mods), [m['module_key']])
        self.assertEqual(mods[m['module_key']]['data']['items'][0]['q'], '問')
        # 其他語言沒有版本：公開 API 不回（不會拿中文頂替）
        self.assertEqual(self.client.get(f"/api/v1/page-modules?keys={m['module_key']}&language=en").get_json()['modules'], {})

    def test_language_copy_needs_confirmation_before_activation(self):
        m = self.create()
        r = self.api('post', '', {'copy_from': m['id'], 'language': 'en'})
        self.assertEqual(r.status_code, 201, r.get_json())
        en = r.get_json()['module']
        self.assertEqual((en['module_key'], en['language'], en['is_active']), (m['module_key'], 'en', False))
        self.assertFalse(en['translation']['confirmed'])
        r = self.api('put', f"/{en['id']}", {'is_active': True})
        self.assertEqual(r.status_code, 400)
        self.assertEqual(self.api('post', f"/{en['id']}/translation-confirm").status_code, 200)
        self.assertEqual(self.api('put', f"/{en['id']}", {'is_active': True}).status_code, 200)
        # 同語言不能再建一份
        self.assertEqual(self.api('post', '', {'copy_from': m['id'], 'language': 'en'}).status_code, 409)

    def test_source_edit_marks_translation_stale(self):
        m = self.create()
        en = self.api('post', '', {'copy_from': m['id'], 'language': 'en'}).get_json()['module']
        self.api('post', f"/{en['id']}/translation-confirm")
        with patch('sites.Polaris_Parent.backend.extensions.page_modules._now_iso', return_value='2999-01-01T00:00:00'):
            self.api('put', f"/{m['id']}", {'data': {'items': [{'q': '新問題', 'a': '答'}]}})
        self.assertTrue(self.api('get', f"/{en['id']}").get_json()['module']['translation']['stale'])

    def test_duplicate_gets_new_key(self):
        m = self.create()
        r = self.api('post', '', {'duplicate_of': m['id'], 'name': '常見問題（精裝版）'})
        dup = r.get_json()['module']
        self.assertNotEqual(dup['module_key'], m['module_key'])
        self.assertEqual((dup['type'], dup['name'], dup['data']), ('faq', '常見問題（精裝版）', m['data']))

    def test_product_activation_blocked_without_module_language(self):
        m = self.create()
        en = self.add_language()
        self.use(en, faq=m['module_key'])
        r = self.products('post', f'/{en.id}/toggle-status')
        self.assertEqual(r.status_code, 400)
        self.assertTrue(any('還沒有英文版本' in p for p in r.get_json()['problems']), r.get_json())
        # 補上英文版但還沒啟用
        en_m = self.api('post', '', {'copy_from': m['id'], 'language': 'en'}).get_json()['module']
        r = self.products('post', f'/{en.id}/toggle-status')
        self.assertTrue(any('還沒啟用' in p for p in r.get_json()['problems']))
        self.api('post', f"/{en_m['id']}/translation-confirm")
        self.api('put', f"/{en_m['id']}", {'is_active': True})
        self.assertEqual(self.products('post', f'/{en.id}/toggle-status').status_code, 200)

    def test_catalog_page_required_once_created(self):
        faq = self.create()
        aud = self.create('audiences', '送禮對象', {'items': [{'label': '給自己', 'note': ''}]})
        r = self.api('post', '', {'type': 'catalog_page', 'name': '報告目錄頁',
                                  'data': {'title': '所有報告', 'audiences': aud['module_key'], 'faq': faq['module_key']}})
        self.assertEqual(r.status_code, 201, r.get_json())
        self.assertEqual(r.get_json()['module']['module_key'], 'report-catalog')
        en = self.add_language()
        self.use(en, faq=faq['module_key'])
        problems = self.products('post', f'/{en.id}/toggle-status').get_json()['problems']
        # FAQ、目錄頁、送禮對象都缺英文版（FAQ 同時被商品與目錄頁引用，只列一次）
        self.assertEqual(len(problems), 3, problems)

    def test_in_use_module_cannot_be_deactivated_or_deleted(self):
        m = self.create()
        self.use(self.product, faq=m['module_key'])
        r = self.api('put', f"/{m['id']}", {'is_active': False})
        self.assertEqual(r.status_code, 409)
        self.assertEqual(r.get_json()['used_by'][0]['product_id'], 'natal-report-digital')
        self.assertEqual(self.api('delete', f"/{m['id']}").status_code, 400)  # 要先停用
        # 商品停用後可以停用模組，但還被引用就不能刪
        self.product.is_active = False
        db.session.commit()
        self.assertEqual(self.api('put', f"/{m['id']}", {'is_active': False}).status_code, 200)
        self.assertEqual(self.api('delete', f"/{m['id']}").status_code, 409)
        self.use(self.product)
        self.assertEqual(self.api('delete', f"/{m['id']}").status_code, 200)

    def test_root_delete_requires_languages_removed_first(self):
        m = self.create()
        en = self.api('post', '', {'copy_from': m['id'], 'language': 'en'}).get_json()['module']
        self.api('put', f"/{m['id']}", {'is_active': False})
        self.assertEqual(self.api('delete', f"/{m['id']}").status_code, 400)
        self.assertEqual(self.api('delete', f"/{en['id']}").status_code, 200)
        self.assertEqual(self.api('delete', f"/{m['id']}").status_code, 200)

    def test_grouped_list_and_usage(self):
        m = self.create()
        self.api('post', '', {'copy_from': m['id'], 'language': 'en'})
        self.use(self.product, faq=m['module_key'])
        groups = self.api('get', '').get_json()['modules']
        self.assertEqual(len(groups), 1)
        g = groups[0]
        self.assertEqual([v['language'] for v in g['versions']], ['zh-TW', 'en'])
        self.assertEqual(g['used_by'][0]['slot'], 'faq')

    def test_bulk_import_links_languages_and_skips_existing(self):
        items = [
            {'module_key': 'natal-report-faq', 'type': 'faq', 'name': 'FAQ', 'language': 'en', 'data': {'items': []}},
            {'module_key': 'natal-report-faq', 'type': 'faq', 'name': '常見問題', 'language': 'zh-TW', 'data': {'items': []}},
        ]
        r = self.api('post', '/bulk', {'modules': items})
        self.assertEqual(len(r.get_json()['created']), 2, r.get_json())
        en = PageModule.query.filter_by(module_key='natal-report-faq', language='en').one()
        zh = PageModule.query.filter_by(module_key='natal-report-faq', language='zh-TW').one()
        self.assertEqual(en.original_id, zh.id)
        self.assertTrue(en.meta_data['translation']['confirmed'])
        r = self.api('post', '/bulk', {'modules': items})
        self.assertEqual((r.get_json()['created'], len(r.get_json()['skipped'])), ([], 2))
