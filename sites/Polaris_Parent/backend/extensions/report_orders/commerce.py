"""Transaction/entitlement boundary. All mutations share the caller's transaction.

No network, no commits, no automatic historical grants. The feature switch only
controls NEW orders; an existing contract always keeps its authorization checks.
"""
from copy import deepcopy
from datetime import datetime, timezone

from flask import current_app
from packages.commerce.models import Order, OrderItem
from core.backend_engine.factory import db
from sites.Polaris_Parent.backend.commerce_models import (
    CommerceSource, CommerceLine, CommerceEntitlement, CommerceTask, CommerceEvent,
)
from .service import OrderError

CONTRACT_KEY = 'commerce_contract_version'


def enabled():
    return current_app.config.get('COMMERCE_FOUNDATION_ENABLED') is True


def tracked(order):
    return (order.attributes or {}).get(CONTRACT_KEY) == 1


def lock_order(order):
    # Refresh stale ORM state after waiting for another transaction's row lock.
    return Order.query.filter_by(id=order.id).populate_existing().with_for_update().one()


def event(order, key, name, actor=None, entitlement=None, **detail):
    if CommerceEvent.query.filter_by(event_key=key).first() is None:
        db.session.add(CommerceEvent(order_id=order.id, entitlement_id=entitlement,
                                    event_key=key, event_type=name, actor_id=actor, detail=detail))


def legacy_line_total(item):
    if item.variant == 'physical' and item.kind == 'addon' and not tracked(item.order):
        return item.unit_price
    return item.unit_price * item.quantity


def finalize_order(order):
    """Shared first-purchase/add-on contract builder, called after all lines/jobs exist."""
    if not enabled():
        return
    from .physical import print_job_for, consultation_for

    db.session.flush()
    from . import money
    if not money.supported(order.currency):
        raise OrderError(f'不支援的幣別：{order.currency}', 409, 'currency_unavailable')
    terms = []
    for item in order.order_items:
        total = legacy_line_total(item)
        if item.currency != order.currency or type(total) is not int or total < 0 or type(item.quantity) is not int or item.quantity < 1:
            raise OrderError('訂單金額或幣別不一致', 409, 'invalid_sale_terms')
        job, consult = print_job_for(item), consultation_for(item)
        rights, components, copies = [], [], 0
        if item.kind == 'purchase':
            rights.append({'kind': 'report', 'units': 1, 'permissions': {'digital_delivery': True}})
        if job is not None:
            pricing = job.pricing or {}
            copies = pricing.get('quantity')
            book_total = pricing.get('line_total')
            if type(copies) is not int or copies < 1 or type(book_total) is not int or book_total < 0:
                raise OrderError('實體書成交快照不完整', 409, 'invalid_sale_terms')
            components = deepcopy(pricing.get('breakdown') or [])
            if sum(c.get('amount', 0) for c in components) != book_total:
                raise OrderError('實體書計價明細不一致', 409, 'invalid_sale_terms')
            if item.kind == 'purchase':
                components.insert(0, {'label': '數位報告', 'amount': total - book_total})
            rights.append({'kind': 'book', 'units': 1, 'permissions': {
                'print_copies': copies, 'spec': deepcopy(job.spec),
                'custom': deepcopy((job.custom or {}).get('options') or []),
                'spreads': (job.custom or {}).get('spreads', 0)}})
            # One priced book package; identical print copies are a separate dimension.
            item.unit_price, item.quantity = total, 1
        if consult is not None:
            rights.append({'kind': 'consult', 'units': consult.sessions,
                           'permissions': {'minutes': consult.minutes}})
        if not rights:
            raise OrderError('商品尚未定義可提供的資格', 409, 'unsupported_product')
        if not components:
            components = [{'label': item.name, 'amount': total}]
        if any(type(c.get('amount')) is not int or c['amount'] < 0 for c in components) or sum(c['amount'] for c in components) != total:
            raise OrderError('成交明細無法還原訂單金額', 409, 'invalid_sale_terms')
        terms.append(CommerceLine(order_item_id=item.id, unit_amount=item.unit_price, quantity=item.quantity,
                                  line_total=total, currency=item.currency, currency_exponent=money.exponent(item.currency),
                                  print_copies=copies, components=components, rights=rights))
    if not terms or sum(t.line_total for t in terms) != order.amount:
        raise OrderError('訂單總額與明細不一致', 409, 'invalid_sale_terms')
    db.session.add_all(terms)
    db.session.add(CommerceSource(order_id=order.id, channel='website', store_key='polaris-parent', contract_version=1))
    order.attributes = {**(order.attributes or {}), CONTRACT_KEY: 1}
    from .physical import item_snapshot
    order.items = [item_snapshot(i) for i in order.order_items]
    event(order, f'order:{order.id}:created', 'order_created', order.user_id)


def grant_paid(order, actor=None, confirmation='payment_confirmed'):
    if not tracked(order):
        return
    terms = [db.session.get(CommerceLine, i.id) for i in order.order_items]
    if order.status != 'paid' or any(t is None for t in terms) or sum(t.line_total for t in terms) != order.amount:
        raise OrderError('訂單成交資料需要人工檢查', 409, 'invalid_sale_terms')
    for item, term in zip(order.order_items, terms):
        if term.currency != order.currency or term.line_total != item.unit_price * item.quantity:
            raise OrderError('訂單成交資料已變更', 409, 'invalid_sale_terms')
        for spec in term.rights:
            for unit in range(1, spec['units'] + 1):
                ent = CommerceEntitlement.query.filter_by(order_item_id=item.id, kind=spec['kind'], unit_index=unit).first()
                if ent is not None:
                    continue  # Includes revoked/completed: payment retries never revive rights.
                ent = CommerceEntitlement(order_item_id=item.id, kind=spec['kind'], unit_index=unit,
                                           holder_id=order.user_id, operator_id=order.user_id,
                                           status='available', rights=deepcopy(spec['permissions']))
                db.session.add(ent)
                db.session.flush()
                event(order, f'ent:{ent.id}:issued', 'entitlement_issued', actor, ent.id)
    event(order, f'order:{order.id}:paid', confirmation, actor)


def require(item, kind, actor=None):
    # Legacy operations must serialize with a concurrent historical conversion.
    order = lock_order(item.order)
    if not tracked(order):
        return []
    from . import binding
    binding.require_evidence(order)
    rows = (CommerceEntitlement.query.filter_by(order_item_id=item.id, kind=kind)
            .order_by(CommerceEntitlement.unit_index).populate_existing().with_for_update().all())
    if order.status != 'paid' or not rows or any(e.status == 'revoked' for e in rows):
        raise OrderError('這項製作資格目前無法使用', 409, 'entitlement_unavailable')
    if actor is not None and any(e.operator_id != actor for e in rows):
        raise OrderError('沒有操作這項資格的權限', 403, 'entitlement_forbidden')
    from . import activation
    activation.require_activated(order, rows)
    return rows


def start(item, kind, target_kind, target_id, actor=None):
    for ent in require(item, kind, actor):
        task = CommerceTask.query.filter_by(entitlement_id=ent.id).first()
        if task is not None:
            if task.target_kind != target_kind or task.target_id != target_id or task.status == 'cancelled':
                raise OrderError('這項資格已關聯其他工作', 409, 'entitlement_used')
            continue
        if ent.status != 'available':
            raise OrderError('這項資格已使用', 409, 'entitlement_used')
        db.session.add(CommerceTask(entitlement_id=ent.id, target_kind=target_kind, target_id=target_id, status='started'))
        ent.status = 'in_use'
        event(item.order, f'ent:{ent.id}:started', 'task_started', actor, ent.id)


def complete(item, kind, target_kind, target_id, actor=None):
    start(item, kind, target_kind, target_id)  # Admin identity is audit-only, not the customer operator.
    for ent in require(item, kind):
        task = CommerceTask.query.filter_by(entitlement_id=ent.id).one()
        task.status, ent.status = 'completed', 'completed'
        event(item.order, f'ent:{ent.id}:completed', 'task_completed', actor, ent.id)


def revoke(item, kind, reason, actor=None):
    if not tracked(item.order):
        return
    lock_order(item.order)
    rows = CommerceEntitlement.query.filter_by(order_item_id=item.id).populate_existing().with_for_update().all()
    for ent in rows:
        if kind is not None and ent.kind != kind or ent.status == 'revoked':
            continue
        if ent.status == 'completed':
            raise OrderError('已完成的資格需人工例外處理', 409, 'completed_entitlement')
        ent.status, ent.revoked_at, ent.revoke_reason = 'revoked', datetime.now(timezone.utc), reason
        task = CommerceTask.query.filter_by(entitlement_id=ent.id).first()
        if task is not None:
            task.status = 'cancelled'
        event(item.order, f'ent:{ent.id}:revoked', 'entitlement_revoked', actor, ent.id, reason=reason)
        from . import activation
        activation.cancel_for(item.order, ent, actor)


def view(order):
    from . import activation
    from . import binding
    if not tracked(order):
        return {'version': 0, 'migration': 'review_required', 'entitlements': []}
    source = db.session.get(CommerceSource, order.id)
    lines, rights = [], []
    for item in order.order_items:
        term = db.session.get(CommerceLine, item.id)
        if term:
            lines.append({'item_no': item.item_no, 'unit_amount': term.unit_amount, 'quantity': term.quantity,
                          'line_total': term.line_total, 'currency': term.currency, 'print_copies': term.print_copies,
                          'components': term.components})
        for ent in CommerceEntitlement.query.filter_by(order_item_id=item.id).order_by(CommerceEntitlement.id).all():
            task = CommerceTask.query.filter_by(entitlement_id=ent.id).first()
            rights.append({'id': ent.id, 'item_no': item.item_no, 'kind': ent.kind, 'unit_index': ent.unit_index,
                          'holder_id': ent.holder_id, 'operator_id': ent.operator_id, 'status': ent.status,
                          'rights': ent.rights, 'revoke_reason': ent.revoke_reason,
                          'activation': activation.view(order, ent.id),
                          'task': None if task is None else {'id': task.id, 'status': task.status,
                                                           'target_kind': task.target_kind, 'target_id': task.target_id}})
    return {'version': 1, 'source': source.channel if source else None, 'lines': lines, 'entitlements': rights,
            'activation_enabled': activation.enabled() and order.payment_method != binding.METHOD,
            'external': binding.status_view(order)}


def historical_preview(order):
    """Read only. Never infer historical rights from today's product configuration."""
    if tracked(order):
        return {'order_no': order.order_no, 'decision': 'already_tracked'}
    items = order.order_items
    reasons = []
    if not items:
        reasons.append('missing_order_items')
    if sum(legacy_line_total(i) for i in items) != order.amount:
        reasons.append('amount_mismatch')
    if order.status != 'paid':
        reasons.append('not_paid_no_grant')
    from .physical import print_job_for, consultation_for
    from .delivery import current_document
    for item in items:
        job, consult = print_job_for(item), consultation_for(item)
        if current_document(item):
            reasons.append('report_already_delivered')
        if job and job.status not in ('awaiting_payment', 'awaiting_customization'):
            reasons.append('book_started_or_cancelled')
        if consult and consult.status != 'to_schedule':
            reasons.append('consult_started_or_cancelled')
    return {'order_no': order.order_no, 'decision': 'manual_review', 'reasons': reasons or ['verify_payment_and_ownership']}
