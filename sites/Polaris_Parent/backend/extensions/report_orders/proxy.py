"""
外部平台代客建單（2026-10-21；docs/external-proxy-orders-plan.md 第 1–4 節）。

客人在小紅書／Etsy／Pinkoi 等平台成交、私訊提供資料；管理者在後台一頁建單，之後完全走官網的標準流程
（PolarisUI 工作單 → 製作 → 打樣 → 送印出貨）。

* 客人檔案（ExternalCustomer）：底層是不能登入的會員帳號（*@customers.polaris-parent.invalid），
  命盤與訂單依客人歸檔，之後可認領（第五項）。給這個信箱的通知信一律略過（notify._deliver）。
* 平台成交：沿用外部訂單帳本——同一個平台訂單號只能建一次單（uq_commerce_external_receipt），
  建立已查證的外部收據＋成交綁定，訂單直接標成 external_verified／已付款，不建官網付款紀錄。
  binding.require_evidence 的既有檢查照常生效：收據被作廢，後續履約會暫停。
* 金額與幣別以平台成交為準（money.py 最小單位），不套官網價格；不含專人解讀。
* 外部實體書（預設精裝）：封面名字與題字建單時直接填，跳過會員的「設計你的書」，建單後直接「待出打樣」。
* 資料來源（OrderSourceRecord）：建單時至少一筆對話摘錄或連結，之後可隨時追加（含截圖）。
"""

import hashlib
import json
import re
import secrets
import uuid
from datetime import date, datetime, timezone

from core.backend_engine.factory import db
from core.backend_engine.models import User
from packages.commerce.models import Order, OrderItem
from sites.Polaris_Parent.backend.commerce_models import (CommerceChannel, CommerceExternalReceipt,
                                                         CommerceReceiptBinding, CommerceSource)
from sites.Polaris_Parent.backend.models import ExternalCustomer, OrderSourceRecord

from . import audit, commerce, intake, money, physical, private_storage
from .service import OrderError

CUSTOMER_DOMAIN = 'customers.polaris-parent.invalid'
METHOD = 'external_verified'
# 直接接單（非平台，2026-10-23）：親友、線下或私訊委託，不經外部平台、不必先建渠道。
# 沿用代客建單的成交紀錄，掛在系統內建渠道 direct 底下（第一次用時自動建立；不受渠道審查期限影響）。
# 金額可以是 0（贈送或內部製作；成交紀錄允許 0 元見 migration 0018），資料來源選填，內部編號可留空自動產生。
DIRECT_CHANNEL = 'direct'
DIRECT_STORE = 'polaris-direct'
DIRECT_VALID_UNTIL = datetime(2099, 12, 31, tzinfo=timezone.utc)
TEXT_SOURCE_KINDS = ('conversation', 'link', 'note')
SOURCE_LABELS = {'conversation': '對話摘錄', 'link': '對話連結', 'screenshot': '對話截圖', 'note': '說明'}
MAX_SCREENSHOT_BYTES = 15 * 1024 * 1024
SCREENSHOT_TYPES = {'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'application/pdf': '.pdf'}


def _fail(message, code='invalid', status=400, errors=None):
    err = OrderError(message, status, code)
    if errors:
        err.errors = errors
    raise err


def _text(value, limit):
    return str(value or '').strip()[:limit]


def is_external_email(email):
    return bool(email) and str(email).lower().endswith('@' + CUSTOMER_DOMAIN)


# ── 客人檔案 ─────────────────────────────────────────────────────────────────
def customer_view(c, with_orders=False):
    view = {'id': c.id, 'display_name': c.display_name, 'platform_handle': c.platform_handle,
            'contact_note': c.contact_note, 'channel_id': c.channel_id, 'app_user_id': c.app_user_id,
            'claimed': c.claimed_at is not None,
            'created_at': c.created_at.isoformat() if c.created_at else None}
    if with_orders:
        from . import claims
        from .overview import row
        view['orders'] = [row(o) for o in orders_of_customer(c) if o.order_items]
        view['claim'] = claims.status_view(c)
    return view


def orders_of_customer(c, limit=100):
    """客人檔案的訂單：認領前＝掛在檔案帳號下的全部訂單；認領後訂單已轉到會員帳號，改依代客建單的綁定紀錄找。"""
    if c.claimed_at is None:
        return Order.query.filter_by(user_id=c.app_user_id).order_by(Order.id.desc()).limit(limit).all()
    ids = [b.order_id for b in CommerceReceiptBinding.query.all() if (b.snapshot or {}).get('customer_id') == c.id]
    return Order.query.filter(Order.id.in_(ids)).order_by(Order.id.desc()).limit(limit).all() if ids else []


def search_customers(q=None, limit=50):
    query = ExternalCustomer.query
    q = (q or '').strip()
    if q:
        like = f'%{q}%'
        query = query.filter(db.or_(ExternalCustomer.display_name.ilike(like),
                                    ExternalCustomer.platform_handle.ilike(like)))
    return query.order_by(ExternalCustomer.id.desc()).limit(limit).all()


def _customer_fields(data, errors):
    name = _text(data.get('display_name'), 100)
    if not name:
        errors['customer.display_name'] = '請填寫客人在平台上的名稱'
    return name, _text(data.get('platform_handle'), 100) or None, _text(data.get('contact_note'), 1000) or None


def create_customer(data, actor, channel_id=None):
    """建客人檔案（不 commit）：一個不能登入的會員帳號＋檔案。"""
    errors = {}
    name, handle, note = _customer_fields(data, errors)
    if errors:
        _fail('客人資料有誤', errors=errors)
    email = f'c-{uuid.uuid4().hex[:16]}@{CUSTOMER_DOMAIN}'
    user = User(username=email, email=email, role='member', is_active=True)
    # Preserve random entropy while guaranteeing the shared complexity rules.
    user.set_password(secrets.token_urlsafe(32) + 'Aa1')
    db.session.add(user)
    db.session.flush()
    c = ExternalCustomer(app_user_id=user.id, channel_id=channel_id, display_name=name, platform_handle=handle,
                         contact_note=note, created_by=actor)
    db.session.add(c)
    db.session.flush()
    return c


def update_customer(customer, data):
    errors = {}
    name, handle, note = _customer_fields(data, errors)
    if errors:
        _fail('客人資料有誤', errors=errors)
    customer.display_name, customer.platform_handle, customer.contact_note = name, handle, note
    db.session.commit()
    return customer


def customer_of_order(order):
    """代客建單的綁定紀錄記著客人檔案（認領後訂單換了會員也找得到）；沒有就看訂單會員是不是檔案帳號。"""
    b = CommerceReceiptBinding.query.filter_by(order_id=order.id).first()
    cid = (b.snapshot or {}).get('customer_id') if b else None
    c = db.session.get(ExternalCustomer, cid) if cid else None
    return c or ExternalCustomer.query.filter_by(app_user_id=order.user_id).first()


# ── 資料來源 ─────────────────────────────────────────────────────────────────
def _clean_sources(raw, errors):
    out = []
    for i, s in enumerate(raw if isinstance(raw, list) else []):
        if not isinstance(s, dict):
            continue
        kind = s.get('kind') or 'conversation'
        summary, url = _text(s.get('summary'), 4000), _text(s.get('url'), 1000)
        if kind not in TEXT_SOURCE_KINDS:
            errors[f'sources.{i}'] = '資料來源類型不正確'
            continue
        if not summary and not url:
            continue
        if url and not url.lower().startswith(('http://', 'https://')):
            errors[f'sources.{i}'] = '連結要以 http:// 或 https:// 開頭'
            continue
        occurred = None
        if s.get('occurred_on'):
            try:
                occurred = date.fromisoformat(str(s['occurred_on']))
            except ValueError:
                errors[f'sources.{i}'] = '對話日期格式不正確'
                continue
        out.append({'kind': 'link' if (url and not summary and kind == 'conversation') else kind,
                    'summary': summary or None, 'url': url or None, 'occurred_on': occurred})
    return out


def add_source(order, actor, data):
    """追加一筆文字或連結來源。"""
    errors = {}
    rows = _clean_sources([data], errors)
    if errors or not rows:
        _fail(next(iter(errors.values()), '請填寫對話摘錄或連結'), errors=errors)
    rec = OrderSourceRecord(order_id=order.id, channel_id=_order_channel_id(order), created_by=actor, **rows[0])
    db.session.add(rec)
    db.session.flush()
    audit.log(order, 'source_added', actor, ref=rec.id, kind=rec.kind)
    db.session.commit()
    return rec


def add_screenshot(order, actor, filename, content_type, data, summary=None, occurred_on=None):
    content_type = (content_type or '').split(';')[0].strip().lower()
    if content_type not in SCREENSHOT_TYPES:
        _fail('截圖請上傳 PNG、JPG、WebP 或 PDF')
    if not data or len(data) > MAX_SCREENSHOT_BYTES:
        _fail('檔案不能超過 15 MB')
    occurred = None
    if occurred_on:
        try:
            occurred = date.fromisoformat(str(occurred_on))
        except ValueError:
            _fail('對話日期格式不正確')
    key = f'sources/{order.order_no}/{uuid.uuid4().hex}{SCREENSHOT_TYPES[content_type]}'
    size, _digest = private_storage.save(key, data, content_type)
    rec = OrderSourceRecord(order_id=order.id, kind='screenshot', channel_id=_order_channel_id(order),
                            summary=_text(summary, 4000) or None, occurred_on=occurred, file_key=key,
                            filename=_text(filename, 200) or 'screenshot', content_type=content_type, bytes=size,
                            created_by=actor)
    db.session.add(rec)
    db.session.flush()
    audit.log(order, 'source_added', actor, ref=rec.id, kind='screenshot')
    db.session.commit()
    return rec


def source_view(rec):
    return {'id': rec.id, 'kind': rec.kind, 'kind_label': SOURCE_LABELS.get(rec.kind, rec.kind),
            'occurred_on': rec.occurred_on.isoformat() if rec.occurred_on else None, 'summary': rec.summary,
            'url': rec.url, 'filename': rec.filename, 'content_type': rec.content_type, 'bytes': rec.bytes,
            'has_file': bool(rec.file_key), 'created_at': rec.created_at.isoformat() if rec.created_at else None}


def sources_of(order):
    return OrderSourceRecord.query.filter_by(order_id=order.id).order_by(OrderSourceRecord.id).all()


def source_for_download(record_id):
    rec = db.session.get(OrderSourceRecord, record_id)
    if rec is None or not rec.file_key:
        _fail('找不到這個檔案', 'not_found', 404)
    return rec, private_storage.read(rec.file_key)


# ── 平台資訊 ─────────────────────────────────────────────────────────────────
def _binding(order):
    return CommerceReceiptBinding.query.filter_by(order_id=order.id).first()


def _order_channel_id(order):
    b = _binding(order)
    r = db.session.get(CommerceExternalReceipt, b.receipt_id) if b else None
    return r.channel_id if r else None


def external_view(order):
    """訂單的平台資訊（不是外部訂單時回 None）。"""
    b = _binding(order)
    if b is None:
        return None
    r = db.session.get(CommerceExternalReceipt, b.receipt_id)
    ch = db.session.get(CommerceChannel, r.channel_id) if r else None
    c = customer_of_order(order)
    return {'channel': ch.channel if ch else None, 'store_key': ch.store_key if ch else None,
            'external_order_id': r.external_order_id if r else None, 'receipt_status': r.status if r else None,
            'amount': r.amount if r else None, 'currency': r.currency if r else None,
            'proxy': bool((b.snapshot or {}).get('proxy')),
            'customer': customer_view(c) if c else None}


def is_proxy_order(order):
    b = _binding(order)
    return bool(b and (b.snapshot or {}).get('proxy'))


# ── 代客建單 ─────────────────────────────────────────────────────────────────
def _default_spec_key(cfg):
    """外部平台的實體書一律預設精裝（使用者 2026-10-20 決定）；規格清單裡第一個「精裝」。"""
    specs = cfg.get('specs') or []
    hard = next((s for s in specs if '精裝' in (s.get('label') or '')), None)
    return (hard or (specs[0] if specs else {})).get('key')


def _receipt_digest(snapshot):
    return hashlib.sha256(json.dumps(snapshot, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def direct_channel(actor):
    """系統內建的「直接接單」渠道（上鎖）；沒有就建一個。"""
    row = CommerceChannel.query.filter_by(channel=DIRECT_CHANNEL, store_key=DIRECT_STORE).first()
    if row is None:
        row = CommerceChannel(channel=DIRECT_CHANNEL, store_key=DIRECT_STORE, revision=1, manual_import=True,
                              policy_reference='官網自營直接接單（系統內建，非外部平台）',
                              review_note='親友、線下或私訊直接委託；不經外部平台', reviewed_by=actor,
                              valid_until=DIRECT_VALID_UNTIL)
        db.session.add(row)
        db.session.flush()
    return intake.locked_channel(row.id, require_active=False)


def is_direct_channel(channel):
    return channel is not None and channel.channel == DIRECT_CHANNEL and channel.store_key == DIRECT_STORE


def new_direct_id():
    return f"D-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{secrets.token_hex(3).upper()}"


def create_order(data, actor, eng, save_chart):
    """代客建單。回傳 (order, created)；同一平台訂單號重送回傳原訂單、created=False。

    data['source'] == 'direct'：直接接單（非平台）——不選平台、內部編號可留空、金額可為 0、資料來源選填。
    """
    from . import service
    from .validation import validate_order

    if not isinstance(data, dict):
        _fail('請提供 JSON 物件')
    direct = data.get('source') == 'direct'
    if direct:
        channel = direct_channel(actor)
    else:
        try:
            channel = intake.locked_channel(int(data.get('channel_id')))
        except (TypeError, ValueError):
            _fail('請選擇平台', errors={'channel_id': '請選擇平台'})
        if is_direct_channel(channel):
            _fail('直接接單請改用「直接接單（非平台）」', errors={'channel_id': '請選擇外部平台'})
    external_id = _text(data.get('external_order_id'), 200)
    if not external_id and direct:
        external_id = new_direct_id()
    if not external_id:
        _fail('請填寫平台訂單編號', errors={'external_order_id': '請填寫平台訂單編號'})
    existing = CommerceExternalReceipt.query.filter_by(channel_id=channel.id, external_order_id=external_id).first()
    if existing is not None:
        b = CommerceReceiptBinding.query.filter_by(receipt_id=existing.id).first()
        order = db.session.get(Order, b.order_id) if b else None
        if order is not None and (b.snapshot or {}).get('proxy'):
            return order, False
        _fail('這個平台訂單號已經在「外部訂單查證」登錄過，請到那裡處理', 'receipt_exists', 409)

    errors = {}
    currency = data.get('currency')
    amount = None
    if not money.supported(currency):
        errors['currency'] = '請選擇幣別'
    else:
        try:
            amount = money.to_minor(data.get('amount'), currency)
            if amount < 0 or (amount == 0 and not direct):
                errors['amount'] = '請填寫平台成交金額'
        except ValueError as exc:
            errors['amount'] = str(exc)
    language = _text(data.get('language'), 20) or 'zh-TW'
    if not re.match(r'^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$', language):
        errors['language'] = '語系代碼不正確（例：zh-TW、en、nb）'

    order_data = dict(data.get('order') or {})
    variant = order_data.get('variant') or 'physical'
    order_data['variant'] = variant
    if variant == 'physical':
        from .physical import load_config
        phys_sel = dict(order_data.get('physical') or {})
        phys_sel.setdefault('spec_key', _default_spec_key(load_config()))
        phys_sel.setdefault('quantity', 1)
        phys_sel.setdefault('custom', [])
        phys_sel.setdefault('spreads', 0)
        order_data['physical'] = phys_sel
    order_data['consult_sessions'] = 0
    clean, order_errors = validate_order(order_data, allow_manual_place=True, allow_international=True)
    errors.update(order_errors)
    sources = _clean_sources(data.get('sources'), errors)
    if not sources and not direct and not any(k.startswith('sources') for k in errors):
        errors['sources'] = '請至少附上一筆對話摘錄或連結，記錄這份資料是哪裡來的'

    customer = None
    if data.get('customer_id'):
        customer = db.session.get(ExternalCustomer, int(data['customer_id']))
        if customer is None:
            errors['customer_id'] = '找不到這位客人'
    elif not isinstance(data.get('customer'), dict):
        errors['customer'] = '請選擇或新增客人'
    if errors:
        _fail('資料有誤，請檢查後再送出', errors=errors)
    if customer is None:
        customer = create_customer(data['customer'], actor, channel.id)
        # The production service uses a different DB connection. It must see the
        # identity before save-and-register; otherwise its unique-key insert
        # waits for this transaction while we wait for its HTTP response.
        # A failed order may leave a reusable customer profile, but no paid order.
        db.session.commit()
    user = db.session.get(User, customer.app_user_id)
    email = user.email or user.username

    terms = {'amount': amount, 'currency': currency, 'language': language,
             'policy_version': f'external:{channel.channel}'}
    submission_key = f'proxy-{channel.id}-{hashlib.sha1(external_id.encode()).hexdigest()[:24]}'
    order, created = service.create_report_order(user, email, clean, submission_key, eng, save_chart,
                                                 payment_mode='manual', terms=terms)
    if not created:
        return order, False
    try:
        _settle(order, channel, external_id, customer, user, actor, data, sources)
    except Exception:
        db.session.rollback()
        # 建單後的認列失敗：把這張待付款訂單取消，不留沒有平台證據的訂單
        order = db.session.get(Order, order.id)
        order.status = 'cancelled'
        audit.log(order, 'proxy_order_failed', actor)
        db.session.commit()
        raise
    return order, True


def _settle(order, channel, external_id, customer, user, actor, data, sources):
    """把剛建好的待付款訂單認列為平台已成交（同一個交易）。"""
    channel = intake.locked_channel(channel.id, require_active=not is_direct_channel(channel))
    item = next(i for i in order.order_items if i.kind == 'purchase')
    snapshot = dict(channel_id=channel.id, external_order_id=external_id, member_id=user.id,
                    amount=order.amount, currency=order.currency,
                    lines=[dict(external_sku=_text(data.get('external_sku'), 200) or item.product_code,
                                quantity=1, unit_amount=order.amount)])
    receipt = CommerceExternalReceipt(**snapshot, fingerprint=_receipt_digest(snapshot), status='verified',
                                      channel_revision=channel.revision)
    db.session.add(receipt)
    db.session.flush()
    plan = dict(receipt_id=receipt.id, receipt_fingerprint=receipt.fingerprint, order_id=order.id,
                order_no=order.order_no, proxy=True, customer_id=customer.id, item_no=item.item_no)
    plan['fingerprint'] = _receipt_digest(plan)
    db.session.add(CommerceReceiptBinding(receipt_id=receipt.id, order_id=order.id, actor_id=actor,
                                          fingerprint=plan['fingerprint'], snapshot=plan))
    source = db.session.get(CommerceSource, order.id)
    if source is not None:
        source.channel, source.store_key, source.external_order_id = channel.channel, channel.store_key, external_id
    order.payment_method, order.status = METHOD, 'paid'
    order.paid_at = datetime.now(timezone.utc).replace(tzinfo=None)
    db.session.flush()
    from . import payment
    payment.prepare_fulfilment(order, actor, 'live', confirmation='external_sale_confirmed')

    job = physical.print_job_for(item)
    if job is not None:
        # 外部實體書：封面名字與題字建單時就填好，跳過會員的「設計你的書」，直接待出打樣
        book = data.get('book') or {}
        audience = (item.customization or {}).get('audience') or {}
        job.options = {'cover_name': _text(book.get('cover_name'), 50) or audience.get('call_name'),
                       'cover_style': _text(book.get('cover_style'), 50) or None,
                       'dedication': _text(book.get('dedication'), 500) or audience.get('dedication') or None}
        job.status, job.customized_at = 'awaiting_proof', datetime.now(timezone.utc)
        commerce.start(item, 'book', 'print_job', job.id)  # 與後台送印相同：不以管理者比對資格持有人

    for s in sources:
        db.session.add(OrderSourceRecord(order_id=order.id, channel_id=channel.id, created_by=actor, **s))
    intake.audit(channel, actor, 'receipt_proxy_order', dict(order_no=order.order_no, order_id=order.id,
                 fingerprint=plan['fingerprint'], channel_revision=channel.revision), receipt)
    audit.log(order, 'proxy_order_created', actor, ref='created', channel=channel.channel,
              external_order_id=external_id, customer=customer.display_name, gift=order.amount == 0)
    db.session.commit()


def mark_delivered_via_platform(order, actor, note=None):
    """數位版：管理者已透過平台把報告 PDF 交給客人。"""
    from . import delivery
    if not is_proxy_order(order):
        _fail('只有代客建單的訂單需要這個步驟', 'not_proxy', 409)
    item = next((i for i in order.order_items if i.kind == 'purchase'), None)
    if item is None or item.variant != 'digital':
        _fail('實體書訂單出貨後即完成，不需要這個步驟', 'not_digital', 409)
    commerce.require(item, 'report')
    if delivery.current_document(item) is None:
        _fail('請先在「報告交付」上傳報告 PDF', 'no_document', 409)
    audit.log(order, 'delivered_via_platform', actor, ref='delivered', note=_text(note, 500) or None)
    db.session.commit()


def delivered_via_platform(order):
    from sites.Polaris_Parent.backend.commerce_models import CommerceEvent
    return CommerceEvent.query.filter_by(order_id=order.id, event_type='delivered_via_platform').first() is not None
