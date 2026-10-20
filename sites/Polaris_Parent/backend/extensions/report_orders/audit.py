"""
訂單稽核紀錄與時間軸（階段 1 ④，2026-10-20）。

事件寫在既有的 shop.commerce_events（只增不改、event_key 唯一），不另建表：契約層本來就在那裡記
建單、付款、資格發放與任務開始／完成；這裡補上營運動作——付款回報與退件、逾期取消、紫微交接、上傳報告、
設計確認、打樣、送印、出貨、送達、取消、退款、專人解讀、管理者備註。
log() 只 add 不 commit，與動作本身同一個交易：動作成功就一定有紀錄，失敗回滾就一起不見。

時間軸（timeline）＝這張訂單的事件＋寄出的通知信，依時間排序；操作人分成會員／管理者／系統。
"""

import uuid
from datetime import timezone

from core.backend_engine.factory import db
from core.backend_engine.models import User
from packages.commerce.models import OrderNotification
from sites.Polaris_Parent.backend.commerce_models import CommerceEvent

from . import commerce


def log(order, event_type, actor=None, ref=None, **detail):
    """記一筆稽核事件（不 commit）。ref 相同的同一種事件只記一次；不給 ref 就每次都記。"""
    key = f'audit:{event_type}:{order.id}:{ref if ref is not None else uuid.uuid4().hex}'
    commerce.event(order, key[:160], event_type[:40], actor, None, **detail)


def _nt(v, d=None):
    from . import money
    return money.fmt(v, (d or {}).get('_currency') or 'TWD') if isinstance(v, int) else '-'


# 事件類型 → 顯示文字（d＝detail）
LABELS = {
    # 契約層（commerce.py）
    'order_created': lambda d: '建立訂單',
    'payment_confirmed': lambda d: '確認收款',
    'external_sale_confirmed': lambda d: '確認外部平台成交',
    'entitlement_issued': lambda d: '發放製作資格',
    'task_started': lambda d: '開始製作',
    'task_completed': lambda d: '製作完成',
    'entitlement_revoked': lambda d: f'撤銷製作資格（{d.get("reason") or "-"}）',
    'activation_issued': lambda d: '發出啟用碼',
    'activation_redeemed': lambda d: '兌換啟用碼',
    'activation_revoked': lambda d: '作廢啟用碼',
    'order_backfilled': lambda d: '補建交易紀錄（歷史訂單）',
    'external_contract_bound': lambda d: '綁定外部成交',
    'external_evidence_voided': lambda d: '作廢外部成交證據',
    # 營運動作（本模組）
    'transfer_reported': lambda d: f'會員回報轉帳 {_nt(d.get("amount"), d)}（轉帳日 {d.get("transferred_on") or "-"}）',
    'transfer_rejected': lambda d: f'退回轉帳回報：{d.get("reason") or "-"}',
    'order_expired': lambda d: '逾期未付款，自動取消',
    'handoff_sent': lambda d: f'已在紫微系統建立工作單（第 {d.get("attempt")} 次送出）',
    'handoff_failed': lambda d: f'送紫微建工作單失敗（第 {d.get("attempt")} 次）：{d.get("error") or "-"}',
    'report_uploaded': lambda d: f'{"上傳更正版報告" if d.get("correction") else "上傳報告 PDF"}：{d.get("filename") or "-"}',
    'design_confirmed': lambda d: '會員確認實體書設計內容',
    'proof_uploaded': lambda d: f'上傳第 {d.get("version")} 版打樣',
    'proof_approved': lambda d: f'會員確認第 {d.get("version")} 版打樣送印',
    'proof_changes_requested': lambda d: f'會員要求修改第 {d.get("version")} 版打樣：{d.get("comment") or "-"}',
    'proof_auto_approved': lambda d: f'第 {d.get("version")} 版打樣超過期限，自動確認送印',
    'proof_admin_approved': lambda d: f'代為確認第 {d.get("version")} 版打樣送印：{d.get("comment") or "-"}',
    'proof_revision_granted': lambda d: '多給一次打樣修改',
    'print_started': lambda d: '標記送印',
    'print_shipped': lambda d: f'登錄出貨：{d.get("carrier") or "-"} {d.get("tracking_no") or ""}',
    'print_delivered': lambda d: '標記送達',
    'physical_cancelled': lambda d: (f'{"會員" if d.get("by") == "member" else "管理者"}取消實體書'
                                     + (f'：{d["reason"]}' if d.get('reason') else '')
                                     + (f'（應退 {_nt(d.get("refund_due"), d)}）' if d.get('refund_due') else '')),
    'refund_recorded': lambda d: f'登錄退款 {_nt(d.get("amount"), d)}' + (f'：{d["note"]}' if d.get('note') else ''),
    'consult_preferences': lambda d: '會員填寫專人解讀方便的時段',
    'consult_scheduled': lambda d: f'安排專人解讀時間 {d.get("scheduled_at") or "-"}',
    'consult_completed': lambda d: '專人解讀完成',
    'consult_cancelled': lambda d: f'取消專人解讀：{d.get("reason") or "-"}',
    'admin_note': lambda d: f'備註：{d.get("note") or ""}',
    'proxy_order_created': lambda d: f'代客建單：{d.get("channel") or "-"} 訂單 {d.get("external_order_id") or "-"}（客人 {d.get("customer") or "-"}）',
    'proxy_order_failed': lambda d: '代客建單失敗，已取消這張未完成的訂單',
    'source_added': lambda d: f'追加資料來源（{ {"conversation": "對話摘錄", "link": "對話連結", "screenshot": "對話截圖", "note": "說明"}.get(d.get("kind"), d.get("kind")) }）',
    'delivered_via_platform': lambda d: '已透過平台把報告交給客人' + (f'：{d["note"]}' if d.get('note') else ''),
}


def label(event_type, detail):
    fn = LABELS.get(event_type)
    try:
        return fn(detail or {}) if fn else event_type
    except Exception:  # noqa: BLE001 — 舊事件的 detail 不完整也要顯示得出來
        return event_type


def _utc(dt):
    if dt is None:
        return None
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt.astimezone(timezone.utc)


def timeline(order):
    """這張訂單的時間軸：稽核事件＋通知信，依時間排序（舊→新）。"""
    from .notify import EVENT_LABELS as MAIL_LABELS

    events = CommerceEvent.query.filter_by(order_id=order.id).all()
    mails = OrderNotification.query.filter_by(order_id=order.id).all()
    actor_ids = {e.actor_id for e in events if e.actor_id}
    names = {u.id: (u.email or u.username) for u in User.query.filter(User.id.in_(actor_ids)).all()} if actor_ids else {}
    rows = []
    for e in events:
        if e.actor_id is None:
            kind = 'system'
        elif e.actor_id == order.user_id:
            kind = 'member'
        else:
            kind = 'admin'
        rows.append({'at': _utc(e.created_at), 'kind': 'event', 'type': e.event_type,
                     'text': label(e.event_type, {**(e.detail or {}), '_currency': order.currency}), 'actor': kind,
                     'actor_name': names.get(e.actor_id) if e.actor_id else None, 'id': e.id})
    for n in mails:
        rows.append({'at': _utc(n.sent_at or n.created_at), 'kind': 'mail', 'type': n.event,
                     'text': f'寄信：{MAIL_LABELS.get(n.event, n.event)}', 'actor': 'system', 'actor_name': None,
                     'recipient': n.recipient, 'status': n.status, 'id': n.id})
    rows.sort(key=lambda r: (r['at'] is None, r['at'] or 0, 0 if r['kind'] == 'event' else 1, r['id']))
    for r in rows:
        r['at'] = r['at'].isoformat() if r['at'] else None
    return rows


def add_note(order, admin_id, note):
    """管理者在訂單上加內部備註（不會給會員看）。"""
    from .service import OrderError
    note = (note or '').strip()
    if not note:
        raise OrderError('請輸入備註內容', 400, 'invalid')
    log(order, 'admin_note', admin_id, note=note[:1000])
    db.session.commit()
