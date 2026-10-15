"""Reviewed, fail-closed historical conversion. No catalog lookups, payments or dispatch.

Preview is read-only. Apply recomputes under the same order lock used by fulfilment,
compares a reviewer-bound signed fingerprint, then writes in the caller's transaction.
"""
from copy import deepcopy
from datetime import datetime, timezone
import hashlib
import json

from flask import current_app
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from core.backend_engine.factory import db
from core.backend_engine.models import User
from packages.commerce.models import OrderItem, PaymentAttempt
from sites.Polaris_Parent.backend.models import (
    ReportFulfillment, ReportPrintJob, ReportConsultation, ReportDocument, ReportBookDesign, Shipment,
)
from sites.Polaris_Parent.backend.commerce_models import (
    CommerceSource, CommerceLine, CommerceEntitlement, CommerceTask, CommerceEvent,
)
from . import commerce
from .service import OrderError

VERSION = 1
TOKEN_SECONDS = 1800


class ReviewBlocked(Exception):
    def __init__(self, code, message):
        self.code, self.message = code, message


def _check(condition, code, message):
    if not condition:
        raise ReviewBlocked(code, message)


def _integer(value, minimum=0):
    return type(value) is int and value >= minimum


def _iso(value):
    if isinstance(value, datetime):
        return (value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)).isoformat()
    raise TypeError('Unsupported snapshot value')


def _record(row):
    return {c.name: getattr(row, c.name) for c in row.__table__.columns} if row is not None else None


def _rows(model, **where):
    return model.query.filter_by(**where).order_by(model.id).populate_existing().all()


def _one(rows, label):
    _check(len(rows) == 1, 'missing_or_duplicate_work', f'{label}工作紀錄缺少或重複，需人工釐清')
    return rows[0]


def _parent(item, owner, evidence):
    parent = OrderItem.query.filter_by(id=item.parent_item_id).populate_existing().first()
    _check(parent is not None and parent.kind == 'purchase' and parent.variant in ('digital', 'physical'),
           'invalid_parent', '加購或解讀缺少原始報告品項')
    _check(parent.order.user_id == owner, 'ownership_mismatch', '原報告與加購的會員歸屬不一致')
    evidence.append({'parent': _record(parent), 'parent_owner': parent.order.user_id})
    return parent


def _grant(kind, units, rights, state, target_kind, target_id, revoked_at=None):
    return {'kind': kind, 'units': units, 'permissions': deepcopy(rights), 'status': state,
            'target_kind': target_kind, 'target_id': target_id,
            'revoked_at': _iso(revoked_at) if revoked_at else None}


def _refund(row, amount):
    if row.status == 'cancelled':
        _check(row.cancelled_at is not None and _integer(row.refund_due) and row.refund_due <= amount,
               'invalid_cancellation', '取消時間或應退金額不完整，需人工核對')
        _check((row.refunded_at is None and row.refund_amount is None) or
               (row.refunded_at is not None and _integer(row.refund_amount, 1) and row.refund_amount <= row.refund_due),
               'invalid_refund', '退款紀錄與應退金額不一致')
    else:
        _check(row.refund_due is None and row.refund_amount is None and row.refunded_at is None,
               'refund_status_conflict', '未取消的服務存在退款紀錄')


def _line(item, owner, evidence):
    _check(item.currency == 'TWD' and _integer(item.unit_price) and _integer(item.quantity, 1),
           'invalid_line', '品項金額、數量或幣別不完整')
    total = commerce.legacy_line_total(item)
    purchase = item.kind == 'purchase' and item.variant in ('digital', 'physical')
    book = item.variant == 'physical' and item.kind in ('purchase', 'addon')
    consult = item.kind == 'service' and item.variant == 'consult'
    _check(purchase or book or consult, 'unsupported_item', '此品項類型尚無歷史轉換規則')
    _check(item.product_code == {'digital': 'natal-report-digital', 'physical': 'natal-report-physical',
                                 'consult': 'report-consult'}.get(item.variant),
           'unsupported_product', '商品代碼不在已知歷史報告商品範圍')
    _check(item.quantity <= 1000, 'ambiguous_quantity', '歷史數量超出本批回填範圍，需人工釐清')
    _check(not purchase or item.quantity == 1, 'ambiguous_report_quantity', '歷史報告品項數量不是一份，無法確定製作次數')
    fs, jobs, cs, docs, shipments = (_rows(model, order_item_id=item.id) for model in
        (ReportFulfillment, ReportPrintJob, ReportConsultation, ReportDocument, Shipment))
    evidence.append({'item': _record(item), 'fulfillments': [_record(r) for r in fs],
                     'books': [_record(r) for r in jobs], 'consults': [_record(r) for r in cs],
                     'documents': [_record(r) for r in docs], 'shipments': [_record(r) for r in shipments]})
    _check((purchase or not fs and not docs) and (book or not jobs and not shipments) and (consult or not cs),
           'unexpected_work', '品項類型與既有工作紀錄不一致')
    grants, components, copies = [], [{'label': item.name, 'amount': total}], 0
    parent = _parent(item, owner, evidence) if not purchase else item
    if purchase:
        f = _one(fs, '報告')
        _check(f.member_id == owner and f.request_no == item.item_no, 'ownership_mismatch', '報告工作與訂單會員或品項不一致')
        _check(f.handoff_status in ('pending', 'sent', 'failed'), 'ambiguous_handoff', '已付款報告尚未交接或已取消，需人工釐清')
        current = [d for d in docs if d.is_current and d.kind == 'book_pdf']
        _check(len(current) <= 1, 'multiple_documents', '存在多份目前有效的報告文件')
        _check(bool(current) == (f.deliverable_ready_at is not None), 'delivery_status_conflict', '報告交付時間與文件紀錄不一致')
        grants.append(_grant('report', 1, {'digital_delivery': True}, 'completed' if current else 'in_use',
                             'report_fulfillment', f.id))
    if book:
        job = _one(jobs, '書籍')
        pricing, custom, spec = job.pricing, job.custom, job.spec
        _check(isinstance(pricing, dict) and isinstance(custom, dict) and isinstance(spec, dict),
               'missing_book_snapshot', '缺少歷史書籍成交快照')
        copies, book_total = pricing.get('quantity'), pricing.get('line_total')
        _check(_integer(copies, 1) and _integer(book_total) and isinstance(spec.get('key'), str) and spec['key'],
               'missing_book_snapshot', '書籍份數、規格或成交金額不完整')
        options, spreads = custom.get('options'), custom.get('spreads')
        _check(isinstance(options, list) and all(isinstance(o, str) and o in ('custom_cover', 'text_unlock', 'image_insert') for o in options)
               and len(set(options)) == len(options) and _integer(spreads),
               'missing_book_rights', '缺少可靠的歷史客製權利快照')
        parts = pricing.get('breakdown')
        _check(isinstance(parts, list) and parts and all(isinstance(p, dict) and isinstance(p.get('label'), str)
               and _integer(p.get('amount')) for p in parts), 'invalid_components', '歷史書籍計價組成不完整')
        _check(sum(p['amount'] for p in parts) == book_total, 'amount_mismatch', '書籍計價組成與成交金額不一致')
        components = deepcopy(parts)
        if purchase:
            _check(_integer(pricing.get('digital_price')) and pricing['digital_price'] + book_total == total,
                   'amount_mismatch', '數位報告與書籍成交金額無法核對')
            components.insert(0, {'label': '數位報告', 'amount': pricing['digital_price']})
        else:
            _check(total == book_total and item.quantity == copies, 'amount_mismatch', '加購金額或印刷份數與歷史快照不一致')
        state = {'awaiting_customization': 'available', 'awaiting_proof': 'in_use', 'proof_ready': 'in_use',
                 'changes_requested': 'in_use', 'approved': 'in_use', 'printing': 'in_use', 'shipped': 'in_use',
                 'delivered': 'completed', 'cancelled': 'revoked'}.get(job.status)
        _check(state is not None, 'ambiguous_book_status', '已收款書籍的工作狀態需要人工釐清')
        shipment = _one(shipments, '出貨')
        expected_shipping = job.status if job.status in ('printing', 'shipped', 'delivered', 'cancelled') else 'pending'
        _check(shipment.status == expected_shipping, 'shipment_status_conflict', '書籍與物流狀態不一致')
        designs = _rows(ReportBookDesign, print_job_id=job.id)
        evidence.append({'designs': [_record(d) for d in designs]})
        _check(len(designs) <= 1 and all(d.user_id == owner and d.report_item_id == parent.id for d in designs),
               'design_ownership_mismatch', '設計紀錄重複或歸屬不一致')
        _check(not designs or not (state == 'available' and designs[0].status == 'confirmed'),
               'design_status_conflict', '已確認設計與尚未開始的書籍狀態矛盾')
        _refund(job, book_total)
        grants.append(_grant('book', 1, {'print_copies': copies, 'spec': spec, 'custom': options, 'spreads': spreads},
                             state, 'print_job', job.id, job.cancelled_at if state == 'revoked' else None))
    if consult:
        row = _one(cs, '解讀')
        _check(row.report_item_id == parent.id and _integer(row.sessions, 1) and row.sessions == item.quantity
               and _integer(row.minutes, 1), 'invalid_consult_snapshot', '解讀歸屬、次數或分鐘數不一致')
        state = {'to_schedule': 'available', 'scheduled': 'in_use', 'completed': 'completed', 'cancelled': 'revoked'}.get(row.status)
        _check(state is not None, 'ambiguous_consult_status', '已收款解讀的工作狀態需要人工釐清')
        _check(row.status not in ('scheduled', 'completed') or row.scheduled_at is not None,
               'missing_consult_time', '已安排的解讀缺少預約時間')
        _check(row.status != 'completed' or row.completed_at is not None, 'missing_consult_time', '已完成的解讀缺少完成時間')
        _refund(row, total)
        grants.append(_grant('consult', row.sessions, {'minutes': row.minutes}, state, 'consultation', row.id,
                             row.cancelled_at if state == 'revoked' else None))
    return {'order_item_id': item.id, 'item_no': item.item_no, 'name': item.name,
            'original_unit_amount': item.unit_price, 'original_quantity': item.quantity,
            'unit_amount': total if book else item.unit_price, 'quantity': 1 if book else item.quantity,
            'line_total': total, 'currency': item.currency, 'currency_exponent': 0,
            'print_copies': copies, 'components': components, 'grants': grants}


def preview(order):
    """Public result excludes source documents/PII; only their fingerprint is exposed."""
    db.session.refresh(order)
    result = {'order_no': order.order_no, 'version': VERSION, 'decision': 'blocked', 'reasons': [], 'lines': [],
              'apply_enabled': current_app.config.get('COMMERCE_BACKFILL_ENABLED') is True}
    if commerce.tracked(order):
        return {**result, 'decision': 'already_tracked'}
    evidence = [_record(order)]
    try:
        _check(not (order.attributes or {}).get(commerce.CONTRACT_KEY) and not (order.attributes or {}).get('commerce_activation_version'),
               'unknown_contract', '訂單已有其他版本標記，不可覆寫')
        payments = _rows(PaymentAttempt, order_id=order.id)
        evidence.append({'payments': [_record(p) for p in payments]})
        paid = [p for p in payments if p.status == 'succeeded']
        if not paid and order.status in ('pending', 'cancelled') and order.paid_at is None:
            return {**result, 'decision': 'skip_unpaid', 'reasons': [{'code': 'not_paid', 'message': '尚未確認付款，不發放資格'}]}
        _check(order.status in ('paid', 'cancelled') and order.currency == 'TWD' and order.payment_method == 'manual'
               and order.paid_at is not None and _integer(order.amount, 1), 'unsupported_order', '僅支援可核對的台幣人工收款歷史訂單')
        _check(len(paid) == 1, 'payment_evidence_required', '需有唯一一筆成功付款紀錄')
        p = paid[0]
        _check(p.amount == order.amount and p.currency == order.currency and p.provider == 'manual' and p.environment == 'live'
               and p.confirmed_by is not None and p.paid_at is not None, 'payment_evidence_required', '成功付款的金額、幣別、環境或核款人不完整')
        _check(db.session.get(User, order.user_id) is not None, 'missing_owner', '找不到訂單對應的會員')
        items = _rows(OrderItem, order_id=order.id)
        _check(bool(items), 'missing_items', '訂單缺少關聯品項')
        ids = [i.id for i in items]
        _check(db.session.get(CommerceSource, order.id) is None and
               CommerceLine.query.filter(CommerceLine.order_item_id.in_(ids)).first() is None and
               CommerceEntitlement.query.filter(CommerceEntitlement.order_item_id.in_(ids)).first() is None and
               CommerceEvent.query.filter_by(order_id=order.id).first() is None,
               'partial_contract', '已有部分交易骨架紀錄，請先釐清，不能疊加回填')
        lines = [_line(i, order.user_id, evidence) for i in items]
        _check(sum(l['line_total'] for l in lines) == order.amount, 'amount_mismatch', '品項總額與訂單總額不一致')
        _check(order.status != 'cancelled' or all(g['status'] == 'revoked' for l in lines for g in l['grants']),
               'cancelled_order_conflict', '已取消的訂單仍存在有效履約工作')
        _check(order.status != 'paid' or any(g['status'] != 'revoked' for l in lines for g in l['grants']),
               'paid_order_conflict', '所有服務均已取消，但訂單仍為已付款')
        fingerprint = hashlib.sha256(json.dumps({'version': VERSION, 'evidence': evidence},
            ensure_ascii=False, sort_keys=True, default=_iso, separators=(',', ':')).encode('utf-8')).hexdigest()
        return {**result, 'decision': 'review_required', 'fingerprint': fingerprint, 'lines': lines,
                'owner_id': order.user_id, 'amount': order.amount, 'currency': order.currency,
                'payment_attempt_id': p.id}
    except ReviewBlocked as exc:
        return {**result, 'reasons': [{'code': exc.code, 'message': exc.message}]}


def _signer():
    return URLSafeTimedSerializer(current_app.config['SECRET_KEY'], salt='commerce-backfill-v1')


def review(order, actor):
    plan = preview(order)
    if plan['decision'] == 'review_required':
        plan['review_token'] = _signer().dumps({'order_id': order.id, 'actor': actor, 'version': VERSION,
                                               'fingerprint': plan['fingerprint']})
        plan['valid_for_seconds'] = TOKEN_SECONDS
    return plan


def apply(order, actor, token, note, confirmed):
    if current_app.config.get('COMMERCE_BACKFILL_ENABLED') is not True:
        raise OrderError('歷史回填尚未開放，仍可先預覽', 503, 'backfill_disabled')
    if confirmed is not True or not isinstance(note, str) or not 1 <= len(note.strip()) <= 500:
        raise OrderError('請確認已核對付款、歸屬與履約狀態，並填寫審查備註', 400, 'review_required')
    if not isinstance(token, str) or len(token) > 2048:
        raise OrderError('審查憑證無效，請重新預覽', 400, 'invalid_review')
    try:
        approved = _signer().loads(token, max_age=TOKEN_SECONDS)
    except (BadSignature, SignatureExpired):
        raise OrderError('審查憑證無效或已到期，請重新預覽', 409, 'invalid_review')
    if not isinstance(approved, dict) or approved.get('actor') != actor or approved.get('order_id') != order.id or approved.get('version') != VERSION:
        raise OrderError('審查憑證不屬於此次操作', 403, 'invalid_review')
    commerce.lock_order(order)
    key = f'order:{order.id}:backfilled'
    prior = CommerceEvent.query.filter_by(event_key=key).first()
    if commerce.tracked(order):
        if prior is not None and (prior.detail or {}).get('fingerprint') == approved.get('fingerprint'):
            return False
        raise OrderError('此訂單已建立交易契約，不能再次回填', 409, 'already_tracked')
    plan = preview(order)
    if plan['decision'] != 'review_required' or plan['fingerprint'] != approved.get('fingerprint'):
        raise OrderError('資料已變更或不再符合回填條件，請重新預覽與審查', 409, 'review_stale')
    for line in plan['lines']:
        item = db.session.get(OrderItem, line['order_item_id'])
        item.unit_price, item.quantity = line['unit_amount'], line['quantity']
        db.session.add(CommerceLine(order_item_id=item.id, **{k: line[k] for k in
            ('unit_amount', 'quantity', 'line_total', 'currency', 'currency_exponent', 'print_copies', 'components')},
            rights=[{'kind': g['kind'], 'units': g['units'], 'permissions': deepcopy(g['permissions'])} for g in line['grants']]))
        for grant in line['grants']:
            for unit in range(1, grant['units'] + 1):
                ent = CommerceEntitlement(order_item_id=item.id, kind=grant['kind'], unit_index=unit,
                    holder_id=order.user_id, operator_id=order.user_id, status=grant['status'], rights=deepcopy(grant['permissions']),
                    revoked_at=datetime.fromisoformat(grant['revoked_at']) if grant['revoked_at'] else None,
                    revoke_reason='historical_cancellation' if grant['status'] == 'revoked' else None)
                db.session.add(ent)
                db.session.flush()
                if grant['status'] != 'available':
                    db.session.add(CommerceTask(entitlement_id=ent.id, target_kind=grant['target_kind'], target_id=grant['target_id'],
                        status={'in_use': 'started', 'completed': 'completed', 'revoked': 'cancelled'}[grant['status']]))
                commerce.event(order, f'ent:{ent.id}:imported', 'entitlement_imported', actor, ent.id,
                               historical_status=grant['status'])
    db.session.add(CommerceSource(order_id=order.id, channel='website', store_key='polaris-parent', contract_version=1))
    order.attributes = {**(order.attributes or {}), commerce.CONTRACT_KEY: 1}
    # Preserve orders.items as the original historical snapshot; relational quantities
    # are normalized, with original values retained in the reviewed audit plan.
    commerce.event(order, key, 'order_backfilled', actor, fingerprint=plan['fingerprint'], version=VERSION,
                   note=note.strip(), payment_attempt_id=plan['payment_attempt_id'], lines=plan['lines'])
    return True
