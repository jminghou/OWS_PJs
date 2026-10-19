"""階段 1 ②：實體書打樣（report_orders/proofs.py）。免費修改 1 次、7 天沒回應自動確認送印。"""

import io
import tempfile
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from core.backend_engine.factory import db
from core.backend_engine.services.rbac import RBACService
from packages.commerce.models import OrderNotification, Product
from sites.Polaris_Parent.backend.extensions.report_orders import jobs, proofs
from sites.Polaris_Parent.backend.models import ReportPrintJob, ReportPrintProof

from tests.test_report_orders import BANK, SHIPPING, _Base, payload
from tests.test_report_physical import SETTINGS

PDF = b'%PDF-1.4\n% proof\n%%EOF\n'


class ProofTests(_Base):
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
        self.order_no = self.book_awaiting_proof()
        self.job = ReportPrintJob.query.one()

    def tearDown(self):
        self.app.config.update(self._saved_cfg)
        super().tearDown()

    # ── helpers ──────────────────────────────────────────────────────────
    def admin_headers(self):
        return self.headers(self.admin)

    def book_awaiting_proof(self):
        o = self.post(payload(variant='physical', shipping=SHIPPING, physical={'spec_key': 'coated'})).get_json()['order']
        r = self.client.post(f'/api/v1/admin/report-orders/{o["order_no"]}/confirm-payment',
                             json={'received_amount': o['amount']}, headers=self.admin_headers())
        self.assertEqual(r.status_code, 200, r.get_json())
        r = self.client.post(f'/api/v1/admin/report-orders/{o["order_no"]}/report-pdf',
                             data={'file': (io.BytesIO(PDF), 'r.pdf')}, content_type='multipart/form-data',
                             headers=self.admin_headers())
        self.assertEqual(r.status_code, 200, r.get_json())
        d = self.client.get(f'/api/v1/report-orders/{o["order_no"]}/design', headers=self.headers()).get_json()['design']
        self.assertEqual(self.client.post(f'/api/v1/report-designs/{d["id"]}/confirm', headers=self.headers()).status_code, 200)
        self.assertEqual(ReportPrintJob.query.one().status, 'awaiting_proof')
        return o['order_no']

    def upload(self, note='第一版', data=PDF, name='proof.pdf'):
        return self.client.post(f'/api/v1/admin/report-print-jobs/{self.job.id}/proofs',
                                data={'file': (io.BytesIO(data), name), 'note': note},
                                content_type='multipart/form-data', headers=self.admin_headers())

    def decide(self, decision, comment='', proof_id=None):
        if proof_id is None:
            proof_id = proofs.current_proof(self.job).id
        return self.client.post(f'/api/v1/report-orders/{self.order_no}/proof-decision',
                                json={'proof_id': proof_id, 'decision': decision, 'comment': comment},
                                headers=self.headers())

    def member_view(self):
        o = self.client.get(f'/api/v1/report-orders/{self.order_no}', headers=self.headers()).get_json()['order']
        return o['physical']

    def action(self, name, body=None):
        return self.client.post(f'/api/v1/admin/report-print-jobs/{self.job.id}/{name}', json=body or {},
                                headers=self.admin_headers())

    def mails(self):
        return [c[0][0] for c in self.mail_send.call_args_list]

    def status(self):
        return db.session.get(ReportPrintJob, self.job.id).status

    # ── tests ────────────────────────────────────────────────────────────
    def test_cannot_print_before_proof_approved(self):
        r = self.action('printing')
        self.assertEqual((r.status_code, r.get_json()['code']), (409, 'invalid_status'))

    def test_upload_notifies_member_with_deadline(self):
        r = self.upload()
        self.assertEqual(r.status_code, 200, r.get_json())
        self.assertEqual(self.status(), 'proof_ready')
        p = self.member_view()['proofs']
        self.assertEqual((p['pending']['version'], p['pending']['admin_note'], p['revisions_left'], p['free_revisions']),
                         (1, '第一版', 1, 1))
        due = datetime.fromisoformat(p['pending']['due_at'])
        self.assertAlmostEqual((due - datetime.now(timezone.utc)).total_seconds(), 7 * 86400, delta=120)
        mail = [m for m in self.mails() if '打樣請確認' in m.subject][0]
        self.assertIn('（台灣時間）前確認送印', mail.body)
        self.assertIn('1 次免費修改', mail.body)

    def test_upload_rejects_non_pdf_and_wrong_state(self):
        self.assertEqual(self.upload(data=b'not a pdf').get_json()['code'], 'invalid_file')
        self.job.status = 'approved'
        db.session.commit()
        self.assertEqual(self.upload().get_json()['code'], 'invalid_status')

    def test_member_approves_then_admin_can_print(self):
        self.upload()
        self.assertEqual(self.decide('approve').status_code, 200)
        job = db.session.get(ReportPrintJob, self.job.id)
        self.assertEqual((job.status, job.approved_proof_id), ('approved', proofs.current_proof(job).id))
        self.assertTrue(any('打樣已確認送印' in m.subject for m in self.mails()))  # 通知管理者
        self.assertEqual(self.action('printing').status_code, 200)
        r = self.client.post(f'/api/v1/report-orders/{self.order_no}/physical-cancel', json={}, headers=self.headers())
        self.assertEqual(r.get_json()['code'], 'not_cancellable')  # 確認送印後不能取消

    def test_one_free_revision_then_must_approve(self):
        self.upload()
        self.assertEqual(self.decide('changes').get_json()['code'], 'comment_required')
        self.assertEqual(self.decide('changes', '封面名字打錯').status_code, 200)
        self.assertEqual(self.status(), 'changes_requested')
        self.assertTrue(any('打樣要修改' in m.subject and '封面名字打錯' in m.body for m in self.mails()))
        self.assertEqual(self.upload(note='已修正封面名字').status_code, 200)
        p = self.member_view()['proofs']
        self.assertEqual((p['pending']['version'], p['revisions_left'], len(p['versions'])), (2, 0, 2))
        self.assertEqual(p['versions'][0]['decision'], 'changes_requested')
        self.assertIn('免費修改次數已用完', [m for m in self.mails() if '打樣請確認' in m.subject][-1].body)
        r = self.decide('changes', '還想改')
        self.assertEqual((r.status_code, r.get_json()['code']), (409, 'no_revisions_left'))
        self.assertEqual(self.decide('approve').status_code, 200)

    def test_admin_can_grant_extra_revision(self):
        self.upload()
        self.decide('changes', '改 1')
        self.upload()
        self.assertEqual(self.action('grant_revision').status_code, 200)
        self.assertEqual(self.member_view()['proofs']['revisions_left'], 1)
        self.assertEqual(self.decide('changes', '改 2').status_code, 200)

    def test_stale_proof_and_superseded_version(self):
        self.upload()
        first = proofs.current_proof(self.job).id
        self.upload(note='管理者自己更正')  # 會員決定前就換新版
        r = self.decide('approve', proof_id=first)
        self.assertEqual(r.get_json()['code'], 'stale_proof')
        versions = self.member_view()['proofs']['versions']
        self.assertEqual([v['decision'] for v in versions], ['superseded', None])
        self.assertEqual(self.decide('approve').status_code, 200)

    def test_admin_approve_on_behalf_requires_note(self):
        self.upload()
        self.assertEqual(self.action('approve_proof').get_json()['code'], 'note_required')
        r = self.action('approve_proof', {'note': '會員 10/20 來電確認'})
        self.assertEqual(r.status_code, 200, r.get_json())
        p = ReportPrintProof.query.one()
        self.assertEqual((p.decision, p.comment, p.decided_by), ('admin_approved', '會員 10/20 來電確認', self.admin.id))
        self.assertEqual(self.status(), 'approved')

    def test_reminder_then_auto_approve_after_deadline(self):
        self.upload()
        due = proofs.current_proof(self.job).due_at
        due = due.replace(tzinfo=timezone.utc) if due.tzinfo is None else due
        self.assertEqual(jobs.run_due(due - timedelta(days=3), force=True, only={'proof_deadlines'})['proof_deadlines'],
                         {'reminded': 0, 'auto_approved': 0})
        r = jobs.run_due(due - timedelta(days=1), force=True, only={'proof_deadlines'})['proof_deadlines']
        self.assertEqual(r, {'reminded': 1, 'auto_approved': 0})
        r = jobs.run_due(due - timedelta(hours=1), force=True, only={'proof_deadlines'})['proof_deadlines']
        self.assertEqual(r, {'reminded': 0, 'auto_approved': 0})  # 每版只提醒一次
        self.assertEqual(self.status(), 'proof_ready')
        r = jobs.run_due(due + timedelta(minutes=1), force=True, only={'proof_deadlines'})['proof_deadlines']
        self.assertEqual(r, {'reminded': 0, 'auto_approved': 1})
        job = db.session.get(ReportPrintJob, self.job.id)
        self.assertEqual((job.status, ReportPrintProof.query.one().decision), ('approved', 'auto_approved'))
        events = {n.event for n in OrderNotification.query.all()}
        self.assertTrue({'proof_reminder', 'proof_auto_approved', 'proof_approved_admin'} <= events)
        self.assertEqual(self.decide('approve').get_json()['code'], 'no_pending_proof')

    def test_proof_pdf_link_is_owner_only(self):
        self.upload()
        proof_id = proofs.current_proof(self.job).id
        r = self.client.post(f'/api/v1/report-orders/{self.order_no}/proofs/{proof_id}/link', headers=self.headers())
        url = r.get_json()['url']
        f = self.client.get(url[url.index('/api/'):])
        self.assertEqual((f.status_code, f.mimetype, f.data), (200, 'application/pdf', PDF))
        other = self.make_user('other@example.com', verified=True)
        r = self.client.post(f'/api/v1/report-orders/{self.order_no}/proofs/{proof_id}/link', headers=self.headers(other))
        self.assertEqual(r.status_code, 404)
        r = self.client.post(f'/api/v1/admin/report-print-jobs/{self.job.id}/proofs/{proof_id}/link',
                             headers=self.admin_headers())
        self.assertEqual(r.status_code, 200)

    def test_admin_list_includes_proof_history(self):
        self.upload()
        self.decide('changes', '改字')
        rows = self.client.get('/api/v1/admin/report-print-jobs?status=changes_requested',
                               headers=self.admin_headers()).get_json()['jobs']
        self.assertEqual(rows[0]['proofs']['versions'][0]['comment'], '改字')
