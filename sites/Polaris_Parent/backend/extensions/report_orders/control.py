"""Order-scoped fulfilment control; durable desired state and retry cursor.

Stored in Order.attributes and changed under the order lock. Network calls happen
after commit; only an acknowledgement for the same revision can clear the hold.
"""
from copy import deepcopy
from datetime import datetime, timedelta, timezone

from core.backend_engine.factory import db
from packages.commerce.models import Order, OrderItem
from sites.Polaris_Parent.backend.models import ReportFulfillment
from .service import OrderError

KEY = 'fulfilment_control'


def now():
    return datetime.now(timezone.utc)


def view(order):
    row = deepcopy((order.attributes or {}).get(KEY) or {})
    if not row:
        return {'revision': 0, 'desired': 'active', 'blocked': False, 'sync': 'synced', 'reason': None}
    row['blocked'] = row['desired'] == 'paused' or row['sync'] != 'synced'
    return row


def require(order):
    if view(order)['blocked']:
        raise OrderError('履約已暫停或正在同步，請由管理者確認', 409, 'fulfilment_paused')


def _save(order, row):
    order.attributes = {**(order.attributes or {}), KEY: row}


def change(order, desired, reason, actor, expected_revision):
    from . import commerce, audit
    order = commerce.lock_order(order)
    old = view(order)
    if type(expected_revision) is not int or expected_revision != old['revision']:
        raise OrderError('狀態已更新，請重新整理後操作', 409, 'stale_control')
    if desired not in ('paused', 'active') or not isinstance(reason, str) or not reason.strip() or len(reason) > 1000:
        raise OrderError('請選擇暫停或恢復，並填寫 1–1000 字原因', 400, 'invalid_control')
    if desired == old['desired']:
        return old
    if desired == 'active':
        # Temporarily omit only the manual hold; all evidence/entitlement checks remain.
        if order.status != 'paid':
            raise OrderError('訂單尚未確認成交，不能恢復', 409, 'not_paid')
        from . import physical
        for item in order.order_items:
            kinds = []
            if item.kind == 'purchase':
                kinds.append('report')
            if physical.print_job_for(item):
                kinds.append('book')
            if physical.consultation_for(item):
                kinds.append('consult')
            for kind in kinds:
                commerce.require(item, kind, check_control=False)
    requests = [f.request_no for f in ReportFulfillment.query.join(OrderItem, OrderItem.id == ReportFulfillment.order_item_id)
                .filter(OrderItem.order_id == order.id).all()]
    row = dict(revision=old['revision'] + 1, desired=desired, reason=reason.strip(), actor_id=actor,
               changed_at=now().isoformat(), sync='pending' if requests else 'synced', requests=requests,
               attempts=0, next_attempt_at=None, error=None)
    _save(order, row)
    audit.log(order, 'fulfilment_' + desired, actor, ref=row['revision'], reason=row['reason'])
    return view(order)


def sync_one(order_id):
    from . import commerce, handoff
    order = db.session.get(Order, order_id)
    row = view(order)
    if row['sync'] == 'synced':
        return True
    revision = row['revision']
    payload = {'revision': revision, 'desired': row['desired'], 'reason': row['reason'], 'order_no': order.order_no}
    requests = list(row['requests'])
    db.session.commit()  # never hold an order lock while waiting for the remote service
    error = None
    for request_no in requests:
        try:
            data, err = handoff._ziwei_call('POST', f'/public/report-requests/{request_no}/control', payload)
            ack = (data or {}).get('control', {})
            if err or ack.get('revision') != revision or ack.get('desired') != row['desired']:
                error = err or '遠端尚未確認相同版本的履約狀態'
                break
        except Exception:
            error = '遠端同步失敗，將稍後重試'
            break
    order = commerce.lock_order(db.session.get(Order, order_id))
    current = view(order)
    if current['revision'] != revision:
        db.session.commit()
        return False  # late acknowledgements must never overwrite a newer command
    current.pop('blocked', None)
    current['attempts'] += 1
    current['sync'] = 'attention' if error and current['attempts'] >= 6 else 'pending' if error else 'synced'
    current['error'] = str(error)[:1000] if error else None
    current['next_attempt_at'] = (now() + timedelta(seconds=min(3600, 60 * 2 ** min(current['attempts'], 6)))).isoformat() if error else None
    _save(order, current)
    db.session.commit()
    return error is None


def sync_due(limit=20):
    ids = []
    for order in Order.query.filter(Order.attributes.isnot(None)).order_by(Order.id).all():
        row = view(order)
        if row['sync'] == 'synced':
            continue
        if row.get('next_attempt_at') and datetime.fromisoformat(row['next_attempt_at']) > now():
            continue
        ids.append(order.id)
        if len(ids) == limit:
            break
    db.session.commit()
    results = [sync_one(oid) for oid in ids]
    return {'synced': sum(results), 'pending': len(results) - sum(results)}


def retry(order, actor, expected_revision):
    """Queue a scheduler retry without changing the decision/version."""
    from . import commerce, audit
    order = commerce.lock_order(order)
    row = view(order)
    if type(expected_revision) is not int or expected_revision != row['revision']:
        raise OrderError('狀態已更新，請重新整理後操作', 409, 'stale_control')
    if row['sync'] == 'synced':
        return row
    row.pop('blocked', None)
    row['next_attempt_at'] = None
    _save(order, row)
    audit.log(order, 'fulfilment_retry', actor, revision=row['revision'])
    return view(order)
