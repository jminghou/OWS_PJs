"""
客製報告建單（會員 v2，docs/membership-v2-ziwei-contract.md §5 步驟 1）。

流程：驗證 → 冪等檢查（submission_key）→ 讀商品價格 → 換算排盤時間 → 紫微 save-and-register
存命盤 → 核對紫微回傳的命盤 → 同一個 transaction 建 orders / order_checkouts / order_items /
report_fulfillments / order_invoices（＋實體書的 shipments）。

付款模式目前只有 placeholder：訂單停在待付款，不建付款嘗試、不交接生產。
"""

import secrets
import string
import uuid
from datetime import datetime

from flask import current_app
from sqlalchemy.exc import IntegrityError

from core.backend_engine.factory import db
from packages.commerce.models import Order, OrderCheckout, OrderInvoice, OrderItem, Product
from sites.Polaris_Parent.backend.models import ReportFulfillment, Shipment

# 交易政策版本：政策文字（前端 /report/policy）改版時一起改，訂單記錄的是同意當下的版本
POLICY_VERSION = '2026-10-03'
LANGUAGE = 'zh-TW'
CURRENCY = 'TWD'
PRODUCT_IDS = {'digital': 'natal-report-digital', 'physical': 'natal-report-physical'}
VARIANT_LABELS = {'digital': '數位版', 'physical': '實體書版'}
_GENDER_CODE = {'男': 'M', '女': 'F'}


class OrderError(Exception):
    def __init__(self, message, status=400, code=None):
        super().__init__(message)
        self.message, self.status, self.code = message, status, code


def _new_item_no():
    alphabet = string.ascii_uppercase + string.digits
    return 'R' + datetime.utcnow().strftime('%y%m%d') + ''.join(secrets.choice(alphabet) for _ in range(8))


def _new_order_no():
    return f"ORD-{datetime.utcnow().strftime('%Y%m%d')}-{uuid.uuid4().hex[:8].upper()}"


def find_by_submission_key(submission_key):
    checkout = OrderCheckout.query.filter_by(submission_key=submission_key).first()
    return checkout.order if checkout else None


def _product_and_price(variant):
    product = Product.query.filter_by(product_id=PRODUCT_IDS[variant], language=LANGUAGE, is_active=True).first()
    if product is None:
        raise OrderError('這個版本尚未開放購買', 409, 'product_unavailable')
    price = product.get_price(CURRENCY).get('price')
    if not isinstance(price, int) or price <= 0:
        raise OrderError('這個版本尚未設定價格', 409, 'product_unavailable')
    return product, price


def _save_chart(clean, email, eng, save_chart):
    """換算排盤時間並請紫微存命盤；核對回傳的命盤確實是這份資料。回 (chart 回應, 排盤時間 dict)。"""
    from sites.Polaris_Parent.backend.extensions.astrology import resolve_birth_time

    b, p = clean['birth'], clean['place']
    clock = (b['year'], b['month'], b['day'], b['hour'], b['minute'])
    try:
        resolved, solar_str, birthplace = resolve_birth_time(eng, clock, b['time_type'], p['city'], p['country'])
    except Exception as exc:  # noqa: BLE001
        raise OrderError(f'無法換算真太陽時：{exc}', 400, 'solar_time_failed')

    # 紫微的 save-and-register 直接以傳入時間排盤，所以真太陽時要先在這裡換好（與 /calculate 預覽一致）
    y, mo, d, h, mi = resolved
    res, err = save_chart({
        'year': y, 'month': mo, 'day': d, 'hour': h, 'minute': mi,
        'gender': clean['gender'], 'name': clean['subject_name'], 'place': birthplace,
        'email': email, 'relation': clean['relation_label'],
    })
    if err:
        raise OrderError(f'命盤儲存失敗：{err}', 502, 'chart_service_error')

    # 防禦性核對：紫微回傳的命盤必須是這次送出的性別與時間（舊版紫微沒有這些欄位 → 拒絕）
    if res.get('gender') is None or res.get('clock_time') is None:
        raise OrderError('命盤服務版本過舊，暫時無法建立訂單', 502, 'chart_service_outdated')
    try:
        returned = tuple(eng.parse_time_str(res['clock_time']))
    except Exception:  # noqa: BLE001
        returned = None
    if res['gender'] != _GENDER_CODE[clean['gender']] or returned != tuple(resolved):
        current_app.logger.error(f"report order: 紫微回傳命盤不符 {res.get('chart_id')} {res} vs {resolved}")
        raise OrderError('命盤資料核對失敗，請聯絡客服', 502, 'chart_mismatch')

    chart_time = {'time_type': b['time_type'], 'used': f'{y:04d}-{mo:02d}-{d:02d} {h:02d}:{mi:02d}',
                  'solar_time': solar_str}
    return res, chart_time


def create_report_order(user, email, clean, submission_key, eng, save_chart, payment_mode='placeholder'):
    """建立待付款訂單。回傳 (order, created)；同一 submission_key 重送回傳既有訂單、created=False。"""
    existing = find_by_submission_key(submission_key)
    if existing is not None:
        if existing.user_id != user.id:
            raise OrderError('這筆送出編號已被使用', 409, 'submission_conflict')
        return existing, False

    product, price = _product_and_price(clean['variant'])
    chart, chart_time = _save_chart(clean, email, eng, save_chart)

    variant = clean['variant']
    name = f"{(product.names or {}).get(LANGUAGE) or product.product_id}（{VARIANT_LABELS[variant]}）"
    item_no = _new_item_no()
    customization = {
        'subject_name': clean['subject_name'],
        'gender': clean['gender'],
        'birth': {k: clean['birth'][k] for k in ('date', 'time', 'time_type')},
        'place': clean['place'],
        'relation_label': clean['relation_label'],
        'audience': clean['audience'],
        'chart_time': chart_time,
    }

    order = Order(order_no=_new_order_no(), user_id=user.id, amount=price, status='pending',
                  items=[{'product_id': product.product_id, 'name': name, 'price': price,
                          'currency': CURRENCY, 'variant': variant, 'item_no': item_no}],
                  language=LANGUAGE, currency=CURRENCY, payment_method=payment_mode)
    db.session.add(order)
    db.session.flush()
    now = datetime.utcnow()
    db.session.add(OrderCheckout(order_id=order.id, submission_key=submission_key,
                                 policy_version=POLICY_VERSION, policy_consented_at=now))
    item = OrderItem(order_id=order.id, item_no=item_no, product_id=product.id, product_code=product.product_id,
                     name=name, variant=variant, kind='purchase', unit_price=price, currency=CURRENCY,
                     quantity=1, customization=customization)
    db.session.add(item)
    db.session.flush()
    db.session.add(ReportFulfillment(order_item_id=item.id, request_no=item_no, member_id=user.id,
                                     chart_id=int(chart['chart_id']), person_user_id=int(chart['person_user_id']),
                                     handoff_status='not_ready'))
    db.session.add(OrderInvoice(order_id=order.id, status='not_applicable'))
    if variant == 'physical':
        s = clean['shipping']
        db.session.add(Shipment(order_item_id=item.id, recipient_name=s['recipient_name'],
                                recipient_phone=s['recipient_phone'], postal_code=s['postal_code'] or None,
                                address=s['address'], status='pending'))
    try:
        db.session.commit()
    except IntegrityError:
        # 同一份草稿同時送出兩次：另一個請求已先建好（紫微端會回傳同一張盤）
        db.session.rollback()
        existing = find_by_submission_key(submission_key)
        if existing is not None and existing.user_id == user.id:
            return existing, False
        raise
    return order, True


def order_summary(order):
    item = order.order_items[0] if order.order_items else None
    fulfillment = ReportFulfillment.query.filter_by(order_item_id=item.id).first() if item else None
    shipment = Shipment.query.filter_by(order_item_id=item.id).first() if item else None
    c = item.customization if item else {}
    return {
        'order_no': order.order_no,
        'status': order.status,
        'amount': order.amount,
        'currency': order.currency,
        'payment_mode': order.payment_method,
        'created_at': order.created_at.isoformat() if order.created_at else None,
        'item': item and {
            'item_no': item.item_no,
            'name': item.name,
            'variant': item.variant,
            'subject_name': c.get('subject_name'),
            'call_name': (c.get('audience') or {}).get('call_name'),
        },
        'production': fulfillment and {'handoff_status': fulfillment.handoff_status,
                                        'ziwei_status': fulfillment.ziwei_status,
                                        'member_note': fulfillment.member_note},
        'shipment': shipment and {'status': shipment.status, 'carrier': shipment.carrier,
                                  'tracking_no': shipment.tracking_no},
    }
