"""Explicit external payment evidence -> one existing digital report contract.

Lock order: channel, receipt, internal order. Never create a PaymentAttempt or
infer birth/chart data. Callers own the transaction and no network is performed.
"""
from copy import deepcopy
from datetime import datetime, timezone
import hashlib
import json

from flask import current_app
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
from core.backend_engine.factory import db
from core.backend_engine.models import User
from packages.commerce.models import Order, OrderItem, PaymentAttempt
from sites.Polaris_Parent.backend.models import ReportFulfillment, ReportPrintJob, ReportConsultation, Shipment
from sites.Polaris_Parent.backend.commerce_models import (
    CommerceProductMapping, CommerceReceiptBinding, CommerceExternalReceipt, CommerceLine,
    CommerceSource, CommerceEntitlement,
)
from . import commerce, intake
from .service import OrderError

METHOD = 'external_verified'


def enabled():
    return current_app.config.get('COMMERCE_BINDING_ENABLED') is True


def check(condition, message, code='binding_blocked'):
    if not condition:
        raise OrderError(message, 409, code)


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False, default=str).encode()).hexdigest()


def profile(item):
    term = db.session.get(CommerceLine, item.id)
    check(commerce.tracked(item.order) and term is not None, '必須先建立官網成交契約')
    check(item.product_code == 'natal-report-digital' and item.variant == 'digital' and item.kind == 'purchase'
          and item.parent_item_id is None and item.quantity == 1, '本批只支援單份數位報告', 'unsupported_contract')
    from . import money
    check(term.currency == item.currency and money.supported(term.currency)
          and term.currency_exponent == money.exponent(term.currency) and term.quantity == 1
          and term.unit_amount == term.line_total == item.unit_price and item.unit_price > 0 and term.print_copies == 0,
          '成交金額或份數不一致')
    check(term.rights == [{'kind': 'report', 'units': 1, 'permissions': {'digital_delivery': True}}],
          '數位報告權利與預期不符', 'unsupported_contract')
    return dict(product_code=item.product_code, variant=item.variant, kind=item.kind,
                unit_amount=term.unit_amount, quantity=term.quantity, currency=term.currency,
                currency_exponent=term.currency_exponent, print_copies=term.print_copies, rights=deepcopy(term.rights))


def mapping_view(row):
    return dict(id=row.id, channel_id=row.channel_id, external_sku=row.external_sku, revision=row.revision,
                active=row.active, profile=row.profile, policy_reference=row.policy_reference,
                review_note=row.review_note, reviewed_by=row.reviewed_by,
                valid_until=intake.utc(row.valid_until).isoformat())


def save_mapping(data, actor):
    check(enabled(), '外部契約對應尚未啟用', 'binding_disabled')
    intake.enabled()
    channel = intake.locked_channel(intake.integer(data, 'channel_id'), require_active=False)
    check(data.get('channel_revision') == channel.revision, '渠道設定已更新，請重新載入', 'stale_revision')
    sku = intake.text(data, 'external_sku', 200)
    reference, note = intake.text(data, 'policy_reference', 1000), intake.text(data, 'review_note', 1000)
    check(type(data.get('active')) is bool, '請明確選擇是否允許此商品在官網履約')
    try:
        expiry = datetime.fromisoformat(intake.text(data, 'valid_until', 40).replace('Z', '+00:00'))
        check(expiry.tzinfo is not None and expiry > datetime.now(timezone.utc), '請填寫含時區的未來審查期限')
    except ValueError:
        raise OrderError('審查期限格式錯誤')
    item = OrderItem.query.filter_by(item_no=intake.text(data, 'template_item_no', 32)).first()
    check(item is not None, '找不到範本品項')
    commerce.lock_order(item.order)
    db.session.refresh(item)
    terms = profile(item)
    row = CommerceProductMapping.query.filter_by(channel_id=channel.id, external_sku=sku).populate_existing().first()
    if row:
        check(data.get('revision') == row.revision, '商品對應已更新，請重新載入', 'stale_revision')
        row.revision += 1
    else:
        check(data.get('revision') in (None, 0), '商品對應版本不符', 'stale_revision')
        row = CommerceProductMapping(channel_id=channel.id, external_sku=sku, revision=1)
        db.session.add(row)
    row.active, row.profile, row.policy_reference, row.review_note = data['active'], terms, reference, note
    row.reviewed_by, row.valid_until = actor, expiry
    db.session.flush()
    intake.audit(channel, actor, 'product_mapping_reviewed', mapping_view(row) | {'template_item_no': item.item_no})
    return row


def _locked(receipt_id, order_no):
    receipt = db.session.get(CommerceExternalReceipt, receipt_id)
    check(receipt is not None, '找不到外部訂單')
    channel = intake.locked_channel(receipt.channel_id)
    receipt = CommerceExternalReceipt.query.filter_by(id=receipt_id).populate_existing().with_for_update().one()
    order = Order.query.filter_by(order_no=order_no).first()
    check(order is not None, '找不到官網訂單')
    commerce.lock_order(order)
    return channel, receipt, order


def _plan(channel, receipt, order):
    check(receipt.status == 'verified', '外部成交證據尚未確認或已失效', 'receipt_unverified')
    check(receipt.member_id == order.user_id, '外部訂單與官網訂單的會員不一致', 'ownership_mismatch')
    user = db.session.get(User, order.user_id)
    check(user is not None and user.is_active, '會員不存在或已停用')
    check(order.status == 'pending' and order.payment_method in ('manual', 'placeholder'), '只可對應尚未付款的官網訂單')
    check(order.paid_at is None and PaymentAttempt.query.filter_by(order_id=order.id).first() is None,
          '此訂單已有付款或轉帳紀錄，請先人工釐清', 'payment_conflict')
    check(CommerceReceiptBinding.query.filter_by(order_id=order.id).first() is None and
          CommerceReceiptBinding.query.filter_by(receipt_id=receipt.id).first() is None, '訂單或證據已被使用', 'already_bound')
    checkout = order.checkout
    check(checkout is not None and checkout.policy_consented_at is not None and checkout.policy_version,
          '缺少會員交易政策同意紀錄')
    check(checkout.expires_at is None or intake.utc(checkout.expires_at) > datetime.now(timezone.utc), '官網訂單已逾期')
    items = OrderItem.query.filter_by(order_id=order.id).populate_existing().all()
    check(len(items) == 1 and len(receipt.lines) == 1, '本批只支援單品項、單份數位報告', 'unsupported_contract')
    item = items[0]
    terms = profile(item)
    check(order.amount == receipt.amount == terms['unit_amount'] and order.currency == receipt.currency == terms['currency'],
          '外部成交與官網契約金額不一致', 'amount_mismatch')
    external_line = receipt.lines[0]
    check(external_line['quantity'] == 1 and external_line['unit_amount'] == order.amount, '外部品項金額或份數不一致')
    mapping = CommerceProductMapping.query.filter_by(channel_id=channel.id, external_sku=external_line['external_sku']).populate_existing().first()
    check(mapping is not None and mapping.active and intake.utc(mapping.valid_until) > datetime.now(timezone.utc),
          '商品尚無有效的官網履約對應審查', 'mapping_required')
    check(mapping.profile == terms, '商品對應與官網成交權利不符', 'mapping_mismatch')
    check(CommerceEntitlement.query.filter_by(order_item_id=item.id).first() is None, '官網訂單已有資格，不能再次發放')
    source = db.session.get(CommerceSource, order.id)
    check(source is not None and source.channel == 'website' and source.external_order_id is None, '官網契約來源不符')
    f = ReportFulfillment.query.filter_by(order_item_id=item.id).populate_existing().first()
    check(f is not None and f.member_id == order.user_id and f.handoff_status == 'not_ready'
          and f.chart_id is not None and f.person_user_id is not None, '報告客製資料或交接狀態不完整')
    from . import delivery
    check(delivery.current_document(item) is None and ReportPrintJob.query.filter_by(order_item_id=item.id).first() is None
          and ReportConsultation.query.filter_by(order_item_id=item.id).first() is None
          and Shipment.query.filter_by(order_item_id=item.id).first() is None, '訂單已有其他履約資料', 'unsupported_contract')
    # Personal data participates only in a hash; never expose it in admin preview/audit tokens.
    identity = digest(dict(customization=item.customization, chart_id=f.chart_id, person_user_id=f.person_user_id,
                           member_id=f.member_id, fulfillment_id=f.id, request_no=f.request_no,
                           policy_version=checkout.policy_version, consented_at=checkout.policy_consented_at,
                           expires_at=checkout.expires_at))
    plan = dict(receipt_id=receipt.id, receipt_fingerprint=receipt.fingerprint, order_id=order.id, order_no=order.order_no,
                member_id=order.user_id, item_no=item.item_no, profile=terms, mapping=mapping_view(mapping),
                channel=intake.channel_view(channel), identity_fingerprint=identity,
                original_payment_method=order.payment_method)
    return plan | {'fingerprint': digest(plan)}


def signer():
    return URLSafeTimedSerializer(current_app.config['SECRET_KEY'], salt='commerce-binding-v1')


def preview(receipt_id, order_no, actor):
    channel, receipt, order = _locked(receipt_id, order_no)
    plan = _plan(channel, receipt, order)
    return plan | {'apply_enabled': enabled() and current_app.config.get('COMMERCE_INTAKE_ENABLED') is True,
                   'review_token': signer().dumps(dict(actor=actor, receipt_id=receipt.id, order_no=order.order_no,
                                                       fingerprint=plan['fingerprint'])), 'valid_for_seconds': 1800}


def apply(receipt_id, data, actor):
    check(enabled(), '外部契約發放尚未啟用', 'binding_disabled')
    intake.enabled()
    check(data.get('confirmed') is True, '請確認商品、會員、客製對象與履約政策一致')
    note = intake.text(data, 'note', 1000)
    token = intake.text(data, 'review_token', 4000)
    try:
        signed = signer().loads(token, max_age=1800)
    except (BadSignature, SignatureExpired):
        raise OrderError('審查憑證無效或已過期，請重新預覽', 409, 'invalid_review_token')
    check(signed.get('actor') == actor and signed.get('receipt_id') == receipt_id, '審查憑證不屬於此操作人或訂單', 'invalid_review_token')
    channel, receipt, order = _locked(receipt_id, signed['order_no'])
    existing = CommerceReceiptBinding.query.filter_by(receipt_id=receipt.id).first()
    if existing:
        check(existing.order_id == order.id and existing.fingerprint == signed['fingerprint'], '外部證據已被使用', 'already_bound')
        return order, False
    plan = _plan(channel, receipt, order)
    check(plan['fingerprint'] == signed['fingerprint'], '審查資料已變更，請重新預覽', 'stale_review')
    db.session.add(CommerceReceiptBinding(receipt_id=receipt.id, order_id=order.id, actor_id=actor,
                                         fingerprint=plan['fingerprint'], snapshot=deepcopy(plan)))
    source = db.session.get(CommerceSource, order.id)
    source.channel, source.store_key, source.external_order_id = channel.channel, channel.store_key, receipt.external_order_id
    order.payment_method, order.status = METHOD, 'paid'
    # Recognition time, not the unknown historical platform settlement timestamp.
    order.paid_at = datetime.now(timezone.utc).replace(tzinfo=None)
    db.session.flush()
    from . import payment
    payment.prepare_fulfilment(order, actor, 'live', confirmation='external_sale_confirmed')
    commerce.event(order, f'order:{order.id}:external-bound', 'external_contract_bound', actor,
                   receipt_id=receipt.id, fingerprint=plan['fingerprint'], note=note)
    intake.audit(channel, actor, 'receipt_contract_bound', dict(order_no=order.order_no, order_id=order.id,
                 fingerprint=plan['fingerprint'], channel_revision=channel.revision, mapping_revision=plan['mapping']['revision'], note=note), receipt)
    return order, True


def require_evidence(order):
    """Called with the internal order lock held; independent of feature flags."""
    if order.payment_method != METHOD:
        return
    bound = CommerceReceiptBinding.query.filter_by(order_id=order.id).first()
    check(bound is not None, '缺少外部成交關聯', 'external_evidence_unavailable')
    receipt = CommerceExternalReceipt.query.filter_by(id=bound.receipt_id).populate_existing().first()
    check(receipt is not None and receipt.status == 'verified' and receipt.member_id == order.user_id
          and receipt.amount == order.amount and receipt.currency == order.currency
          and receipt.fingerprint == bound.snapshot['receipt_fingerprint'],
          '外部成交證據已失效，履約暫停，請聯絡客服', 'external_evidence_unavailable')


def status_view(order):
    if order.payment_method != METHOD:
        return None
    bound = CommerceReceiptBinding.query.filter_by(order_id=order.id).first()
    receipt = db.session.get(CommerceExternalReceipt, bound.receipt_id) if bound else None
    return dict(receipt_id=receipt.id if receipt else None, evidence_status=receipt.status if receipt else 'missing',
                fulfilment_blocked=receipt is None or receipt.status != 'verified')


def lock_bound_order(receipt):
    """Void shares the order lock with fulfilment so neither can pass stale evidence."""
    bound = CommerceReceiptBinding.query.filter_by(receipt_id=receipt.id).first()
    if bound:
        order = commerce.lock_order(db.session.get(Order, bound.order_id))
        return order
