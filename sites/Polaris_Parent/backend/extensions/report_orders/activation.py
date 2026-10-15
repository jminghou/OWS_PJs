"""Account-bound activation lifecycle. Caller commits; lock order before any token/rights mutation.

Codes only claim an existing paid right. No payment creation, ownership transfer,
network calls or plaintext persistence. Normal website rights need no token.
"""
import base64
import hashlib
import re
import secrets
from datetime import datetime, timedelta, timezone

from flask import current_app
from core.backend_engine.factory import db
from packages.commerce.models import OrderItem, PaymentAttempt
from sites.Polaris_Parent.backend.commerce_models import CommerceActivation, CommerceEntitlement, CommerceTask
from . import commerce
from .service import OrderError

MARKER = 'commerce_activation_version'


def enabled():
    return current_app.config.get('COMMERCE_ACTIVATION_ENABLED') is True


def _utc(value):
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def _now():
    return datetime.now(timezone.utc)


def _digest(raw):
    if not isinstance(raw, str) or len(raw) > 80:
        raise OrderError('啟用碼無效或不屬於此帳號', 400, 'invalid_activation')
    normalized = re.sub(r'[\s-]', '', raw).upper()
    if not re.fullmatch(r'PP[A-Z2-7]{32}', normalized):
        raise OrderError('啟用碼無效或不屬於此帳號', 400, 'invalid_activation')
    return hashlib.sha256(normalized.encode('ascii')).hexdigest()


def latest(entitlement_id):
    return (CommerceActivation.query.filter_by(entitlement_id=entitlement_id)
            .order_by(CommerceActivation.id.desc()).populate_existing().first())


def _locked(entitlement_id):
    ent = db.session.get(CommerceEntitlement, entitlement_id)
    if ent is None:
        raise OrderError('找不到這項資格', 404, 'not_found')
    item = db.session.get(OrderItem, ent.order_item_id)
    order = commerce.lock_order(item.order)
    db.session.refresh(ent)
    return ent, item, order


def _available(ent, order):
    if order.payment_method == 'external_verified':
        raise OrderError('外部成交尚未開放啟用碼；目前僅支援已對應的數位報告履約', 409, 'external_activation_unavailable')
    if not commerce.tracked(order) or order.status != 'paid' or ent.status != 'available':
        raise OrderError('僅能啟用已付款且尚未使用的資格', 409, 'entitlement_unavailable')
    if ent.holder_id != order.user_id or ent.operator_id != order.user_id:
        raise OrderError('資格歸屬需要人工核對', 409, 'ownership_mismatch')
    if CommerceTask.query.filter_by(entitlement_id=ent.id).first() is not None:
        raise OrderError('這項資格已開始使用', 409, 'entitlement_used')
    evidence = PaymentAttempt.query.filter_by(order_id=order.id, status='succeeded').all()
    if len(evidence) != 1 or evidence[0].amount != order.amount or evidence[0].currency != order.currency:
        raise OrderError('請先核對此訂單的成功付款紀錄', 409, 'payment_evidence_required')


def issue(entitlement_id, actor, days=14):
    if not enabled():
        raise OrderError('目前未開放發放啟用碼', 503, 'activation_disabled')
    if type(days) is not int or not 1 <= days <= 90:
        raise OrderError('有效天數須為 1 到 90 天', 400, 'invalid')
    ent, item, order = _locked(entitlement_id)
    _available(ent, order)
    prior = latest(ent.id)
    if prior is not None and prior.status == 'redeemed':
        raise OrderError('這項資格已完成啟用', 409, 'already_activated')
    if prior is not None and prior.status == 'issued' and _utc(prior.expires_at) > _now():
        raise OrderError('已有有效啟用碼；若遺失請先撤銷再補發', 409, 'activation_exists')
    if prior is not None and prior.status == 'issued':
        prior.status, prior.revoked_at, prior.revoke_reason = 'revoked', _now(), 'expired_replaced'
        commerce.event(order, f'activation:{prior.id}:revoked', 'activation_revoked', actor, ent.id,
                       reason='expired_replaced')
        db.session.flush()  # Release the partial unique index before issuing its replacement.
    raw = base64.b32encode(secrets.token_bytes(20)).decode('ascii')
    code = 'PP-' + '-'.join(raw[i:i + 4] for i in range(0, len(raw), 4))
    row = CommerceActivation(entitlement_id=ent.id, code_digest=_digest(code), recipient_id=ent.holder_id,
                             issued_by=actor, status='issued', expires_at=_now() + timedelta(days=days))
    db.session.add(row)
    order.attributes = {**(order.attributes or {}), MARKER: 1}
    db.session.flush()
    commerce.event(order, f'activation:{row.id}:issued', 'activation_issued', actor, ent.id,
                   activation_id=row.id, recipient_id=row.recipient_id)
    return row, code


def redeem(code, user_id, order_no=None):
    if not enabled():
        raise OrderError('啟用碼服務暫停，請稍後再試', 503, 'activation_disabled')
    row = CommerceActivation.query.filter_by(code_digest=_digest(code), recipient_id=user_id).first()
    if row is None:
        raise OrderError('啟用碼無效或不屬於此帳號', 400, 'invalid_activation')
    ent, item, order = _locked(row.entitlement_id)
    db.session.refresh(row)
    if order_no is not None and order_no != order.order_no:
        raise OrderError('啟用碼不屬於這筆訂單', 400, 'invalid_activation')
    if ent.holder_id != user_id or ent.operator_id != user_id or order.user_id != user_id:
        raise OrderError('啟用碼無效或不屬於此帳號', 400, 'invalid_activation')
    if row.status == 'revoked' or ent.status == 'revoked' or order.status != 'paid':
        raise OrderError('這個啟用碼已失效，請聯絡客服', 409, 'activation_unavailable')
    if row.status == 'redeemed':
        return order, False  # Same recipient retry remains safe even after production started.
    if _utc(row.expires_at) <= _now():
        raise OrderError('啟用碼已到期，請聯絡客服補發', 409, 'activation_expired')
    _available(ent, order)
    row.status, row.redeemed_at = 'redeemed', _now()
    commerce.event(order, f'activation:{row.id}:redeemed', 'activation_redeemed', user_id, ent.id,
                   activation_id=row.id)
    return order, True


def revoke(activation_id, actor, reason):
    # Revocation stays available when new issuance/redemption is disabled.
    if not isinstance(reason, str) or not 1 <= len(reason.strip()) <= 500:
        raise OrderError('請填寫 1 到 500 字的撤銷原因', 400, 'invalid')
    row = db.session.get(CommerceActivation, activation_id)
    if row is None:
        raise OrderError('找不到啟用碼紀錄', 404, 'not_found')
    ent, item, order = _locked(row.entitlement_id)
    db.session.refresh(row)
    if row.status == 'redeemed':
        raise OrderError('啟用碼已兌換；取消服務請使用原訂單取消流程', 409, 'already_activated')
    if row.status != 'revoked':
        row.status, row.revoked_at, row.revoke_reason = 'revoked', _now(), reason.strip()
        commerce.event(order, f'activation:{row.id}:revoked', 'activation_revoked', actor, ent.id,
                       reason=row.revoke_reason)
    return row


def require_activated(order, entitlements):
    if (order.attributes or {}).get(MARKER) != 1:
        return
    for ent in entitlements:
        row = latest(ent.id)
        if row is not None and row.status != 'redeemed':
            raise OrderError('請先由指定會員兌換啟用碼', 409, 'activation_required')


def cancel_for(order, ent, actor=None):
    if (order.attributes or {}).get(MARKER) != 1:
        return
    row = latest(ent.id)
    if row is not None and row.status == 'issued':
        row.status, row.revoked_at, row.revoke_reason = 'revoked', _now(), 'entitlement_revoked'
        commerce.event(order, f'activation:{row.id}:revoked', 'activation_revoked', actor, ent.id,
                       reason='entitlement_revoked')


def view(order, entitlement_id):
    if (order.attributes or {}).get(MARKER) != 1:
        return None
    row = latest(entitlement_id)
    if row is None:
        return None
    status = 'expired' if row.status == 'issued' and _utc(row.expires_at) <= _now() else row.status
    return {'id': row.id, 'status': status, 'recipient_id': row.recipient_id,
            'expires_at': _utc(row.expires_at).isoformat(),
            'redeemed_at': _utc(row.redeemed_at).isoformat() if row.redeemed_at else None}
