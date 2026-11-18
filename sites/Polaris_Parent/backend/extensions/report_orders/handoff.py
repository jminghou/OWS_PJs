"""
報告交接：付款後把製作工作單送到紫微（POST /public/report-requests，紫微介接契約 §4.3、§5 第 3 步）。

payment.prepare_fulfilment 把 report_fulfillments.handoff_status 從 not_ready 改成 pending（與付款同一個交易）；
之後由背景排程（jobs.py 的 handoff_reports）呼叫這裡送出。付款與交接分屬兩個系統、無法同一個交易，
所以靠 pending／failed 加重送補上：紫微端以 request_no 冪等，重送不會產生第二張工作單。

送出失敗依 notify.RETRY_BACKOFF 拉長間隔重試；用完次數後不放棄（訂單已付款，工作單一定要建），
改為每 12 小時再試一次，並在第一次用完時寄警示給管理者。
後台「報告交付」可以按「立即送出」手動重送。
"""

from datetime import datetime, timedelta, timezone

from flask import current_app

from core.backend_engine.factory import db
from packages.commerce.models import Order, OrderItem
from sites.Polaris_Parent.backend.models import ReportFulfillment

from . import notify

RETRY_LATER = timedelta(hours=12)
HANDOFF_STATUS_LABELS = {'not_ready': '未付款', 'pending': '待送出', 'sent': '已建工作單', 'failed': '送出失敗',
                         'cancelled': '已取消'}


def _naive_utc(dt):
    if dt is None:
        return None
    return dt.astimezone(timezone.utc).replace(tzinfo=None) if dt.tzinfo else dt


def _ziwei_call(method, path, payload=None):
    from sites.Polaris_Parent.backend.extensions.astrology import _ziwei_call as call
    return call(method, path, payload)


def payload(f, item, order):
    """送給紫微的工作單內容：命主資料與讀者設定取自下單當時的 customization 快照。"""
    c = item.customization or {}
    return {
        'request_no': f.request_no,
        'env': f.environment if f.environment in ('test', 'live') else 'live',
        'language': getattr(order, 'language', None) or 'zh-TW',  # 紫微端依語系分工接單
        'member_id': f.member_id,
        'chart_id': f.chart_id,
        'order_no': order.order_no,
        'product_code': item.product_code or '',
        'variant': item.variant if item.variant in ('digital', 'physical') else 'digital',
        'subject': {k: c.get(k) for k in ('subject_name', 'gender', 'birth', 'place', 'relation_label') if k in c},
        'audience': c.get('audience') or {},
        'paid_at': (order.paid_at.replace(tzinfo=timezone.utc).isoformat()
                    if order.paid_at and order.paid_at.tzinfo is None
                    else (order.paid_at.isoformat() if order.paid_at else None)),
    }


def next_attempt_at(f):
    """failed 的單下次可以重試的時間（UTC，不帶時區）；pending 立刻可送。"""
    if f.handoff_status == 'pending':
        return None
    attempts = f.handoff_attempts or 0
    wait = notify.RETRY_BACKOFF[attempts - 1] if 0 < attempts <= len(notify.RETRY_BACKOFF) else RETRY_LATER
    last = _naive_utc(f.updated_at) or datetime.utcnow()
    return last + wait


def send(f, now=None, actor=None):
    """送一次（呼叫前需已上鎖或確定沒有別人在處理）。回傳是否成功；結果一律 commit。"""
    now = now or datetime.utcnow()
    item = db.session.get(OrderItem, f.order_item_id)
    order = db.session.get(Order, item.order_id) if item is not None else None
    if order is None or order.status != 'paid':
        f.last_error = '訂單不是已付款狀態，未送出'
        db.session.commit()
        return False
    from . import commerce
    from .service import OrderError
    try:
        commerce.require(item, 'report')
    except OrderError as exc:
        db.session.rollback()
        f.last_error = exc.message
        db.session.commit()
        return False  # A business hold is not a failed network attempt.
    data, err = _ziwei_call('POST', '/public/report-requests', payload(f, item, order))
    f.handoff_attempts = (f.handoff_attempts or 0) + 1
    f.updated_at = now.replace(tzinfo=timezone.utc)  # 重試間隔以這次嘗試的時間起算
    if err is None and isinstance(data, dict) and data.get('request'):
        f.handoff_status, f.last_error = 'sent', None
        f.sent_at = f.synced_at = now.replace(tzinfo=timezone.utc)
        f.ziwei_status = data['request'].get('status')
        from . import audit
        audit.log(order, 'handoff_sent', actor, ref=f.id, attempt=f.handoff_attempts)
        db.session.commit()
        return True
    f.handoff_status, f.last_error = 'failed', (err or '紫微回應格式不正確')[:1000]
    exhausted = f.handoff_attempts == notify.MAX_ATTEMPTS
    from . import audit
    audit.log(order, 'handoff_failed', actor, ref=f'{f.id}:{f.handoff_attempts}', attempt=f.handoff_attempts,
              error=f.last_error[:300])
    db.session.commit()
    if exhausted:
        current_app.logger.error(f'報告交接失敗 {f.handoff_attempts} 次，之後每 12 小時重試 {f.request_no}：{f.last_error}')
        _alert_admin(f, order)
    else:
        current_app.logger.warning(f'報告交接失敗（第 {f.handoff_attempts} 次）{f.request_no}：{f.last_error}')
    return False


def _alert_admin(f, order):
    to = notify._admin_to()
    if not to:
        return False
    body = '\n'.join([
        f'有一筆已付款的報告訂單，送到紫微系統建立工作單失敗 {f.handoff_attempts} 次。', '',
        f'訂單編號：{order.order_no}', f'工作單編號：{f.request_no}', f'錯誤：{f.last_error or "-"}', '',
        '系統會繼續每 12 小時重試一次。確認紫微系統正常後，也可以到後台「報告交付」按「立即送出」：',
        f'{notify._frontend_url()}/admin/report-deliveries',
    ])
    return notify._deliver(order, 'handoff_failed_admin', to, f'【親紫之間後台】報告交接失敗 {order.order_no}', body,
                           key=f'handoff_failed:{f.id}')


def send_due(now=None, limit=20):
    """背景排程：送出 pending、以及重試時間已到的 failed。回傳 (成功, 失敗)。"""
    now = now or datetime.utcnow()
    ids = [row[0] for row in db.session.query(ReportFulfillment.id)
           .filter(ReportFulfillment.handoff_status.in_(('pending', 'failed')))
           .order_by(ReportFulfillment.id).all()]
    db.session.commit()
    ok = failed = 0
    for fid in ids:
        if ok + failed >= limit:
            break
        # Same order as fulfilment and evidence review: order before child row.
        parent_id = (db.session.query(OrderItem.order_id)
                     .join(ReportFulfillment, ReportFulfillment.order_item_id == OrderItem.id)
                     .filter(ReportFulfillment.id == fid).scalar())
        parent = Order.query.filter_by(id=parent_id).with_for_update(skip_locked=True).first()
        if parent is None:
            db.session.commit()
            continue
        f = ReportFulfillment.query.filter_by(id=fid).with_for_update(skip_locked=True).first()
        due = f is not None and f.handoff_status in ('pending', 'failed') and \
            (next_attempt_at(f) is None or next_attempt_at(f) <= now)
        if not due:
            db.session.commit()
            continue
        if send(f, now):
            ok += 1
        else:
            failed += 1
    return ok, failed


def send_now(order, actor=None):
    """後台「立即送出」：不看重試間隔。回傳 [(request_no, 是否成功, 錯誤)]；沒有可送的單回空串列。"""
    results = []
    for item in order.order_items:
        from . import commerce
        commerce.lock_order(order)
        f = ReportFulfillment.query.filter_by(order_item_id=item.id).with_for_update().first()
        if f is None or f.handoff_status not in ('pending', 'failed'):
            db.session.commit()
            continue
        ok = send(f, actor=actor)
        results.append((f.request_no, ok, f.last_error))
    return results


def view(f):
    if f is None:
        return None
    nxt = next_attempt_at(f) if f.handoff_status == 'failed' else None
    from . import control, progress
    return {
        'progress': progress.view(f),
        'control': control.view(db.session.get(OrderItem, f.order_item_id).order),
        'status': f.handoff_status, 'status_label': HANDOFF_STATUS_LABELS.get(f.handoff_status, f.handoff_status),
        'attempts': f.handoff_attempts or 0, 'error': f.last_error,
        'sent_at': f.sent_at.isoformat() if f.sent_at else None,
        'ziwei_status': f.ziwei_status,
        'next_attempt_at': nxt.isoformat() if nxt else None,
    }
