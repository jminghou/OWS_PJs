"""報告交付：管理者上傳報告 PDF、會員以短效連結下載（docs/report-physical-addon-plan.md 階段 2）。"""

import io
import tempfile
from unittest.mock import patch

from core.backend_engine.factory import db
from core.backend_engine.services.rbac import RBACService
from sites.Polaris_Parent.backend.models import ReportDocument

from tests.test_report_orders import BANK, SHIPPING, _Base, payload

PDF = b'%PDF-1.4\n% fake pdf for tests\n%%EOF\n'


class DeliveryTests(_Base):
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
        db.session.commit()
        perms = {'report_orders.read', 'report_orders.confirm_payment', 'report_orders.fulfill'}
        p = patch.object(RBACService, 'get_user_permissions',
                         side_effect=lambda uid: perms if int(uid) == self.admin.id else set())
        p.start()
        self.addCleanup(p.stop)

    def tearDown(self):
        self.app.config.update(self._saved_cfg)
        super().tearDown()

    def paid_order(self, **over):
        o = self.post(payload(**over)).get_json()['order']
        r = self.client.post(f'/api/v1/admin/report-orders/{o["order_no"]}/confirm-payment',
                             json={'received_amount': o['amount']}, headers=self.headers(self.admin))
        self.assertEqual(r.status_code, 200, r.get_json())
        return o

    def upload(self, order_no, data=PDF, name='小明的報告.pdf', user=None):
        return self.client.post(f'/api/v1/admin/report-orders/{order_no}/report-pdf',
                                data={'file': (io.BytesIO(data), name)}, content_type='multipart/form-data',
                                headers=self.headers(user or self.admin))

    def link(self, order_no, user=None):
        return self.client.post(f'/api/v1/report-orders/{order_no}/report-pdf/link', headers=self.headers(user))

    def mails(self):
        return [c[0][0] for c in self.mail_send.call_args_list]

    def test_upload_requires_paid_order_and_pdf(self):
        o = self.post(payload()).get_json()['order']
        self.assertEqual(self.upload(o['order_no']).get_json()['code'], 'not_paid')
        o = self.paid_order(submission_key='paid-key-0001')
        self.assertEqual(self.upload(o['order_no'], data=b'hello', name='x.pdf').get_json()['code'], 'invalid_file')
        self.assertEqual(self.upload(o['order_no'], name='x.docx').get_json()['code'], 'invalid_file')
        self.assertEqual(self.upload(o['order_no'], user=self.user).status_code, 403)

    def test_member_downloads_with_short_lived_link(self):
        o = self.paid_order()
        r = self.link(o['order_no'])
        self.assertEqual((r.status_code, r.get_json()['code']), (404, 'not_ready'))

        r = self.upload(o['order_no'])
        self.assertEqual(r.status_code, 200, r.get_json())
        self.assertTrue(r.get_json()['first_time'])
        self.assertTrue(any('你的報告完成了' in m.subject for m in self.mails()))

        view = self.client.get(f'/api/v1/report-orders/{o["order_no"]}', headers=self.headers()).get_json()['order']
        self.assertEqual(view['report']['filename'], '小明的報告.pdf')

        url = self.link(o['order_no']).get_json()['url']
        path = url.split('localhost', 1)[1]
        f = self.client.get(path)
        self.assertEqual((f.status_code, f.mimetype, f.data), (200, 'application/pdf', PDF))
        self.assertIn('inline', f.headers['Content-Disposition'])
        self.assertIn('attachment', self.client.get(path + '?download=1').headers['Content-Disposition'])
        self.assertEqual(self.client.get('/api/v1/report-files/not-a-token').status_code, 410)

        other = self.make_user('other@example.com', verified=True)
        self.assertEqual(self.link(o['order_no'], user=other).status_code, 404)

    def test_reupload_replaces_and_old_link_stops_working(self):
        o = self.paid_order()
        self.upload(o['order_no'])
        old = self.link(o['order_no']).get_json()['url'].split('localhost', 1)[1]
        r = self.upload(o['order_no'], data=PDF + b'v2', name='更正版.pdf')
        self.assertFalse(r.get_json()['first_time'])
        self.assertEqual(sum(1 for m in self.mails() if '你的報告完成了' in m.subject), 1)
        self.assertEqual(self.client.get(old).status_code, 404)
        new = self.link(o['order_no']).get_json()['url'].split('localhost', 1)[1]
        self.assertEqual(self.client.get(new).data, PDF + b'v2')
        self.assertEqual(ReportDocument.query.filter_by(is_current=True).count(), 1)

    def test_admin_delivery_list_and_physical_design_invite(self):
        o = self.paid_order(variant='physical', shipping=SHIPPING)
        listing = self.client.get('/api/v1/admin/report-deliveries', headers=self.headers(self.admin)).get_json()
        self.assertEqual(([d['order_no'] for d in listing['deliveries']], listing['counts']), ([o['order_no']], {'pending': 1, 'delivered': 0}))
        self.upload(o['order_no'])
        self.assertTrue(any('設計封面' in m.body for m in self.mails()))
        listing = self.client.get('/api/v1/admin/report-deliveries?status=delivered', headers=self.headers(self.admin)).get_json()
        self.assertEqual(listing['deliveries'][0]['document']['filename'], '小明的報告.pdf')
        admin_url = self.client.post(f'/api/v1/admin/report-orders/{o["order_no"]}/report-pdf/link',
                                     headers=self.headers(self.admin)).get_json()['url']
        self.assertEqual(self.client.get(admin_url.split('localhost', 1)[1]).status_code, 200)
