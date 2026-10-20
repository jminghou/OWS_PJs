"""第三項：外部平台代客建單（report_orders/proxy.py；2026-10-21）。"""

import io
import tempfile
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from core.backend_engine.factory import db
from core.backend_engine.models import User
from core.backend_engine.services.rbac import RBACService
from packages.commerce.models import Order, OrderItem, OrderNotification, Product
from sites.Polaris_Parent.backend.commerce_models import (CommerceChannel, CommerceEntitlement, CommerceExternalReceipt,
                                                         CommerceIntakeEvent, CommerceLine, CommerceReceiptBinding,
                                                         CommerceSource, CommerceTask)
from sites.Polaris_Parent.backend.extensions.report_orders import binding, handoff
from sites.Polaris_Parent.backend.models import (ExternalCustomer, OrderSourceRecord, ReportFulfillment,
                                                 ReportMailOutbox, ReportPrintJob, Shipment)

from tests.test_report_orders import BANK, _Base
from tests.test_report_physical import SETTINGS

PDF = b'%PDF-1.4\n% proxy\n%%EOF\n'
PNG = b'\x89PNG\r\n\x1a\nfake'
OSLO = 3143244
SHIP_NO = {'recipient_name': 'Ola Nordmann', 'recipient_phone': '+47 912 34 567', 'postal_code': '9008',
           'address': 'Storgata 1, 9008 Tromsø', 'country': 'no'}


class ProxyTests(_Base):
    MODE = 'manual'

    def setUp(self):
        super().setUp()
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self._saved_cfg = {k: self.app.config.get(k) for k in [*BANK, 'PRIVATE_UPLOAD_DIR', 'COMMERCE_FOUNDATION_ENABLED']}
        self.app.config.update(BANK)
        self.app.config['PRIVATE_UPLOAD_DIR'] = self._tmp.name
        self.app.config['COMMERCE_FOUNDATION_ENABLED'] = True
        for model in (CommerceSource, CommerceLine, CommerceEntitlement, CommerceTask, CommerceIntakeEvent):
            model.__table__.create(db.engine)
            self.tables.append(model.__table__)
        self.admin = self.make_user('admin@example.test', verified=True)
        self.admin.role = 'admin'
        Product.query.filter_by(product_id='natal-report-digital').one().attributes = {'report_addon': SETTINGS}
        self.channel = CommerceChannel(channel='etsy', store_key='polaris-etsy', revision=1, manual_import=True,
                                       policy_reference='Etsy 政策審查 2026-10', review_note='測試', reviewed_by=self.admin.id,
                                       valid_until=datetime.now(timezone.utc) + timedelta(days=90))
        db.session.add(self.channel)
        db.session.commit()
        perms = {'report_orders.read', 'report_orders.fulfill', 'report_orders.proxy', 'report_orders.confirm_payment'}
        p = patch.object(RBACService, 'get_user_permissions',
                         side_effect=lambda uid: perms if int(uid) == self.admin.id else set())
        p.start()
        self.addCleanup(p.stop)

    def tearDown(self):
        self.app.config.update(self._saved_cfg)
        super().tearDown()

    # ── helpers ──────────────────────────────────────────────────────────
    def body(self, **over):
        order = {'variant': 'physical', 'subject_name': 'Emma', 'gender': '女', 'relation_label': 'daughter',
                 'birth': {'date': '2018-07-15', 'time': '12:00', 'time_type': 'clock_time'},
                 'place': {'geonameid': OSLO, 'city': 'ignored', 'country': 'ignored'},
                 'audience': {'reader': '父母', 'call_name': 'Emma', 'dedication': 'To our brave Emma'},
                 'shipping': SHIP_NO}
        order.update(over.pop('order', {}))
        b = {'channel_id': self.channel.id, 'external_order_id': 'ETSY-3141592', 'currency': 'NOK', 'amount': '499.00',
             'language': 'nb', 'customer': {'display_name': 'Kari N.', 'platform_handle': 'kari_n', 'contact_note': 'Etsy 私訊'},
             'order': order, 'book': {'cover_name': 'Emma'},
             'sources': [{'kind': 'conversation', 'occurred_on': '2026-10-20', 'summary': 'Born 2018-07-15 12:00 in Oslo'}]}
        b.update(over)
        return b

    def create(self, body=None, user=None):
        return self.client.post('/api/v1/admin/proxy-orders', json=body or self.body(),
                                headers=self.headers(user or self.admin))

    def created_order(self, **over):
        r = self.create(self.body(**over))
        self.assertEqual(r.status_code, 201, r.get_json())
        return Order.query.filter_by(order_no=r.get_json()['order_no']).one()

    def detail(self, order_no):
        r = self.client.get(f'/api/v1/admin/report-orders/{order_no}/detail', headers=self.headers(self.admin))
        self.assertEqual(r.status_code, 200, r.get_json())
        return r.get_json()['order']

    # ── tests ────────────────────────────────────────────────────────────
    def test_physical_proxy_order_goes_straight_to_proof(self):
        order = self.created_order()
        item = OrderItem.query.filter_by(order_id=order.id).one()
        self.assertEqual((order.status, order.payment_method, order.currency, order.amount, order.language),
                         ('paid', 'external_verified', 'NOK', 49900, 'nb'))
        self.assertEqual((item.variant, item.unit_price, item.currency), ('physical', 49900, 'NOK'))
        self.assertEqual(item.customization['place']['city'], '奧斯陸')  # 伺服器依 geonameid 填名稱
        job = ReportPrintJob.query.one()
        self.assertEqual((job.status, job.options['cover_name'], job.pricing['currency']), ('awaiting_proof', 'Emma', 'NOK'))
        self.assertEqual(job.spec['label'], '精裝（銅西卡紙質）')  # 預設精裝
        ship = Shipment.query.one()
        self.assertEqual((ship.country, ship.postal_code), ('NO', '9008'))
        self.assertEqual(ReportFulfillment.query.one().handoff_status, 'pending')  # 照常交給紫微
        customer = ExternalCustomer.query.one()
        user = db.session.get(User, customer.app_user_id)
        self.assertTrue(user.email.endswith('@customers.polaris-parent.invalid'))
        self.assertEqual(order.user_id, user.id)
        receipt = CommerceExternalReceipt.query.one()
        self.assertEqual((receipt.status, receipt.amount, receipt.currency, receipt.member_id), ('verified', 49900, 'NOK', user.id))
        self.assertEqual(CommerceReceiptBinding.query.one().snapshot['proxy'], True)
        binding.require_evidence(order)  # 既有的平台證據檢查照常通過

        d = self.detail(order.order_no)
        self.assertEqual([t['key'] for t in d['todos']], ['proof'])  # 沒有「待上傳報告」
        self.assertEqual((d['external']['channel'], d['external']['external_order_id'], d['external']['customer_name']),
                         ('etsy', 'ETSY-3141592', 'Kari N.'))
        self.assertEqual(len(d['external_detail']['sources']), 1)
        self.assertIn('proxy_order_created', [e['type'] for e in d['timeline']])

    def test_customer_mail_is_skipped_not_retried(self):
        order = self.created_order()
        job = ReportPrintJob.query.one()
        r = self.client.post(f'/api/v1/admin/report-print-jobs/{job.id}/proofs', headers=self.headers(self.admin),
                             data={'file': (io.BytesIO(PDF), 'p.pdf'), 'note': ''}, content_type='multipart/form-data')
        self.assertEqual(r.status_code, 200, r.get_json())
        note = OrderNotification.query.filter_by(order_id=order.id, event='proof_ready').one()
        self.assertEqual(note.status, 'skipped')
        self.assertIsNone(ReportMailOutbox.query.filter_by(notification_id=note.id).first())  # 不排重試
        self.mail_send.assert_not_called()

    def test_same_platform_order_returns_existing(self):
        first = self.created_order()
        r = self.create()
        self.assertEqual((r.status_code, r.get_json()['created'], r.get_json()['order_no']), (200, False, first.order_no))
        self.assertEqual(Order.query.count(), 1)

    def test_overview_search_by_platform_order_and_customer(self):
        order = self.created_order()
        for q in ('ETSY-314', 'kari', 'Kari N'):
            r = self.client.get('/api/v1/admin/report-orders/overview', query_string={'q': q, 'needs': 'all'},
                                headers=self.headers(self.admin))
            self.assertEqual([o['order_no'] for o in r.get_json()['orders']], [order.order_no], q)

    def test_existing_customer_is_reused(self):
        self.created_order()
        cid = ExternalCustomer.query.one().id
        b = self.body(external_order_id='ETSY-2', customer_id=cid)
        b.pop('customer')
        r = self.create(b)
        self.assertEqual(r.status_code, 201, r.get_json())
        self.assertEqual(ExternalCustomer.query.count(), 1)
        self.assertEqual(len({o.user_id for o in Order.query.all()}), 1)
        r = self.client.get(f'/api/v1/admin/external-customers/{cid}', headers=self.headers(self.admin))
        self.assertEqual(len(r.get_json()['customer']['orders']), 2)

    def test_validation(self):
        for over, key in (({'sources': []}, 'sources'), ({'amount': '499.999'}, 'amount'), ({'currency': 'XYZ'}, 'currency'),
                          ({'customer': None}, 'customer'), ({'language': '挪威文'}, 'language'),
                          ({'order': {'shipping': {**SHIP_NO, 'postal_code': '!!'}}}, 'postal_code')):
            r = self.create(self.body(**over))
            self.assertEqual(r.status_code, 400, (over, r.get_json()))
            errs = r.get_json().get('errors') or {}
            self.assertTrue(any(k.startswith(key) for k in errs), (key, errs))
        self.assertEqual(Order.query.count(), 0)
        self.assertEqual(ExternalCustomer.query.count(), 0)  # 驗證失敗不留客人檔案

    def test_manual_coordinates_allowed_for_proxy(self):
        place = {'manual': True, 'lat': 69.65, 'lon': 18.96, 'tz': 'Europe/Oslo', 'city': 'Kvaløya', 'country': '挪威'}
        order = self.created_order(order={'place': place})
        c = OrderItem.query.filter_by(order_id=order.id).one().customization['place']
        self.assertEqual((c['manual'], c['tz'], c['city']), (True, 'Europe/Oslo', 'Kvaløya'))

    def test_digital_proxy_order_and_platform_delivery(self):
        order = self.created_order(order={'variant': 'digital', 'shipping': None}, currency='USD', amount='49.99',
                                   external_order_id='ETSY-D1')
        self.assertEqual((order.amount, order.currency), (4999, 'USD'))
        no = order.order_no
        self.assertIn('upload_report', [t['key'] for t in self.detail(no)['todos']])
        url = f'/api/v1/admin/report-orders/{no}/delivered-via-platform'
        self.assertEqual(self.client.post(url, headers=self.headers(self.admin)).get_json()['code'], 'no_document')
        r = self.client.post(f'/api/v1/admin/report-orders/{no}/report-pdf', headers=self.headers(self.admin),
                             data={'file': (io.BytesIO(PDF), 'r.pdf')}, content_type='multipart/form-data')
        self.assertEqual(r.status_code, 200, r.get_json())
        self.assertEqual([t['key'] for t in self.detail(no)['todos']], ['deliver_platform'])
        r = self.client.post(url, json={'note': 'Etsy 訊息已傳 PDF'}, headers=self.headers(self.admin))
        self.assertEqual(r.status_code, 200, r.get_json())
        self.assertEqual(r.get_json()['order']['todos'], [])
        self.assertTrue(r.get_json()['order']['external_detail']['delivered_via_platform'])

    def test_physical_order_has_no_platform_delivery_step(self):
        order = self.created_order()
        r = self.client.post(f'/api/v1/admin/report-orders/{order.order_no}/delivered-via-platform',
                             headers=self.headers(self.admin))
        self.assertEqual(r.get_json()['code'], 'not_digital')

    def test_sources_text_and_screenshot(self):
        order = self.created_order()
        base = f'/api/v1/admin/report-orders/{order.order_no}/sources'
        r = self.client.post(base, json={'kind': 'link', 'url': 'https://www.etsy.com/messages/123'}, headers=self.headers(self.admin))
        self.assertEqual(len(r.get_json()['sources']), 2)
        self.assertEqual(self.client.post(base, json={'kind': 'link', 'url': 'ftp://x'}, headers=self.headers(self.admin)).status_code, 400)
        r = self.client.post(f'{base}/upload', headers=self.headers(self.admin), content_type='multipart/form-data',
                             data={'file': (io.BytesIO(PNG), 'chat.png', 'image/png'), 'summary': '客人確認地址', 'occurred_on': '2026-10-21'})
        self.assertEqual(r.status_code, 200, r.get_json())
        shot = [s for s in r.get_json()['sources'] if s['kind'] == 'screenshot'][0]
        link = self.client.post(f'{base}/{shot["id"]}/link', headers=self.headers(self.admin)).get_json()['url']
        f = self.client.get(link[link.index('/api/'):])
        self.assertEqual((f.status_code, f.data), (200, PNG))
        self.assertEqual(OrderSourceRecord.query.count(), 3)
        member_token = self.client.post(f'{base}/{shot["id"]}/link', headers=self.headers()).status_code
        self.assertEqual(member_token, 403)

    def test_permissions_and_channel_state(self):
        self.assertEqual(self.create(user=self.user).status_code, 403)
        self.channel.manual_import = False
        db.session.commit()
        r = self.create()
        self.assertEqual((r.status_code, r.get_json()['code']), (409, 'channel_blocked'))

    def test_config_endpoint(self):
        r = self.client.get('/api/v1/admin/proxy-orders/config', headers=self.headers(self.admin)).get_json()
        self.assertEqual(r['default_spec_key'], 'coated')
        self.assertIn('NOK', [c['code'] for c in r['currencies']])
        self.assertEqual(r['channels'][0]['channel'], 'etsy')

    def test_handoff_carries_order_language(self):
        self.created_order()
        sent = []
        with patch.object(handoff, '_ziwei_call', side_effect=lambda m, p, b=None: (sent.append(b) or ({'request': {'status': 'queued'}}, None))):
            handoff.send_due()
        self.assertEqual((sent[0]['language'], sent[0]['variant']), ('nb', 'physical'))
