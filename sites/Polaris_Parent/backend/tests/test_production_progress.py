"""Production polling with fake remote replies; never contacts Polaris."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[4]))
from datetime import datetime, timedelta, timezone
from unittest.mock import patch
from core.backend_engine.factory import db
from sites.Polaris_Parent.backend.models import ReportFulfillment, ReportDocument
from sites.Polaris_Parent.backend.extensions.report_orders import progress, handoff, control
from tests.test_report_proxy import _ProxyBase


class ProgressTests(_ProxyBase):
    def setUp(self):
        super().setUp()
        self.order = self.created_order()
        self.f = ReportFulfillment.query.one()
        self.f.handoff_status = 'sent'
        db.session.commit()
        self.stamp = datetime.now(timezone.utc) - timedelta(minutes=1)

    def reply(self, **over):
        row = dict(request_no=self.f.request_no, order_no=self.order.order_no, member_id=str(self.f.member_id),
                   language=self.order.language, status='in_progress', member_note='編輯製作中',
                   internal_note='private', updated_at=self.stamp.isoformat())
        row.update(over)
        return {'request': row}, None

    def sync(self, **over):
        with patch.object(handoff, '_ziwei_call', return_value=self.reply(**over)):
            return progress.sync_one(self.f.id)

    def test_completed_is_not_a_deliverable_and_private_notes_are_excluded(self):
        self.assertTrue(self.sync(status='completed'))
        self.assertEqual(self.f.ziwei_status, 'completed')
        self.assertIsNone(self.f.deliverable_ready_at)
        self.assertEqual(ReportDocument.query.count(), 0)
        public = progress.view(self.f, public=True)
        self.assertEqual(public['status_label'], '製作已完成，待交付')
        self.assertNotIn('private', str(public))
        self.assertNotIn('error', public)

    def test_wrong_identity_language_or_timestamp_rejected(self):
        for over in ({'member_id': 999}, {'order_no': 'other'}, {'language': 'en'},
                     {'request_no': 'other'}, {'status': 'bogus'}, {'updated_at': 'not-a-date'}):
            self.assertFalse(self.sync(**over))
            self.assertIsNone(self.f.ziwei_status)

    def test_old_reply_cannot_regress_progress(self):
        self.assertTrue(self.sync(status='completed'))
        self.assertFalse(self.sync(updated_at=(self.stamp - timedelta(seconds=1)).isoformat()))
        self.assertEqual(self.f.ziwei_status, 'completed')

    def test_same_version_conflict_rejected_but_newer_reopen_allowed(self):
        self.assertTrue(self.sync(status='completed'))
        self.assertFalse(self.sync(status='needs_info'))
        self.assertEqual(self.f.ziwei_status, 'completed')
        self.assertTrue(self.sync(status='needs_info', updated_at=(self.stamp + timedelta(seconds=1)).isoformat()))
        self.assertEqual(self.f.ziwei_status, 'needs_info')

    def test_timeout_retains_progress_and_defers_retry(self):
        self.sync()
        with patch.object(handoff, '_ziwei_call', return_value=(None, 'secret endpoint')):
            self.assertFalse(progress.sync_one(self.f.id))
        self.assertEqual(self.f.ziwei_status, 'in_progress')
        self.assertTrue(progress.view(self.f)['stale'])
        self.assertNotIn('secret endpoint', str(progress.view(self.f)))
        with patch.object(handoff, '_ziwei_call') as call:
            self.assertEqual(progress.sync_due(), {'synced': 0, 'failed': 0})
            call.assert_not_called()

    def test_sync_does_not_clear_hold(self):
        control.change(self.order, 'paused', '確認資料', self.admin.id, 0)
        db.session.commit()
        self.assertTrue(self.sync())
        self.assertTrue(control.view(self.order)['blocked'])

    def test_claim_during_request_discards_response(self):
        response = self.reply()
        def remote(*args):
            self.f.member_id = self.user.id
            db.session.commit()
            return response
        with patch.object(handoff, '_ziwei_call', side_effect=remote):
            self.assertFalse(progress.sync_one(self.f.id))
        self.assertIsNone(self.f.ziwei_status)

    def test_endpoint_permission_and_success(self):
        url = f'/api/v1/admin/report-orders/{self.order.order_no}/production-sync'
        self.assertEqual(self.client.post(url, headers=self.headers()).status_code, 403)
        with patch.object(handoff, '_ziwei_call', return_value=self.reply(status='needs_info')):
            res = self.client.post(url, headers=self.headers(self.admin))
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.get_json()['progress']['status_label'], '待補資料')
