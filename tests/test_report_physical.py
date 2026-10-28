"""實體書與專人解讀：設定與計價、事後加購、多品項訂單、取消與退款、出貨與解讀管理
（docs/report-physical-addon-plan.md 第 10 節定案版）。"""

from datetime import datetime, timedelta
from unittest.mock import patch

from core.backend_engine.factory import db
from core.backend_engine.services.rbac import RBACService
from packages.commerce.models import Order, OrderCheckout, OrderItem, Product
from sites.Polaris_Parent.backend.models import ReportConsultation, ReportPrintJob, Shipment

from tests.test_report_orders import BANK, SHIPPING, _Base, payload

SETTINGS = {
    'physical_enabled': True,
    'first_copy_price': 1200,
    'extra_copy_price': 600,
    'specs': [{'key': 'soft', 'label': '平裝', 'price_delta': -300},
              {'key': 'coated', 'label': '精裝（銅西卡紙質）', 'price_delta': 0},
              {'key': 'thin', 'label': '精裝（薄紙版）', 'price_delta': 0}],
    'custom_options': {'custom_cover': {'price': 300}, 'text_unlock': {'price': 500},
                       'image_insert': {'price': 500}},
    'spreads': {'price': 300, 'max': 10},
    'consult': {'price': 1500, 'minutes': 30, 'max_sessions': 4},
}


class PhysicalTests(_Base):
    MODE = 'manual'

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

    def tearDown(self):
        self.app.config.update(self._saved_cfg)
        super().tearDown()

    # ── helpers ──────────────────────────────────────────────────────────
    def configure(self, **over):
        digital = Product.query.filter_by(product_id='natal-report-digital').one()
        digital.attributes = {'report_addon': {**SETTINGS, **over}}
        db.session.commit()

    def paid_order(self, **over):
        r = self.post(payload(**over))
        self.assertEqual(r.status_code, 201, r.get_json())
        o = r.get_json()['order']
        self.confirm(o['order_no'], o['amount'])
        return o

    def confirm(self, order_no, amount):
        r = self.client.post(f'/api/v1/admin/report-orders/{order_no}/confirm-payment',
                             json={'received_amount': amount}, headers=self.headers(self.admin))
        self.assertEqual(r.status_code, 200, r.get_json())

    def addon(self, order_no, user=None, physical=None, consult=0, **over):
        body = {'submission_key': over.pop('submission_key', 'addon-key-0001'), 'policy_consented': True,
                'policy_version': '2026-10-03', 'shipping': SHIPPING, 'consult_sessions': consult}
        if physical is not None:
            body['physical'] = physical
        body.update(over)
        return self.client.post(f'/api/v1/report-orders/{order_no}/addons', json=body, headers=self.headers(user))

    def admin_post(self, path, body=None, user=None):
        return self.client.post(f'/api/v1/admin/{path}', json=body or {}, headers=self.headers(user or self.admin))

    def mails(self):
        return [c[0][0] for c in self.mail_send.call_args_list]

    # ── 設定與計價 ───────────────────────────────────────────────────────
    def test_config_without_settings_falls_back_and_hides_extras(self):
        c = self.client.get('/api/v1/report-physical-config').get_json()['config']
        self.assertEqual((c['enabled'], c['digital_price'], c['first_copy_price'], c['extra_copy_price']),
                         (True, 1980, 2000, 2000))
        self.assertEqual((c['custom_options'], c['spreads'], c['consult']), ([], None, None))

    def test_config_with_settings(self):
        self.configure()
        c = self.client.get('/api/v1/report-physical-config').get_json()['config']
        self.assertEqual(c['first_copy_price'], 1200)
        self.assertEqual([s['price_delta'] for s in c['specs']], [-300, 0, 0])
        self.assertEqual([o['key'] for o in c['custom_options']], ['custom_cover', 'text_unlock', 'image_insert'])
        self.assertEqual(c['spreads']['price'], 300)
        self.assertEqual(c['consult'], {'label': '專人解讀', 'minutes': 30, 'price': 1500, 'max_sessions': 4})
        self.configure(custom_options={'text_unlock': {'price': 500, 'enabled': False}}, consult={'enabled': False})
        c = self.client.get('/api/v1/report-physical-config').get_json()['config']
        self.assertNotIn('text_unlock', [o['key'] for o in c['custom_options']])
        self.assertIsNone(c['consult'])

    def test_disabled_physical_blocks_orders(self):
        self.configure(physical_enabled=False)
        r = self.post(payload(variant='physical', shipping=SHIPPING, physical={'spec_key': 'soft'}))
        self.assertEqual((r.status_code, r.get_json()['code']), (409, 'product_unavailable'))
        self.assertEqual(self.ziwei_calls, [])

    def test_physical_purchase_pricing_with_quantity_custom_and_consult(self):
        self.configure()
        bad = self.post(payload(variant='physical', shipping=SHIPPING, physical={'quantity': 2}))
        self.assertIn('spec_key', bad.get_json()['errors'])
        bad = self.post(payload(variant='physical', shipping=SHIPPING,
                                physical={'spec_key': 'soft', 'spreads': 11, 'custom': ['nope']}))
        self.assertEqual(set(bad.get_json()['errors']), {'spreads', 'custom'})

        # 平裝 3 本：900 ＋ 600×2；文字修改 500；2 個跨頁 600；解讀 1 次 1500
        r = self.post(payload(variant='physical', shipping=SHIPPING, consult_sessions=1,
                              physical={'spec_key': 'soft', 'quantity': 3, 'custom': ['text_unlock'], 'spreads': 2}))
        self.assertEqual(r.status_code, 201, r.get_json())
        o = r.get_json()['order']
        book = 900 + 600 * 2 + 500 + 600
        self.assertEqual(o['amount'], 1980 + book + 1500)
        self.assertEqual([(line['variant'], line['amount']) for line in o['lines']],
                         [('physical', 1980 + book), ('consult', 1500)])
        job = ReportPrintJob.query.one()
        self.assertEqual((job.pricing['quantity'], job.pricing['line_total'], job.pricing['digital_price']), (3, book, 1980))
        self.assertEqual(job.custom['options'], ['text_unlock'])
        self.assertEqual(o['physical']['custom_labels'], ['解鎖內容文字修改', '指定跨頁 2 個'])
        self.assertEqual(o['consult']['status'], 'awaiting_payment')
        consult = ReportConsultation.query.one()
        self.assertEqual((consult.sessions, consult.minutes), (1, 30))

    def test_digital_purchase_with_consult_only(self):
        self.configure()
        r = self.post(payload(consult_sessions=2))
        o = r.get_json()['order']
        self.assertEqual((o['amount'], o['physical']), (1980 + 3000, None))
        self.confirm(o['order_no'], o['amount'])
        self.assertEqual(ReportConsultation.query.one().status, 'to_schedule')
        self.assertEqual(self.post(payload(submission_key='k-2-consult', consult_sessions=5)).get_json()['code'], 'invalid')

    # ── 事後加購 ─────────────────────────────────────────────────────────
    def test_addon_requires_paid_parent(self):
        o = self.post(payload()).get_json()['order']
        r = self.addon(o['order_no'], physical={'quantity': 1})
        self.assertEqual((r.status_code, r.get_json()['code']), (409, 'parent_not_paid'))

    def test_addon_book_and_consult_in_one_order(self):
        self.configure()
        o = self.paid_order()
        detail = self.client.get(f'/api/v1/report-orders/{o["order_no"]}', headers=self.headers()).get_json()['order']
        self.assertEqual(detail['addon_offer'], {'physical': True, 'consult': True, 'available': True})

        r = self.addon(o['order_no'], physical={'spec_key': 'coated', 'quantity': 2, 'custom': ['custom_cover']},
                       consult=1)
        self.assertEqual(r.status_code, 201, r.get_json())
        a = r.get_json()['order']
        self.assertEqual(a['amount'], (1200 + 600 + 300) + 1500)
        self.assertEqual((a['item']['kind'], a['item']['quantity'], a['item']['parent_order_no']), ('addon', 2, o['order_no']))
        self.assertEqual((a['physical']['status'], a['consult']['status']), ('awaiting_payment', 'awaiting_payment'))
        item = OrderItem.query.filter_by(kind='addon').one()
        self.assertEqual((item.unit_price, item.quantity), (2100, 2))
        self.assertEqual(len(self.ziwei_calls), 1)  # 加購不重新排盤

        again = self.addon(o['order_no'], physical={'spec_key': 'coated', 'quantity': 2}, consult=1)
        self.assertEqual((again.status_code, again.get_json()['created']), (200, False))

        parent_view = self.client.get(f'/api/v1/report-orders/{o["order_no"]}', headers=self.headers()).get_json()['order']
        self.assertEqual(len(parent_view['addons']), 1)
        self.assertEqual(parent_view['addons'][0]['physical']['quantity'], 2)
        self.assertEqual(parent_view['addons'][0]['consult']['sessions'], 1)

    def test_consult_only_addon_needs_no_shipping(self):
        self.configure()
        o = self.paid_order()
        r = self.addon(o['order_no'], consult=2, shipping={})
        self.assertEqual(r.status_code, 201, r.get_json())
        a = r.get_json()['order']
        self.assertEqual((a['amount'], a['physical'], a['consult']['sessions']), (3000, None, 2))
        self.assertEqual(a['item']['parent_order_no'], o['order_no'])
        self.assertEqual(self.addon(o['order_no'], submission_key='addon-key-none').get_json()['code'], 'invalid')

    def test_addon_validation_and_ownership(self):
        self.configure()
        o = self.paid_order()
        self.assertIn('quantity', self.addon(o['order_no'], physical={'spec_key': 'soft', 'quantity': 0}).get_json()['errors'])
        self.assertIn('recipient_name', self.addon(o['order_no'], physical={'spec_key': 'soft'}, shipping={}).get_json()['errors'])
        self.assertEqual(self.addon(o['order_no'], physical={'spec_key': 'soft'}, policy_consented=False).get_json()['code'],
                         'policy_required')
        other = self.make_user('other@example.com', verified=True)
        self.assertEqual(self.addon(o['order_no'], user=other, physical={'spec_key': 'soft'}).status_code, 404)
        self.configure(physical_enabled=False)
        self.assertEqual(self.addon(o['order_no'], physical={'spec_key': 'soft'}).get_json()['code'], 'addon_unavailable')

    def test_addon_payment_moves_book_and_consult(self):
        self.configure()
        o = self.paid_order()
        a = self.addon(o['order_no'], physical={'spec_key': 'soft'}, consult=1).get_json()['order']
        self.confirm(a['order_no'], a['amount'])
        self.assertEqual((ReportPrintJob.query.one().status, ReportConsultation.query.one().status),
                         ('awaiting_customization', 'to_schedule'))
        self.assertTrue(any('出貨時會再寄信通知你' in m.body and '約時間' in m.body for m in self.mails()))

    # ── 取消與退款 ───────────────────────────────────────────────────────
    def test_cancel_unpaid_addon_cancels_whole_order(self):
        self.configure()
        o = self.paid_order()
        a = self.addon(o['order_no'], physical={'spec_key': 'soft'}, consult=1).get_json()['order']
        r = self.client.post(f'/api/v1/report-orders/{a["order_no"]}/physical-cancel', json={}, headers=self.headers())
        v = r.get_json()['order']
        self.assertEqual((v['status'], v['physical']['status'], v['consult']['status']), ('cancelled', 'cancelled', 'cancelled'))
        self.assertIsNone(ReportPrintJob.query.one().refund_due)

    def test_cancel_paid_addon_book_keeps_consult(self):
        self.configure()
        o = self.paid_order()
        a = self.addon(o['order_no'], physical={'spec_key': 'coated', 'quantity': 2}, consult=1).get_json()['order']
        self.confirm(a['order_no'], a['amount'])
        v = self.client.post(f'/api/v1/report-orders/{a["order_no"]}/physical-cancel', json={},
                             headers=self.headers()).get_json()['order']
        self.assertEqual((v['status'], v['physical']['refund_due'], v['consult']['status']), ('paid', 1800, 'to_schedule'))

    def test_cancel_paid_physical_purchase_refunds_book_part(self):
        self.configure()
        o = self.paid_order(variant='physical', shipping=SHIPPING, physical={'spec_key': 'soft', 'custom': ['image_insert']})
        r = self.client.post(f'/api/v1/report-orders/{o["order_no"]}/physical-cancel', json={}, headers=self.headers())
        v = r.get_json()['order']
        self.assertEqual((v['status'], v['physical']['status'], v['physical']['refund_due']), ('paid', 'cancelled', 900 + 500))
        self.assertTrue(any('數位版報告不受影響' in m.body for m in self.mails()))
        job = ReportPrintJob.query.one()
        self.assertEqual(self.admin_post(f'report-print-jobs/{job.id}/refund', {'amount': 1400}).status_code, 200)
        self.assertEqual(self.admin_post(f'report-print-jobs/{job.id}/refund', {'amount': 1400}).get_json()['code'],
                         'already_refunded')

    def test_unpaid_physical_purchase_cannot_cancel_physical_part(self):
        o = self.post(payload(variant='physical', shipping=SHIPPING)).get_json()['order']
        r = self.client.post(f'/api/v1/report-orders/{o["order_no"]}/physical-cancel', json={}, headers=self.headers())
        self.assertEqual(r.get_json()['code'], 'not_paid')

    def approve_for_print(self, job):
        """打樣確認流程另有測試（tests/test_report_proofs.py）；這裡直接當作會員已確認打樣。"""
        job.status = 'approved'
        db.session.commit()

    def test_cannot_cancel_after_printing(self):
        o = self.paid_order(variant='physical', shipping=SHIPPING)
        job = ReportPrintJob.query.one()
        self.approve_for_print(job)
        self.assertEqual(self.admin_post(f'report-print-jobs/{job.id}/printing').status_code, 200)
        r = self.client.post(f'/api/v1/report-orders/{o["order_no"]}/physical-cancel', json={}, headers=self.headers())
        self.assertEqual(r.get_json()['code'], 'not_cancellable')

    # ── 出貨管理 ─────────────────────────────────────────────────────────
    def test_admin_fulfilment_flow(self):
        o = self.paid_order()
        a = self.addon(o['order_no'], physical={}).get_json()['order']
        job = ReportPrintJob.query.one()
        self.assertEqual(self.admin_post(f'report-print-jobs/{job.id}/printing').get_json()['code'], 'invalid_status')
        self.confirm(a['order_no'], a['amount'])
        self.assertEqual(self.admin_post(f'report-print-jobs/{job.id}/printing', user=self.user).status_code, 403)
        r = self.admin_post(f'report-print-jobs/{job.id}/printing')  # 會員還沒確認打樣，不能送印
        self.assertEqual((r.status_code, r.get_json()['code']), (409, 'invalid_status'))
        self.approve_for_print(job)
        self.assertEqual(self.admin_post(f'report-print-jobs/{job.id}/printing').status_code, 200)
        self.assertEqual(self.admin_post(f'report-print-jobs/{job.id}/shipped', {'carrier': '黑貓'}).status_code, 400)
        r = self.admin_post(f'report-print-jobs/{job.id}/shipped', {'carrier': '黑貓', 'tracking_no': '9001'})
        self.assertEqual(r.get_json()['job']['shipping']['tracking_no'], '9001')
        self.assertTrue(any('實體書已出貨' in m.subject for m in self.mails()))
        self.assertEqual(self.admin_post(f'report-print-jobs/{job.id}/delivered').status_code, 200)

    def test_overdue_addon_is_cancelled_with_book_and_consult(self):
        self.configure()
        o = self.paid_order()
        a = self.addon(o['order_no'], physical={'spec_key': 'soft'}, consult=1).get_json()['order']
        order = Order.query.filter_by(order_no=a['order_no']).one()
        OrderCheckout.query.filter_by(order_id=order.id).one().expires_at = datetime.utcnow() - timedelta(hours=1)
        db.session.commit()
        self.client.get(f'/api/v1/report-orders/{a["order_no"]}', headers=self.headers())
        self.assertEqual((ReportPrintJob.query.one().status, ReportConsultation.query.one().status), ('cancelled', 'cancelled'))

    # ── 專人解讀管理 ─────────────────────────────────────────────────────
    def test_consult_schedule_complete_and_listing(self):
        self.configure()
        o = self.paid_order(consult_sessions=1)
        c = ReportConsultation.query.one()
        self.assertEqual(self.admin_post(f'report-consultations/{c.id}/complete').get_json()['code'], 'invalid_status')
        self.assertEqual(self.admin_post(f'report-consultations/{c.id}/schedule', {}).status_code, 400)
        r = self.admin_post(f'report-consultations/{c.id}/schedule',
                            {'scheduled_at': '2026-10-20T14:00:00+08:00', 'note': 'Google Meet'})
        self.assertEqual(r.status_code, 200, r.get_json())
        self.assertTrue(any('專人解讀時間確認' in m.subject and '2026-10-20 14:00' in m.body for m in self.mails()))
        self.assertEqual(self.admin_post(f'report-consultations/{c.id}/complete').status_code, 200)
        listing = self.client.get('/api/v1/admin/report-consultations?status=completed',
                                  headers=self.headers(self.admin)).get_json()
        self.assertEqual([x['report_order_no'] for x in listing['consultations']], [o['order_no']])
        self.assertEqual(listing['consultations'][0]['call_name'], '小明')

    def test_consult_booking_keeps_preferences_before_payment(self):
        """會員中心「專人解讀」預約：選一本書＋次數＋時段，一張加購訂單；付款前時段就存著、也能改。"""
        from datetime import date, timedelta
        self.configure()
        o = self.paid_order()
        d1 = (date.today() + timedelta(days=5)).isoformat()
        prefs = {'slots': [{'date': d1, 'period': 'evening'}], 'note': '想聊孩子的學習'}
        bad = self.addon(o['order_no'], consult=1, shipping={}, submission_key='consult-bad-1',
                         consult_preferences={'slots': [{'date': date.today().isoformat(), 'period': 'morning'}]})
        self.assertIn('consult_preferences', bad.get_json()['errors'])
        r = self.addon(o['order_no'], consult=1, shipping={}, consult_preferences=prefs)
        self.assertEqual(r.status_code, 201, r.get_json())
        a = r.get_json()['order']
        self.assertEqual((a['status'], a['consult']['status'], a['consult']['preferences']),
                         ('pending', 'awaiting_payment', prefs))
        url = f'/api/v1/report-orders/{a["order_no"]}/consult-preferences'
        d2 = (date.today() + timedelta(days=6)).isoformat()
        r = self.client.post(url, json={'slots': [{'date': d2, 'period': 'morning'}]}, headers=self.headers())
        self.assertEqual(r.status_code, 200, r.get_json())  # 付款前也能改
        self.confirm(a['order_no'], a['amount'])
        c = ReportConsultation.query.one()
        self.assertEqual((c.status, c.preferences['slots'][0]['date']), ('to_schedule', d2))

    def test_member_consult_preferences(self):
        from datetime import date, timedelta
        self.configure()
        o = self.paid_order(consult_sessions=1)
        url = f'/api/v1/report-orders/{o["order_no"]}/consult-preferences'
        d1, d2 = (date.today() + timedelta(days=2)).isoformat(), (date.today() + timedelta(days=3)).isoformat()
        r = self.client.post(url, json={'slots': [{'date': date.today().isoformat(), 'period': 'morning'}]},
                             headers=self.headers())
        self.assertEqual(r.get_json()['code'], 'invalid')  # 今天不行
        r = self.client.post(url, headers=self.headers(), json={'note': '平日晚上較方便', 'slots': [
            {'date': d1, 'period': 'evening'}, {'date': d1, 'period': 'evening'}, {'date': d2, 'period': 'noon'},
            {'date': d2, 'period': 'morning'}]})
        self.assertEqual(r.status_code, 200, r.get_json())
        prefs = r.get_json()['order']['consult']['preferences']
        self.assertEqual(prefs, {'note': '平日晚上較方便', 'slots': [{'date': d1, 'period': 'evening'},
                                                                  {'date': d2, 'period': 'morning'}]})
        other = self.make_user('other@example.com', verified=True)
        self.assertEqual(self.client.post(url, json={}, headers=self.headers(other)).status_code, 404)
        c = ReportConsultation.query.one()
        listing = self.client.get('/api/v1/admin/report-consultations', headers=self.headers(self.admin)).get_json()
        self.assertEqual(listing['consultations'][0]['preferences']['slots'][0]['date'], d1)
        self.admin_post(f'report-consultations/{c.id}/schedule', {'scheduled_at': '2026-10-20T14:00:00+08:00'})
        r = self.client.post(url, json={'slots': [{'date': d1, 'period': 'morning'}]}, headers=self.headers())
        self.assertEqual(r.get_json()['code'], 'invalid_status')  # 約好之後不能再改

    def test_consult_admin_cancel_and_refund(self):
        self.configure()
        o = self.paid_order()
        a = self.addon(o['order_no'], consult=2).get_json()['order']
        self.confirm(a['order_no'], a['amount'])
        c = ReportConsultation.query.one()
        self.assertEqual(self.admin_post(f'report-consultations/{c.id}/cancel', {'reason': ''}).status_code, 400)
        r = self.admin_post(f'report-consultations/{c.id}/cancel', {'reason': '會員要求'})
        self.assertEqual(r.get_json()['consultation']['refund_due'], 3000)
        self.assertEqual(Order.query.filter_by(order_no=a['order_no']).one().status, 'cancelled')
        listing = self.client.get('/api/v1/admin/report-consultations?status=refund_pending',
                                  headers=self.headers(self.admin)).get_json()
        self.assertEqual(listing['counts']['refund_pending'], 1)
        self.assertEqual(self.admin_post(f'report-consultations/{c.id}/refund', {'amount': 3000}).status_code, 200)
        self.assertTrue(any('退款完成' in m.subject for m in self.mails()))
