"""
客製報告建單（會員 v2，docs/membership-v2-ziwei-contract.md §5 步驟 1）。

流程：驗證 → 冪等檢查（submission_key）→ 讀商品價格 → 換算排盤時間 → 紫微 save-and-register
存命盤 → 核對紫微回傳的命盤 → 同一個 transaction 建 orders / order_checkouts / order_items /
report_fulfillments / order_invoices（＋實體書的 shipments）。

付款模式：placeholder 只建待付款訂單；manual（人工收款）另設匯款期限，付款流程見 payment.py。
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
# 官網販售的語言（一種語言一筆商品，2026-10-28）；訂單語言決定交付的報告語言（handoff 帶給紫微端）
SUPPORTED_LANGUAGES = ('zh-TW', 'zh-CN', 'en', 'ja')
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


def _product_and_price(variant, language=LANGUAGE):
    product = Product.query.filter_by(product_id=PRODUCT_IDS[variant], language=language, is_active=True).first()
    if product is None:
        raise OrderError('這個版本尚未開放購買', 409, 'product_unavailable')
    price = product.get_price(product.currency).get('price')
    if not isinstance(price, int) or price <= 0:
        raise OrderError('這個版本尚未設定價格', 409, 'product_unavailable')
    return product, price


def _save_chart(clean, email, eng, save_chart):
    """換算排盤時間並請紫微存命盤；核對回傳的命盤確實是這份資料。回 (chart 回應, 排盤時間 dict)。"""
    from sites.Polaris_Parent.backend.extensions.astrology import resolve_birth_time
    from sites.Polaris_Parent.backend.extensions.astrology.birthplace import BirthplaceError

    b, p = clean['birth'], clean['place']
    clock = (b['year'], b['month'], b['day'], b['hour'], b['minute'])
    try:
        birth = resolve_birth_time(eng, clock, b['time_type'], p['city'], p['country'], place=p,
                                   allow_manual=p.get('manual') is True)  # 手動只會出現在後台代客建單（驗證已把關）
    except BirthplaceError as exc:
        current_app.logger.error(f'report order: 出生時間換算失敗 {p}：{exc}')
        raise OrderError(str(exc), 400, 'birth_time_failed')

    # 紫微的 save-and-register 直接以傳入時間排盤，所以真太陽時／夏令時要先在這裡換好（與 /calculate 預覽一致）
    resolved, birthplace = birth.resolved, birth.birthplace
    y, mo, d, h, mi = resolved
    res, err = save_chart({
        'year': y, 'month': mo, 'day': d, 'hour': h, 'minute': mi,
        'gender': clean['gender'], 'name': clean['subject_name'], 'place': birthplace,
        'email': email, 'relation': clean['relation_label'],
    })
    if err:
        # 技術細節（連線錯誤、紫微回應）只進 log，不顯示給客人
        current_app.logger.error(f'report order: 紫微 save-and-register 失敗：{err}')
        raise OrderError('系統暫時無法建立訂單，請稍後再試；若持續發生請聯絡客服。', 502, 'chart_service_error')

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

    return res, birth.as_dict()


def create_report_order(user, email, clean, submission_key, eng, save_chart, payment_mode='placeholder',
                        expires_at=None, terms=None):
    """建立待付款訂單。回傳 (order, created)；同一 submission_key 重送回傳既有訂單、created=False。

    terms（後台代客建單用，proxy.py）：{'amount', 'currency', 'language', 'policy_version'}——
    以平台實際成交金額與幣別建單、不套官網價格；不接受專人解讀（外部平台的解讀另行處理）。
    """
    existing = find_by_submission_key(submission_key)
    if existing is not None:
        if existing.user_id != user.id:
            raise OrderError('這筆送出編號已被使用', 409, 'submission_conflict')
        return existing, False

    from . import physical as phys

    # 官網下單：語言版本決定商品、售價與幣別；代客建單沿用繁中商品資料（平台訂單的語系可能沒有對應商品）
    language = (clean.get('language') or LANGUAGE) if terms is None else LANGUAGE
    if language not in SUPPORTED_LANGUAGES:
        raise OrderError('不支援這個語言', 400, 'invalid')
    cfg = phys.load_config(language)
    selection = None
    errors = {}
    if clean['variant'] == 'physical':
        # 實體書版：數位版售價＋實體書（第一本含規格＋第二本起＋特殊客製），設定見 physical.py
        # 代客建單（terms）以平台成交金額為準，不受官網「是否開放實體書」限制（官網還沒開賣也能接外部訂單）
        if not cfg['enabled'] and terms is None:
            raise OrderError('實體書目前沒有開放購買', 409, 'product_unavailable')
        selection, e = phys.price_physical(cfg, clean.get('physical'))
        errors.update(e)
    consult, e = phys.price_consult(cfg, clean.get('consult_sessions'))
    errors.update(e)
    if terms is not None and consult:
        errors['consult_sessions'] = '代客建單目前不含專人解讀'
    if errors:
        err = OrderError('資料有誤，請檢查後再送出', 400, 'invalid')
        err.errors = errors
        raise err
    if terms is not None:
        # 代客建單：只要官網有這個商品資料（訂單項目要指向它）；不要求上架、不要求有售價，金額用平台成交
        product = Product.query.filter_by(product_id=PRODUCT_IDS[clean['variant']], language=LANGUAGE).first()
        if product is None:
            raise OrderError('官網還沒有建立這個報告商品的資料，請先到後台「產品」建立', 409, 'product_unavailable')
        price = terms['amount']
    elif selection is not None:
        product = Product.query.filter_by(product_id=PRODUCT_IDS['physical'], language=language).first()
        if product is None or cfg['digital_price'] is None:
            raise OrderError('實體書目前沒有開放購買', 409, 'product_unavailable')
        price = cfg['digital_price'] + selection['line_total']
    else:
        product, price = _product_and_price(clean['variant'], language)
    currency, policy_version = cfg['currency'], POLICY_VERSION
    if terms is None and currency != CURRENCY and payment_mode == 'manual':
        # 人工匯款只收台幣；外幣要等國際金流
        raise OrderError('這個語言版本目前還不能付款，請改選繁體中文版本', 409, 'currency_unavailable')
    if terms is not None:
        price, currency = terms['amount'], terms['currency']
        language, policy_version = terms.get('language') or LANGUAGE, terms['policy_version']
    chart, chart_time = _save_chart(clean, email, eng, save_chart)

    variant = clean['variant']
    name = f"{(product.names or {}).get(product.language) or product.product_id}（{VARIANT_LABELS[variant]}）"
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

    order = Order(order_no=_new_order_no(), user_id=user.id, amount=price + (consult['line_total'] if consult else 0),
                  status='pending', items=[], language=language, currency=currency, payment_method=payment_mode)
    db.session.add(order)
    db.session.flush()
    now = datetime.utcnow()
    db.session.add(OrderCheckout(order_id=order.id, submission_key=submission_key,
                                 policy_version=policy_version, policy_consented_at=now, expires_at=expires_at))
    item = OrderItem(order_id=order.id, item_no=item_no, product_id=product.id, product_code=product.product_id,
                     name=name, variant=variant, kind='purchase', unit_price=price, currency=currency,
                     quantity=1, customization=customization)
    db.session.add(item)
    db.session.flush()
    db.session.add(ReportFulfillment(order_item_id=item.id, request_no=item_no, member_id=user.id,
                                     chart_id=int(chart['chart_id']), person_user_id=int(chart['person_user_id']),
                                     handoff_status='not_ready'))
    db.session.add(OrderInvoice(order_id=order.id, status='not_applicable'))
    items = [item]
    if consult:
        items.append(phys.create_consult_item(order, item, consult))
    order.items = [phys.item_snapshot(i) for i in items]
    if variant == 'physical':
        job = phys.create_print_job(item, cfg, selection, clean['audience']['call_name'])
        if terms is not None:
            # 價格以平台成交為準：計價快照只記平台金額，不留官網（台幣）的計價明細
            job.pricing = {'quantity': selection['quantity'], 'line_total': price, 'currency': currency,
                           'breakdown': [{'label': '平台成交金額', 'amount': price}], 'source': 'external'}
        s = clean['shipping']
        db.session.add(Shipment(order_item_id=item.id, recipient_name=s['recipient_name'],
                                recipient_phone=s['recipient_phone'], postal_code=s['postal_code'] or None,
                                address=s['address'], country=s.get('country') or None, status='pending'))
    from . import commerce
    try:
        commerce.finalize_order(order)
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
    from . import commerce
    from .payment import attempt_view, latest_manual_attempt, manual_bank_info

    from . import delivery
    from . import physical as phys

    # 主項目：報告（purchase）＞實體書加購＞其他（例如單獨加購的專人解讀）
    items = order.order_items
    item = (next((i for i in items if i.kind == 'purchase'), None)
            or next((i for i in items if i.variant == 'physical'), None)
            or (items[0] if items else None))
    payment = {'mode': order.payment_method,
               'deadline': order.checkout.expires_at.isoformat() if order.checkout and order.checkout.expires_at else None}
    if order.payment_method == 'external_verified':
        payment['deadline'] = None
    if order.payment_method == 'manual':
        payment['transfer'] = attempt_view(latest_manual_attempt(order))
        if order.status == 'pending':
            payment['bank'] = manual_bank_info()
    fulfillment = ReportFulfillment.query.filter_by(order_item_id=item.id).first() if item else None
    shipment = Shipment.query.filter_by(order_item_id=item.id).first() if item else None
    c = item.customization if item else {}
    p_item = phys.physical_item(order)
    p_job = phys.print_job_for(p_item)
    c_item = phys.consult_item(order)
    c_row = phys.consultation_for(c_item)
    return {
        'commerce': commerce.view(order),
        'order_no': order.order_no,
        'status': order.status,
        'amount': order.amount,
        'currency': order.currency,
        'payment_mode': order.payment_method,
        'payment': payment,
        'created_at': order.created_at.isoformat() if order.created_at else None,
        'paid_at': order.paid_at.isoformat() if order.paid_at else None,
        'item': item and {
            'item_no': item.item_no,
            'name': item.name,
            'variant': item.variant,
            'subject_name': c.get('subject_name'),
            'call_name': (c.get('audience') or {}).get('call_name'),
            'kind': item.kind,
            'quantity': item.quantity,
            'parent_order_no': c.get('parent_order_no'),
            # 會員中心依家人分組用（對 my-charts 的 person user_id）；加購訂單沒有 fulfillment，跟著原報告走
            'person_user_id': str(fulfillment.person_user_id) if fulfillment and fulfillment.person_user_id else None,
            'chart_id': str(fulfillment.chart_id) if fulfillment and fulfillment.chart_id else None,
        },
        'lines': [{'name': i.name, 'kind': i.kind, 'variant': i.variant, 'quantity': i.quantity,
                   'amount': commerce.legacy_line_total(i)}
                  for i in items],
        'report': (lambda d: d and delivery.document_view(d))(delivery.current_document(item))
        if item is not None and item.kind == 'purchase' and order.status == 'paid' else None,
        'physical': p_job and phys.job_view(p_job, p_item),
        'consult': c_row and phys.consult_view(c_row, c_item),
        'addons': phys.addon_children(item) if item is not None and item.kind == 'purchase' else [],
        'addon_offer': phys.addon_offer(order),
        'production': fulfillment and {'handoff_status': fulfillment.handoff_status,
                                        'ziwei_status': fulfillment.ziwei_status,
                                        'member_note': fulfillment.member_note},
        'shipment': shipment and {'status': shipment.status, 'carrier': shipment.carrier,
                                  'tracking_no': shipment.tracking_no},
    }
