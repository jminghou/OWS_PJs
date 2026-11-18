"""Actionable mail is revalidated on initial send, worker retry and manual resend."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[4]))
from datetime import datetime, timedelta
from unittest.mock import patch
from sqlalchemy import event
from core.backend_engine.factory import db
from packages.commerce.models import OrderNotification
from sites.Polaris_Parent.backend.models import ExternalCustomer, ReportPrintJob
from sites.Polaris_Parent.backend.extensions import report_orders
from sites.Polaris_Parent.backend.extensions.report_orders import control, delivery, notify, proofs
from tests.test_report_proxy import _ProxyBase, PDF


class NotificationGateTests(_ProxyBase):
    def setUp(self):
        super().setUp()
        self.order = self.created_order()
        self.job = ReportPrintJob.query.one()
        self.proof = proofs.upload(self.job, self.admin.id, 'proof.pdf', PDF)
        self.mail_send.reset_mock()

    def pause(self):
        control.change(self.order, 'paused', '確認中', self.admin.id, 0)
        db.session.commit()

    def reminder(self):
        notify.send_proof_reminder(self.order, self.job, self.proof, self.user.email)
        return OrderNotification.query.filter_by(event='proof_reminder').one()

    def test_hold_defers_without_consuming_attempts(self):
        self.pause()
        note = self.reminder()
        self.assertEqual((note.status, note.attempts), ('pending', 0))
        self.mail_send.assert_not_called()
        self.assertFalse(notify.resend(note.id))
        self.assertEqual(note.attempts, 0)
        self.assertIsNotNone(notify.outbox_of(note).next_attempt_at)
        res = self.client.post(f'/api/v1/admin/report-notifications/{note.id}/resend', headers=self.headers(self.admin))
        self.assertEqual(res.status_code, 409)
        self.assertEqual(res.get_json()['code'], 'notification_held')

    def test_failed_mail_retry_obeys_later_pause(self):
        self.mail_send.side_effect = RuntimeError('offline')
        note = self.reminder()
        self.assertEqual(note.attempts, 1)
        self.pause()
        self.mail_send.side_effect = None
        self.mail_send.reset_mock()
        notify.retry_due(datetime.utcnow() + timedelta(minutes=6))
        self.mail_send.assert_not_called()
        self.assertEqual((note.status, note.attempts), ('pending', 1))

    def test_confirmed_resume_allows_one_send(self):
        self.pause()
        note = self.reminder()
        control.change(self.order, 'active', '已確認', self.admin.id, 1)
        db.session.commit()
        self.assertFalse(notify.resend(note.id))
        with patch.object(report_orders.handoff, '_ziwei_call', return_value=({'control': {'revision':2,'desired':'active'}}, None)):
            self.assertTrue(control.sync_one(self.order.id))
        self.assertTrue(notify.resend(note.id))
        self.assertTrue(notify.attempt(note))
        self.assertEqual(self.mail_send.call_count, 1)

    def test_superseded_or_expired_proof_never_resends(self):
        self.mail_send.side_effect = RuntimeError('offline')
        note = self.reminder()
        proofs.upload(self.job, self.admin.id, 'new.pdf', PDF)
        self.mail_send.side_effect = None
        self.mail_send.reset_mock()
        self.assertFalse(notify.resend(note.id))
        self.assertEqual(note.status, 'skipped')
        self.assertIsNone(notify.outbox_of(note).next_attempt_at)
        self.mail_send.assert_not_called()

    def test_elapsed_deadline_skips_deferred_reminder(self):
        self.pause()
        note = self.reminder()
        self.proof.due_at = datetime.utcnow() - timedelta(minutes=1)
        db.session.commit()
        self.assertFalse(notify.resend(note.id))
        self.assertEqual(note.status, 'skipped')
        self.mail_send.assert_not_called()

    def test_ready_notification_requires_a_document(self):
        self.assertFalse(notify.send_report_ready(self.order, self.user.email, []))
        note = OrderNotification.query.filter_by(event='report_ready').one()
        self.assertEqual((note.status, note.attempts), ('skipped', 0))
        self.mail_send.assert_not_called()

    def test_ready_notification_with_document_obeys_hold(self):
        delivery.upload_report_pdf(self.order.order_items[0], self.admin.id, 'final.pdf', PDF)
        self.pause()
        self.assertFalse(notify.send_report_ready(self.order, self.user.email, []))
        note = OrderNotification.query.filter_by(event='report_ready').one()
        self.assertEqual((note.status, note.attempts), ('pending', 0))
        self.mail_send.assert_not_called()


class ProxyIdentityBoundaryTests(_ProxyBase):
    def test_customer_committed_before_remote_chart_call(self):
        commits = []
        def committed(session):
            commits.append(True)
        event.listen(db.session, 'after_commit', committed)
        self.addCleanup(lambda: event.remove(db.session, 'after_commit', committed))
        original = self.fake_save_chart
        def remote(payload):
            self.assertTrue(commits, 'identity must be committed before another service reads it')
            self.assertEqual(ExternalCustomer.query.count(), 1)
            return original(payload)
        with patch.object(report_orders, '_save_chart', side_effect=remote):
            self.assertEqual(self.create().status_code, 201)
