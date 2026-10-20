"""
後台訂單總覽與訂單詳細（階段 1 ④，2026-10-20）。

既有的「人工收款／報告交付／實體書出貨／專人解讀」是各自的工作清單；這裡是一張訂單的全貌：
搜尋（訂單編號、項目編號、會員 Email、主角姓名）、每筆訂單「現在卡在誰手上」的待辦，
以及詳細頁的付款紀錄、報告檔、實體書、專人解讀、相關訂單與時間軸（audit.timeline）。
"""

from sqlalchemy import or_

from core.backend_engine.factory import db
from core.backend_engine.models import User
from packages.commerce.models import Order, OrderItem, PaymentAttempt
from sites.Polaris_Parent.backend.models import ReportDocument, ReportFulfillment

from . import audit, handoff, money, physical, service

ORDER_STATUS_LABELS = {'pending': '待付款', 'paid': '已付款', 'cancelled': '已取消', 'refunded': '已退款'}

# 待辦 → 後台哪一頁處理
_WORK_PAGES = {
    'confirm_payment': '/admin/report-payments', 'handoff': '/admin/report-deliveries',
    'upload_report': '/admin/report-deliveries', 'proof': '/admin/report-shipments',
    'print': '/admin/report-shipments', 'ship': '/admin/report-shipments', 'refund': '/admin/report-shipments',
    'consult': '/admin/report-consultations', 'consult_refund': '/admin/report-consultations',
}


def _todo(key, label, waiting_on='admin'):
    return {'key': key, 'label': label, 'waiting_on': waiting_on, 'href': _WORK_PAGES.get(key)}


def todos(order, summary):
    """這張訂單現在要做的事。waiting_on：admin（要你處理）／member（等會員）。"""
    out = []
    if order.status == 'pending':
        transfer = ((summary.get('payment') or {}).get('transfer') or {})
        if transfer.get('status') == 'created':
            out.append(_todo('confirm_payment', '會員已回報轉帳，待確認收款'))
        else:
            out.append(_todo('wait_payment', '等待會員付款', 'member'))
        return out
    if order.status != 'paid':
        p = summary.get('physical') or {}
        if p.get('status') == 'cancelled' and p.get('refund_due') and not p.get('refunded_at'):
            out.append(_todo('refund', f'實體書待退款 {money.fmt(p["refund_due"], order.currency)}'))
        return out
    item = summary.get('item') or {}
    if item.get('kind') == 'purchase':
        prod = summary.get('production') or {}
        if prod.get('handoff_status') == 'failed':
            out.append(_todo('handoff', '送紫微建工作單失敗'))
        if not summary.get('report'):
            out.append(_todo('upload_report', '報告製作中，完成後上傳 PDF'))
    p = summary.get('physical') or {}
    st = p.get('status')
    if st == 'awaiting_customization' and p.get('report_ready'):
        out.append(_todo('design', '等會員設計實體書', 'member'))
    elif st in ('awaiting_proof', 'changes_requested'):
        out.append(_todo('proof', '待出打樣' if st == 'awaiting_proof' else '會員要求修改，待出下一版打樣'))
    elif st == 'proof_ready':
        out.append(_todo('proof_wait', '等會員確認打樣', 'member'))
    elif st == 'approved':
        out.append(_todo('print', '已確認打樣，待送印'))
    elif st == 'printing':
        out.append(_todo('ship', '印製中，待登錄出貨'))
    elif st == 'cancelled' and p.get('refund_due') and not p.get('refunded_at'):
        out.append(_todo('refund', f'實體書待退款 {money.fmt(p["refund_due"], order.currency)}'))
    c = summary.get('consult') or {}
    if c.get('status') == 'to_schedule':
        out.append(_todo('consult', '待安排專人解讀時間'))
    elif c.get('status') == 'cancelled' and c.get('refund_due') and not c.get('refunded_at'):
        out.append(_todo('consult_refund', f'專人解讀待退款 {money.fmt(c["refund_due"], order.currency)}'))
    return out


def _buyer_email(order):
    u = db.session.get(User, order.user_id)
    return (u.email or u.username) if u else None


def row(order):
    s = service.order_summary(order)
    item = s.get('item') or {}
    return {
        'order_no': order.order_no, 'status': order.status,
        'status_label': ORDER_STATUS_LABELS.get(order.status, order.status),
        'amount': order.amount, 'currency': order.currency, 'created_at': s.get('created_at'), 'paid_at': s.get('paid_at'),
        'buyer_email': _buyer_email(order), 'kind': item.get('kind'),
        'subject_name': item.get('subject_name'), 'call_name': item.get('call_name'),
        'parent_order_no': item.get('parent_order_no'),
        'lines': [ln['name'] for ln in s.get('lines') or []],
        'physical_status': (s.get('physical') or {}).get('status_label'),
        'consult_status': (s.get('consult') or {}).get('status_label'),
        'report_ready': bool(s.get('report')),
        'todos': todos(order, s),
    }


def search(q=None, status='all', needs='all', limit=100):
    """needs：all／admin（要你處理）／member（等會員）。最新的在前。"""
    from . import ORDER_LIST_PAYMENT_MODES
    query = Order.query.filter(Order.payment_method.in_(ORDER_LIST_PAYMENT_MODES))
    if status in ORDER_STATUS_LABELS:
        query = query.filter(Order.status == status)
    q = (q or '').strip()
    if q:
        like = f'%{q}%'
        users = db.session.query(User.id).filter(or_(User.email.ilike(like), User.username.ilike(like)))
        # 取 JSON 欄位比對（整欄轉文字在 SQLite 會變成 \uXXXX 跳脫，中文比不到）
        items = db.session.query(OrderItem.order_id).filter(or_(
            OrderItem.item_no.ilike(like),
            OrderItem.customization['subject_name'].as_string().ilike(like),
            OrderItem.customization['audience']['call_name'].as_string().ilike(like)))
        query = query.filter(or_(Order.order_no.ilike(like), Order.user_id.in_(users), Order.id.in_(items)))
    orders = [o for o in query.order_by(Order.id.desc()).limit(300).all() if o.order_items]
    rows = [row(o) for o in orders]
    if needs in ('admin', 'member'):
        rows = [r for r in rows if any(t['waiting_on'] == needs for t in r['todos'])]
    counts = {'admin': 0, 'member': 0}
    for r in rows:
        for who in {t['waiting_on'] for t in r['todos']}:
            counts[who] += 1
    return rows[:limit], counts


def _related(order, summary):
    out = []
    item = summary.get('item') or {}
    if item.get('parent_order_no'):
        parent = Order.query.filter_by(order_no=item['parent_order_no']).first()
        if parent is not None:
            out.append({'relation': '原報告訂單', 'order_no': parent.order_no,
                        'status_label': ORDER_STATUS_LABELS.get(parent.status, parent.status)})
    for child in summary.get('addons') or []:
        out.append({'relation': '加購訂單', 'order_no': child['order_no'],
                    'status_label': ORDER_STATUS_LABELS.get(child.get('order_status'), child.get('order_status'))})
    return out


def detail(order):
    s = service.order_summary(order)
    report_item = next((i for i in order.order_items if i.kind == 'purchase'), None)
    f = ReportFulfillment.query.filter_by(order_item_id=report_item.id).first() if report_item else None
    docs = (ReportDocument.query.filter_by(order_item_id=report_item.id).order_by(ReportDocument.id).all()
            if report_item else [])
    attempts = PaymentAttempt.query.filter_by(order_id=order.id).order_by(PaymentAttempt.id).all()
    p_item = physical.physical_item(order)
    job = physical.print_job_for(p_item) if p_item is not None else None
    return {
        **row(order),
        'summary': s,
        'handoff': handoff.view(f),
        'documents': [{'filename': d.filename, 'bytes': d.bytes, 'is_current': d.is_current,
                       'uploaded_at': d.created_at.isoformat() if d.created_at else None} for d in docs],
        'payments': [{'attempt_no': a.attempt_no, 'provider': a.provider, 'status': a.status, 'amount': a.amount,
                      'manual_reference': a.manual_reference,
                      'transferred_on': a.transferred_on.isoformat() if a.transferred_on else None,
                      'paid_at': a.paid_at.isoformat() if a.paid_at else None, 'review_note': a.review_note}
                     for a in attempts],
        'print_job_id': job.id if job is not None else None,
        'related': _related(order, s),
        'timeline': audit.timeline(order),
    }
