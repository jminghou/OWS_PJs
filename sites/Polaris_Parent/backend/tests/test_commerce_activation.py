"""Account-bound codes: isolated SQLite/API tests, no email or external platforms."""
import sys
from pathlib import Path
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[4]))
from core.backend_engine.factory import db
from core.backend_engine.services.rbac import RBACService
from packages.commerce.models import Order, PaymentAttempt
from sites.Polaris_Parent.backend.commerce_models import CommerceActivation, CommerceEntitlement, CommerceTask, CommerceEvent
from sites.Polaris_Parent.backend.extensions.report_orders import activation, commerce, physical
from sites.Polaris_Parent.backend.extensions.report_orders.service import OrderError
from sites.Polaris_Parent.backend.tests import test_commerce_foundation as foundation
from tests.test_report_orders import SHIPPING


class ActivationTests(foundation.FoundationTests):
    def setUp(self):
        super().setUp()
        self.app.config['COMMERCE_ACTIVATION_ENABLED'] = True
        CommerceActivation.__table__.create(db.engine)
        self.tables.append(CommerceActivation.__table__)
        perms = {'report_orders.read', 'report_orders.confirm_payment', 'report_orders.fulfill', 'report_orders.activation'}
        p = patch.object(RBACService, 'get_user_permissions',
                         side_effect=lambda uid: perms if int(uid) == self.admin.id else set())
        p.start()
        self.addCleanup(p.stop)

    def tearDown(self):
        self.app.config['COMMERCE_ACTIVATION_ENABLED'] = False
        super().tearDown()

    def book(self):
        self.paid_order(variant='physical', shipping=SHIPPING, physical={'spec_key': 'coated'})
        return CommerceEntitlement.query.filter_by(kind='book').one()

    def issue(self, ent, user=None, **body):
        return self.client.post(f'/api/v1/admin/report-entitlements/{ent.id}/activation',
                                json={'days': 14, **body}, headers=self.headers(user or self.admin))

    def redeem(self, code, user=None, **body):
        return self.client.post('/api/v1/report-activations/redeem', json={'code': code, **body},
                                headers=self.headers(user or self.user))

    def test_code_hash_only_account_bound_and_retry_does_not_duplicate(self):
        ent = self.book()
        response = self.issue(ent)
        self.assertEqual(response.status_code, 201, response.get_json())
        self.assertEqual(response.headers['Cache-Control'], 'no-store')
        code = response.get_json()['code']
        row = CommerceActivation.query.one()
        self.assertEqual(len(row.code_digest), 64)
        self.assertNotIn(code, repr(row.__dict__))
        item = Order.query.one().order_items[0]
        with self.assertRaises(OrderError) as ctx:
            commerce.require(item, 'book', self.user.id)
        self.assertEqual(ctx.exception.code, 'activation_required')
        self.assertEqual(self.redeem(code).status_code, 200)
        retry = self.redeem(code.lower().replace('-', ' '))
        self.assertEqual(retry.status_code, 200)
        self.assertFalse(retry.get_json()['redeemed'])
        self.assertEqual(CommerceEntitlement.query.count(), 2)
        self.assertEqual(PaymentAttempt.query.count(), 1)
        self.assertEqual(CommerceTask.query.count(), 1)
        self.assertEqual(CommerceEvent.query.filter_by(event_type='activation_redeemed').count(), 1)
        self.assertEqual(commerce.require(item, 'book', self.user.id)[0].id, ent.id)
        summary = commerce.view(Order.query.one())
        self.assertNotIn(code, str(summary))
        self.assertNotIn(row.code_digest, str(summary))

    def test_wrong_account_and_wrong_order_cannot_redeem_or_leak_order(self):
        ent = self.book()
        code = self.issue(ent).get_json()['code']
        other = self.make_user('other-activation@example.test', verified=True)
        result = self.redeem(code, other)
        self.assertEqual((result.status_code, result.get_json()['code']), (400, 'invalid_activation'))
        self.assertNotIn('order', result.get_json())
        self.assertEqual(self.redeem(code, order_no='different').status_code, 400)
        self.assertEqual(CommerceActivation.query.one().status, 'issued')

    def test_issue_requires_special_permission_active_user_and_verified_redemption(self):
        ent = self.book()
        self.assertEqual(self.issue(ent, self.user).status_code, 403)
        with patch.object(RBACService, 'get_user_permissions', return_value={'report_orders.fulfill'}):
            self.assertEqual(self.issue(ent).status_code, 403)
        code = self.issue(ent).get_json()['code']
        with patch('sites.Polaris_Parent.backend.extensions.report_orders.is_email_verified', return_value=False):
            self.assertEqual(self.redeem(code).status_code, 403)
        self.user.is_active = False
        db.session.commit()
        self.assertEqual(self.redeem(code).status_code, 401)

    def test_expiration_replacement_and_revocation_keep_gate(self):
        ent = self.book()
        old = self.issue(ent).get_json()['code']
        self.assertEqual(self.issue(ent).status_code, 409)
        row = CommerceActivation.query.one()
        row.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        db.session.commit()
        self.assertEqual(self.redeem(old).get_json()['code'], 'activation_expired')
        new = self.issue(ent).get_json()
        self.assertEqual(self.redeem(old).get_json()['code'], 'activation_unavailable')
        response = self.admin_post(f'report-activations/{new["activation_id"]}/revoke', {'reason': 'lost'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.redeem(new['code']).status_code, 409)
        with self.assertRaises(OrderError):
            commerce.require(Order.query.one().order_items[0], 'book')
        replacement = self.issue(ent).get_json()['code']
        self.assertEqual(self.redeem(replacement).status_code, 200)

    def test_cancellation_invalidates_code_without_reviving_right(self):
        ent = self.book()
        code = self.issue(ent).get_json()['code']
        physical.cancel_physical(Order.query.one(), 'member', 'cancel')
        self.assertEqual(CommerceActivation.query.one().status, 'revoked')
        self.assertEqual(self.redeem(code).status_code, 409)
        self.assertEqual(self.issue(ent).status_code, 409)
        self.assertEqual(CommerceEntitlement.query.filter_by(kind='book').one().status, 'revoked')

    def test_cannot_issue_for_started_right_or_revoke_redeemed_code(self):
        ent = self.book()
        report = CommerceEntitlement.query.filter_by(kind='report').one()
        self.assertEqual(self.issue(report).status_code, 409)
        issued = self.issue(ent).get_json()
        self.redeem(issued['code'])
        self.assertEqual(self.issue(ent).get_json()['code'], 'already_activated')
        self.assertEqual(self.admin_post(f'report-activations/{issued["activation_id"]}/revoke', {'reason': 'x'}).status_code, 409)

    def test_feature_off_does_not_bypass_existing_gate(self):
        ent = self.book()
        issued = self.issue(ent).get_json()
        self.app.config['COMMERCE_ACTIVATION_ENABLED'] = False
        self.assertEqual(self.issue(ent).status_code, 503)
        self.assertEqual(self.redeem(issued['code']).status_code, 503)
        with self.assertRaises(OrderError):
            commerce.require(Order.query.one().order_items[0], 'book')
        self.assertEqual(self.admin_post(f'report-activations/{issued["activation_id"]}/revoke', {'reason': 'pause'}).status_code, 200)

    def test_invalid_inputs_and_missing_payment_evidence(self):
        ent = self.book()
        for days in (True, 0, 91, '14'):
            self.assertEqual(self.issue(ent, days=days).status_code, 400)
        for code in (None, [], 'x' * 100, 'PP-invalid'):
            self.assertEqual(self.redeem(code).status_code, 400)
        attempt = PaymentAttempt.query.one()
        attempt.amount += 1
        db.session.commit()
        self.assertEqual(self.issue(ent).get_json()['code'], 'payment_evidence_required')

    def test_atomic_issuance_failure_leaves_no_gate_or_code(self):
        ent = self.book()
        with patch.object(commerce, 'event', side_effect=RuntimeError('test failure')):
            with self.assertRaises(RuntimeError):
                activation.issue(ent.id, self.admin.id)
        db.session.rollback()
        self.assertEqual(CommerceActivation.query.count(), 0)
        self.assertNotIn(activation.MARKER, Order.query.one().attributes)

    def test_pending_activation_does_not_break_admin_design_audit(self):
        from sites.Polaris_Parent.backend.extensions.report_orders import delivery, design
        self.book()
        order = Order.query.one()
        with patch.object(delivery.private_storage, 'save', return_value=(20, 'test-digest')):
            delivery.upload_report_pdf(order.order_items[0], self.admin.id, 'r.pdf', b'%PDF-test')
        book = design.design_for_job(self.user, order)
        ent = CommerceEntitlement.query.filter_by(kind='book').one()
        self.issue(ent)
        self.assertEqual(design.purchased(book), {'custom': [], 'spreads': 0})
        with self.assertRaises(OrderError):
            design.confirm(book)
        self.assertEqual(self.client.get('/api/v1/admin/report-print-jobs', headers=self.headers(self.admin)).status_code, 200)

    def test_consult_group_waits_for_its_gated_unit_only(self):
        self.paid_order(consult_sessions=2)
        ent = CommerceEntitlement.query.filter_by(kind='consult', unit_index=1).one()
        code = self.issue(ent).get_json()['code']
        order = Order.query.one()
        consult_item = next(i for i in order.order_items if i.variant == 'consult')
        row = physical.consultation_for(consult_item)
        with self.assertRaises(OrderError):
            physical.schedule_consult(row, self.admin.id, '2026-11-01T10:00:00')
        self.assertEqual(self.redeem(code).status_code, 200)
        physical.schedule_consult(row, self.admin.id, '2026-11-01T10:00:00')
        self.assertEqual(CommerceTask.query.count(), 3)

    def test_redemption_failure_rolls_back_claim_and_audit(self):
        ent = self.book()
        code = self.issue(ent).get_json()['code']
        with patch.object(commerce, 'event', side_effect=RuntimeError('test failure')):
            with self.assertRaises(RuntimeError):
                activation.redeem(code, self.user.id)
        db.session.rollback()
        self.assertEqual(CommerceActivation.query.one().status, 'issued')
        self.assertIsNone(CommerceActivation.query.one().redeemed_at)
        self.assertEqual(CommerceEvent.query.filter_by(event_type='activation_redeemed').count(), 0)
