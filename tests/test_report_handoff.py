"""階段 1 ③：付款後把報告工作單送到紫微（report_orders/handoff.py）。紫微 API 以假函式代替。"""
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from core.backend_engine.factory import db
from packages.commerce.models import OrderNotification
from sites.Polaris_Parent.backend.extensions.report_orders import handoff, jobs, notify
from sites.Polaris_Parent.backend.models import ReportFulfillment

from tests.test_report_jobs import _JobsBase


class HandoffTests(_JobsBase):
    def setUp(self):
        super().setUp()
        self.calls = []
        self.ziwei_error = None
        p = patch.object(handoff, '_ziwei_call', side_effect=self.fake_ziwei)
        p.start()
        self.addCleanup(p.stop)

    def fake_ziwei(self, method, path, payload=None):
        self.calls.append((method, path, payload))
        if self.ziwei_error:
            return None, self.ziwei_error
        return {'created': True, 'request': {'request_no': payload['request_no'], 'status': 'queued'}}, None

    def paid_order(self):
        order = self.order()
        r = self.client.post(f'/api/v1/admin/report-orders/{order.order_no}/confirm-payment',
                             json={'received_amount': 1980, 'last5': '99999'}, headers=self.headers(self.admin))
        self.assertEqual(r.status_code, 200, r.get_json())
        return order

    def fulfillment(self):
        return ReportFulfillment.query.one()

    def test_unpaid_order_is_not_sent(self):
        self.order()
        self.assertEqual(self.fulfillment().handoff_status, 'not_ready')
        self.assertEqual(handoff.send_due(), (0, 0))
        self.assertEqual(self.calls, [])

    def test_paid_order_creates_ziwei_work_order(self):
        order = self.paid_order()
        self.assertEqual(self.fulfillment().handoff_status, 'pending')
        self.assertEqual(jobs.run_due(only={'handoff_reports'})['handoff_reports'], {'sent': 1, 'failed': 0})
        method, path, body = self.calls[0]
        self.assertEqual((method, path), ('POST', '/public/report-requests'))
        f = self.fulfillment()
        self.assertEqual((body['request_no'], body['member_id'], body['chart_id'], body['env']),
                         (f.request_no, self.user.id, 202005011000000001, 'live'))
        self.assertEqual((body['order_no'], body['product_code'], body['variant'], body['language']),
                         (order.order_no, 'natal-report-digital', 'digital', 'zh-TW'))
        self.assertEqual(body['audience']['dedication'], '生日快樂')
        self.assertEqual(body['subject']['birth']['date'], '2020-05-01')
        self.assertTrue(body['paid_at'].endswith('+00:00'))
        self.assertEqual((f.handoff_status, f.ziwei_status, f.handoff_attempts, f.last_error),
                         ('sent', 'queued', 1, None))
        self.assertIsNotNone(f.sent_at)
        self.assertEqual(handoff.send_due(), (0, 0))  # 已送出不再送
        self.assertEqual(len(self.calls), 1)

    def test_failed_handoff_is_retried_with_backoff(self):
        self.paid_order()
        self.ziwei_error = '無法連線命盤服務：timeout'
        now = datetime.utcnow()
        self.assertEqual(handoff.send_due(now), (0, 1))
        f = self.fulfillment()
        self.assertEqual((f.handoff_status, f.handoff_attempts), ('failed', 1))
        self.assertIn('timeout', f.last_error)
        self.assertEqual(handoff.send_due(now + timedelta(minutes=4)), (0, 0))  # 還沒到重試時間
        self.ziwei_error = None
        self.assertEqual(handoff.send_due(now + timedelta(minutes=6)), (1, 0))
        self.assertEqual(self.fulfillment().handoff_status, 'sent')

    def test_exhausted_retries_alert_admin_once_and_keep_trying(self):
        self.paid_order()
        self.ziwei_error = '命盤服務錯誤 (502)'
        now = datetime.utcnow()
        for _ in range(notify.MAX_ATTEMPTS + 2):
            handoff.send_due(now)
            now += timedelta(hours=13)
        f = self.fulfillment()
        self.assertEqual(f.handoff_status, 'failed')
        self.assertEqual(f.handoff_attempts, notify.MAX_ATTEMPTS + 2)  # 用完次數後仍繼續重試
        alerts = OrderNotification.query.filter_by(event='handoff_failed_admin').all()
        self.assertEqual(len(alerts), 1)
        self.assertEqual(alerts[0].recipient, 'ops@example.test')
        nxt = handoff.next_attempt_at(f)
        last = f.updated_at.replace(tzinfo=None) if f.updated_at.tzinfo is None else \
            f.updated_at.astimezone(timezone.utc).replace(tzinfo=None)
        self.assertEqual(nxt - last, handoff.RETRY_LATER)

    def test_admin_send_now(self):
        order = self.paid_order()
        self.ziwei_error = 'service token 無效'
        url = f'/api/v1/admin/report-orders/{order.order_no}/handoff'
        r = self.client.post(url, headers=self.headers(self.admin))
        self.assertEqual((r.status_code, r.get_json()['code']), (502, 'handoff_failed'))
        self.assertEqual(r.get_json()['handoff']['status'], 'failed')
        self.ziwei_error = None
        r = self.client.post(url, headers=self.headers(self.admin))  # 立即送出不看重試間隔
        self.assertEqual(r.status_code, 200, r.get_json())
        self.assertEqual((r.get_json()['handoff']['status'], r.get_json()['handoff']['ziwei_status']), ('sent', 'queued'))
        r = self.client.post(url, headers=self.headers(self.admin))
        self.assertEqual((r.status_code, r.get_json()['code']), (409, 'nothing_to_send'))
        self.assertEqual(self.client.post(url, headers=self.headers()).status_code, 403)

    def test_delivery_list_shows_handoff_status(self):
        self.paid_order()
        rows = self.client.get('/api/v1/admin/report-deliveries?status=all',
                               headers=self.headers(self.admin)).get_json()['deliveries']
        self.assertEqual((rows[0]['handoff']['status'], rows[0]['handoff']['status_label']), ('pending', '待送出'))
        handoff.send_due()
        rows = self.client.get('/api/v1/admin/report-deliveries?status=all',
                               headers=self.headers(self.admin)).get_json()['deliveries']
        self.assertEqual(rows[0]['handoff']['status'], 'sent')
