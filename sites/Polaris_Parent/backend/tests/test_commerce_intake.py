"""External evidence must never become payment or entitlement by itself."""
import sys
from pathlib import Path
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[4]))
from core.backend_engine.factory import db
from core.backend_engine.services.rbac import RBACService
from packages.commerce.models import Order, PaymentAttempt
from sites.Polaris_Parent.backend.commerce_models import (CommerceChannel, CommerceExternalReceipt, CommerceIntakeEvent,
    CommerceProductMapping, CommerceReceiptBinding)
from sites.Polaris_Parent.backend.extensions.report_orders import intake
from sites.Polaris_Parent.backend.extensions.report_orders.service import OrderError
from tests.test_report_orders import _Base


class IntakeTests(_Base):
    def setUp(self):
        super().setUp()
        for model in (CommerceChannel, CommerceExternalReceipt, CommerceIntakeEvent, CommerceProductMapping, CommerceReceiptBinding):
            if model.__table__ in self.tables:  # 基底已建（例：稽核用的 commerce_events）
                continue
            model.__table__.create(db.engine)
            self.tables.append(model.__table__)
        self.app.config['COMMERCE_INTAKE_ENABLED'] = True
        self.admin = self.make_user('intake-admin@example.test', verified=True)
        p = patch.object(RBACService, 'get_user_permissions', side_effect=lambda uid:
            {'report_orders.channels', 'report_orders.intake'} if int(uid) == self.admin.id else set())
        p.start()
        self.addCleanup(p.stop)

    def tearDown(self):
        self.app.config['COMMERCE_INTAKE_ENABLED'] = False
        super().tearDown()

    def policy(self, **over):
        return dict(channel='test-market', store_key='shop-1', manual_import=True,
                    policy_reference='internal-review:test-only', review_note='test intake scope only',
                    valid_until=(datetime.now(timezone.utc) + timedelta(days=7)).isoformat(), **over)

    def post(self, path, data, user=None):
        return self.client.post('/api/v1/admin/' + path, json=data, headers=self.headers(user or self.admin))

    def channel(self):
        response = self.post('commerce-channels', self.policy())
        self.assertEqual(response.status_code, 200, response.get_json())
        return response.get_json()['channel']

    def receipt_data(self, channel):
        return dict(channel_id=channel['id'], channel_revision=channel['revision'], external_order_id='EXT-001',
                    member_id=self.user.id, amount=200, currency='TWD',
                    lines=[dict(external_sku='external-book', quantity=2, unit_amount=100)])

    def receipt(self):
        channel = self.channel()
        data = self.receipt_data(channel)
        result = self.post('commerce-receipts', data)
        self.assertEqual(result.status_code, 200, result.get_json())
        return channel, data, result.get_json()['receipt']

    def review_data(self, receipt, **over):
        return dict(fingerprint=receipt['fingerprint'], channel_revision=receipt['channel_revision'],
                    decision='verified', note='核對紀錄', evidence_reference='case:proof-001',
                    payment_confirmed=True, ownership_confirmed=True) | over

    def test_import_review_retry_audit_and_no_payment_side_effect(self):
        _, data, row = self.receipt()
        self.assertEqual(row['status'], 'pending')
        self.assertFalse(self.post('commerce-receipts', data).get_json()['created'])
        path = f"commerce-receipts/{row['id']}/review"
        verified = self.post(path, self.review_data(row))
        self.assertEqual(verified.status_code, 200, verified.get_json())
        self.assertEqual(verified.get_json()['receipt']['status'], 'verified')
        self.assertFalse(self.post(path, self.review_data(row)).get_json()['changed'])
        self.assertEqual(CommerceExternalReceipt.query.count(), 1)
        self.assertEqual(CommerceIntakeEvent.query.count(), 3)
        self.assertEqual(Order.query.count(), 0)
        self.assertEqual(PaymentAttempt.query.count(), 0)

    def test_conflicting_duplicate_never_overwrites(self):
        _, data, row = self.receipt()
        data['member_id'] = self.admin.id
        result = self.post('commerce-receipts', data)
        self.assertEqual(result.status_code, 409)
        self.assertEqual(CommerceExternalReceipt.query.one().member_id, self.user.id)

    def test_unknown_disabled_expired_channel_blocks(self):
        channel = self.channel()
        data = self.receipt_data(channel)
        saved = db.session.get(CommerceChannel, channel['id'])
        saved.manual_import = False
        db.session.commit()
        self.assertEqual(self.post('commerce-receipts', data).status_code, 409)
        saved.manual_import = True
        saved.valid_until = datetime.now(timezone.utc) - timedelta(days=1)
        db.session.commit()
        self.assertEqual(self.post('commerce-receipts', data).status_code, 409)
        data['channel_id'] = 999
        self.assertEqual(self.post('commerce-receipts', data).status_code, 404)

    def test_stale_policy_and_stale_receipt_review(self):
        channel, data, row = self.receipt()
        policy = self.policy() | {'revision': 1}
        result = self.client.put(f"/api/v1/admin/commerce-channels/{channel['id']}", json=policy,
                                 headers=self.headers(self.admin))
        self.assertEqual(result.get_json()['channel']['revision'], 2)
        self.assertEqual(self.post('commerce-receipts', data).status_code, 409)
        path = f"commerce-receipts/{row['id']}/review"
        self.assertEqual(self.post(path, self.review_data(row)).status_code, 409)
        self.assertEqual(self.post(path, self.review_data(row, channel_revision=2, fingerprint='bad')).status_code, 409)
        self.assertEqual(self.post(path, self.review_data(row, channel_revision=2)).status_code, 200)

    def test_proof_requires_both_confirmations(self):
        _, _, row = self.receipt()
        for key in ('payment_confirmed', 'ownership_confirmed'):
            result = self.post(f"commerce-receipts/{row['id']}/review", self.review_data(row, **{key: False}))
            self.assertEqual(result.status_code, 400)
        self.assertEqual(CommerceExternalReceipt.query.one().status, 'pending')

    def test_void_after_policy_expiry_and_terminal_cannot_revive(self):
        channel, _, row = self.receipt()
        path = f"commerce-receipts/{row['id']}/review"
        self.assertEqual(self.post(path, self.review_data(row)).status_code, 200)
        saved = db.session.get(CommerceChannel, channel['id'])
        saved.valid_until = datetime.now(timezone.utc) - timedelta(days=1)
        db.session.commit()
        self.assertEqual(self.post(path, self.review_data(row, decision='voided')).status_code, 200)
        saved.valid_until = datetime.now(timezone.utc) + timedelta(days=1)
        db.session.commit()
        self.assertEqual(self.post(path, self.review_data(row)).status_code, 409)

    def test_validation_and_access_controls(self):
        channel = self.channel()
        data = self.receipt_data(channel)
        self.assertEqual(self.post('commerce-receipts', data, self.user).status_code, 403)
        for over in ({'amount': 201}, {'amount': True}, {'currency': 'USD'}, {'lines': []}, {'member_id': 999}):
            self.assertEqual(self.post('commerce-receipts', data | over).status_code, 400)
        self.assertEqual(self.post('commerce-receipts', []).status_code, 400)
        self.app.config['COMMERCE_INTAKE_ENABLED'] = False
        self.assertEqual(self.post('commerce-receipts', data).status_code, 409)
        self.assertEqual(CommerceExternalReceipt.query.count(), 0)

    def test_transaction_rollback_retains_no_partial_receipt(self):
        data = self.receipt_data(self.channel())
        with patch.object(intake, 'audit', side_effect=OrderError('test audit failure', 409)):
            self.assertEqual(self.post('commerce-receipts', data).status_code, 409)
        self.assertEqual(CommerceExternalReceipt.query.count(), 0)

    def test_read_access_cache_and_audit(self):
        _, _, row = self.receipt()
        for path in ('commerce-receipts', f"commerce-receipts/{row['id']}/events"):
            self.assertEqual(self.client.get('/api/v1/admin/' + path, headers=self.headers()).status_code, 403)
            response = self.client.get('/api/v1/admin/' + path, headers=self.headers(self.admin))
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.headers['Cache-Control'], 'no-store')
            if path.endswith('/events'):
                self.assertTrue(response.get_json()['events'][0]['created_at'].endswith('+00:00'))
