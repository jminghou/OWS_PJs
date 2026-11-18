"""Cross-entry evidence/entitlement checks; no real network or production app."""
from datetime import datetime, timedelta, timezone
from unittest.mock import patch
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4]))

from core.backend_engine.factory import db
from packages.commerce.models import PaymentAttempt
from sites.Polaris_Parent.backend.commerce_models import CommerceEntitlement, CommerceExternalReceipt, CommerceSource
from sites.Polaris_Parent.backend.extensions.report_orders import commerce, handoff, proofs
from sites.Polaris_Parent.backend.extensions.report_orders.service import OrderError
from sites.Polaris_Parent.backend.models import ReportFulfillment, ReportPrintJob, ReportPrintProof
from tests.test_report_proxy import _ProxyBase, PDF


class FulfilmentBoundaryTests(_ProxyBase):
    def test_customer_secret_always_meets_password_rules(self):
        with patch('sites.Polaris_Parent.backend.extensions.report_orders.proxy.secrets.token_urlsafe',
                   return_value='a' * 43):
            self.created_order()

    def test_proxy_and_direct_gift_require_contract_even_when_switch_off(self):
        self.app.config['COMMERCE_FOUNDATION_ENABLED'] = False
        for data in ({}, {'source': 'direct', 'amount': '0', 'external_order_id': 'GIFT-1'}):
            order = self.created_order(**data)
            self.assertTrue(commerce.tracked(order))
            self.assertIsNotNone(db.session.get(CommerceSource, order.id))
        self.assertEqual(CommerceEntitlement.query.count(), 4)
        self.assertEqual(PaymentAttempt.query.count(), 0)

    def test_void_blocks_handoff_without_network_attempt(self):
        order = self.created_order()
        CommerceExternalReceipt.query.one().status = 'voided'
        db.session.commit()
        with patch.object(handoff, '_ziwei_call') as remote:
            self.assertEqual(handoff.send_due(), (0, 1))
            self.assertFalse(handoff.send_now(order)[0][1])
            remote.assert_not_called()
        f = ReportFulfillment.query.one()
        self.assertEqual(f.handoff_attempts, 0)
        self.assertEqual(order.status, 'paid')
        self.assertIn('履約暫停', f.last_error)

    def test_legacy_external_evidence_cannot_bypass_checks(self):
        order = self.created_order()
        order.attributes = {}
        CommerceExternalReceipt.query.one().status = 'voided'
        db.session.commit()
        with self.assertRaises(OrderError):
            commerce.require(order.order_items[0], 'report')
        db.session.rollback()

    def test_revoked_entitlement_blocks_handoff(self):
        self.created_order()
        CommerceEntitlement.query.filter_by(kind='report').one().status = 'revoked'
        db.session.commit()
        with patch.object(handoff, '_ziwei_call') as remote:
            self.assertEqual(handoff.send_due(), (0, 1))
            remote.assert_not_called()

    def test_void_blocks_proof_upload_and_automatic_approval(self):
        self.created_order()
        job = ReportPrintJob.query.one()
        proof = proofs.upload(job, self.admin.id, 'proof.pdf', PDF)
        proof.due_at = datetime.now(timezone.utc) - timedelta(days=1)
        CommerceExternalReceipt.query.one().status = 'voided'
        db.session.commit()
        with self.assertRaises(OrderError):
            proofs.upload(job, self.admin.id, 'replacement.pdf', PDF)
        db.session.rollback()
        with self.assertRaises(OrderError):
            proofs.admin_approve(job, self.admin.id, 'confirmed')
        db.session.rollback()
        self.assertEqual(proofs.auto_approve_due(), [])
        db.session.rollback()
        self.assertEqual(ReportPrintProof.query.count(), 1)
        self.assertEqual(ReportPrintJob.query.one().status, 'proof_ready')
        self.assertIsNone(ReportPrintProof.query.one().decision)
