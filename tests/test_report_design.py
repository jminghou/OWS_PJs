"""設計你的書：草稿、照片、連到加購訂單、付款後確認、清除（docs/report-physical-addon-plan.md 階段 2）。"""

import io
import tempfile
from datetime import datetime, timedelta
from unittest.mock import patch

from core.backend_engine.factory import db
from core.backend_engine.services.rbac import RBACService
from packages.commerce.models import Product
from sites.Polaris_Parent.backend.extensions.report_orders import design as design_mod
from sites.Polaris_Parent.backend.models import ReportBookDesign, ReportDesignAsset, ReportPrintJob

from tests.test_report_orders import BANK, SHIPPING, _Base, payload
from tests.test_report_physical import SETTINGS

PDF = b'%PDF-1.4\n% fake\n%%EOF\n'
PNG = b'\x89PNG\r\n\x1a\nfake'


class DesignTests(_Base):
    MODE = 'manual'

    def setUp(self):
        super().setUp()
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self._saved_cfg = {k: self.app.config.get(k) for k in [*BANK, 'PRIVATE_UPLOAD_DIR']}
        self.app.config.update(BANK)
        self.app.config['PRIVATE_UPLOAD_DIR'] = self._tmp.name
        self.admin = self.make_user('admin@example.test', verified=True)
        self.admin.role = 'admin'
        digital = Product.query.filter_by(product_id='natal-report-digital').one()
        digital.attributes = {'report_addon': SETTINGS}
        db.session.commit()
        perms = {'report_orders.read', 'report_orders.confirm_payment', 'report_orders.fulfill'}
        p = patch.object(RBACService, 'get_user_permissions',
                         side_effect=lambda uid: perms if int(uid) == self.admin.id else set())
        p.start()
        self.addCleanup(p.stop)

    def tearDown(self):
        self.app.config.update(self._saved_cfg)
        super().tearDown()

    # ── helpers ──────────────────────────────────────────────────────────
    def confirm_payment(self, order_no, amount):
        r = self.client.post(f'/api/v1/admin/report-orders/{order_no}/confirm-payment',
                             json={'received_amount': amount}, headers=self.headers(self.admin))
        self.assertEqual(r.status_code, 200, r.get_json())

    def paid_order(self, **over):
        o = self.post(payload(**over)).get_json()['order']
        self.confirm_payment(o['order_no'], o['amount'])
        return o

    def upload_report(self, order_no):
        r = self.client.post(f'/api/v1/admin/report-orders/{order_no}/report-pdf',
                             data={'file': (io.BytesIO(PDF), 'r.pdf')}, content_type='multipart/form-data',
                             headers=self.headers(self.admin))
        self.assertEqual(r.status_code, 200, r.get_json())

    def put(self, design_id, data, page_count=20):
        return self.client.put(f'/api/v1/report-designs/{design_id}', json={'data': data, 'page_count': page_count},
                               headers=self.headers())

    def upload_asset(self, design_id, data=PNG, mimetype='image/png', name='a.png'):
        return self.client.post(f'/api/v1/report-designs/{design_id}/assets',
                                data={'file': (io.BytesIO(data), name, mimetype)},
                                content_type='multipart/form-data', headers=self.headers())

    # ── 付款前的草稿 ─────────────────────────────────────────────────────
    def test_draft_requires_report_and_is_reused(self):
        o = self.paid_order()
        r = self.client.post(f'/api/v1/report-orders/{o["order_no"]}/design-draft', headers=self.headers())
        self.assertEqual(r.get_json()['code'], 'report_not_ready')
        self.upload_report(o['order_no'])
        d1 = self.client.post(f'/api/v1/report-orders/{o["order_no"]}/design-draft', headers=self.headers()).get_json()['design']
        d2 = self.client.post(f'/api/v1/report-orders/{o["order_no"]}/design-draft', headers=self.headers()).get_json()['design']
        self.assertEqual(d1['id'], d2['id'])
        self.assertEqual((d1['status'], d1['data']['cover_name'], d1['data']['dedication']), ('draft', '小明', '生日快樂'))
        self.assertIsNotNone(d1['report_token'])
        self.assertIsNone(d1['purchased'])
        other = self.make_user('other@example.com', verified=True)
        self.assertEqual(self.client.get(f'/api/v1/report-designs/{d1["id"]}', headers=self.headers(other)).status_code, 404)

    def test_save_cleans_content_and_assets(self):
        o = self.paid_order()
        self.upload_report(o['order_no'])
        d = self.client.post(f'/api/v1/report-orders/{o["order_no"]}/design-draft', headers=self.headers()).get_json()['design']
        self.assertEqual(self.upload_asset(d['id'], data=b'x', mimetype='text/plain', name='a.txt').get_json()['code'], 'invalid_file')
        asset = self.upload_asset(d['id']).get_json()['asset']
        img = self.client.get(f'/api/v1/report-files/{asset["token"]}')
        self.assertEqual((img.status_code, img.mimetype, img.data), (200, 'image/png', PNG))

        r = self.put(d['id'], {
            'cover_name': '小明' * 20, 'cover_style': 'style-2', 'cover_asset_id': asset['id'], 'dedication': '愛你',
            'annotations': [
                {'page': 3, 'type': 'fix', 'text': '「小名」應為「小明」'},
                {'page': 99, 'type': 'fix', 'text': '超出頁數'},
                {'page': 4, 'type': 'nope', 'text': 'x'},
                {'page': 5, 'type': 'image', 'text': '換成這張', 'asset_ids': [asset['id'], 9999]},
            ],
            'spreads': [{'after_page': 6, 'text': '海邊', 'asset_ids': [asset['id']]}, {'after_page': 0}],
        })
        data = r.get_json()['design']['data']
        self.assertEqual(len(data['cover_name']), 20)
        self.assertEqual([(a['page'], a['type'], a['asset_ids']) for a in data['annotations']],
                         [(3, 'fix', []), (5, 'image', [asset['id']])])
        self.assertEqual([s['after_page'] for s in data['spreads']], [6, None])

        r = self.client.delete(f'/api/v1/report-designs/{d["id"]}/assets/{asset["id"]}', headers=self.headers())
        data = r.get_json()['design']['data']
        self.assertIsNone(data['cover_asset_id'])
        self.assertEqual(data['spreads'][0]['asset_ids'], [])
        self.assertEqual(ReportDesignAsset.query.count(), 0)

    # ── 送出加購 → 付款 → 確認 ───────────────────────────────────────────
    def test_addon_with_draft_then_confirm_after_payment(self):
        o = self.paid_order()
        self.upload_report(o['order_no'])
        d = self.client.post(f'/api/v1/report-orders/{o["order_no"]}/design-draft', headers=self.headers()).get_json()['design']
        a = self.client.post(f'/api/v1/report-orders/{o["order_no"]}/addons', headers=self.headers(), json={
            'submission_key': 'addon-with-design', 'policy_consented': True, 'policy_version': '2026-10-03',
            'shipping': SHIPPING, 'consult_sessions': 0, 'design_id': d['id'],
            'physical': {'spec_key': 'soft', 'custom': ['custom_cover'], 'spreads': 1}}).get_json()['order']
        view = self.client.get(f'/api/v1/report-designs/{d["id"]}', headers=self.headers()).get_json()['design']
        self.assertEqual((view['status'], view['order_no'], view['purchased']),
                         ('submitted', a['order_no'], {'custom': ['custom_cover'], 'spreads': 1}))
        self.assertFalse(view['confirmable'])  # 還沒付款
        self.assertEqual(self.client.post(f'/api/v1/report-designs/{d["id"]}/confirm', headers=self.headers()).get_json()['code'],
                         'invalid_status')

        self.confirm_payment(a['order_no'], a['amount'])
        view = self.client.get(f'/api/v1/report-orders/{a["order_no"]}/design', headers=self.headers()).get_json()['design']
        self.assertEqual(view['id'], d['id'])
        self.assertTrue(view['confirmable'])
        self.assertEqual(len(view['problems']), 2)  # 封面圖、跨頁位置
        r = self.client.post(f'/api/v1/report-designs/{d["id"]}/confirm', headers=self.headers())
        self.assertEqual(r.get_json()['code'], 'incomplete')

        asset = self.upload_asset(d['id']).get_json()['asset']
        self.put(d['id'], {'cover_name': '小明', 'cover_asset_id': asset['id'],
                           'annotations': [{'page': 2, 'type': 'text', 'text': '改口語'}],
                           'spreads': [{'after_page': 8, 'text': '我們家的夏天'}]})
        problems = self.client.get(f'/api/v1/report-designs/{d["id"]}', headers=self.headers()).get_json()['design']['problems']
        self.assertEqual(len(problems), 1)
        self.assertIn('需要另外加購', problems[0])
        self.put(d['id'], {'cover_name': '小明', 'cover_asset_id': asset['id'],
                           'annotations': [{'page': 2, 'type': 'fix', 'text': '錯字'}],
                           'spreads': [{'after_page': 8, 'text': '我們家的夏天'}]})
        r = self.client.post(f'/api/v1/report-designs/{d["id"]}/confirm', headers=self.headers())
        self.assertEqual(r.status_code, 200, r.get_json())
        job = ReportPrintJob.query.one()
        self.assertEqual((job.status, job.options['cover_asset_id'], len(job.pages['spreads'])), ('awaiting_proof', asset['id'], 1))
        self.assertEqual(self.put(d['id'], {'cover_name': '改'}).get_json()['code'], 'locked')

        listing = self.client.get('/api/v1/admin/report-print-jobs?status=awaiting_proof',
                                  headers=self.headers(self.admin)).get_json()
        admin_design = listing['jobs'][0]['design']
        self.assertEqual(admin_design['data']['spreads'][0]['text'], '我們家的夏天')
        self.assertEqual(self.client.get(f'/api/v1/report-files/{admin_design["assets"][0]["token"]}').status_code, 200)

    def test_design_after_payment_for_first_purchase_physical(self):
        o = self.paid_order(variant='physical', shipping=SHIPPING, physical={'spec_key': 'coated'})
        r = self.client.get(f'/api/v1/report-orders/{o["order_no"]}/design', headers=self.headers())
        self.assertEqual(r.get_json()['code'], 'report_not_ready')
        self.upload_report(o['order_no'])
        d = self.client.get(f'/api/v1/report-orders/{o["order_no"]}/design', headers=self.headers()).get_json()['design']
        self.assertEqual((d['status'], d['confirmable'], d['problems']), ('submitted', True, []))
        self.assertEqual(self.client.post(f'/api/v1/report-designs/{d["id"]}/confirm', headers=self.headers()).status_code, 200)
        self.assertEqual(ReportPrintJob.query.one().status, 'awaiting_proof')

    def test_cleanup_removes_abandoned_drafts_only(self):
        o = self.paid_order()
        self.upload_report(o['order_no'])
        d = self.client.post(f'/api/v1/report-orders/{o["order_no"]}/design-draft', headers=self.headers()).get_json()['design']
        self.upload_asset(d['id'])
        self.assertEqual(design_mod.cleanup(now=datetime.utcnow()), 0)
        self.assertEqual(design_mod.cleanup(now=datetime.utcnow() + timedelta(days=31)), 1)
        self.assertEqual((ReportBookDesign.query.count(), ReportDesignAsset.query.count()), (0, 0))
