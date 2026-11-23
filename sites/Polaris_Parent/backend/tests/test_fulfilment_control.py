"""Order control commands, retries and stale acknowledgements; isolated fixtures."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[4]))
from unittest.mock import patch
from core.backend_engine.factory import db
from sites.Polaris_Parent.backend.extensions.report_orders import control, commerce, handoff
from sites.Polaris_Parent.backend.extensions.report_orders.service import OrderError
from sites.Polaris_Parent.backend.commerce_models import CommerceExternalReceipt
from tests.test_report_proxy import _ProxyBase


class ControlTests(_ProxyBase):
    def test_hold_is_visible_and_manual_handoff_returns_conflict(self):
        o = self.created_order()
        self.pause(o)
        self.assertTrue(self.detail(o.order_no)['fulfilment_control']['blocked'])
        r = self.client.post(f'/api/v1/admin/report-orders/{o.order_no}/handoff', headers=self.headers(self.admin))
        self.assertEqual((r.status_code, r.get_json()['code']), (409, 'fulfilment_paused'))

    def test_repeated_failures_need_attention_and_manual_retry_keeps_version(self):
        o = self.created_order()
        self.pause(o)
        with patch.object(handoff, '_ziwei_call', return_value=(None, 'timeout')):
            for _ in range(6):
                control.sync_one(o.id)
        self.assertEqual(control.view(o)['sync'], 'attention')
        r = self.client.post(f'/api/v1/admin/report-orders/{o.order_no}/fulfilment-control',
                             json={'action': 'retry', 'revision': 1}, headers=self.headers(self.admin))
        self.assertEqual(r.status_code, 200)
        state = r.get_json()['control']
        self.assertEqual(state['revision'], 1)
        self.assertTrue(state['blocked'])
        self.assertIsNone(state['next_attempt_at'])
        with patch.object(handoff, '_ziwei_call', side_effect=self.ack):
            self.assertEqual(control.sync_due(), {'synced': 1, 'pending': 0})

    def pause(self, order):
        result = control.change(order, 'paused', '核對客製資料', self.admin.id, 0)
        db.session.commit()
        return result

    def ack(self, method, path, payload):
        return {'control': {'revision': payload['revision'], 'desired': payload['desired']}}, None

    def test_pause_blocks_locally_and_resume_waits_for_ack(self):
        o = self.created_order()
        self.pause(o)
        with self.assertRaises(OrderError):
            commerce.require(o.order_items[0], 'report')
        db.session.rollback()
        with patch.object(handoff, '_ziwei_call', side_effect=self.ack):
            self.assertTrue(control.sync_one(o.id))
            self.assertTrue(control.view(o)['blocked'])
            control.change(o, 'active', '已完成核對', self.admin.id, 1)
            db.session.commit()
            self.assertTrue(control.view(o)['blocked'])
            self.assertTrue(control.sync_one(o.id))
            self.assertFalse(control.view(o)['blocked'])

    def test_failed_sync_retains_hold_and_retries(self):
        o = self.created_order()
        self.pause(o)
        with patch.object(handoff, '_ziwei_call', return_value=(None, 'timeout')):
            self.assertFalse(control.sync_one(o.id))
        self.assertTrue(control.view(o)['blocked'])
        self.assertIsNotNone(control.view(o)['next_attempt_at'])
        with patch.object(handoff, '_ziwei_call', side_effect=self.ack):
            self.assertTrue(control.sync_one(o.id))

    def test_late_ack_cannot_overwrite_new_revision(self):
        o = self.created_order()
        self.pause(o)
        def late(method, path, payload):
            control.change(o, 'active', '完成核對', self.admin.id, 1)
            db.session.commit()
            return self.ack(method, path, payload)
        with patch.object(handoff, '_ziwei_call', side_effect=late):
            self.assertFalse(control.sync_one(o.id))
        self.assertEqual(control.view(o)['revision'], 2)
        self.assertTrue(control.view(o)['blocked'])

    def test_void_evidence_cannot_be_resumed(self):
        o = self.created_order()
        self.pause(o)
        CommerceExternalReceipt.query.one().status = 'voided'
        db.session.commit()
        with self.assertRaises(OrderError):
            control.change(o, 'active', '嘗試恢復', self.admin.id, 1)
        db.session.rollback()
        self.assertEqual(control.view(o)['desired'], 'paused')

    def test_api_requires_permission_reason_and_current_version(self):
        o = self.created_order()
        url = f'/api/v1/admin/report-orders/{o.order_no}/fulfilment-control'
        body = dict(desired='paused', reason='核對', revision=0)
        self.assertEqual(self.client.post(url, json=body, headers=self.headers()).status_code, 403)
        self.assertEqual(self.client.post(url, json={**body, 'reason': ''}, headers=self.headers(self.admin)).status_code, 400)
        self.assertEqual(self.client.post(url, json=body, headers=self.headers(self.admin)).status_code, 200)
        self.assertEqual(self.client.post(url, json=body, headers=self.headers(self.admin)).status_code, 409)
