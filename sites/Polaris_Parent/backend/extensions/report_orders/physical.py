"""
客製報告的實體書與專人解讀：設定、計價、事後加購、取消與後台管理
（docs/report-physical-addon-plan.md 第 10 節定案版）。

設定存在數位版商品的 attributes.report_addon（後台「實體書設定」分頁）：
    physical_enabled   是否開放實體書
    first_copy_price   第一本（含運費）
    extra_copy_price   第二本起每本
    specs              規格 [{key, label, price_delta}]；加減價只影響第一本，可為負數
    cover_styles       封面款式 [{key, label, image}]
    custom_options     特殊客製（一張訂單收一次）{custom_cover|text_unlock|image_insert: {label, note, price, enabled}}
    spreads            指定跨頁 {label, price, max, enabled}（依跨頁數，一張訂單收一次）
    consult            專人解讀 {label, minutes, price, max_sessions, enabled}（任何報告可加購）

一筆實體書（line_total）＝第一本（含規格）＋第二本起×(數量−1)＋勾選的特殊客製＋跨頁數×跨頁價。
- 下單選實體書版：報告項目金額＝數位版售價＋line_total
- 事後加購：實體書項目金額＝line_total（OrderItem.quantity 記本數、unit_price 記整筆金額）
- 專人解讀：獨立的訂單項目（kind=service, variant=consult），unit_price×quantity＝次數×單價

所有金額由後端建單時計算並寫入訂單與快照；前端顯示的價格只是參考。
"""

from datetime import datetime
from sqlalchemy.exc import IntegrityError

from core.backend_engine.factory import db
from packages.commerce.models import Order, OrderCheckout, OrderInvoice, OrderItem, Product
from sites.Polaris_Parent.backend.models import (PRINT_JOB_CANCELLABLE, ReportConsultation, ReportPrintJob,
                                                 Shipment)

from .service import (CURRENCY, LANGUAGE, POLICY_VERSION, PRODUCT_IDS, OrderError, _new_item_no,
                      _new_order_no, find_by_submission_key)

ADDON_KEY = 'report_addon'
MAX_QUANTITY = 20
CUSTOM_KEYS = ('custom_cover', 'text_unlock', 'image_insert')
DEFAULT_COVER_STYLES = [
    {'key': 'style-1', 'label': '封面款式一', 'image': ''},
    {'key': 'style-2', 'label': '封面款式二', 'image': ''},
]
DEFAULT_CUSTOM = {
    'custom_cover': {'label': '客製封面', 'note': '需自行提供封面圖片；如需另外設計封面，費用另計。', 'price': 300},
    'text_unlock': {'label': '解鎖內容文字修改', 'note': '可以要求改寫報告裡的文字。', 'price': 500},
    'image_insert': {'label': '修改及置入指定圖片', 'note': '把書裡的圖片換成你指定的圖片。', 'price': 500},
}
DEFAULT_SPREADS = {'label': '加入自己的指定頁面', 'price': 300, 'max': 10}
DEFAULT_CONSULT = {'label': '專人解讀', 'minutes': 30, 'price': 1500, 'max_sessions': 4}

# 打樣確認上線後改為 True：只有會員確認送印（approved）的實體書才能標記送印
# 打樣上線（階段 1 ②，2026-10-19）：會員確認打樣（或自動／代為確認）後才能送印
PROOF_APPROVAL_REQUIRED = True
_PRE_PRINT = ('awaiting_customization', 'awaiting_proof', 'proof_ready', 'changes_requested', 'approved')


# ── 設定 ─────────────────────────────────────────────────────────────────────
def _product(variant):
    return Product.query.filter_by(product_id=PRODUCT_IDS[variant], language=LANGUAGE).first()


def _int(v, default=0, minimum=0):
    if isinstance(v, bool):
        return default
    try:
        n = int(v)
    except (TypeError, ValueError):
        return default
    return n if minimum is None else max(minimum, n)


def _text(v, limit):
    return str(v or '').strip()[:limit]


def _clean_specs(items):
    out, seen = [], set()
    for x in items if isinstance(items, list) else []:
        if not isinstance(x, dict):
            continue
        key, label = _text(x.get('key'), 40), _text(x.get('label'), 60)
        if key and label and key not in seen:
            seen.add(key)
            out.append({'key': key, 'label': label, 'price_delta': _int(x.get('price_delta'), minimum=None)})
    return out


def _clean_styles(items):
    out, seen = [], set()
    for x in items if isinstance(items, list) else []:
        if not isinstance(x, dict):
            continue
        key, label = _text(x.get('key'), 40), _text(x.get('label'), 60)
        if key and label and key not in seen:
            seen.add(key)
            out.append({'key': key, 'label': label, 'image': _text(x.get('image'), 500)})
    return out or DEFAULT_COVER_STYLES


def _block(raw, default, fields):
    """把後台存的一個設定區塊與預設值合併；enabled 預設 True。"""
    raw = raw if isinstance(raw, dict) else {}
    out = {'enabled': raw.get('enabled', True) is not False}
    for f in fields:
        if f in ('label', 'note'):
            out[f] = _text(raw.get(f), 200) or default.get(f, '')
        else:
            out[f] = _int(raw.get(f, default.get(f)), default.get(f, 0))
    return out


def load_config():
    """目前的實體書與專人解讀設定。"""
    digital, physical = _product('digital'), _product('physical')
    digital_price = None
    if digital is not None and digital.is_active:
        p = digital.get_price(CURRENCY).get('price')
        digital_price = p if isinstance(p, int) and p > 0 else None

    attrs = (digital.attributes or {}).get(ADDON_KEY) if digital is not None else None
    if isinstance(attrs, dict) and 'first_copy_price' in attrs:
        enabled = bool(attrs.get('physical_enabled'))
        first = _int(attrs.get('first_copy_price'))
        extra = _int(attrs.get('extra_copy_price'), first)
        specs = _clean_specs(attrs.get('specs'))
        styles = _clean_styles(attrs.get('cover_styles'))
        raw_custom = attrs.get('custom_options') if isinstance(attrs.get('custom_options'), dict) else {}
        custom = {k: _block(raw_custom.get(k), DEFAULT_CUSTOM[k], ('label', 'note', 'price')) for k in CUSTOM_KEYS}
        spreads = _block(attrs.get('spreads'), DEFAULT_SPREADS, ('label', 'price', 'max'))
        consult = _block(attrs.get('consult'), DEFAULT_CONSULT, ('label', 'minutes', 'price', 'max_sessions'))
    else:
        # 還沒在後台存過新版設定：第一本沿用「實體書售價 − 數位版售價」，其餘選項關閉
        phys_price = physical.get_price(CURRENCY).get('price') if physical is not None else None
        first = (phys_price - digital_price) if isinstance(phys_price, int) and digital_price else 0
        enabled, extra, specs, styles = True, first, [], DEFAULT_COVER_STYLES
        custom = {k: {**DEFAULT_CUSTOM[k], 'enabled': False} for k in CUSTOM_KEYS}
        spreads = {**DEFAULT_SPREADS, 'enabled': False}
        consult = {**DEFAULT_CONSULT, 'enabled': False}

    physical_ok = (enabled and physical is not None and physical.is_active and digital_price is not None
                   and first > 0)
    consult_ok = consult['enabled'] and consult['price'] > 0 and digital_price is not None
    return {
        'enabled': physical_ok,
        'digital_price': digital_price,
        'first_copy_price': first,
        'extra_copy_price': extra,
        'specs': specs,
        'cover_styles': styles,
        'custom_options': custom,
        'spreads': spreads,
        'consult': consult,
        'consult_enabled': consult_ok,
        'max_quantity': MAX_QUANTITY,
        'currency': CURRENCY,
    }


def public_config():
    """前台用：只給顯示與選擇需要的欄位（停用的選項不給）。"""
    c = load_config()
    return {
        'enabled': c['enabled'],
        'digital_price': c['digital_price'],
        'first_copy_price': c['first_copy_price'],
        'extra_copy_price': c['extra_copy_price'],
        'specs': c['specs'],
        'cover_styles': c['cover_styles'],
        'custom_options': [{'key': k, 'label': v['label'], 'note': v['note'], 'price': v['price']}
                           for k, v in c['custom_options'].items() if v['enabled']],
        'spreads': ({'label': c['spreads']['label'], 'price': c['spreads']['price'], 'max': c['spreads']['max']}
                    if c['spreads']['enabled'] and c['spreads']['max'] > 0 else None),
        'consult': ({k: c['consult'][k] for k in ('label', 'minutes', 'price', 'max_sessions')}
                    if c['consult_enabled'] else None),
        'max_quantity': c['max_quantity'],
        'currency': c['currency'],
    }


# ── 選項與計價 ───────────────────────────────────────────────────────────────
def _err(errors):
    err = OrderError('資料有誤，請檢查後再送出', 400, 'invalid')
    err.errors = errors
    return err


def price_physical(cfg, raw):
    """驗證實體書選項並計價。回傳 (selection, errors)。

    selection = {spec, quantity, custom: [key…], spreads, first_copy, extra_copies, custom_total,
                 line_total, breakdown: [{label, amount}]}
    """
    raw = raw if isinstance(raw, dict) else {}
    errors = {}
    spec = {'key': '', 'label': '', 'price_delta': 0}
    if cfg['specs']:
        match = next((x for x in cfg['specs'] if x['key'] == raw.get('spec_key')), None)
        if match is None:
            errors['spec_key'] = '請選擇實體書規格'
        else:
            spec = dict(match)

    quantity = raw.get('quantity', 1)
    if not isinstance(quantity, int) or isinstance(quantity, bool) or not 1 <= quantity <= MAX_QUANTITY:
        errors['quantity'] = f'數量請填 1 到 {MAX_QUANTITY} 本'
        quantity = 1

    custom_raw = raw.get('custom') or []
    custom = []
    if not isinstance(custom_raw, list):
        errors['custom'] = '特殊客製選項不正確'
    else:
        for k in custom_raw:
            opt = cfg['custom_options'].get(k) if isinstance(k, str) else None
            if opt is None or not opt['enabled']:
                errors['custom'] = '有選項目前沒有開放'
            elif k not in custom:
                custom.append(k)

    spreads = raw.get('spreads', 0)
    sp = cfg['spreads']
    if not isinstance(spreads, int) or isinstance(spreads, bool) or spreads < 0:
        errors['spreads'] = '跨頁數量不正確'
        spreads = 0
    elif spreads and (not sp['enabled'] or spreads > sp['max']):
        errors['spreads'] = f'最多加入 {sp["max"]} 個跨頁' if sp['enabled'] else '目前不開放加入指定頁面'

    if errors:
        return None, errors

    first = cfg['first_copy_price'] + spec['price_delta']
    extra = (quantity - 1) * cfg['extra_copy_price']
    breakdown = [{'label': f'第一本・{spec["label"]}' if spec['label'] else '第一本', 'amount': first}]
    if quantity > 1:
        breakdown.append({'label': f'第二本起 × {quantity - 1}', 'amount': extra})
    custom_total = 0
    for k in custom:
        opt = cfg['custom_options'][k]
        breakdown.append({'label': opt['label'], 'amount': opt['price']})
        custom_total += opt['price']
    if spreads:
        breakdown.append({'label': f'{sp["label"]} × {spreads} 跨頁', 'amount': spreads * sp['price']})
        custom_total += spreads * sp['price']
    return {'spec': spec, 'quantity': quantity, 'custom': custom, 'spreads': spreads, 'first_copy': first,
            'extra_copies': extra, 'custom_total': custom_total, 'line_total': first + extra + custom_total,
            'breakdown': breakdown}, {}


def price_consult(cfg, sessions):
    """專人解讀次數與金額。sessions=0 表示不買。回傳 (selection 或 None, errors)。"""
    if sessions in (None, 0):
        return None, {}
    c = cfg['consult']
    if not cfg['consult_enabled']:
        return None, {'consult_sessions': '目前沒有開放專人解讀'}
    if not isinstance(sessions, int) or isinstance(sessions, bool) or not 1 <= sessions <= c['max_sessions']:
        return None, {'consult_sessions': f'專人解讀請選 1 到 {c["max_sessions"]} 次'}
    return {'sessions': sessions, 'minutes': c['minutes'], 'unit_price': c['price'], 'label': c['label'],
            'line_total': sessions * c['price']}, {}


def create_print_job(item, cfg, selection, call_name=''):
    """建立實體書紀錄（不 commit），回傳 job。"""
    job = ReportPrintJob(
        order_item_id=item.id, status='awaiting_payment', spec=selection['spec'],
        custom={'options': selection['custom'], 'spreads': selection['spreads'],
                'labels': [cfg['custom_options'][k]['label'] for k in selection['custom']]},
        pricing={'quantity': selection['quantity'], 'first_copy': selection['first_copy'],
                 'extra_copies': selection['extra_copies'], 'custom_total': selection['custom_total'],
                 'line_total': selection['line_total'], 'breakdown': selection['breakdown'],
                 'digital_price': cfg['digital_price']},
        options={'cover_name': call_name} if call_name else {}, pages=[])
    db.session.add(job)
    return job


def create_consult_item(order, report_item, consult):
    """在訂單裡加一個專人解讀項目（不 commit）。"""
    item = OrderItem(order_id=order.id, item_no=_new_item_no(), product_id=report_item.product_id,
                     product_code='report-consult', name=f'{consult["label"]}（{consult["minutes"]} 分鐘）',
                     variant='consult', kind='service', parent_item_id=report_item.id,
                     unit_price=consult['unit_price'], currency=CURRENCY, quantity=consult['sessions'],
                     customization={'parent_item_no': report_item.item_no})
    db.session.add(item)
    db.session.flush()
    db.session.add(ReportConsultation(order_item_id=item.id, report_item_id=report_item.id,
                                      sessions=consult['sessions'], minutes=consult['minutes']))
    return item


def item_snapshot(item):
    """orders.items JSONB 快照的一列。"""
    return {'product_id': item.product_code, 'name': item.name, 'price': item.unit_price, 'quantity': item.quantity,
            'currency': CURRENCY, 'variant': item.variant, 'kind': item.kind, 'item_no': item.item_no}


# ── 事後加購 ─────────────────────────────────────────────────────────────────
def report_item(order):
    """訂單裡的報告項目（kind=purchase）。"""
    return next((i for i in order.order_items if i.kind == 'purchase'), None)


def addon_offer(order, cfg=None):
    """這筆訂單現在能加購什麼（給訂單頁顯示用）。"""
    if order.payment_method == 'external_verified':
        return None  # External cross-sell policy has not been reviewed/implemented.
    item = report_item(order)
    if order.status != 'paid' or item is None:
        return None
    cfg = cfg or load_config()
    return {'physical': cfg['enabled'], 'consult': cfg['consult_enabled'], 'available': cfg['enabled']}


def create_addon_order(user, parent_order, data, shipping, submission_key, payment_mode, expires_at=None):
    """事後加購：實體書與／或專人解讀，建立一張新訂單。回傳 (order, created)。"""
    from . import commerce
    commerce.lock_order(parent_order)
    if parent_order.payment_method == 'external_verified':
        raise OrderError('此平台成交的訂單尚未開放官網加購', 409, 'external_addon_unavailable')
    existing = find_by_submission_key(submission_key)
    if existing is not None:
        if existing.user_id != user.id:
            raise OrderError('這筆送出編號已被使用', 409, 'submission_conflict')
        return existing, False

    if parent_order.user_id != user.id:
        raise OrderError('找不到這筆訂單', 404, 'not_found')
    parent = report_item(parent_order)
    if parent is None or parent_order.status != 'paid':
        raise OrderError('原訂單完成付款後才能加購', 409, 'parent_not_paid')

    cfg = load_config()
    want_physical = isinstance(data.get('physical'), dict)
    physical_sel = consult_sel = None
    errors = {}
    if want_physical:
        if not cfg['enabled']:
            raise OrderError('目前沒有開放加購實體書', 409, 'addon_unavailable')
        physical_sel, e = price_physical(cfg, data['physical'])
        errors.update(e)
        if shipping is None:
            errors['shipping'] = '請填寫收件資料'
    consult_sel, e = price_consult(cfg, data.get('consult_sessions'))
    errors.update(e)
    if errors:
        raise _err(errors)
    if not physical_sel and not consult_sel:
        raise _err({'physical': '請選擇要加購的項目'})

    c = parent.customization or {}
    audience = c.get('audience') or {}
    order = Order(order_no=_new_order_no(), user_id=user.id, amount=0, status='pending', items=[],
                  language=LANGUAGE, currency=CURRENCY, payment_method=payment_mode)
    db.session.add(order)
    db.session.flush()
    now = datetime.utcnow()
    db.session.add(OrderCheckout(order_id=order.id, submission_key=submission_key, policy_version=POLICY_VERSION,
                                 policy_consented_at=now, expires_at=expires_at))
    items, amount = [], 0
    if physical_sel:
        physical = _product('physical')
        name = f"{(physical.names or {}).get(LANGUAGE) or physical.product_id}（實體書加購）"
        item = OrderItem(order_id=order.id, item_no=_new_item_no(), product_id=physical.id,
                         product_code=physical.product_id, name=name, variant='physical', kind='addon',
                         parent_item_id=parent.id, unit_price=physical_sel['line_total'], currency=CURRENCY,
                         quantity=physical_sel['quantity'],
                         customization={'subject_name': c.get('subject_name'),
                                        'audience': {'call_name': audience.get('call_name'),
                                                     'dedication': audience.get('dedication', '')},
                                        'parent_item_no': parent.item_no, 'parent_order_no': parent_order.order_no})
        db.session.add(item)
        db.session.flush()
        job = create_print_job(item, cfg, physical_sel, audience.get('call_name') or '')
        db.session.flush()
        if data.get('design_id'):
            from . import design as design_mod

            design_mod.attach_draft(data.get('design_id'), user, parent, job)
        db.session.add(Shipment(order_item_id=item.id, recipient_name=shipping['recipient_name'],
                                recipient_phone=shipping['recipient_phone'],
                                postal_code=shipping['postal_code'] or None, address=shipping['address'],
                                status='pending'))
        items.append(item)
        amount += physical_sel['line_total']
    if consult_sel:
        ci = create_consult_item(order, parent, consult_sel)
        ci.customization = {**(ci.customization or {}), 'parent_order_no': parent_order.order_no,
                            'subject_name': c.get('subject_name'), 'audience': {'call_name': audience.get('call_name')}}
        items.append(ci)
        amount += consult_sel['line_total']
    order.amount = amount
    order.items = [item_snapshot(i) for i in items]
    db.session.add(OrderInvoice(order_id=order.id, status='not_applicable'))
    from . import commerce
    try:
        commerce.finalize_order(order)
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        existing = find_by_submission_key(submission_key)
        if existing is not None and existing.user_id == user.id:
            return existing, False
        raise
    return order, True


# ── 狀態轉換 ─────────────────────────────────────────────────────────────────
def print_job_for(item):
    return ReportPrintJob.query.filter_by(order_item_id=item.id).first() if item is not None else None


def consultation_for(item):
    return ReportConsultation.query.filter_by(order_item_id=item.id).first() if item is not None else None


def physical_item(order):
    return next((i for i in order.order_items if i.variant == 'physical'), None)


def consult_item(order):
    return next((i for i in order.order_items if i.variant == 'consult'), None)


def on_paid(order):
    """付款成功：實體書進入「待設計內容」、專人解讀進入「待安排」。由 payment.mark_paid 呼叫，不 commit。"""
    for item in order.order_items:
        job = print_job_for(item)
        if job is not None and job.status == 'awaiting_payment':
            job.status = 'awaiting_customization'
        consult = consultation_for(item)
        if consult is not None and consult.status == 'awaiting_payment':
            consult.status = 'to_schedule'


def on_order_cancelled(order, by='system', reason=None):
    """整張訂單取消（逾期、未付款加購單取消）：實體書、出貨、專人解讀一併取消。不 commit。"""
    now = datetime.utcnow()
    for item in order.order_items:
        from . import commerce
        commerce.revoke(item, None, reason or 'order_cancelled')
        job = print_job_for(item)
        if job is not None and job.status != 'cancelled':
            job.status, job.cancelled_at, job.cancelled_by, job.cancel_reason = 'cancelled', now, by, reason
        s = Shipment.query.filter_by(order_item_id=item.id).first()
        if s is not None and s.status in ('pending', 'printing'):
            s.status = 'cancelled'
        consult = consultation_for(item)
        if consult is not None and consult.status != 'cancelled':
            consult.status, consult.cancelled_at, consult.cancel_reason = 'cancelled', now, reason


def _active_items_left(order):
    """訂單裡還沒取消的實體書／解讀項目數（判斷加購訂單要不要整張改成已取消）。"""
    n = 0
    for item in order.order_items:
        job, consult = print_job_for(item), consultation_for(item)
        if (job is not None and job.status != 'cancelled') or (consult is not None and consult.status != 'cancelled'):
            n += 1
    return n


def cancel_physical(order, by, reason=None, actor_id=None):
    """送印前取消實體書。

    - 未付款的加購訂單：整張取消（含同一張的專人解讀）。
    - 已付款：只取消實體書，記應退金額（加購＝這筆實體書金額；下單選實體書版＝實體書部分）。
      加購訂單若已沒有其他有效項目，整張改為已取消。
    - 下單選實體書版但還沒付款：不在這裡處理（逾期會自動取消）。
    回傳 print job。
    """
    from . import commerce
    commerce.lock_order(order)
    item = physical_item(order)
    job = print_job_for(item)
    if job is not None:
        db.session.refresh(job)
    if job is None:
        raise OrderError('這筆訂單沒有實體書', 404, 'no_physical')
    if job.status not in PRINT_JOB_CANCELLABLE:
        raise OrderError('已確認送印的實體書無法取消', 409, 'not_cancellable')
    if item.kind != 'addon' and order.status != 'paid':
        raise OrderError('尚未付款的訂單不需要取消，超過匯款期限會自動取消', 409, 'not_paid')

    reason = (reason or '').strip()[:500] or None
    from . import audit
    if order.status != 'paid':
        on_order_cancelled(order, by, reason)
        order.status = 'cancelled'
        audit.log(order, 'physical_cancelled', actor_id, ref=job.id, by=by, reason=reason)
        db.session.commit()
        return job

    pricing = job.pricing or {}
    commerce.revoke(item, 'book', reason or 'physical_cancelled')
    job.refund_due = item.unit_price if item.kind == 'addon' else pricing.get('line_total')
    job.status, job.cancelled_at, job.cancelled_by, job.cancel_reason = 'cancelled', datetime.utcnow(), by, reason
    s = Shipment.query.filter_by(order_item_id=item.id).first()
    if s is not None and s.status in ('pending', 'printing'):
        s.status = 'cancelled'
    if item.kind == 'addon' and _active_items_left(order) == 0:
        order.status = 'cancelled'
    audit.log(order, 'physical_cancelled', actor_id, ref=job.id, by=by, reason=reason, refund_due=job.refund_due)
    db.session.commit()
    return job


def mark_printing(job, admin_id):
    from . import commerce
    item = db.session.get(OrderItem, job.order_item_id)
    commerce.require(item, 'book')
    db.session.refresh(job)
    allowed = ('approved',) if PROOF_APPROVAL_REQUIRED else _PRE_PRINT
    if job.status not in allowed:
        raise OrderError('這本實體書目前不能送印' + ('（會員尚未確認打樣）' if PROOF_APPROVAL_REQUIRED else ''),
                         409, 'invalid_status')
    job.status = 'printing'
    commerce.start(item, 'book', 'print_job', job.id)
    s = Shipment.query.filter_by(order_item_id=job.order_item_id).first()
    if s is not None:
        s.status, s.print_sent_at, s.updated_by = 'printing', datetime.utcnow(), admin_id
    from . import audit
    audit.log(item.order, 'print_started', admin_id, ref=job.id)
    db.session.commit()


def mark_shipped(job, admin_id, carrier, tracking_no, note=None):
    from . import commerce
    item = db.session.get(OrderItem, job.order_item_id)
    commerce.require(item, 'book')
    db.session.refresh(job)
    if job.status != 'printing':
        raise OrderError('送印後才能登錄出貨', 409, 'invalid_status')
    carrier, tracking_no = (carrier or '').strip(), (tracking_no or '').strip()
    if not carrier or not tracking_no:
        raise OrderError('請填寫物流業者與單號', 400, 'invalid')
    job.status = 'shipped'
    s = Shipment.query.filter_by(order_item_id=job.order_item_id).first()
    if s is not None:
        s.status, s.shipped_at, s.updated_by = 'shipped', datetime.utcnow(), admin_id
        s.carrier, s.tracking_no = carrier[:100], tracking_no[:100]
        if note:
            s.note = note.strip()[:500]
    from . import audit
    audit.log(item.order, 'print_shipped', admin_id, ref=job.id, carrier=carrier[:100], tracking_no=tracking_no[:100])
    db.session.commit()


def mark_delivered(job, admin_id):
    from . import commerce
    item = db.session.get(OrderItem, job.order_item_id)
    commerce.require(item, 'book')
    db.session.refresh(job)
    if job.status != 'shipped':
        raise OrderError('出貨後才能標記送達', 409, 'invalid_status')
    job.status = 'delivered'
    commerce.complete(item, 'book', 'print_job', job.id, admin_id)
    s = Shipment.query.filter_by(order_item_id=job.order_item_id).first()
    if s is not None:
        s.status, s.delivered_at, s.updated_by = 'delivered', datetime.utcnow(), admin_id
    from . import audit
    audit.log(item.order, 'print_delivered', admin_id, ref=job.id)
    db.session.commit()


def _record_refund(row, amount, note):
    from . import commerce
    item = db.session.get(OrderItem, row.order_item_id)
    commerce.lock_order(item.order)
    db.session.refresh(row)
    if row.status != 'cancelled':
        raise OrderError('取消後才能登錄退款', 409, 'invalid_status')
    if row.refunded_at is not None:
        raise OrderError('這筆已登錄過退款', 409, 'already_refunded')
    if not isinstance(amount, int) or isinstance(amount, bool) or amount <= 0:
        raise OrderError('請填寫退款金額', 400, 'invalid')
    if row.refund_due is None or amount > row.refund_due:
        raise OrderError('退款金額不可超過應退金額', 400, 'refund_exceeds_due')
    row.refund_amount, row.refunded_at = amount, datetime.utcnow()
    row.refund_note = (note or '').strip()[:500] or None


def record_refund(job, admin_id, amount, note=None):
    _record_refund(job, amount, note)
    job.refunded_by = admin_id
    from . import audit
    audit.log(db.session.get(OrderItem, job.order_item_id).order, 'refund_recorded', admin_id, ref=f'book:{job.id}',
              amount=amount, note=job.refund_note, item='book')
    db.session.commit()


# ── 專人解讀（後台） ─────────────────────────────────────────────────────────
def _parse_dt(value):
    """解析後台送來的時間，一律回傳 UTC。沒帶時區的視為台灣時間——不能依伺服器時區解讀（Railway 是 UTC）。"""
    from datetime import timedelta, timezone
    try:
        dt = datetime.fromisoformat(str(value).replace('Z', '+00:00'))
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone(timedelta(hours=8)))
    return dt.astimezone(timezone.utc)


def schedule_consult(consult, admin_id, scheduled_at, note=None):
    from . import commerce
    item = db.session.get(OrderItem, consult.order_item_id)
    commerce.require(item, 'consult')
    db.session.refresh(consult)
    if consult.status not in ('to_schedule', 'scheduled'):
        raise OrderError('付款後才能安排時間', 409, 'invalid_status')
    when = _parse_dt(scheduled_at) if scheduled_at else None
    if when is None:
        raise OrderError('請填寫約定的日期與時間', 400, 'invalid')
    consult.status, consult.scheduled_at, consult.updated_by = 'scheduled', when, admin_id
    commerce.start(item, 'consult', 'consultation', consult.id)
    if note is not None:
        consult.admin_note = note.strip()[:1000] or None
    from . import audit
    from .notify import _fmt_time
    audit.log(item.order, 'consult_scheduled', admin_id, scheduled_at=f'{_fmt_time(when)}（台灣時間）')
    db.session.commit()


CONSULT_PERIODS = {'morning': '上午', 'afternoon': '下午', 'evening': '晚上'}
CONSULT_MAX_SLOTS = 3
CONSULT_PREF_DAYS = 60


def set_consult_preferences(consult, raw, today=None):
    """會員填方便的時段（1–3 個，明天起 60 天內）與備註；待安排時間時才能填、可重填。"""
    from datetime import date, timedelta
    from . import commerce

    item = db.session.get(OrderItem, consult.order_item_id)
    commerce.lock_order(item.order)
    db.session.refresh(consult)

    if consult.status != 'to_schedule':
        raise OrderError('目前無法更改時段；已約好時間的話，請直接回覆確認信', 409, 'invalid_status')
    raw = raw if isinstance(raw, dict) else {}
    today = today or date.today()
    first, last = today + timedelta(days=1), today + timedelta(days=CONSULT_PREF_DAYS)
    slots, seen = [], set()
    for s in raw.get('slots') or []:
        if not isinstance(s, dict) or s.get('period') not in CONSULT_PERIODS:
            continue
        try:
            d = date.fromisoformat(str(s.get('date') or ''))
        except ValueError:
            continue
        if not (first <= d <= last) or (d, s['period']) in seen:
            continue
        seen.add((d, s['period']))
        slots.append({'date': d.isoformat(), 'period': s['period']})
    if not slots:
        raise OrderError(f'請至少選一個時段（明天起 {CONSULT_PREF_DAYS} 天內）', 400, 'invalid')
    consult.preferences = {'slots': slots[:CONSULT_MAX_SLOTS], 'note': str(raw.get('note') or '').strip()[:500]}
    consult.preferences_at = datetime.utcnow()
    from . import audit
    audit.log(item.order, 'consult_preferences', item.order.user_id)
    db.session.commit()


def complete_consult(consult, admin_id):
    from . import commerce
    item = db.session.get(OrderItem, consult.order_item_id)
    commerce.require(item, 'consult')
    db.session.refresh(consult)
    if consult.status != 'scheduled':
        raise OrderError('安排時間後才能標記完成', 409, 'invalid_status')
    consult.status, consult.completed_at, consult.updated_by = 'completed', datetime.utcnow(), admin_id
    commerce.complete(item, 'consult', 'consultation', consult.id, admin_id)
    from . import audit
    audit.log(item.order, 'consult_completed', admin_id, ref=consult.id)
    db.session.commit()


def cancel_consult(consult, admin_id, reason):
    """由管理者代為取消（取消規則不對外公開）。已付款的記應退金額。"""
    from . import commerce
    item = db.session.get(OrderItem, consult.order_item_id)
    commerce.lock_order(item.order)
    db.session.refresh(consult)
    if consult.status in ('completed', 'cancelled'):
        raise OrderError('這筆專人解讀已完成或已取消', 409, 'invalid_status')
    reason = (reason or '').strip()
    if not reason:
        raise OrderError('請填寫取消原因', 400, 'invalid')
    item = db.session.get(OrderItem, consult.order_item_id)
    order = item.order
    commerce.revoke(item, 'consult', reason[:500], admin_id)
    if order.status == 'paid':
        consult.refund_due = item.unit_price * item.quantity
    consult.status, consult.cancelled_at, consult.cancel_reason = 'cancelled', datetime.utcnow(), reason[:500]
    consult.updated_by = admin_id
    if order.status == 'pending':
        # 還沒付款：整張訂單一起取消
        on_order_cancelled(order, 'admin', reason[:500])
        order.status = 'cancelled'
    elif item.kind == 'service' and report_item(order) is None and _active_items_left(order) == 0:
        order.status = 'cancelled'
    from . import audit
    audit.log(order, 'consult_cancelled', admin_id, ref=consult.id, reason=reason[:500])
    db.session.commit()


def record_consult_refund(consult, admin_id, amount, note=None):
    _record_refund(consult, amount, note)
    consult.updated_by = admin_id
    from . import audit
    audit.log(db.session.get(OrderItem, consult.order_item_id).order, 'refund_recorded', admin_id,
              ref=f'consult:{consult.id}', amount=amount, note=consult.refund_note, item='consult')
    db.session.commit()


# ── 顯示 ─────────────────────────────────────────────────────────────────────
STATUS_LABELS = {
    'awaiting_payment': '待付款',
    'awaiting_customization': '待設計內容',
    'awaiting_proof': '打樣製作中',
    'proof_ready': '待確認打樣',
    'changes_requested': '打樣修改中',
    'approved': '已確認，待送印',
    'printing': '印製中',
    'shipped': '已出貨',
    'delivered': '已送達',
    'cancelled': '已取消',
}
CONSULT_LABELS = {
    'awaiting_payment': '待付款',
    'to_schedule': '待安排時間',
    'scheduled': '已約時間',
    'completed': '已完成',
    'cancelled': '已取消',
}


def _custom_labels(job):
    """特殊客製的名稱：用下單當下的快照（後台改名不影響舊訂單）。"""
    custom = job.custom or {}
    names = list(custom.get('labels') or [DEFAULT_CUSTOM.get(k, {}).get('label', k) for k in custom.get('options') or []])
    if custom.get('spreads'):
        names.append(f'指定跨頁 {custom["spreads"]} 個')
    return names


def _design_state(job):
    """設計狀態：報告 PDF 好了沒、設計做到哪（給訂單頁決定要不要顯示「設計你的書」）。"""
    from sites.Polaris_Parent.backend.models import ReportBookDesign

    from . import delivery

    item = db.session.get(OrderItem, job.order_item_id)
    report_item = db.session.get(OrderItem, item.parent_item_id) if item.kind == 'addon' else item
    d = ReportBookDesign.query.filter_by(print_job_id=job.id).first()
    return {'report_ready': delivery.current_document(report_item) is not None,
            'design_status': d.status if d is not None else None}


def job_view(job, item):
    pricing = job.pricing or {}
    return {
        **_design_state(job),
        'id': job.id,
        'status': job.status,
        'status_label': STATUS_LABELS.get(job.status, job.status),
        'spec_label': (job.spec or {}).get('label') or '',
        'quantity': pricing.get('quantity') or item.quantity,
        'custom': (job.custom or {}).get('options') or [],
        'spreads': (job.custom or {}).get('spreads') or 0,
        'custom_labels': _custom_labels(job),
        'line_total': pricing.get('line_total'),
        'breakdown': pricing.get('breakdown') or [],
        'cancellable': job.status in PRINT_JOB_CANCELLABLE,
        'cancelled_at': job.cancelled_at.isoformat() if job.cancelled_at else None,
        'refund_due': job.refund_due,
        'refund_amount': job.refund_amount,
        'refunded_at': job.refunded_at.isoformat() if job.refunded_at else None,
        'proofs': _proofs_view(job),
    }


def _proofs_view(job):
    from . import proofs
    return proofs.job_proofs_view(job)


def consult_view(consult, item):
    return {
        'id': consult.id,
        'status': consult.status,
        'status_label': CONSULT_LABELS.get(consult.status, consult.status),
        'sessions': consult.sessions,
        'minutes': consult.minutes,
        'amount': item.unit_price * item.quantity,
        'scheduled_at': consult.scheduled_at.isoformat() if consult.scheduled_at else None,
        'preferences': consult.preferences or None,
        'preferences_at': consult.preferences_at.isoformat() if consult.preferences_at else None,
        'cancelled_at': consult.cancelled_at.isoformat() if consult.cancelled_at else None,
        'refund_due': consult.refund_due,
        'refunded_at': consult.refunded_at.isoformat() if consult.refunded_at else None,
    }


def pending_design_jobs(report_item):
    """這份報告底下已付款、還在等客人設計內容的實體書（報告完成時通知客人來設計）。"""
    if report_item is None:
        return []
    ids = [report_item.id] + [i.id for i in OrderItem.query.filter_by(parent_item_id=report_item.id, variant='physical').all()]
    return ReportPrintJob.query.filter(ReportPrintJob.order_item_id.in_(ids),
                                       ReportPrintJob.status == 'awaiting_customization').all()


def addon_children(item):
    """原報告項目底下的所有加購訂單（實體書與專人解讀），給原訂單頁顯示。"""
    if item is None:
        return []
    rows = (OrderItem.query.filter(OrderItem.parent_item_id == item.id, OrderItem.order_id != item.order_id)
            .order_by(OrderItem.id).all())
    by_order = {}
    for child in rows:
        o = child.order
        entry = by_order.setdefault(o.order_no, {
            'order_no': o.order_no, 'order_status': o.status, 'amount': o.amount,
            'created_at': o.created_at.isoformat() if o.created_at else None,
            'physical': None, 'consult': None,
        })
        job, consult = print_job_for(child), consultation_for(child)
        if job is not None:
            entry['physical'] = {'quantity': (job.pricing or {}).get('quantity') or child.quantity, 'status': job.status,
                                 'status_label': STATUS_LABELS.get(job.status, '')}
        if consult is not None:
            entry['consult'] = {'sessions': consult.sessions, 'status': consult.status,
                                'status_label': CONSULT_LABELS.get(consult.status, '')}
    return list(by_order.values())
