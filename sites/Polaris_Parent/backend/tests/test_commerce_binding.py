"""External proof binds a digital contract, never a website payment attempt."""
import sys
from pathlib import Path
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[4]))
from core.backend_engine.factory import db
from core.backend_engine.services.rbac import RBACService
from packages.commerce.models import Order, PaymentAttempt, Product
from sites.Polaris_Parent.backend.models import ReportFulfillment
from sites.Polaris_Parent.backend.commerce_models import (
    CommerceChannel, CommerceExternalReceipt, CommerceIntakeEvent, CommerceProductMapping, CommerceReceiptBinding,
    CommerceSource, CommerceLine, CommerceEntitlement, CommerceTask, CommerceEvent,
)
from sites.Polaris_Parent.backend.extensions.report_orders import binding, intake, commerce, delivery, payment
from sites.Polaris_Parent.backend.extensions.report_orders.service import OrderError
from sites.Polaris_Parent.backend.tests import test_commerce_foundation as foundation
from tests.test_report_orders import payload, SHIPPING


class BindingTests(foundation.FoundationTests):
    def setUp(self):
        super().setUp()
        for model in (CommerceChannel, CommerceExternalReceipt, CommerceIntakeEvent, CommerceProductMapping, CommerceReceiptBinding):
            if model.__table__ in self.tables:  # 基底已建（例：稽核用的 commerce_events）
                continue
            model.__table__.create(db.engine)
            self.tables.append(model.__table__)
        self.app.config.update(COMMERCE_INTAKE_ENABLED=True, COMMERCE_BINDING_ENABLED=True)
        perms = {'report_orders.read', 'report_orders.confirm_payment', 'report_orders.fulfill',
                 'report_orders.intake', 'report_orders.channels', 'report_orders.contracts'}
        p = patch.object(RBACService, 'get_user_permissions', side_effect=lambda uid: perms if int(uid) == self.admin.id else set())
        p.start()
        self.addCleanup(p.stop)

    def tearDown(self):
        self.app.config.update(COMMERCE_INTAKE_ENABLED=False, COMMERCE_BINDING_ENABLED=False)
        super().tearDown()

    def seed(self):
        result = self.post(payload())
        self.assertEqual(result.status_code, 201, result.get_json())
        order = Order.query.one()
        expiry = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
        channel = intake.save_channel(dict(channel='test-market', store_key='test-shop', manual_import=True,
            policy_reference='test:intake', review_note='test only', valid_until=expiry), self.admin.id)
        self.map_data = dict(channel_id=channel.id, channel_revision=channel.revision, external_sku='EXT-DIGITAL',
            template_item_no=order.order_items[0].item_no, active=True,
            policy_reference='test:fulfilment', review_note='digital matching only', valid_until=expiry)
        binding.save_mapping(self.map_data, self.admin.id)
        receipt, _ = intake.import_receipt(dict(channel_id=channel.id, channel_revision=channel.revision,
            external_order_id='external-1', member_id=self.user.id, amount=order.amount, currency='TWD',
            lines=[dict(external_sku='EXT-DIGITAL', quantity=1, unit_amount=order.amount)]), self.admin.id)
        self.review_data = dict(channel_revision=1, fingerprint=receipt.fingerprint, decision='verified',
            note='verified', evidence_reference='test:receipt', payment_confirmed=True, ownership_confirmed=True)
        intake.review(receipt.id, self.review_data, self.admin.id)
        db.session.commit()
        return order, receipt

    def preview(self, order, receipt):
        response = self.admin_post(f'commerce-receipts/{receipt.id}/contract-preview', {'order_no': order.order_no})
        self.assertEqual(response.status_code, 200, response.get_json())
        return response.get_json()['review']

    def apply_plan(self, receipt, plan, **over):
        return self.admin_post(f'commerce-receipts/{receipt.id}/contract',
            dict(review_token=plan['review_token'], confirmed=True, note='核對客製對象與平台成交') | over)

    def test_exact_match_grants_once_without_payment_or_mail_and_delivers(self):
        order, receipt = self.seed()
        plan = self.preview(order, receipt)
        self.assertNotIn('birth', str(plan))
        self.assertEqual(CommerceEntitlement.query.count(), 0)
        mail_before = self.mail_send.call_count
        result = self.apply_plan(receipt, plan)
        self.assertEqual(result.status_code, 200, result.get_json())
        self.assertTrue(result.get_json()['changed'])
        self.assertFalse(self.apply_plan(receipt, plan).get_json()['changed'])
        self.assertEqual(Order.query.count(), 1)
        self.assertEqual(PaymentAttempt.query.count(), 0)
        self.assertEqual(order.payment_method, 'external_verified')
        self.assertEqual(CommerceEntitlement.query.count(), 1)
        self.assertEqual(CommerceTask.query.count(), 1)
        self.assertEqual(CommerceEvent.query.filter_by(event_type='payment_confirmed').count(), 0)
        self.assertEqual(CommerceEvent.query.filter_by(event_type='external_sale_confirmed').count(), 1)
        self.assertEqual(CommerceReceiptBinding.query.count(), 1)
        self.assertEqual(self.mail_send.call_count, mail_before)
        self.assertEqual(db.session.get(CommerceSource, order.id).channel, 'test-market')
        self.assertIsNone(result.get_json()['order']['addon_offer'])
        self.assertFalse(result.get_json()['order']['commerce']['activation_enabled'])
        with patch.object(delivery.private_storage, 'save', return_value=(20, 'test')):
            delivery.upload_report_pdf(order.order_items[0], self.admin.id, 'test.pdf', b'%PDF-test')
        self.assertEqual(CommerceEntitlement.query.one().status, 'completed')

    def test_void_blocks_delivery_even_with_switches_off(self):
        order, receipt = self.seed()
        self.assertEqual(self.apply_plan(receipt, self.preview(order, receipt)).status_code, 200)
        intake.review(receipt.id, self.review_data | {'decision': 'voided'}, self.admin.id)
        db.session.commit()
        self.app.config.update(COMMERCE_INTAKE_ENABLED=False, COMMERCE_BINDING_ENABLED=False, COMMERCE_FOUNDATION_ENABLED=False)
        with self.assertRaises(OrderError) as err:
            commerce.require(order.order_items[0], 'report')
        self.assertEqual(err.exception.code, 'external_evidence_unavailable')
        self.assertTrue(commerce.view(order)['external']['fulfilment_blocked'])
        self.assertEqual(CommerceEvent.query.filter_by(event_type='external_evidence_voided').count(), 1)

    def test_stale_mapping_rejected_and_catalog_not_used(self):
        order, receipt = self.seed()
        plan = self.preview(order, receipt)
        binding.save_mapping(self.map_data | {'revision': 1, 'review_note': 'new policy'}, self.admin.id)
        db.session.commit()
        self.assertEqual(self.apply_plan(receipt, plan).get_json()['code'], 'stale_review')
        Product.query.update({'price': 9999})
        db.session.commit()
        self.assertEqual(self.apply_plan(receipt, self.preview(order, receipt)).status_code, 200)

    def test_stale_customization_and_tampered_token(self):
        order, receipt = self.seed()
        plan = self.preview(order, receipt)
        item = order.order_items[0]
        item.customization = {**item.customization, 'subject_name': 'changed'}
        db.session.commit()
        self.assertEqual(self.apply_plan(receipt, plan).get_json()['code'], 'stale_review')
        self.assertEqual(self.apply_plan(receipt, plan, review_token='fake').get_json()['code'], 'invalid_review_token')

    def test_transfer_or_manual_payment_blocks_binding(self):
        order, receipt = self.seed()
        plan = self.preview(order, receipt)
        payment.confirm_manual_payment(order, self.admin.id, order.amount)
        self.assertEqual(self.apply_plan(receipt, plan).status_code, 409)
        self.assertEqual(CommerceReceiptBinding.query.count(), 0)
        self.assertEqual(PaymentAttempt.query.count(), 1)
        self.assertEqual(db.session.get(CommerceSource, order.id).channel, 'website')

    def test_pending_transfer_blocks_without_claiming_external_evidence(self):
        order, receipt = self.seed()
        plan = self.preview(order, receipt)
        payment.report_transfer(order, dict(last5='12345', transferred_on=datetime.now(timezone.utc).date().isoformat(), amount=order.amount))
        self.assertEqual(self.apply_plan(receipt, plan).get_json()['code'], 'payment_conflict')
        self.assertEqual(CommerceReceiptBinding.query.count(), 0)
        self.assertEqual(CommerceEntitlement.query.count(), 0)

    def test_two_receipts_cannot_fund_one_contract(self):
        order, receipt = self.seed()
        second, _ = intake.import_receipt(dict(channel_id=receipt.channel_id, channel_revision=1,
            external_order_id='external-2', member_id=self.user.id, amount=order.amount, currency='TWD',
            lines=[dict(external_sku='EXT-DIGITAL', quantity=1, unit_amount=order.amount)]), self.admin.id)
        intake.review(second.id, self.review_data | {'fingerprint': second.fingerprint}, self.admin.id)
        db.session.commit()
        first_plan, second_plan = self.preview(order, receipt), self.preview(order, second)
        self.assertEqual(self.apply_plan(receipt, first_plan).status_code, 200)
        self.assertEqual(self.apply_plan(second, second_plan).status_code, 409)
        self.assertEqual(CommerceReceiptBinding.query.count(), 1)
        self.assertEqual(CommerceEntitlement.query.count(), 1)

    def test_mismatched_owner_and_amount_blocked(self):
        order, receipt = self.seed()
        receipt.member_id = self.admin.id
        db.session.commit()
        response = self.admin_post(f'commerce-receipts/{receipt.id}/contract-preview', {'order_no': order.order_no})
        self.assertEqual(response.get_json()['code'], 'ownership_mismatch')
        receipt.member_id, receipt.amount = self.user.id, 1
        db.session.commit()
        response = self.admin_post(f'commerce-receipts/{receipt.id}/contract-preview', {'order_no': order.order_no})
        self.assertEqual(response.get_json()['code'], 'amount_mismatch')

    def test_expiry_policy_and_switch_block_without_grants(self):
        order, receipt = self.seed()
        plan = self.preview(order, receipt)
        self.app.config['COMMERCE_BINDING_ENABLED'] = False
        self.assertEqual(self.apply_plan(receipt, plan).get_json()['code'], 'binding_disabled')
        self.app.config['COMMERCE_BINDING_ENABLED'] = True
        mapping = CommerceProductMapping.query.one()
        mapping.valid_until = datetime.now(timezone.utc) - timedelta(days=1)
        db.session.commit()
        self.assertEqual(self.apply_plan(receipt, plan).get_json()['code'], 'mapping_required')
        self.assertEqual(CommerceEntitlement.query.count(), 0)

    def test_actor_bound_expiry_and_permission(self):
        order, receipt = self.seed()
        plan = self.preview(order, receipt)
        path = f'/api/v1/admin/commerce-receipts/{receipt.id}/contract'
        self.assertEqual(self.client.post(path, headers=self.headers(), json={'review_token': plan['review_token']}).status_code, 403)
        with patch('itsdangerous.timed.TimestampSigner.get_timestamp', return_value=1):
            old = binding.signer().dumps(dict(actor=self.admin.id, receipt_id=receipt.id, order_no=order.order_no, fingerprint=plan['fingerprint']))
        self.assertEqual(self.apply_plan(receipt, plan, review_token=old).get_json()['code'], 'invalid_review_token')
        wrong = binding.signer().dumps(dict(actor=self.user.id, receipt_id=receipt.id, order_no=order.order_no, fingerprint=plan['fingerprint']))
        self.assertEqual(self.apply_plan(receipt, plan, review_token=wrong).get_json()['code'], 'invalid_review_token')

    def test_failure_rolls_back_binding_source_and_entitlements(self):
        order, receipt = self.seed()
        plan = self.preview(order, receipt)
        with patch.object(intake, 'audit', side_effect=OrderError('simulated failure', 409)):
            self.assertEqual(self.apply_plan(receipt, plan).status_code, 409)
        self.assertEqual((order.status, order.payment_method), ('pending', 'manual'))
        self.assertEqual(db.session.get(CommerceSource, order.id).channel, 'website')
        self.assertEqual(CommerceReceiptBinding.query.count(), 0)
        self.assertEqual(CommerceEntitlement.query.count(), 0)
        self.assertEqual(CommerceTask.query.count(), 0)

    def test_other_work_and_rights_changes_blocked(self):
        order, receipt = self.seed()
        item = order.order_items[0]
        term = db.session.get(CommerceLine, item.id)
        term.rights = [{'kind': 'report', 'units': 2, 'permissions': {'digital_delivery': True}}]
        db.session.commit()
        response = self.admin_post(f'commerce-receipts/{receipt.id}/contract-preview', {'order_no': order.order_no})
        self.assertEqual(response.get_json()['code'], 'unsupported_contract')

    def test_physical_mapping_rejected(self):
        order, receipt = self.seed()
        result = self.post(payload(submission_key='physical-template', variant='physical', shipping=SHIPPING, physical={'spec_key': 'coated'}))
        self.assertEqual(result.status_code, 201, result.get_json())
        physical = Order.query.filter_by(order_no=result.get_json()['order']['order_no']).one()
        response = self.admin_post('commerce-product-mappings', self.map_data | {'external_sku': 'physical', 'template_item_no': physical.order_items[0].item_no})
        self.assertEqual(response.get_json()['code'], 'unsupported_contract')

    def test_external_order_list_and_addon_gate(self):
        order, receipt = self.seed()
        self.assertEqual(self.apply_plan(receipt, self.preview(order, receipt)).status_code, 200)
        response = self.client.get('/api/v1/admin/report-orders?status=paid', headers=self.headers(self.admin))
        self.assertIn(order.order_no, [row['order_no'] for row in response.get_json()['orders']])
        response = self.addon(order.order_no, physical={'spec_key': 'coated'})
        self.assertEqual(response.get_json()['code'], 'external_addon_unavailable')
