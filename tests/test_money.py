"""多幣別資料基礎（report_orders/money.py；2026-10-20）：最小單位換算、顯示格式、契約層的小數位數。"""
import unittest

from core.backend_engine.factory import db
from packages.commerce.models import Order, OrderItem, Product
from sites.Polaris_Parent.backend.commerce_models import (CommerceEntitlement, CommerceLine, CommerceSource,
                                                         CommerceTask)
from sites.Polaris_Parent.backend.extensions.report_orders import commerce, money
from sites.Polaris_Parent.backend.extensions.report_orders.service import OrderError

from tests.test_report_orders import _Base


class MoneyTests(unittest.TestCase):
    def test_to_minor(self):
        self.assertEqual(money.to_minor('49.99', 'USD'), 4999)
        self.assertEqual(money.to_minor(49, 'USD'), 4900)
        self.assertEqual(money.to_minor('1,980', 'TWD'), 1980)
        self.assertEqual(money.to_minor('499.5', 'NOK'), 49950)
        self.assertEqual(money.to_minor('0', 'EUR'), 0)
        for bad, code in (('49.999', 'USD'), ('1980.5', 'TWD'), ('-1', 'USD'), ('abc', 'USD'), ('NaN', 'EUR'),
                          ('1e3', 'JPY')):
            if bad == '1e3':
                self.assertEqual(money.to_minor(bad, code), 1000)  # 科學記號是合法數字
                continue
            with self.assertRaises(ValueError, msg=(bad, code)):
                money.to_minor(bad, code)
        with self.assertRaises(ValueError):
            money.to_minor('1', 'XYZ')

    def test_fmt_and_major(self):
        self.assertEqual(money.fmt(1980, 'TWD'), 'NT$1,980')  # 既有台幣顯示不變
        self.assertEqual(money.fmt(4999, 'USD'), 'US$49.99')
        self.assertEqual(money.fmt(123450, 'EUR'), '€1,234.50')
        self.assertEqual(money.fmt(49900, 'NOK'), 'NOK 499.00')
        self.assertEqual(money.fmt(5000, 'JPY'), '¥5,000')
        self.assertEqual(money.fmt(None, 'USD'), '-')
        self.assertEqual(money.to_major(4999, 'USD'), '49.99')
        self.assertEqual(money.to_major(1980, 'TWD'), '1980')
        self.assertEqual({c['code'] for c in money.catalog()} >= {'TWD', 'USD', 'EUR', 'NOK'}, True)


class ContractCurrencyTests(_Base):
    def setUp(self):
        super().setUp()
        self.app.config['COMMERCE_FOUNDATION_ENABLED'] = True
        for model in (CommerceSource, CommerceLine, CommerceEntitlement, CommerceTask):
            model.__table__.create(db.engine)
            self.tables.append(model.__table__)

    def tearDown(self):
        self.app.config['COMMERCE_FOUNDATION_ENABLED'] = False
        super().tearDown()

    def _order(self, currency, amount):
        product = Product.query.filter_by(product_id='natal-report-digital').one()
        order = Order(order_no=f'T-{currency}', user_id=self.user.id, amount=amount, status='pending', items=[],
                      language='zh-TW', currency=currency, payment_method='manual')
        db.session.add(order)
        db.session.flush()
        db.session.add(OrderItem(order_id=order.id, item_no=f'R-{currency}', product_id=product.id,
                                 product_code=product.product_id, name='本命客製報告', variant='digital',
                                 kind='purchase', unit_price=amount, currency=currency, quantity=1, customization={}))
        db.session.flush()
        return order

    def test_contract_records_currency_exponent(self):
        order = self._order('USD', 4999)
        commerce.finalize_order(order)
        db.session.commit()
        line = CommerceLine.query.one()
        self.assertEqual((line.currency, line.currency_exponent, line.unit_amount), ('USD', 2, 4999))

    def test_twd_contract_unchanged(self):
        order = self._order('TWD', 1980)
        commerce.finalize_order(order)
        db.session.commit()
        self.assertEqual(CommerceLine.query.one().currency_exponent, 0)

    def test_unsupported_currency_rejected(self):
        order = self._order('XYZ', 100)
        with self.assertRaises(OrderError) as ctx:
            commerce.finalize_order(order)
        self.assertEqual(ctx.exception.code, 'currency_unavailable')
