"""階段 1 ①：寄信重試（shop.report_mail_outbox）與背景排程（report_orders/jobs.py）。In-memory SQLite。"""
from datetime import datetime, timedelta
from unittest.mock import patch

from core.backend_engine.factory import db
from core.backend_engine.services.rbac import RBACService
from packages.commerce.models import Order, OrderCheckout, OrderNotification
from sites.Polaris_Parent.backend.extensions.report_orders import jobs, notify
from sites.Polaris_Parent.backend.models import ReportJobRun, ReportMailOutbox

from tests.test_report_orders import BANK, _Base, payload


class _JobsBase(_Base):
    MODE = 'manual'

    def setUp(self):
        super().setUp()
        self._saved_cfg = {k: self.app.config.get(k) for k in BANK}
        self.app.config.update(BANK)
        self.admin = self.make_user('admin@example.test', verified=True)
        perms = {'report_orders.read', 'report_orders.fulfill', 'report_orders.confirm_payment'}
        p = patch.object(RBACService, 'get_user_permissions',
                         side_effect=lambda uid: perms if int(uid) == self.admin.id else set())
        p.start()
        self.addCleanup(p.stop)

    def tearDown(self):
        self.app.config.update(self._saved_cfg)
        super().tearDown()

    def order(self):
        r = self.post(payload())
        self.assertEqual(r.status_code, 201, r.get_json())
        return Order.query.filter_by(order_no=r.get_json()['order']['order_no']).one()

    def note(self, event='order_created'):
        return OrderNotification.query.filter_by(event=event).one()

    def mail_down(self):
        self.mail_send.side_effect = RuntimeError('smtp down')

    def mail_up(self):
        self.mail_send.side_effect = None


class MailRetryTests(_JobsBase):
    def test_sent_mail_keeps_body_for_lookup_and_clears_retry(self):
        self.order()
        note = self.note()
        box = notify.outbox_of(note)
        self.assertEqual((note.status, note.attempts), ('sent', 1))
        self.assertIsNone(box.next_attempt_at)
        self.assertIn('訂單編號', box.body)
        self.assertIn('（台灣時間）前', box.body)  # 匯款期限改以台灣時間顯示

    def test_failed_mail_is_retried_with_backoff(self):
        self.mail_down()
        self.order()
        note = self.note()
        box = notify.outbox_of(note)
        self.assertEqual((note.status, note.attempts), ('failed', 1))
        first = box.last_attempt_at
        self.assertEqual(box.next_attempt_at, first + notify.RETRY_BACKOFF[0])

        self.mail_up()
        self.assertEqual(notify.retry_due(first + timedelta(minutes=4)), (0, 0))  # 還沒到期
        self.assertEqual(notify.retry_due(first + timedelta(minutes=6)), (1, 0))
        note = self.note()
        self.assertEqual((note.status, note.attempts, note.error), ('sent', 2, None))
        self.assertIsNone(notify.outbox_of(note).next_attempt_at)
        self.assertEqual(notify.retry_due(first + timedelta(days=2)), (0, 0))  # 寄出後不再重寄

    def test_retries_stop_after_max_attempts_and_alert_admin_once(self):
        self.mail_down()
        self.order()
        now = datetime.utcnow()
        for _ in range(notify.MAX_ATTEMPTS + 3):
            now += timedelta(hours=13)
            notify.retry_due(now)
        note = self.note()
        self.assertEqual((note.status, note.attempts), ('failed', notify.MAX_ATTEMPTS))
        self.assertIsNone(notify.outbox_of(note).next_attempt_at)
        alert = self.note('mail_failed_admin')
        self.assertEqual(alert.recipient, 'ops@example.test')
        self.assertIn(note.recipient, notify.outbox_of(alert).body)
        # 警示信自己也寄不出去：用完次數後不再產生「警示的警示」
        for _ in range(notify.MAX_ATTEMPTS + 3):
            now += timedelta(hours=13)
            notify.retry_due(now)
        self.assertEqual(OrderNotification.query.filter_by(event='mail_failed_admin').count(), 1)
        self.assertEqual(self.note('mail_failed_admin').attempts, notify.MAX_ATTEMPTS)

    def test_mail_interrupted_mid_send_is_picked_up_later(self):
        order = self.order()
        # 模擬：信已寫入，但程序在寄出前被中止（狀態停在 pending）
        note = OrderNotification(order_id=order.id, event='report_ready', dedupe_key=f'report_ready:{order.id}',
                                 recipient='buyer@example.com', status='pending', attempts=0)
        db.session.add(note)
        db.session.flush()
        db.session.add(ReportMailOutbox(notification_id=note.id, subject='s', body='b',
                                        next_attempt_at=datetime.utcnow() + notify.INFLIGHT_GRACE))
        db.session.commit()
        self.assertEqual(notify.retry_due(datetime.utcnow()), (0, 0))
        self.assertEqual(notify.retry_due(datetime.utcnow() + timedelta(minutes=11)), (1, 0))
        self.assertEqual(self.note('report_ready').status, 'sent')

    def test_duplicate_event_is_not_sent_twice(self):
        order = self.order()
        self.assertFalse(notify.send_order_created(order, 'buyer@example.com', 'manual', None))
        self.assertEqual(ReportMailOutbox.query.count(), 1)

    def test_purge_bodies_after_retention(self):
        self.order()
        note = self.note()
        self.assertEqual(notify.purge_bodies(datetime.utcnow() + timedelta(days=29)), 0)
        self.assertEqual(notify.purge_bodies(datetime.utcnow() + timedelta(days=31)), 1)
        self.assertIsNone(notify.outbox_of(note).body)
        self.assertFalse(notify.notification_view(note)['can_resend'])

    def test_purge_keeps_body_of_mail_still_retrying(self):
        self.mail_down()
        self.order()
        self.assertEqual(notify.purge_bodies(datetime.utcnow() + timedelta(days=31)), 0)


class NotificationAdminTests(_JobsBase):
    def test_list_filters_failed_and_shows_job_status(self):
        self.mail_down()
        order = self.order()
        r = self.client.get('/api/v1/admin/report-notifications?status=failed', headers=self.headers(self.admin))
        body = r.get_json()
        self.assertEqual(r.status_code, 200, body)
        self.assertEqual(body['counts'], {'failed': 1})
        row = body['notifications'][0]
        self.assertEqual((row['order_no'], row['event_label'], row['can_resend']), (order.order_no, '訂單成立', True))
        self.assertNotIn('body', row)  # 列表不帶內文
        self.assertEqual({j['job'] for j in body['jobs']['jobs']}, {name for name, *_ in jobs.JOBS})
        r = self.client.get(f'/api/v1/admin/report-notifications?status=all&q={order.order_no}',
                            headers=self.headers(self.admin))
        self.assertEqual(len(r.get_json()['notifications']), 1)

    def test_member_cannot_read_mail_log(self):
        r = self.client.get('/api/v1/admin/report-notifications', headers=self.headers())
        self.assertEqual(r.status_code, 403)

    def test_detail_includes_body(self):
        self.order()
        note = self.note()
        r = self.client.get(f'/api/v1/admin/report-notifications/{note.id}', headers=self.headers(self.admin))
        self.assertIn('訂單編號', r.get_json()['notification']['body'])

    def test_manual_resend(self):
        self.mail_down()
        self.order()
        note_id = self.note().id
        url = f'/api/v1/admin/report-notifications/{note_id}/resend'
        r = self.client.post(url, headers=self.headers(self.admin))
        self.assertEqual((r.status_code, r.get_json()['code']), (502, 'send_failed'))
        self.mail_up()
        r = self.client.post(url, headers=self.headers(self.admin))
        self.assertEqual(r.status_code, 200, r.get_json())
        self.assertEqual(r.get_json()['notification']['status'], 'sent')
        r = self.client.post(url, headers=self.headers(self.admin))
        self.assertEqual((r.status_code, r.get_json()['code']), (409, 'not_resendable'))
        self.assertEqual(self.client.post('/api/v1/admin/report-notifications/999999/resend',
                                          headers=self.headers(self.admin)).status_code, 404)


class JobRunnerTests(_JobsBase):
    def test_periodic_jobs_respect_their_interval(self):
        now = datetime.utcnow()
        first = jobs.run_due(now)
        self.assertEqual(set(first), {name for name, *_ in jobs.JOBS})
        every_tick = {name for name, every, *_ in jobs.JOBS if every == timedelta(0)}
        self.assertEqual(every_tick, {'retry_mail', 'handoff_reports', 'claim_sync'})
        again = jobs.run_due(now + timedelta(minutes=1))
        self.assertEqual(set(again), every_tick)  # 週期 0：每輪都跑
        later = jobs.run_due(now + timedelta(minutes=11))
        self.assertEqual(set(later), every_tick | {'expire_overdue'})
        self.assertEqual(set(jobs.run_due(now + timedelta(minutes=12), force=True)), set(first))
        run = db.session.get(ReportJobRun, 'cleanup_designs')
        self.assertEqual((run.last_status, run.last_result), ('ok', '{"removed": 0}'))

    def test_failing_job_is_recorded_and_others_still_run(self):
        with patch.object(jobs, 'JOBS', [('boom', timedelta(0), 'x', lambda now: 1 / 0)] + jobs.JOBS):
            results = jobs.run_due(force=True)
        self.assertIn('ZeroDivisionError', results['boom']['error'])
        self.assertEqual(db.session.get(ReportJobRun, 'boom').last_status, 'error')
        self.assertEqual(results['retry_mail'], {'sent': 0, 'failed': 0})

    def test_overdue_order_is_cancelled_by_job(self):
        order = self.order()
        OrderCheckout.query.filter_by(order_id=order.id).one().expires_at = datetime.utcnow() - timedelta(hours=1)
        db.session.commit()
        self.assertEqual(jobs.run_due(only={'expire_overdue'})['expire_overdue'], {'cancelled': 1})
        self.assertEqual(db.session.get(Order, order.id).status, 'cancelled')
        self.assertEqual(self.note('order_expired').status, 'sent')

    def _age(self, order, created_ago, expires_in):
        now = datetime.utcnow()
        order.created_at = now - created_ago
        OrderCheckout.query.filter_by(order_id=order.id).one().expires_at = now + expires_in
        db.session.commit()

    def test_payment_reminder_sent_once_before_deadline(self):
        order = self.order()
        self._age(order, timedelta(days=2), timedelta(hours=10))
        self.assertEqual(jobs.run_due(only={'payment_reminders'})['payment_reminders'], {'sent': 1})
        self.assertEqual(jobs.run_due(force=True, only={'payment_reminders'})['payment_reminders'], {'sent': 0})
        body = notify.outbox_of(self.note('payment_reminder')).body
        self.assertIn('1234567890123', body)
        self.assertIn(order.order_no, body)

    def test_no_reminder_when_far_from_deadline_new_or_reported(self):
        order = self.order()
        self._age(order, timedelta(days=1), timedelta(days=2))  # 離期限還遠
        self.assertEqual(jobs.run_due(force=True, only={'payment_reminders'})['payment_reminders'], {'sent': 0})
        self._age(order, timedelta(hours=1), timedelta(hours=10))  # 剛下單（期限短）
        self.assertEqual(jobs.run_due(force=True, only={'payment_reminders'})['payment_reminders'], {'sent': 0})
        self._age(order, timedelta(days=2), timedelta(hours=10))
        body = {'last5': '12345', 'transferred_on': datetime.utcnow().date().isoformat(), 'amount': 1980}
        self.assertEqual(self.client.post(f'/api/v1/report-orders/{order.order_no}/transfer', json=body,
                                          headers=self.headers()).status_code, 200)
        self.assertEqual(jobs.run_due(force=True, only={'payment_reminders'})['payment_reminders'], {'sent': 0})

    def test_reminder_skipped_without_bank_info(self):
        self.app.config['MANUAL_PAYMENT_ACCOUNT_NO'] = ''
        self.assertEqual(jobs.run_due(force=True, only={'payment_reminders'})['payment_reminders'],
                         {'sent': 0, 'skipped': 'manual_payment_not_configured'})

    def test_run_locked_runs_on_sqlite(self):
        self.assertIn('retry_mail', jobs.run_locked(force=True))

    def test_background_never_starts_in_tests(self):
        self.app.config['REPORT_JOBS_ENABLED'] = True
        try:
            with patch('threading.Thread') as thread:
                self.client.get('/api/v1/report-payment-mode')
                jobs.start_background(self.app)
            thread.assert_not_called()
        finally:
            self.app.config['REPORT_JOBS_ENABLED'] = False
