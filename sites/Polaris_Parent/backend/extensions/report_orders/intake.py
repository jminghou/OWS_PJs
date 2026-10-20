"""External evidence staging. No payments, entitlements, network calls or commits."""
import hashlib
import json
import re
from datetime import datetime, timezone

from flask import current_app
from core.backend_engine.factory import db
from core.backend_engine.models import User
from sites.Polaris_Parent.backend.commerce_models import CommerceChannel, CommerceExternalReceipt, CommerceIntakeEvent
from .service import OrderError


def fail(message, code='invalid', status=400):
    raise OrderError(message, status, code)


def enabled():
    if not current_app.config.get('COMMERCE_INTAKE_ENABLED', False):
        fail('外部訂單審查尚未啟用', 'intake_disabled', 409)


def text(data, key, limit):
    value = data.get(key)
    if not isinstance(value, str) or not value.strip() or len(value) > limit:
        fail(f'{key} 必須填寫，且不可超過 {limit} 字元')
    return value.strip()


def integer(data, key, maximum=2147483647):
    value = data.get(key)
    if type(value) is not int or not 1 <= value <= maximum:
        fail(f'{key} 必須是有效正整數')
    return value


def utc(value):
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


def audit(channel, actor, kind, detail, receipt=None):
    db.session.add(CommerceIntakeEvent(channel_id=channel.id, receipt_id=receipt.id if receipt else None,
                                      actor_id=actor, event_type=kind, detail=detail))


def channel_view(row):
    return dict(id=row.id, channel=row.channel, store_key=row.store_key, revision=row.revision,
                manual_import=row.manual_import, policy_reference=row.policy_reference,
                review_note=row.review_note, reviewed_by=row.reviewed_by,
                valid_until=utc(row.valid_until).isoformat(),
                effective=row.manual_import and utc(row.valid_until) > datetime.now(timezone.utc),
                external_activation=False, external_customization=False, webhook=False)


def save_channel(data, actor, channel_id=None):
    enabled()
    permission = data.get('manual_import')
    if type(permission) is not bool:
        fail('manual_import 必須明確填寫 true 或 false')
    reference, note = text(data, 'policy_reference', 1000), text(data, 'review_note', 1000)
    try:
        expiry = datetime.fromisoformat(text(data, 'valid_until', 40).replace('Z', '+00:00'))
        if expiry.tzinfo is None or expiry <= datetime.now(timezone.utc):
            raise ValueError()
    except ValueError:
        fail('valid_until 必須是含時區的未來時間')
    if channel_id is None:
        name, store = text(data, 'channel', 40), text(data, 'store_key', 100)
        if not re.fullmatch('[a-z][a-z0-9_-]{0,39}', name) or name == 'website':
            fail('渠道識別須為小寫英文、數字、底線或連字號，且不得使用 website')
        row = CommerceChannel(channel=name, store_key=store, revision=1)
        db.session.add(row)
    else:
        row = CommerceChannel.query.filter_by(id=channel_id).populate_existing().with_for_update().first()
        if row is None:
            fail('找不到渠道', 'not_found', 404)
        if data.get('revision') != row.revision:
            fail('渠道設定已變更，請重新載入', 'stale_revision', 409)
        row.revision += 1
    row.manual_import, row.policy_reference, row.review_note = permission, reference, note
    row.reviewed_by, row.valid_until = actor, expiry
    db.session.flush()
    audit(row, actor, 'channel_reviewed', channel_view(row))
    return row


def locked_channel(channel_id, require_active=True):
    row = CommerceChannel.query.filter_by(id=channel_id).populate_existing().with_for_update().first()
    if row is None:
        fail('找不到渠道', 'not_found', 404)
    if require_active and (not row.manual_import or utc(row.valid_until) <= datetime.now(timezone.utc)):
        fail('渠道未開放匯入或政策審查已到期', 'channel_blocked', 409)
    return row


def receipt_view(row):
    from sites.Polaris_Parent.backend.commerce_models import CommerceReceiptBinding
    from packages.commerce.models import Order
    bound = CommerceReceiptBinding.query.filter_by(receipt_id=row.id).first()
    order = db.session.get(Order, bound.order_id) if bound else None
    return {**{key: getattr(row, key) for key in ('id', 'channel_id', 'external_order_id', 'member_id',
            'amount', 'currency', 'lines', 'fingerprint', 'status', 'channel_revision')},
            'contract_order_no': order.order_no if order else None}


def import_receipt(data, actor):
    enabled()
    channel = locked_channel(integer(data, 'channel_id'))
    if data.get('channel_revision') != channel.revision:
        fail('渠道設定已變更，請重新載入', 'stale_revision', 409)
    external_id = text(data, 'external_order_id', 200)
    member = integer(data, 'member_id')
    user = db.session.get(User, member)
    if user is None or not user.is_active:
        fail('會員不存在或已停用')
    # 金額為該幣別的最小單位整數（台幣＝元、美金＝分；見 money.py）
    amount = integer(data, 'amount')
    currency = data.get('currency')
    from . import money
    if not money.supported(currency):
        fail('不支援的幣別', 'currency_unsupported')
    lines = data.get('lines')
    if not isinstance(lines, list) or not 1 <= len(lines) <= 100:
        fail('必須提供 1 至 100 個成交品項')
    clean = []
    for line in lines:
        if not isinstance(line, dict):
            fail('成交品項格式錯誤')
        clean.append(dict(external_sku=text(line, 'external_sku', 200),
                          quantity=integer(line, 'quantity', 1000), unit_amount=integer(line, 'unit_amount')))
    if sum(line['quantity'] * line['unit_amount'] for line in clean) != amount:
        fail('成交品項加總與訂單金額不符', 'amount_mismatch')
    # Sort for stable retry identity; external SKUs deliberately do not map to internal rights yet.
    clean.sort(key=lambda item: (item['external_sku'], item['quantity'], item['unit_amount']))
    snapshot = dict(channel_id=channel.id, external_order_id=external_id, member_id=member,
                    amount=amount, currency=currency, lines=clean)
    digest = hashlib.sha256(json.dumps(snapshot, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
    existing = CommerceExternalReceipt.query.filter_by(channel_id=channel.id, external_order_id=external_id).first()
    if existing:
        if existing.fingerprint != digest:
            fail('此外部訂單已存在，內容不同，禁止覆寫', 'receipt_conflict', 409)
        return existing, False
    row = CommerceExternalReceipt(**snapshot, fingerprint=digest, status='pending', channel_revision=channel.revision)
    db.session.add(row)
    db.session.flush()
    audit(channel, actor, 'receipt_imported', dict(fingerprint=digest, channel_revision=channel.revision), row)
    return row, True


def review(receipt_id, data, actor):
    enabled()
    candidate = db.session.get(CommerceExternalReceipt, receipt_id)
    if candidate is None:
        fail('找不到外部訂單', 'not_found', 404)
    action = data.get('decision')
    if action not in ('verified', 'rejected', 'voided'):
        fail('decision 必須是 verified、rejected 或 voided')
    # Same lock order as intake; rejection/void remains available after a policy expires.
    channel = locked_channel(candidate.channel_id, require_active=action == 'verified')
    row = CommerceExternalReceipt.query.filter_by(id=receipt_id).populate_existing().with_for_update().one()
    if data.get('fingerprint') != row.fingerprint or data.get('channel_revision') != channel.revision:
        fail('訂單或渠道版本不符，請重新審查', 'stale_review', 409)
    note, evidence = text(data, 'note', 1000), text(data, 'evidence_reference', 1000)
    if action == 'verified':
        if data.get('payment_confirmed') is not True or data.get('ownership_confirmed') is not True:
            fail('須核對平台已付款狀態及會員與購買者的歸屬')
        user = db.session.get(User, row.member_id)
        if user is None or not user.is_active:
            fail('會員不存在或已停用')
    if row.status == action:
        return row, False
    if not (row.status == 'pending' and action in ('verified', 'rejected', 'voided')
            or row.status == 'verified' and action == 'voided'):
        fail('此審查狀態不可變更；不得重新啟用已否決或作廢的證據', 'invalid_transition', 409)
    previous = row.status
    if action == 'voided':
        from . import binding, commerce
        order = binding.lock_bound_order(row)
        if order is not None:
            commerce.event(order, f'order:{order.id}:external-voided', 'external_evidence_voided', actor,
                           receipt_id=row.id, reason=note)
    row.status, row.channel_revision = action, channel.revision
    audit(channel, actor, 'receipt_' + action,
          dict(previous=previous, note=note, evidence_reference=evidence, fingerprint=row.fingerprint,
               channel_revision=channel.revision, payment_confirmed=data.get('payment_confirmed') is True,
               ownership_confirmed=data.get('ownership_confirmed') is True), row)
    return row, True
