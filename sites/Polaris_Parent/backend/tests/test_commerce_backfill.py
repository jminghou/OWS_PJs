"""Historical conversion uses isolated legacy fixtures; never touches a live database."""
import sys
import time
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[4]))
from core.backend_engine.factory import db
from core.backend_engine.services.rbac import RBACService
from packages.commerce.models import Order, PaymentAttempt
from sites.Polaris_Parent.backend.commerce_models import CommerceLine, CommerceEntitlement, CommerceTask, CommerceEvent
from sites.Polaris_Parent.backend.extensions.report_orders import backfill, physical, delivery, design
from sites.Polaris_Parent.backend.tests import test_commerce_foundation as foundation
from tests.test_report_orders import SHIPPING, payload


class BackfillTests(foundation.FoundationTests):
    def setUp(self):
        super().setUp()
        self.app.config['COMMERCE_BACKFILL_ENABLED'] = True
        perms = {'report_orders.read', 'report_orders.confirm_payment', 'report_orders.fulfill', 'report_orders.backfill'}
        p = patch.object(RBACService, 'get_user_permissions',
                         side_effect=lambda uid: perms if int(uid) == self.admin.id else set())
        p.start()
        self.addCleanup(p.stop)

    def tearDown(self):
        self.app.config['COMMERCE_BACKFILL_ENABLED'] = False
        super().tearDown()

    def legacy(self, **over):
        self.app.config['COMMERCE_FOUNDATION_ENABLED'] = False
        result = self.paid_order(**over)
        self.app.config['COMMERCE_FOUNDATION_ENABLED'] = True
        return Order.query.filter_by(order_no=result['order_no']).one()

    def preview(self, order):
        response = self.client.get(f'/api/v1/admin/report-orders/{order.order_no}/commerce-review', headers=self.headers(self.admin))
        self.assertEqual(response.status_code, 200, response.get_json())
        return response.get_json()['review']

    def apply_review(self, order, plan, **over):
        return self.admin_post(f'report-orders/{order.order_no}/commerce-review',
                              {'review_token': plan.get('review_token'), 'note': '核對既有收款與履約紀錄', 'confirmed': True, **over})

    def test_readonly_preview_and_idempotent_apply_do_not_pay_or_dispatch_again(self):
        order = self.legacy()
        original_items, paid_at = order.items, order.paid_at
        plan = self.preview(order)
        self.assertEqual(plan['decision'], 'review_required')
        self.assertEqual(plan['lines'][0]['grants'][0]['status'], 'in_use')
        self.assertEqual(CommerceEntitlement.query.count(), 0)
        self.assertNotIn('birth', str(plan))
        self.assertNotIn('subject_name', str(plan))
        sent_before = self.mail_send.call_count
        applied = self.apply_review(order, plan)
        self.assertEqual(applied.status_code, 200, applied.get_json())
        self.assertTrue(applied.get_json()['changed'])
        self.assertFalse(self.apply_review(order, plan).get_json()['changed'])
        self.assertEqual(PaymentAttempt.query.count(), 1)
        self.assertEqual(CommerceEntitlement.query.count(), 1)
        self.assertEqual(CommerceTask.query.count(), 1)
        self.assertEqual(CommerceEvent.query.filter_by(event_type='order_backfilled').count(), 1)
        self.assertEqual(CommerceEvent.query.filter_by(event_type='payment_confirmed').count(), 0)
        self.assertEqual(self.mail_send.call_count, sent_before)
        self.assertEqual((order.items, order.paid_at), (original_items, paid_at))

    def test_delivered_report_and_cancelled_book_preserve_terminal_states(self):
        order = self.legacy(variant='physical', shipping=SHIPPING, physical={'spec_key': 'coated'})
        item = order.order_items[0]
        with patch.object(delivery.private_storage, 'save', return_value=(20, 'hash')):
            delivery.upload_report_pdf(item, self.admin.id, 'r.pdf', b'%PDF-test')
        physical.cancel_physical(order, 'member', 'history')
        plan = self.preview(order)
        self.assertEqual(plan['decision'], 'review_required', plan)
        self.assertEqual(self.apply_review(order, plan).status_code, 200)
        self.assertEqual(CommerceEntitlement.query.filter_by(kind='report').one().status, 'completed')
        self.assertEqual(CommerceEntitlement.query.filter_by(kind='book').one().status, 'revoked')
        self.assertEqual({t.status for t in CommerceTask.query.all()}, {'completed', 'cancelled'})

    def test_completed_book_and_consult_remain_completed(self):
        order = self.legacy(variant='physical', shipping=SHIPPING, physical={'spec_key': 'coated'}, consult_sessions=2)
        item = order.order_items[0]
        with patch.object(delivery.private_storage, 'save', return_value=(20, 'hash')):
            delivery.upload_report_pdf(item, self.admin.id, 'r.pdf', b'%PDF-test')
        book = design.design_for_job(self.user, order)
        job = design.confirm(book)
        physical.mark_printing(job, self.admin.id)
        physical.mark_shipped(job, self.admin.id, 'test', 'test')
        physical.mark_delivered(job, self.admin.id)
        ci = next(i for i in order.order_items if i.variant == 'consult')
        consult = physical.consultation_for(ci)
        physical.schedule_consult(consult, self.admin.id, '2026-11-01T10:00:00')
        physical.complete_consult(consult, self.admin.id)
        plan = self.preview(order)
        self.assertEqual(plan['decision'], 'review_required', plan)
        self.assertEqual(self.apply_review(order, plan).status_code, 200)
        self.assertEqual(CommerceEntitlement.query.count(), 4)
        self.assertTrue(all(e.status == 'completed' for e in CommerceEntitlement.query.all()))

    def test_addon_normalization_preserves_original_snapshot_and_audit(self):
        parent = self.legacy()
        self.app.config['COMMERCE_FOUNDATION_ENABLED'] = False
        result = self.addon(parent.order_no, physical={'spec_key': 'coated', 'quantity': 3}).get_json()['order']
        self.confirm(result['order_no'], result['amount'])
        order = Order.query.filter_by(order_no=result['order_no']).one()
        before = order.items
        plan = self.preview(order)
        self.assertEqual(plan['decision'], 'review_required', plan)
        self.assertEqual((plan['lines'][0]['original_quantity'], plan['lines'][0]['quantity']), (3, 1))
        self.assertEqual(self.apply_review(order, plan).status_code, 200)
        line = CommerceLine.query.one()
        self.assertEqual((line.line_total, line.print_copies, order.order_items[0].quantity), (2400, 3, 1))
        self.assertEqual(order.items, before)
        audit = CommerceEvent.query.filter_by(event_type='order_backfilled').one()
        self.assertEqual(audit.detail['lines'][0]['original_quantity'], 3)

    def test_cancelled_paid_addon_has_only_revoked_rights(self):
        parent = self.legacy()
        self.app.config['COMMERCE_FOUNDATION_ENABLED'] = False
        result = self.addon(parent.order_no, physical={'spec_key': 'coated'}).get_json()['order']
        self.confirm(result['order_no'], result['amount'])
        order = Order.query.filter_by(order_no=result['order_no']).one()
        physical.cancel_physical(order, 'member', 'history')
        plan = self.preview(order)
        self.assertEqual(plan['decision'], 'review_required', plan)
        self.assertEqual(self.apply_review(order, plan).status_code, 200)
        self.assertEqual(CommerceEntitlement.query.one().status, 'revoked')
        self.assertEqual(order.status, 'cancelled')

    def test_unpaid_skips_and_paid_without_evidence_blocks(self):
        self.app.config['COMMERCE_FOUNDATION_ENABLED'] = False
        self.post(payload())
        order = Order.query.one()
        self.assertEqual(self.preview(order)['decision'], 'skip_unpaid')
        order.status = 'paid'
        db.session.commit()
        plan = self.preview(order)
        self.assertEqual(plan['decision'], 'blocked')
        self.assertNotIn('review_token', plan)

    def test_payment_mismatch_and_missing_snapshots_block(self):
        order = self.legacy(variant='physical', shipping=SHIPPING, physical={'spec_key': 'coated'})
        attempt = PaymentAttempt.query.one()
        attempt.amount += 1
        db.session.commit()
        self.assertEqual(self.preview(order)['reasons'][0]['code'], 'payment_evidence_required')
        attempt.amount = order.amount
        physical.print_job_for(order.order_items[0]).pricing = {}
        db.session.commit()
        self.assertEqual(self.preview(order)['reasons'][0]['code'], 'missing_book_snapshot')

    def test_changes_after_preview_reject_without_writing(self):
        order = self.legacy(variant='physical', shipping=SHIPPING, physical={'spec_key': 'coated'})
        plan = self.preview(order)
        physical.cancel_physical(order, 'member', 'changed after review')
        response = self.apply_review(order, plan)
        self.assertEqual((response.status_code, response.get_json()['code']), (409, 'review_stale'))
        self.assertEqual(CommerceEntitlement.query.count(), 0)

    def test_current_catalog_changes_do_not_reprice_history(self):
        order = self.legacy(variant='physical', shipping=SHIPPING, physical={'spec_key': 'coated'})
        plan = self.preview(order)
        self.configure(first_copy_price=999999, custom_options={})
        self.assertEqual(self.apply_review(order, plan).status_code, 200)
        self.assertEqual(CommerceLine.query.one().line_total, order.amount)

    def test_token_signature_identity_expiry_and_explicit_confirmation(self):
        order = self.legacy()
        plan = self.preview(order)
        self.assertEqual(self.apply_review(order, plan, confirmed=False).status_code, 400)
        self.assertEqual(self.apply_review(order, plan, note='').status_code, 400)
        self.assertEqual(self.apply_review(order, plan, review_token=plan['review_token'] + 'bad').status_code, 409)
        wrong = backfill.review(order, self.user.id)
        self.assertEqual(self.apply_review(order, wrong).status_code, 403)
        with patch('itsdangerous.timed.time.time', return_value=time.time() + 1801):
            self.assertEqual(self.apply_review(order, plan).status_code, 409)
        self.assertEqual(CommerceEntitlement.query.count(), 0)

    def test_dedicated_permission_and_switch_required(self):
        order = self.legacy()
        path = f'/api/v1/admin/report-orders/{order.order_no}/commerce-review'
        self.assertEqual(self.client.get(path, headers=self.headers()).status_code, 403)
        with patch.object(RBACService, 'get_user_permissions', return_value={'report_orders.read', 'report_orders.confirm_payment'}):
            self.assertEqual(self.client.get(path, headers=self.headers(self.admin)).status_code, 403)
        plan = self.preview(order)
        self.app.config['COMMERCE_BACKFILL_ENABLED'] = False
        self.assertEqual(self.preview(order)['decision'], 'review_required')
        self.assertEqual(self.apply_review(order, plan).status_code, 503)

    def test_failure_rolls_back_all_contract_rows(self):
        order = self.legacy()
        plan = self.preview(order)
        with patch.object(backfill.commerce, 'event', side_effect=RuntimeError('simulated failure')):
            with self.assertRaises(RuntimeError):
                backfill.apply(order, self.admin.id, plan['review_token'], 'checked', True)
        db.session.rollback()
        self.assertEqual(CommerceLine.query.count(), 0)
        self.assertEqual(CommerceEntitlement.query.count(), 0)
        self.assertEqual(CommerceTask.query.count(), 0)
        self.assertNotIn('commerce_contract_version', Order.query.one().attributes)

    def test_stale_partial_contract_and_ownership_mismatch_block(self):
        order = self.legacy()
        f = delivery.ReportFulfillment.query.one()
        f.member_id += 1
        db.session.commit()
        self.assertEqual(self.preview(order)['reasons'][0]['code'], 'ownership_mismatch')
        f.member_id = self.user.id
        db.session.add(CommerceEvent(order_id=order.id, event_key='partial-test', event_type='test', detail={}))
        db.session.commit()
        self.assertEqual(self.preview(order)['reasons'][0]['code'], 'partial_contract')
