"""階段 1 ④：後台訂單總覽、訂單詳細與稽核時間軸（report_orders/overview.py、audit.py）。"""

import io
import tempfile
from datetime import datetime
from unittest.mock import patch

from core.backend_engine.factory import db
from core.backend_engine.services.rbac import RBACService
from packages.commerce.models import Product
from sites.Polaris_Parent.backend.commerce_models import (CommerceEntitlement, CommerceEvent, CommerceLine,
                                                         CommerceSource, CommerceTask)
from sites.Polaris_Parent.backend.extensions.report_orders import handoff
from sites.Polaris_Parent.backend.models import ReportPrintJob

from tests.test_report_orders import BANK, SHIPPING, _Base, payload
from tests.test_report_physical import SETTINGS

PDF = b'%PDF-1.4\n% overview\n%%EOF\n'


class OverviewTests(_Base):
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
        Product.query.filter_by(product_id='natal-report-digital').one().attributes = {'report_addon': SETTINGS}
        db.session.commit()
        perms = {'report_orders.read', 'report_orders.confirm_payment', 'report_orders.fulfill'}
        p = patch.object(RBACService, 'get_user_permissions',
                         side_effect=lambda uid: perms if int(uid) == self.admin.id else set())
        p.start()
        self.addCleanup(p.stop)
        # 正式環境契約層是開的：建單、付款的事件由契約層記，這裡也打開才看得到完整時間軸
        self.app.config['COMMERCE_FOUNDATION_ENABLED'] = True
        for model in (CommerceSource, CommerceLine, CommerceEntitlement, CommerceTask):
            model.__table__.create(db.engine)
            self.tables.append(model.__table__)
        p2 = patch.object(handoff, '_ziwei_call', return_value=({'request': {'status': 'queued'}}, None))
        p2.start()
        self.addCleanup(p2.stop)

    def tearDown(self):
        self.app.config['COMMERCE_FOUNDATION_ENABLED'] = False
        self.app.config.update(self._saved_cfg)
        super().tearDown()

    # ── helpers ──────────────────────────────────────────────────────────
    def ah(self):
        return self.headers(self.admin)

    def admin_post(self, path, body=None, **kw):
        if 'data' not in kw:
            kw['json'] = body or {}
        r = self.client.post(f'/api/v1/admin/{path}', headers=self.ah(), **kw)
        self.assertLess(r.status_code, 300, r.get_json())
        return r

    def report_transfer(self, order_no):
        amount = self.client.get(f'/api/v1/report-orders/{order_no}', headers=self.headers()).get_json()['order']['amount']
        r = self.client.post(f'/api/v1/report-orders/{order_no}/transfer', headers=self.headers(),
                             json={'last5': '12345', 'transferred_on': datetime.utcnow().date().isoformat(),
                                   'amount': amount})
        self.assertEqual(r.status_code, 200, r.get_json())

    def overview(self, **params):
        r = self.client.get('/api/v1/admin/report-orders/overview', query_string=params, headers=self.ah())
        self.assertEqual(r.status_code, 200, r.get_json())
        return r.get_json()

    def detail(self, order_no):
        r = self.client.get(f'/api/v1/admin/report-orders/{order_no}/detail', headers=self.ah())
        self.assertEqual(r.status_code, 200, r.get_json())
        return r.get_json()['order']

    def todo_keys(self, order_no):
        return [t['key'] for t in self.detail(order_no)['todos']]

    def physical_order(self):
        o = self.post(payload(variant='physical', shipping=SHIPPING, physical={'spec_key': 'coated'})).get_json()['order']
        self.amount = o['amount']
        return o['order_no']

    # ── tests ────────────────────────────────────────────────────────────
    def test_full_lifecycle_timeline_and_todos(self):
        no = self.physical_order()
        self.assertEqual(self.todo_keys(no), ['wait_payment'])
        self.report_transfer(no)
        self.assertEqual(self.todo_keys(no), ['confirm_payment'])
        self.admin_post(f'report-orders/{no}/reject-transfer', {'reason': '金額不符'})
        self.report_transfer(no)
        self.admin_post(f'report-orders/{no}/confirm-payment', {'received_amount': self.amount})
        self.assertIn('upload_report', self.todo_keys(no))
        handoff.send_due()
        self.admin_post(f'report-orders/{no}/report-pdf', data={'file': (io.BytesIO(PDF), 'r.pdf')},
                        content_type='multipart/form-data')
        self.assertEqual(self.todo_keys(no), ['design'])
        d = self.client.get(f'/api/v1/report-orders/{no}/design', headers=self.headers()).get_json()['design']
        self.assertEqual(self.client.post(f'/api/v1/report-designs/{d["id"]}/confirm', headers=self.headers()).status_code, 200)
        self.assertEqual(self.todo_keys(no), ['proof'])
        job = ReportPrintJob.query.one()
        upload = lambda: self.admin_post(f'report-print-jobs/{job.id}/proofs',  # noqa: E731
                                         data={'file': (io.BytesIO(PDF), 'p.pdf'), 'note': ''},
                                         content_type='multipart/form-data')
        upload()
        self.assertEqual(self.todo_keys(no), ['proof_wait'])
        from sites.Polaris_Parent.backend.extensions.report_orders import proofs
        pid = lambda: proofs.current_proof(db.session.get(ReportPrintJob, job.id)).id  # noqa: E731
        self.client.post(f'/api/v1/report-orders/{no}/proof-decision', headers=self.headers(),
                         json={'proof_id': pid(), 'decision': 'changes', 'comment': '封面名字打錯'})
        upload()
        self.client.post(f'/api/v1/report-orders/{no}/proof-decision', headers=self.headers(),
                         json={'proof_id': pid(), 'decision': 'approve'})
        self.assertEqual(self.todo_keys(no), ['print'])
        self.admin_post(f'report-print-jobs/{job.id}/printing')
        self.assertEqual(self.todo_keys(no), ['ship'])
        self.admin_post(f'report-print-jobs/{job.id}/shipped', {'carrier': '黑貓', 'tracking_no': '9001'})
        self.admin_post(f'report-print-jobs/{job.id}/delivered')
        self.assertEqual(self.todo_keys(no), [])

        tl = self.detail(no)['timeline']
        events = [(e['type'], e['actor']) for e in tl if e['kind'] == 'event' and not e['type'].startswith(('entitlement', 'task'))]
        expected = [('order_created', 'member'), ('transfer_reported', 'member'), ('transfer_rejected', 'admin'),
                    ('transfer_reported', 'member'), ('payment_confirmed', 'admin'), ('handoff_sent', 'system'),
                    ('report_uploaded', 'admin'), ('design_confirmed', 'member'), ('proof_uploaded', 'admin'),
                    ('proof_changes_requested', 'member'), ('proof_uploaded', 'admin'), ('proof_approved', 'member'),
                    ('print_started', 'admin'), ('print_shipped', 'admin'), ('print_delivered', 'admin')]
        self.assertEqual(events, expected)
        texts = {e['type']: e['text'] for e in tl if e['kind'] == 'event'}
        self.assertIn('金額不符', texts['transfer_rejected'])
        self.assertIn('封面名字打錯', texts['proof_changes_requested'])
        self.assertIn('黑貓 9001', texts['print_shipped'])
        mails = [e for e in tl if e['kind'] == 'mail']
        self.assertTrue(any(m['text'] == '寄信：實體書出貨' and m['status'] == 'sent' for m in mails))
        admin_event = next(e for e in tl if e['type'] == 'print_started')
        self.assertEqual(admin_event['actor_name'], 'admin@example.test')

    def test_overview_search_and_needs_filter(self):
        a = self.physical_order()
        b = self.post(payload(submission_key='draft-key-0002')).get_json()['order']['order_no']
        self.report_transfer(a)
        data = self.overview()
        self.assertEqual({r['order_no'] for r in data['orders']}, {a, b})
        self.assertEqual(data['counts'], {'admin': 1, 'member': 1})
        self.assertEqual([r['order_no'] for r in self.overview(needs='admin')['orders']], [a])
        self.assertEqual([r['order_no'] for r in self.overview(needs='member')['orders']], [b])
        self.assertEqual(len(self.overview(q='buyer@example.com')['orders']), 2)
        self.assertEqual([r['order_no'] for r in self.overview(q=a[-6:])['orders']], [a])
        self.assertEqual(len(self.overview(q='王小明')['orders']), 2)  # 主角姓名在 customization 裡
        self.assertEqual(self.overview(q='nobody@x')['orders'], [])
        self.assertEqual(self.overview(status='paid')['orders'], [])
        row = self.overview(q=a)['orders'][0]
        self.assertEqual((row['todos'][0]['label'], row['todos'][0]['href']), ('會員已回報轉帳，待確認收款', '/admin/report-payments'))

    def test_admin_note_and_permissions(self):
        no = self.physical_order()
        url = f'/api/v1/admin/report-orders/{no}/notes'
        self.assertEqual(self.client.post(url, json={'note': ' '}, headers=self.ah()).get_json()['code'], 'invalid')
        r = self.client.post(url, json={'note': '會員來電詢問交期'}, headers=self.ah())
        notes = [e for e in r.get_json()['timeline'] if e['type'] == 'admin_note']
        self.assertEqual((notes[0]['text'], notes[0]['actor']), ('備註：會員來電詢問交期', 'admin'))
        self.assertEqual(self.client.post(url, json={'note': 'x'}, headers=self.headers()).status_code, 403)
        self.assertEqual(self.client.get(f'/api/v1/admin/report-orders/{no}/detail', headers=self.headers()).status_code, 403)
        self.assertEqual(self.client.get('/api/v1/admin/report-orders/overview', headers=self.headers()).status_code, 403)
        self.assertEqual(self.client.get('/api/v1/admin/report-orders/NOPE/detail', headers=self.ah()).status_code, 404)

    def test_failed_action_leaves_no_audit_event(self):
        no = self.physical_order()
        r = self.client.post(f'/api/v1/admin/report-orders/{no}/reject-transfer', json={'reason': 'x'}, headers=self.ah())
        self.assertEqual(r.get_json()['code'], 'no_report')  # 沒有轉帳回報可退
        self.assertEqual(CommerceEvent.query.filter_by(event_type='transfer_rejected').count(), 0)

    def test_detail_shows_related_orders_and_payments(self):
        parent = self.post(payload()).get_json()['order']
        self.admin_post(f'report-orders/{parent["order_no"]}/confirm-payment', {'received_amount': parent['amount']})
        r = self.client.post(f'/api/v1/report-orders/{parent["order_no"]}/addons', headers=self.headers(),
                             json={'physical': {'spec_key': 'coated'}, 'shipping': SHIPPING, 'submission_key': 'addon-0001',
                                   'policy_consented': True, 'policy_version': '2026-10-03', 'consult_sessions': 0})
        self.assertEqual(r.status_code, 201, r.get_json())
        child = r.get_json()['order']['order_no']
        d = self.detail(parent['order_no'])
        self.assertEqual([(x['relation'], x['order_no']) for x in d['related']], [('加購訂單', child)])
        self.assertEqual((d['payments'][0]['status'], d['payments'][0]['amount']), ('succeeded', parent['amount']))
        self.assertEqual(d['handoff']['status'], 'pending')
        self.assertEqual([(x['relation'], x['order_no']) for x in self.detail(child)['related']],
                         [('原報告訂單', parent['order_no'])])
