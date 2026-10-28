"""商品多語言（2026-10-28）：一種語言一筆獨立商品，同一個產品 ID 以語言區分。"""

from unittest.mock import patch

from core.backend_engine.factory import cache, db
from core.backend_engine.models import Category, Tag
from core.backend_engine.services.rbac import RBACService
from packages.commerce.models import Product, product_tags

from tests.test_report_orders import _Base, _make_app

PERMS = {'products.read', 'products.create', 'products.update', 'products.delete'}


class ProductLanguageTests(_Base):
    @classmethod
    def setUpClass(cls):
        cls.app = _make_app()
        cache.init_app(cls.app, config={'CACHE_TYPE': 'NullCache'})
        import packages.commerce.api.orders, packages.commerce.api.payment_methods, packages.commerce.api.products  # noqa: E401,F401  先載入所有路由，之後別的測試再註冊同一個 blueprint 才不會出錯
        from packages.commerce.blueprint import commerce_bp
        cls.app.register_blueprint(commerce_bp, url_prefix='/api/v1', name='commerce_product_languages')

    def setUp(self):
        super().setUp()
        for t in (Category.__table__, Tag.__table__, product_tags):
            t.create(db.engine, checkfirst=True)
            self.tables.append(t)
        self.admin = self.make_user('admin@example.test', verified=True)
        p = patch.object(RBACService, 'get_user_permissions',
                         side_effect=lambda uid: PERMS if int(uid) == self.admin.id else set())
        p.start()
        self.addCleanup(p.stop)
        self.root = Product.query.filter_by(product_id='natal-report-digital', language='zh-TW').one()
        self.root.attributes = {'report_display': {'tagline': '中文標語'}}
        db.session.commit()

    def api(self, method, path, body=None):
        return getattr(self.client, method)(f'/api/v1/admin/products{path}', json=body, headers=self.headers(self.admin))

    def copy_to(self, language, **over):
        r = self.api('post', '', {'copy_from': self.root.id, 'language': language, **over})
        self.assertEqual(r.status_code, 201, r.get_json())
        return db.session.get(Product, r.get_json()['id'])

    def test_copy_creates_independent_inactive_draft(self):
        en = self.copy_to('en', currency='USD')
        self.assertEqual(en.product_id, 'natal-report-digital')
        self.assertEqual(en.language, 'en')
        self.assertFalse(en.is_active)
        self.assertEqual(en.original_id, self.root.id)
        self.assertEqual(en.currency, 'USD')
        self.assertEqual(en.price, 0)
        self.assertEqual(en.names, {'en': '本命客製報告'})
        self.assertEqual(en.attributes['report_display']['tagline'], '中文標語')
        # 改草稿不影響原文
        self.api('put', f'/{en.id}', {'attributes': {'report_display': {'tagline': 'English tagline'}}})
        db.session.expire_all()
        self.assertEqual(self.root.attributes['report_display']['tagline'], '中文標語')
        # 同一個語言不能建兩次
        r = self.api('post', '', {'copy_from': self.root.id, 'language': 'en'})
        self.assertEqual(r.status_code, 400)

    def test_plain_create_checks_id_per_language(self):
        body = {'product_id': 'natal-report-digital', 'names': {'ja': 'レポート'}, 'price': 5000}
        self.assertEqual(self.api('post', '', {**body, 'language': 'zh-TW'}).status_code, 400)
        r = self.api('post', '', {**body, 'language': 'ja', 'currency': 'JPY'})
        self.assertEqual(r.status_code, 201, r.get_json())
        ja = db.session.get(Product, r.get_json()['id'])
        self.assertEqual((ja.original_id, ja.currency), (self.root.id, 'JPY'))

    def test_activation_needs_price_and_confirmation(self):
        en = self.copy_to('en', currency='USD')
        r = self.api('post', f'/{en.id}/toggle-status')
        self.assertEqual(r.status_code, 400)
        self.assertEqual(len(r.get_json()['problems']), 2)  # 沒售價、還沒確認
        self.api('put', f'/{en.id}', {'price': 49, 'name': 'Natal Report', 'language': 'en'})
        r = self.api('put', f'/{en.id}', {'is_active': True})
        self.assertEqual(r.status_code, 400)
        self.assertIn('確認內容已完成', r.get_json()['message'])
        self.assertEqual(self.api('post', f'/{en.id}/translation-confirm').status_code, 200)
        r = self.api('post', f'/{en.id}/toggle-status')
        self.assertEqual(r.status_code, 200, r.get_json())
        self.assertTrue(r.get_json()['is_active'])
        # 售價以自己的幣別回給前台
        price = db.session.get(Product, en.id).get_price('USD')
        self.assertEqual((price['price'], price['currency']), (49, 'USD'))

    def test_source_edit_marks_translation_stale(self):
        en = self.copy_to('en', currency='USD')
        self.api('post', f'/{en.id}/translation-confirm')
        state = self.api('get', f'/{en.id}').get_json()['translation']
        self.assertFalse(state['stale'])
        # 只改上下架、價格不算內容變更
        self.api('put', f'/{self.root.id}', {'price': 1500})
        self.assertFalse(self.api('get', f'/{en.id}').get_json()['translation']['stale'])
        with patch('packages.commerce.api.products._now_iso', return_value='2999-01-01T00:00:00'):
            self.api('put', f'/{self.root.id}', {'name': '新的名稱', 'language': 'zh-TW'})
        self.assertTrue(self.api('get', f'/{en.id}').get_json()['translation']['stale'])
        self.assertIsNone(self.api('get', f'/{self.root.id}').get_json()['translation'])

    def test_grouped_list(self):
        self.copy_to('en', currency='USD')
        self.copy_to('ja', currency='JPY')
        r = self.api('get', '?group=1&search=natal-report-digital')
        items = [p for p in r.get_json()['products'] if p['product_id'] == 'natal-report-digital']
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]['language'], 'zh-TW')
        self.assertEqual([l['language'] for l in items[0]['languages']], ['zh-TW', 'en', 'ja'])

    def test_delete_one_language_keeps_others(self):
        en = self.copy_to('en', currency='USD')
        ja = self.copy_to('ja', currency='JPY')
        self.assertEqual(self.api('delete', f'/{en.id}').status_code, 200)
        self.assertIsNotNone(db.session.get(Product, ja.id))
        # 刪掉原文：其他語言版本留下，其中一筆接手成為原文
        root_id = self.root.id
        self.assertEqual(self.api('delete', f'/{root_id}').status_code, 200)
        db.session.expire_all()
        ja = db.session.get(Product, ja.id)
        self.assertIsNotNone(ja)
        self.assertIsNone(ja.original_id)
