"""第五項：外部平台客人認領（report_orders/claims.py；2026-10-21）。"""

from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from core.backend_engine.factory import db
from core.backend_engine.models import User
from packages.commerce.models import Order
from sites.Polaris_Parent.backend.commerce_models import CommerceActivation, CommerceEntitlement, CommerceExternalReceipt
from sites.Polaris_Parent.backend.extensions.report_orders import binding, claims
from sites.Polaris_Parent.backend.models import ExternalCustomer, ReportBookDesign, ReportFulfillment

from tests.test_report_proxy import _ProxyBase


class ClaimTests(_ProxyBase):
    def setUp(self):
        super().setUp()
        for model in (CommerceActivation, ReportBookDesign):  # 認領也會轉這兩張表（正式庫都有）
            if not db.inspect(db.engine).has_table(model.__tablename__, schema=model.__table__.schema):
                model.__table__.create(db.engine)
                self.tables.append(model.__table__)
        self.order = self.created_order()
        self.customer = ExternalCustomer.query.one()
        self.old_user_id = self.customer.app_user_id
        self.member = self.make_user('kari@example.test', verified=True)
        # 紫微服務 API（PolarisUI /public/members/transfer）：預設成功，個別測試可改
        self.ziwei_calls = []
        self.ziwei_result = ({'success': True, 'moved': {'users': 1, 'report_requests': 1}}, None)

        def fake_call(method, path, payload=None):
            self.ziwei_calls.append((method, path, payload))
            return self.ziwei_result
        p = patch('sites.Polaris_Parent.backend.extensions.astrology._ziwei_call', side_effect=fake_call)
        p.start()
        self.addCleanup(p.stop)

    def issue(self, **body):
        r = self.client.post(f'/api/v1/admin/external-customers/{self.customer.id}/claim-code', json=body,
                             headers=self.headers(self.admin))
        self.assertEqual(r.status_code, 200, r.get_json())
        return r.get_json()

    def claim(self, code, user=None, preview=False):
        path = '/api/v1/report-claims/preview' if preview else '/api/v1/report-claims'
        return self.client.post(path, json={'code': code}, headers=self.headers(user or self.member))

    def test_issue_shows_code_once_and_stores_only_digest(self):
        res = self.issue()
        code = res['code']
        self.assertRegex(code, r'^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$')
        c = db.session.get(ExternalCustomer, self.customer.id)
        self.assertNotIn(claims.normalise(code), c.claim_code_digest)
        self.assertEqual(c.claim_code_digest, claims.digest(code))
        self.assertTrue(res['customer']['claim']['has_code'])
        r = self.client.get(f'/api/v1/admin/external-customers/{self.customer.id}', headers=self.headers(self.admin))
        self.assertNotIn('code', r.get_json())  # 之後再查不到明碼

    def test_preview_then_claim_moves_orders_and_evidence(self):
        code = self.issue()['code']
        sloppy = claims.normalise(code).lower()  # 小寫、沒有連字號也可以
        r = self.claim(sloppy, preview=True)
        self.assertEqual(r.status_code, 200, r.get_json())
        self.assertEqual((r.get_json()['customer_name'], [o['order_no'] for o in r.get_json()['orders']]),
                         ('Kari N.', [self.order.order_no]))

        r = self.claim(code)
        self.assertEqual(r.status_code, 200, r.get_json())
        self.assertEqual(r.get_json()['orders'], [self.order.order_no])
        db.session.expire_all()
        order = db.session.get(Order, self.order.id)
        self.assertEqual(order.user_id, self.member.id)
        self.assertEqual(ReportFulfillment.query.one().member_id, self.member.id)
        self.assertEqual(CommerceExternalReceipt.query.one().member_id, self.member.id)
        for ent in CommerceEntitlement.query.all():
            self.assertEqual(ent.holder_id, self.member.id)
        binding.require_evidence(order)  # 平台成交證據照樣有效
        c = db.session.get(ExternalCustomer, self.customer.id)
        self.assertEqual((c.claimed_by, c.claim_code_digest), (self.member.id, None))
        self.assertFalse(db.session.get(User, self.old_user_id).is_active)
        self.assertEqual(self.ziwei_calls, [('POST', '/public/members/transfer',
                                             {'from_member_id': self.old_user_id, 'to_member_id': self.member.id})])
        self.assertIsNotNone(c.ziwei_transferred_at)

        # 會員看得到自己的訂單；後台的客人檔案與訂單仍對得上
        mine = self.client.get('/api/v1/report-orders', headers=self.headers(self.member)).get_json()['orders']
        self.assertEqual([o['order_no'] for o in mine], [self.order.order_no])
        d = self.detail(self.order.order_no)
        self.assertEqual(d['external']['customer_name'], 'Kari N.')
        self.assertIn('claimed_by_member', [e['type'] for e in d['timeline']])
        r = self.client.get(f'/api/v1/admin/external-customers/{self.customer.id}', headers=self.headers(self.admin))
        cust = r.get_json()['customer']
        self.assertEqual(([o['order_no'] for o in cust['orders']], cust['claim']['claimed_by_email']),
                         ([self.order.order_no], 'kari@example.test'))

        # 用過即失效
        self.assertEqual(self.claim(code, user=self.make_user('other@example.test', verified=True)).status_code, 404)

    def test_reissue_and_revoke_invalidate_old_code(self):
        first = self.issue()['code']
        second = self.issue()['code']
        self.assertEqual(self.claim(first, preview=True).status_code, 404)
        self.assertEqual(self.claim(second, preview=True).status_code, 200)
        r = self.client.delete(f'/api/v1/admin/external-customers/{self.customer.id}/claim-code',
                               headers=self.headers(self.admin))
        self.assertEqual(r.status_code, 200, r.get_json())
        self.assertEqual(self.claim(second, preview=True).status_code, 404)

    def test_expired_code(self):
        code = self.issue(days=1)['code']
        c = db.session.get(ExternalCustomer, self.customer.id)
        c.claim_code_expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
        db.session.commit()
        self.assertEqual(self.claim(code).status_code, 404)
        r = self.client.get(f'/api/v1/admin/external-customers/{self.customer.id}', headers=self.headers(self.admin))
        self.assertTrue(r.get_json()['customer']['claim']['expired'])

    def test_who_can_claim_and_issue(self):
        code = self.issue()['code']
        unverified = self.make_user('new@example.test', verified=False)
        self.assertEqual(self.claim(code, user=unverified).status_code, 403)
        self.assertEqual(self.claim('ABCD-EFGH-JKMN').status_code, 404)
        self.assertEqual(self.claim('short').status_code, 404)
        r = self.client.post(f'/api/v1/admin/external-customers/{self.customer.id}/claim-code', json={},
                             headers=self.headers(self.member))
        self.assertEqual(r.status_code, 403)
        # 已認領的檔案不能再發碼
        self.assertEqual(self.claim(code).status_code, 200)
        r = self.client.post(f'/api/v1/admin/external-customers/{self.customer.id}/claim-code', json={},
                             headers=self.headers(self.admin))
        self.assertEqual(r.status_code, 409)

    def test_ziwei_transfer_failure_is_retried_by_job(self):
        code = self.issue()['code']
        self.ziwei_result = (None, '無法連線命盤服務')
        r = self.claim(code)
        self.assertEqual(r.status_code, 200, r.get_json())  # 官網這邊照樣完成
        c = db.session.get(ExternalCustomer, self.customer.id)
        self.assertEqual((c.ziwei_transferred_at, c.ziwei_transfer_attempts, c.ziwei_transfer_error),
                         (None, 1, '無法連線命盤服務'))
        r = self.client.get(f'/api/v1/admin/external-customers/{self.customer.id}', headers=self.headers(self.admin))
        self.assertIs(r.get_json()['customer']['claim']['ziwei_synced'], False)
        self.ziwei_result = ({'success': True, 'moved': {}}, None)
        self.assertEqual(claims.sync_due(), (1, 0))
        db.session.expire_all()
        self.assertIsNotNone(db.session.get(ExternalCustomer, self.customer.id).ziwei_transferred_at)
        self.assertEqual(claims.sync_due(), (0, 0))  # 轉成功後不再呼叫
