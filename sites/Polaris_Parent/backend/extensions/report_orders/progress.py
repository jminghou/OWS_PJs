"""Read-only production polling. Never grants rights or publishes a document."""
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from urllib.parse import quote

from core.backend_engine.factory import db
from packages.commerce.models import Order, OrderItem
from sites.Polaris_Parent.backend.models import ReportFulfillment

KEY = 'production_sync'
LABELS = {'queued': '待製作', 'in_progress': '製作中', 'needs_info': '待補資料',
          'completed': '製作已完成，待交付', 'failed': '製作待處理', 'cancelled': '製作已取消'}


def utc(value):
    parsed = datetime.fromisoformat(value.replace('Z', '+00:00')) if isinstance(value, str) else value
    if parsed.tzinfo is None:
        raise ValueError('progress timestamp must include timezone')
    return parsed.astimezone(timezone.utc)


def state(order, f):
    return deepcopy(((order.attributes or {}).get(KEY) or {}).get(f.request_no) or {})


def view(f, public=False):
    if f is None:
        return None
    order = db.session.get(OrderItem, f.order_item_id).order
    s = state(order, f)
    result = dict(status=f.ziwei_status, status_label=LABELS.get(f.ziwei_status),
                  member_note=f.member_note, last_synced_at=s.get('last_synced_at'),
                  stale=not s.get('last_synced_at') or bool(s.get('error')) or
                  datetime.now(timezone.utc) - utc(s['last_synced_at']) > timedelta(minutes=15))
    if not public:
        result.update(error=s.get('error'), attempts=s.get('attempts', 0), next_attempt_at=s.get('next_attempt_at'))
    return result


def sync_one(fid):
    from . import handoff, commerce
    f = db.session.get(ReportFulfillment, fid)
    if f is None or f.handoff_status != 'sent':
        return False
    item = db.session.get(OrderItem, f.order_item_id)
    oid, owner, request_no = item.order_id, f.member_id, f.request_no
    order_no, language = item.order.order_no, item.order.language
    db.session.commit()  # no database locks during HTTP
    error = None
    remote = None
    stamp = None
    try:
        data, err = handoff._ziwei_call('GET', f'/public/report-requests/{quote(request_no, safe="")}')
        if err:
            raise ValueError('製作端暫時無法取得進度')
        remote = (data or {}).get('request') or {}
        if (remote.get('request_no') != request_no or remote.get('order_no') != order_no
                or str(remote.get('member_id')) != str(owner) or remote.get('language') != language
                or remote.get('status') not in LABELS):
            raise ValueError('工作單歸屬、語言或狀態不符')
        stamp = utc(remote.get('updated_at'))
        if stamp > datetime.now(timezone.utc) + timedelta(minutes=5):
            raise ValueError('製作端時間異常')
        note = remote.get('member_note')
        if note is not None and (not isinstance(note, str) or len(note) > 4000):
            raise ValueError('會員進度說明格式不符')
    except Exception:
        error = '製作進度同步失敗，請確認製作端連線、工作單歸屬及資料格式'
    order = commerce.lock_order(db.session.get(Order, oid))
    f = ReportFulfillment.query.filter_by(id=fid).populate_existing().with_for_update().one()
    if f.member_id != owner or f.request_no != request_no or f.handoff_status != 'sent':
        db.session.commit()
        return False  # claim/cancellation changed while request was in flight
    s = state(order, f)
    now = datetime.now(timezone.utc)
    if not error and s.get('remote_updated_at') and stamp < utc(s['remote_updated_at']):
        error = '製作端回傳較舊進度，已保留目前狀態'
    if not error and s.get('remote_updated_at') and stamp == utc(s['remote_updated_at']) and (
            f.ziwei_status != remote['status'] or f.member_note != remote.get('member_note')):
        error = '同一版本的製作進度內容不一致'
    if error:
        s['attempts'] = s.get('attempts', 0) + 1
        s['error'] = error
        delay = min(3600, 60 * 2 ** min(s['attempts'], 6))
    else:
        f.ziwei_status, f.member_note, f.synced_at = remote['status'], remote.get('member_note'), now
        s.update(remote_updated_at=stamp.isoformat(), last_synced_at=now.isoformat(), attempts=0, error=None)
        delay = 300
    s['next_attempt_at'] = (now + timedelta(seconds=delay)).isoformat()
    all_states = deepcopy((order.attributes or {}).get(KEY) or {})
    all_states[request_no] = s
    order.attributes = {**(order.attributes or {}), KEY: all_states}
    db.session.commit()
    return error is None


def sync_due(limit=20):
    now = datetime.now(timezone.utc)
    candidates = []
    for f in ReportFulfillment.query.filter_by(handoff_status='sent').order_by(ReportFulfillment.id).all():
        order = db.session.get(OrderItem, f.order_item_id).order
        s = state(order, f)
        if s.get('next_attempt_at') and utc(s['next_attempt_at']) > now:
            continue
        candidates.append((utc(s['next_attempt_at']) if s.get('next_attempt_at') else
                           datetime.min.replace(tzinfo=timezone.utc), f.id))
    # Oldest due first so a full batch cannot starve later work requests.
    ids = [fid for _, fid in sorted(candidates)[:max(0, limit)]]
    db.session.commit()
    results = [sync_one(fid) for fid in ids]
    return {'synced': sum(results), 'failed': len(results) - sum(results)}
