"""Polaris 會員 v2：客製報告建單。In-memory SQLite；紫微服務、排盤引擎、寄信皆以假物件代替。"""
import re
import unittest
from datetime import datetime
from unittest.mock import patch

from flask import Flask
from flask_jwt_extended import JWTManager, create_access_token
from sqlalchemy import BigInteger, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles

from core.backend_engine.factory import db, limiter, mail
from core.backend_engine.models import User
from packages.commerce.models import (
    Order, OrderCheckout, OrderInvoice, OrderItem, OrderNotification, Product, ProductPrice,
)
from sites.Polaris_Parent.backend.extensions import report_orders
from sites.Polaris_Parent.backend.extensions.member_account import service as account_service
from sites.Polaris_Parent.backend.extensions.report_orders import service
from sites.Polaris_Parent.backend.models import MemberEmailVerification, ReportFulfillment, Shipment


@compiles(JSONB, 'sqlite')
def _jsonb_on_sqlite(type_, compiler, **kw):
    return 'JSON'


@compiles(BigInteger, 'sqlite')
def _bigint_on_sqlite(type_, compiler, **kw):
    return 'INTEGER'


_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September',
           'October', 'November', 'December']


class FakeEngine:
    """只實作建單用到的四個方法；真太陽時固定比鐘錶時間晚 9 分鐘。"""
    @staticmethod
    def build_clock_time_str(y, mo, d, h, mi):
        return f'{d} {_MONTHS[mo - 1]} {y} at {h:02d}:{mi:02d}'

    @staticmethod
    def parse_time_str(s):
        m = re.match(r'(\d+) (\w+) (\d+) at (\d+):(\d+)', s)
        d, month, y, h, mi = m.groups()
        return int(y), _MONTHS.index(month) + 1, int(d), int(h), int(mi)

    @staticmethod
    def get_geo_info(city, country):
        return {'place_en': city, 'coordinates': '0,0', 'timezone': 'Asia/Taipei'}

    def compute_solar_time(self, clock_str, place, tz):
        y, mo, d, h, mi = self.parse_time_str(clock_str)
        return self.build_clock_time_str(y, mo, d, h, mi + 9)


def payload(**over):
    body = {
        'submission_key': 'draft-key-0001',
        'policy_consented': True,
        'policy_version': service.POLICY_VERSION,
        'variant': 'digital',
        'subject_name': '王小明',
        'gender': '男',
        'birth': {'date': '2020-05-01', 'time': '08:00', 'time_type': 'clock_time'},
        'place': {'continent': '', 'country': '', 'city': ''},
        'relation_label': 'son',
        'audience': {'reader': '父母', 'call_name': '小明', 'dedication': '生日快樂'},
    }
    body.update(over)
    return body


SHIPPING = {'recipient_name': '王大明', 'recipient_phone': '0912-345-678', 'postal_code': '100',
            'address': '台北市中正區某某路 1 號'}


def _make_app():
    app = Flask(__name__)
    app.config.update(SQLALCHEMY_DATABASE_URI='sqlite://', RATELIMIT_ENABLED=False, TESTING=True,
                      SECRET_KEY='test-only', JWT_SECRET_KEY='test-only-jwt-secret-key-32bytes!',
                      JWT_TOKEN_LOCATION=['headers'], REPORT_PAYMENT_MODE='placeholder',
                      MAIL_DEFAULT_SENDER='noreply@example.test')
    JWTManager(app)
    db.init_app(app)
    limiter.init_app(app)
    mail.init_app(app)
    app.register_blueprint(report_orders.bp, url_prefix='/api/v1')
    return app


class ReportOrderTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = _make_app()

    def setUp(self):
        self.ctx = self.app.app_context()
        self.ctx.push()
        with db.engine.begin() as conn:
            attached = conn.execute(text('PRAGMA database_list')).scalars(1).all()
            for schema in ('blog', 'account', 'shop'):
                if schema not in attached:
                    conn.execute(text(f"ATTACH DATABASE ':memory:' AS {schema}"))
        self.tables = [User.__table__, Product.__table__, ProductPrice.__table__, Order.__table__,
                       OrderCheckout.__table__, OrderItem.__table__, OrderInvoice.__table__,
                       OrderNotification.__table__, ReportFulfillment.__table__, Shipment.__table__,
                       MemberEmailVerification.__table__]
        for t in self.tables:
            t.create(db.engine)

        self.user = self.make_user('buyer@example.com', verified=True)
        for code, price in (('natal-report-digital', 1980), ('natal-report-physical', 3980)):
            p = Product(product_id=code, names={'zh-TW': '本命客製報告'}, price=price, language='zh-TW',
                        is_active=True, stock_quantity=0, stock_status='in_stock')
            db.session.add(p)
            db.session.flush()
            db.session.add(ProductPrice(product_id=p.id, currency='TWD', price=price, is_active=True))
        db.session.commit()

        self.ziwei_calls = []
        self.ziwei_override = {}
        p1 = patch.object(report_orders, '_engine', return_value=FakeEngine())
        p2 = patch.object(report_orders, '_save_chart', side_effect=self.fake_save_chart)
        p3 = patch.object(mail, 'send')
        self.mail_send = p3.start()
        p1.start(), p2.start()
        for p in (p1, p2, p3):
            self.addCleanup(p.stop)
        self.client = self.app.test_client()

    def tearDown(self):
        db.session.remove()
        for t in reversed(self.tables):
            t.drop(db.engine)
        self.ctx.pop()

    # ── helpers ──────────────────────────────────────────────────────────
    def make_user(self, email, verified):
        u = User(username=email, email=email, role='member', is_active=True)
        u.set_password('Secret123')
        db.session.add(u)
        db.session.flush()
        if verified:
            account_service.mark_verified(u.id, email)
        db.session.commit()
        return u

    def fake_save_chart(self, p):
        self.ziwei_calls.append(p)
        res = {'chart_id': '202005011000000001', 'person_user_id': '777', 'member_id': str(self.user.id),
               'gender': {'男': 'M', '女': 'F'}[p['gender']],
               'clock_time': FakeEngine.build_clock_time_str(p['year'], p['month'], p['day'], p['hour'], p['minute'])}
        res.update(self.ziwei_override)
        return res, None

    def headers(self, user=None):
        return {'Authorization': f'Bearer {create_access_token(identity=str((user or self.user).id))}'}

    def post(self, body, user=None):
        return self.client.post('/api/v1/report-orders', json=body, headers=self.headers(user))

    # ── 前置條件 ─────────────────────────────────────────────────────────
    def test_requires_verified_email(self):
        other = self.make_user('new@example.com', verified=False)
        r = self.post(payload(), other)
        self.assertEqual(r.status_code, 403)
        self.assertEqual(r.get_json()['code'], 'email_unverified')
        self.assertEqual(self.ziwei_calls, [])

    def test_requires_policy_consent_with_current_version(self):
        for over in ({'policy_consented': False}, {'policy_version': 'old'}):
            r = self.post(payload(**over))
            self.assertEqual(r.status_code, 400)
            self.assertEqual(r.get_json()['code'], 'policy_required')
        self.assertEqual(Order.query.count(), 0)

    def test_invalid_fields_rejected_before_calling_ziwei(self):
        r = self.post(payload(subject_name='', birth={'date': '2099-01-01', 'time': '25:00', 'time_type': 'clock_time'}))
        self.assertEqual(r.status_code, 400)
        self.assertEqual(set(r.get_json()['errors']), {'subject_name', 'birth_date', 'birth_time'})
        self.assertEqual(self.ziwei_calls, [])

    def test_product_without_price_is_unavailable(self):
        Product.query.filter_by(product_id='natal-report-digital').update({'is_active': False})
        db.session.commit()
        r = self.post(payload())
        self.assertEqual(r.status_code, 409)
        self.assertEqual(r.get_json()['code'], 'product_unavailable')

    # ── 建單 ─────────────────────────────────────────────────────────────
    def test_digital_order_creates_all_rows(self):
        r = self.post(payload())
        self.assertEqual(r.status_code, 201, r.get_json())
        body = r.get_json()['order']
        self.assertEqual((body['status'], body['amount'], body['payment_mode']), ('pending', 1980, 'placeholder'))

        self.assertEqual(self.ziwei_calls, [{
            'year': 2020, 'month': 5, 'day': 1, 'hour': 8, 'minute': 0, 'gender': '男', 'name': '王小明',
            'place': '', 'email': 'buyer@example.com', 'relation': 'son'}])

        order = Order.query.one()
        self.assertEqual(order.checkout.submission_key, 'draft-key-0001')
        self.assertEqual(order.checkout.policy_version, service.POLICY_VERSION)
        item = OrderItem.query.one()
        self.assertTrue(re.fullmatch(r'R\d{6}[A-Z0-9]{8}', item.item_no))
        self.assertEqual((item.variant, item.unit_price, item.kind), ('digital', 1980, 'purchase'))
        self.assertEqual(item.customization['audience']['dedication'], '生日快樂')
        self.assertEqual(item.customization['chart_time']['used'], '2020-05-01 08:00')
        f = ReportFulfillment.query.one()
        self.assertEqual((f.request_no, f.chart_id, f.person_user_id, f.handoff_status),
                         (item.item_no, 202005011000000001, 777, 'not_ready'))
        self.assertEqual(OrderInvoice.query.one().status, 'not_applicable')
        self.assertEqual(Shipment.query.count(), 0)

        note = OrderNotification.query.one()
        self.assertEqual((note.event, note.status, note.recipient), ('order_created', 'sent', 'buyer@example.com'))
        sent = self.mail_send.call_args[0][0]
        self.assertIn('付款功能尚未開放', sent.body)
        self.assertNotIn('2020', sent.body)  # 信中不放出生資料

    def test_resubmit_same_key_returns_same_order(self):
        first = self.post(payload())
        again = self.post(payload())
        self.assertEqual(again.status_code, 200)
        self.assertFalse(again.get_json()['created'])
        self.assertEqual(again.get_json()['order']['order_no'], first.get_json()['order']['order_no'])
        self.assertEqual(len(self.ziwei_calls), 1)
        self.assertEqual(Order.query.count(), 1)
        self.assertEqual(self.mail_send.call_count, 1)

    def test_submission_key_of_another_user_conflicts(self):
        self.post(payload())
        other = self.make_user('other@example.com', verified=True)
        r = self.post(payload(), other)
        self.assertEqual(r.status_code, 409)

    def test_physical_requires_shipping_and_creates_shipment(self):
        r = self.post(payload(variant='physical'))
        self.assertEqual(r.status_code, 400)
        self.assertIn('recipient_name', r.get_json()['errors'])

        r = self.post(payload(variant='physical', shipping=SHIPPING))
        self.assertEqual(r.status_code, 201, r.get_json())
        self.assertEqual(r.get_json()['order']['amount'], 3980)
        s = Shipment.query.one()
        self.assertEqual((s.recipient_name, s.status), ('王大明', 'pending'))

    def test_solar_time_is_converted_before_saving_chart(self):
        body = payload(birth={'date': '2020-05-01', 'time': '08:00', 'time_type': 'solar_time'},
                       place={'continent': 'Asia', 'country': 'Taiwan', 'city': 'Taipei'})
        r = self.post(body)
        self.assertEqual(r.status_code, 201, r.get_json())
        self.assertEqual((self.ziwei_calls[0]['hour'], self.ziwei_calls[0]['minute']), (8, 9))
        self.assertEqual(self.ziwei_calls[0]['place'], 'Taipei, Taiwan')
        c = OrderItem.query.one().customization
        self.assertEqual(c['birth']['time'], '08:00')            # 保留客人原始輸入
        self.assertEqual(c['chart_time']['used'], '2020-05-01 08:09')

    def test_chart_mismatch_or_outdated_service_creates_nothing(self):
        for override, code in (({'gender': 'F'}, 'chart_mismatch'),
                               ({'clock_time': '1 May 2020 at 09:00'}, 'chart_mismatch'),
                               ({'gender': None}, 'chart_service_outdated')):
            self.ziwei_override = override
            r = self.post(payload(submission_key=f'key-{code}-{len(self.ziwei_calls)}'))
            self.assertEqual(r.status_code, 502)
            self.assertEqual(r.get_json()['code'], code)
        self.assertEqual(Order.query.count(), 0)
        self.assertEqual(ReportFulfillment.query.count(), 0)

    # ── 查詢 ─────────────────────────────────────────────────────────────
    def test_members_only_see_their_own_orders(self):
        order_no = self.post(payload()).get_json()['order']['order_no']
        other = self.make_user('other@example.com', verified=True)
        self.assertEqual(self.client.get(f'/api/v1/report-orders/{order_no}', headers=self.headers()).status_code, 200)
        self.assertEqual(self.client.get(f'/api/v1/report-orders/{order_no}', headers=self.headers(other)).status_code, 404)
        mine = self.client.get('/api/v1/report-orders', headers=self.headers()).get_json()['orders']
        theirs = self.client.get('/api/v1/report-orders', headers=self.headers(other)).get_json()['orders']
        self.assertEqual([o['order_no'] for o in mine], [order_no])
        self.assertEqual(theirs, [])


if __name__ == '__main__':
    unittest.main()
