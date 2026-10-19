"""Isolated SQLite integration tests. No app startup, real chart API, mail or production DB."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4]))

from unittest.mock import patch
from sqlalchemy.exc import IntegrityError
from core.backend_engine.factory import db
from packages.commerce.models import Order, PaymentAttempt
from sites.Polaris_Parent.backend.commerce_models import (
    CommerceSource, CommerceLine, CommerceEntitlement, CommerceTask, CommerceEvent,
)
from sites.Polaris_Parent.backend.extensions.report_orders import commerce, payment, physical
from sites.Polaris_Parent.backend.extensions.report_orders.service import OrderError
from tests.test_report_orders import _Base, payload, SHIPPING, BANK
from tests import test_report_physical as physical_tests
from core.backend_engine.services.rbac import RBACService


class FoundationTests(_Base):
    MODE = 'manual'
    configure = physical_tests.PhysicalTests.configure
    paid_order = physical_tests.PhysicalTests.paid_order
    confirm = physical_tests.PhysicalTests.confirm
    addon = physical_tests.PhysicalTests.addon
    admin_post = physical_tests.PhysicalTests.admin_post

    def setUp(self):
        super().setUp()
        self._saved_cfg = {k: self.app.config.get(k) for k in BANK}
        self.app.config.update(BANK)
        self.admin = self.make_user('admin@example.test', verified=True)
        self.admin.role = 'admin'
        db.session.commit()
        perms = {'report_orders.read', 'report_orders.confirm_payment', 'report_orders.fulfill'}
        p = patch.object(RBACService, 'get_user_permissions',
                         side_effect=lambda uid: perms if int(uid) == self.admin.id else set())
        p.start()
        self.addCleanup(p.stop)
        self.app.config['COMMERCE_FOUNDATION_ENABLED'] = True
        self.configure()
        for model in (CommerceSource, CommerceLine, CommerceEntitlement, CommerceTask, CommerceEvent):
            if model.__table__ in self.tables:  # 基底已建（例：稽核用的 commerce_events）
                continue
            model.__table__.create(db.engine)
            self.tables.append(model.__table__)

    def tearDown(self):
        self.app.config['COMMERCE_FOUNDATION_ENABLED'] = False
        self.app.config.update(self._saved_cfg)
        super().tearDown()

    def test_paid_grants_snapshot_and_duplicate_payment_does_not_duplicate(self):
        o = self.paid_order(variant='physical', shipping=SHIPPING, consult_sessions=2,
                            physical={'spec_key': 'coated', 'quantity': 3, 'custom': ['text_unlock'], 'spreads': 1})
        self.assertEqual(CommerceEntitlement.query.count(), 4)
        self.assertEqual(CommerceTask.query.count(), 1)  # report handoff only
        ent = CommerceEntitlement.query.filter_by(kind='book').one()
        self.assertEqual(ent.rights['print_copies'], 3)
        self.assertEqual(ent.rights['spreads'], 1)
        self.configure(first_copy_price=99999)
        self.assertEqual(ent.rights['print_copies'], 3)
        order = Order.query.filter_by(order_no=o['order_no']).one()
        attempt = PaymentAttempt.query.filter_by(order_id=order.id).one()
        payment.mark_paid(order, attempt)
        db.session.commit()
        self.assertEqual(CommerceEntitlement.query.count(), 4)
        r = self.admin_post(f'report-orders/{o["order_no"]}/confirm-payment', {'received_amount': o['amount']})
        self.assertEqual(r.status_code, 409)
        self.assertEqual(CommerceEntitlement.query.count(), 4)

    def test_addon_amount_and_copy_count_have_distinct_meanings(self):
        o = self.paid_order()
        a = self.addon(o['order_no'], physical={'spec_key': 'coated', 'quantity': 3}).get_json()['order']
        order = Order.query.filter_by(order_no=a['order_no']).one()
        item = order.order_items[0]
        self.assertEqual((item.quantity, item.unit_price), (1, 2400))
        self.assertEqual(a['physical']['quantity'], 3)
        self.assertEqual(a['lines'][0]['amount'], 2400)
        self.assertEqual(CommerceLine.query.filter_by(order_item_id=item.id).one().print_copies, 3)
        self.confirm(a['order_no'], a['amount'])
        self.assertEqual(CommerceEntitlement.query.filter_by(order_item_id=item.id).count(), 1)

    def test_partial_cancel_only_revokes_book_and_caps_refund(self):
        o = self.paid_order(variant='physical', shipping=SHIPPING, physical={'spec_key': 'coated'})
        r = self.client.post(f'/api/v1/report-orders/{o["order_no"]}/physical-cancel', json={}, headers=self.headers())
        self.assertEqual(r.status_code, 200, r.get_json())
        self.assertEqual(CommerceEntitlement.query.filter_by(kind='book').one().status, 'revoked')
        self.assertEqual(CommerceEntitlement.query.filter_by(kind='report').one().status, 'in_use')
        self.assertEqual(Order.query.one().status, 'paid')
        job = physical.print_job_for(Order.query.one().order_items[0])
        with self.assertRaises(OrderError) as ctx:
            physical.record_refund(job, self.admin.id, job.refund_due + 1)
        self.assertEqual(ctx.exception.code, 'refund_exceeds_due')

    def test_tasks_are_unique_and_revoked_rights_cannot_restart(self):
        o = self.paid_order(variant='physical', shipping=SHIPPING, physical={'spec_key': 'coated'})
        item = Order.query.one().order_items[0]
        job = physical.print_job_for(item)
        other = self.make_user('other@example.test', verified=True)
        with self.assertRaises(OrderError) as ctx:
            commerce.start(item, 'book', 'print_job', job.id, other.id)
        self.assertEqual(ctx.exception.code, 'entitlement_forbidden')
        commerce.start(item, 'book', 'print_job', job.id, self.user.id)
        commerce.start(item, 'book', 'print_job', job.id, self.user.id)
        db.session.commit()
        self.assertEqual(CommerceTask.query.count(), 2)
        with self.assertRaises(OrderError):
            commerce.start(item, 'book', 'print_job', job.id + 1, self.user.id)
        physical.cancel_physical(item.order, 'member', 'test')
        with self.assertRaises(OrderError):
            commerce.start(item, 'book', 'print_job', job.id, self.user.id)

    def test_payment_grant_failure_rolls_back_payment_and_all_grants(self):
        o = self.post(payload()).get_json()['order']
        order = Order.query.one()
        with patch.object(commerce, 'event', side_effect=RuntimeError('simulated failure')):
            with self.assertRaises(RuntimeError):
                payment.confirm_manual_payment(order, self.admin.id, o['amount'])
        db.session.rollback()
        self.assertEqual(Order.query.one().status, 'pending')
        self.assertEqual(PaymentAttempt.query.count(), 0)
        self.assertEqual(CommerceEntitlement.query.count(), 0)

    def test_database_unique_unit_prevents_duplicate_grants(self):
        self.paid_order()
        e = CommerceEntitlement.query.one()
        db.session.add(CommerceEntitlement(order_item_id=e.order_item_id, kind=e.kind, unit_index=e.unit_index,
                                           holder_id=e.holder_id, operator_id=e.operator_id, status='available', rights={}))
        with self.assertRaises(IntegrityError):
            db.session.commit()
        db.session.rollback()
        self.assertEqual(CommerceEntitlement.query.count(), 1)

    def test_feature_off_keeps_existing_contract_enforcement_and_legacy_unmodified(self):
        self.paid_order()
        tracked = Order.query.one()
        self.app.config['COMMERCE_FOUNDATION_ENABLED'] = False
        self.assertEqual(commerce.view(tracked)['version'], 1)
        legacy = self.paid_order(submission_key='legacy-order')
        order = Order.query.filter_by(order_no=legacy['order_no']).one()
        self.assertEqual(commerce.view(order)['version'], 0)
        preview = commerce.historical_preview(order)
        self.assertEqual(preview['decision'], 'manual_review')
        self.assertEqual(CommerceEntitlement.query.count(), 1)

    def test_member_cannot_read_other_members_order_contract(self):
        o = self.paid_order()
        other = self.make_user('other@example.test', verified=True)
        r = self.client.get(f'/api/v1/report-orders/{o["order_no"]}', headers=self.headers(other))
        self.assertEqual(r.status_code, 404)

    def test_delivery_design_and_consult_complete_the_same_durable_tasks(self):
        from sites.Polaris_Parent.backend.extensions.report_orders import delivery, design
        self.paid_order(variant='physical', shipping=SHIPPING, consult_sessions=2,
                        physical={'spec_key': 'coated'})
        order = Order.query.one()
        report_item = next(i for i in order.order_items if i.kind == 'purchase')
        with patch.object(delivery.private_storage, 'save', return_value=(20, 'test-digest')):
            delivery.upload_report_pdf(report_item, self.admin.id, 'report.pdf', b'%PDF-test')
            delivery.upload_report_pdf(report_item, self.admin.id, 'correction.pdf', b'%PDF-test')
        self.assertEqual(CommerceEntitlement.query.filter_by(kind='report').one().status, 'completed')
        book = design.design_for_job(self.user, order)
        # Operational job data cannot silently enlarge rights bought at checkout.
        job = physical.print_job_for(report_item)
        job.custom = {'options': ['text_unlock'], 'spreads': 10}
        db.session.commit()
        self.assertEqual(design.purchased(book), {'custom': [], 'spreads': 0})
        design.confirm(book)
        job.status = 'approved'  # 打樣確認流程另有測試（tests/test_report_proofs.py）
        db.session.commit()
        physical.mark_printing(job, self.admin.id)
        physical.mark_shipped(job, self.admin.id, 'test-carrier', 'test-tracking')
        physical.mark_delivered(job, self.admin.id)
        consult_item = next(i for i in order.order_items if i.variant == 'consult')
        consult = physical.consultation_for(consult_item)
        physical.schedule_consult(consult, self.admin.id, '2026-11-01T10:00:00')
        physical.complete_consult(consult, self.admin.id)
        self.assertEqual(CommerceTask.query.count(), 4)
        self.assertTrue(all(e.status == 'completed' for e in CommerceEntitlement.query.all()))
        self.assertTrue(all(t.status == 'completed' for t in CommerceTask.query.all()))
