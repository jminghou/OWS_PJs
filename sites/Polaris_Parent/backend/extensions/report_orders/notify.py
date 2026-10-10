"""
客製報告的訂單通知信（docs/membership-v2-architecture.md §9）。

每封信先寫一筆 shop.order_notifications（dedupe_key 唯一），已寄過就不重寄；
寄信失敗只記錄、不影響訂單。信中不放出生資料，只用訂單編號與主角稱呼辨識。
"""

import os
from datetime import datetime

from flask import current_app
from sqlalchemy.exc import IntegrityError

from core.backend_engine.factory import db
from packages.commerce.models import OrderNotification

POLICY_NOTE = '本報告依你提供的出生資料個別製作，屬客製化商品，不適用七日解除權；付款後不受理取消或退款。'


def _frontend_url():
    return os.environ.get('FRONTEND_URL', 'http://localhost:3000').rstrip('/')


def _order_link(order):
    return f'{_frontend_url()}/report/orders/{order.order_no}'


def _deliver(order, event, recipient, subject, body, key=None):
    key = key or f'{event}:{order.id}'
    note = OrderNotification(order_id=order.id, event=event, dedupe_key=key[:120], recipient=recipient,
                             status='pending', attempts=0)
    db.session.add(note)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return False  # 已寄過（或正在寄）

    note.attempts = 1
    try:
        from flask_mail import Message

        from core.backend_engine.factory import mail

        mail.send(Message(subject=subject, recipients=[recipient],
                          sender=current_app.config.get('MAIL_DEFAULT_SENDER'), body=body))
        note.status, note.sent_at = 'sent', datetime.utcnow()
    except Exception as exc:  # noqa: BLE001
        note.status, note.error = 'failed', str(exc)[:500]
        current_app.logger.warning(f'訂單通知信寄送失敗 {key} → {recipient}：{exc}')
    db.session.commit()
    return note.status == 'sent'


def _item_line(order):
    """品項：一張訂單可能有報告／實體書／專人解讀多個項目。"""
    names = []
    call_name = ''
    for item in order.order_items:
        c = item.customization or {}
        call_name = call_name or (c.get('audience') or {}).get('call_name') or ''
        if item.variant == 'consult':
            names.append(f'{item.name} × {item.quantity} 次')
        elif item.kind == 'addon':
            names.append(f'{item.name} × {item.quantity} 本')
        else:
            names.append(item.name)
    return '品項：' + '、'.join(names) + (f'（{call_name}）' if call_name else '')


def _bank_lines(bank, order):
    deadline = order.checkout.expires_at if order.checkout else None
    lines = [
        '請於期限內轉帳至以下帳戶，完成後到訂單頁回報轉出帳號末五碼：',
        f'銀行：{bank["bank_name"]}（代碼 {bank["bank_code"]}）',
        f'帳號：{bank["account_no"]}',
        f'戶名：{bank["account_name"]}',
        f'金額：NT${order.amount:,}',
    ]
    if deadline:
        lines.append(f'匯款期限：{deadline.strftime("%Y-%m-%d %H:%M")}（UTC）前，逾期未回報訂單將自動取消')
    return lines


def send_order_created(order, recipient, payment_mode, bank=None):
    lines = ['感謝你在親紫之間訂購客製命理報告，訂單已成立。', '',
             f'訂單編號：{order.order_no}', _item_line(order), f'金額：NT${order.amount:,}', '']
    if payment_mode == 'manual' and bank:
        lines += _bank_lines(bank, order) + ['']
    elif payment_mode == 'placeholder':
        lines += ['付款功能尚未開放，目前訂單保留為「待付款」。開放付款後我們會再通知你。', '']
    lines += [f'訂單詳情：{_order_link(order)}', '', POLICY_NOTE]
    return _deliver(order, 'order_created', recipient, f'【親紫之間】訂單成立 {order.order_no}', '\n'.join(lines))


def send_transfer_reported(order, attempt, buyer_email):
    """通知管理者：會員回報了轉帳，請對帳確認。未設定 REPORT_ADMIN_NOTIFY_EMAIL 時不寄。"""
    to = (current_app.config.get('REPORT_ADMIN_NOTIFY_EMAIL') or '').strip()
    if not to:
        return False
    body = '\n'.join([
        '有會員回報了轉帳，請對帳後到後台「人工收款」確認。', '',
        f'訂單編號：{order.order_no}', f'購買者：{buyer_email}', f'訂單金額：NT${order.amount:,}',
        f'回報金額：NT${attempt.amount:,}', f'末五碼：{attempt.manual_reference}',
        f'轉帳日期：{attempt.transferred_on.isoformat() if attempt.transferred_on else "-"}', '',
        f'後台：{_frontend_url()}/admin/report-payments',
    ])
    key = f'transfer_reported:{attempt.id}:{attempt.manual_reference}:{attempt.transferred_on}:{attempt.amount}'
    return _deliver(order, 'transfer_reported', to, f'【親紫之間後台】待確認收款 {order.order_no}', body, key=key)


def send_payment_confirmed(order, recipient):
    kinds = {i.kind for i in order.order_items}
    has_consult = any(i.variant == 'consult' for i in order.order_items)
    if 'purchase' not in kinds:
        intro = '我們已確認收到你的款項。'
        after = '\n'.join(filter(None, [
            '實體書：送印前會請你在訂單頁確認內容，出貨時會再寄信通知你。' if 'addon' in kinds else '',
            '專人解讀：我們會以 Email 或電話跟你約時間。' if has_consult else '',
        ]))
    else:
        intro, after = '我們已確認收到你的款項，報告將開始製作。', '製作完成後會再寄信通知你到會員中心下載。'
    body = '\n'.join([
        intro, '',
        f'訂單編號：{order.order_no}', _item_line(order), f'金額：NT${order.amount:,}', '',
        after,
        f'訂單詳情：{_order_link(order)}',
    ])
    return _deliver(order, 'payment_confirmed', recipient, f'【親紫之間】已確認收款 {order.order_no}', body)


def send_transfer_rejected(order, attempt, recipient):
    body = '\n'.join([
        '你回報的轉帳資料我們無法核對，請確認後重新回報：', '',
        f'訂單編號：{order.order_no}', f'原因：{attempt.review_note}', '',
        f'重新回報：{_order_link(order)}',
        '若有疑問，請直接回信與我們聯絡。',
    ])
    return _deliver(order, 'transfer_rejected', recipient, f'【親紫之間】轉帳資料需要確認 {order.order_no}', body,
                    key=f'transfer_rejected:{attempt.id}')


def send_order_expired(order, recipient):
    body = '\n'.join([
        '你的訂單已超過匯款期限且未收到轉帳回報，已自動取消。', '',
        f'訂單編號：{order.order_no}', _item_line(order), '',
        '若你其實已經轉帳，請直接回信與我們聯絡；也歡迎重新下單。',
    ])
    return _deliver(order, 'order_expired', recipient, f'【親紫之間】訂單已取消 {order.order_no}', body)


# ── 實體書 ───────────────────────────────────────────────────────────────────
def _admin_to():
    return (current_app.config.get('REPORT_ADMIN_NOTIFY_EMAIL') or '').strip()


def send_physical_cancelled(order, job, recipient, by_member):
    refund = job.refund_due
    lines = [('你已取消' if by_member else '我們已為你取消') + '這筆訂單的實體書。', '',
             f'訂單編號：{order.order_no}', _item_line(order), '']
    if refund:
        lines += [f'應退金額：NT${refund:,}。我們會以轉帳退款，完成後再寄信通知你。', '']
    if order.order_items[0].kind != 'addon':
        lines += ['你的數位版報告不受影響，會照常製作與交付。', '']
    if job.cancel_reason and not by_member:
        lines += [f'原因：{job.cancel_reason}', '']
    lines += [f'訂單詳情：{_order_link(order)}']
    sent = _deliver(order, 'physical_cancelled', recipient, f'【親紫之間】實體書已取消 {order.order_no}',
                    '\n'.join(lines), key=f'physical_cancelled:{job.id}')
    to = _admin_to()
    if to and by_member:
        body = '\n'.join(['會員取消了實體書，請確認是否需要退款。', '', f'訂單編號：{order.order_no}',
                          f'購買者：{recipient}', f'應退金額：NT${refund:,}' if refund else '應退金額：無（尚未付款）', '',
                          f'後台：{_frontend_url()}/admin/report-shipments'])
        _deliver(order, 'physical_cancelled_admin', to, f'【親紫之間後台】實體書取消 {order.order_no}', body,
                 key=f'physical_cancelled_admin:{job.id}')
    return sent


def send_physical_shipped(order, shipment, recipient):
    body = '\n'.join([
        '你的實體書已經出貨。', '',
        f'訂單編號：{order.order_no}', _item_line(order),
        f'物流：{shipment.carrier}', f'單號：{shipment.tracking_no}', '',
        f'訂單詳情：{_order_link(order)}',
    ])
    return _deliver(order, 'physical_shipped', recipient, f'【親紫之間】實體書已出貨 {order.order_no}', body,
                    key=f'physical_shipped:{shipment.id}')


def send_refund_recorded(order, job, recipient):
    body = '\n'.join([
        '我們已完成退款。', '',
        f'訂單編號：{order.order_no}', f'退款金額：NT${job.refund_amount:,}',
        *( [f'說明：{job.refund_note}'] if job.refund_note else [] ), '',
        '若一週內沒有收到款項，請直接回信與我們聯絡。',
    ])
    return _deliver(order, 'refund_recorded', recipient, f'【親紫之間】退款完成 {order.order_no}', body,
                    key=f'refund_recorded:{job.id}')


# ── 專人解讀 ─────────────────────────────────────────────────────────────────
def _fmt_time(dt):
    # 存的是含時區的時間；信件以台灣時間顯示
    from datetime import timedelta, timezone
    return dt.astimezone(timezone(timedelta(hours=8))).strftime('%Y-%m-%d %H:%M') if dt else '-'


def send_consult_scheduled(order, consult, recipient):
    body = '\n'.join([
        '你的專人解讀時間已經確認：', '',
        f'時間：{_fmt_time(consult.scheduled_at)}（台灣時間）',
        f'長度：{consult.minutes * consult.sessions} 分鐘',
        *([f'說明：{consult.admin_note}'] if consult.admin_note else []), '',
        f'訂單編號：{order.order_no}',
        '如需更改時間，請直接回覆這封信。',
    ])
    key = f'consult_scheduled:{consult.id}:{consult.scheduled_at.isoformat() if consult.scheduled_at else ""}'
    return _deliver(order, 'consult_scheduled', recipient, f'【親紫之間】專人解讀時間確認 {order.order_no}', body, key=key)


def send_consult_cancelled(order, consult, recipient):
    lines = ['你的專人解讀已取消。', '', f'訂單編號：{order.order_no}']
    if consult.refund_due:
        lines += [f'應退金額：NT${consult.refund_due:,}。我們會以轉帳退款，完成後再寄信通知你。']
    return _deliver(order, 'consult_cancelled', recipient, f'【親紫之間】專人解讀已取消 {order.order_no}',
                    '\n'.join(lines), key=f'consult_cancelled:{consult.id}')


def send_consult_refunded(order, consult, recipient):
    body = '\n'.join([
        '我們已完成退款。', '',
        f'訂單編號：{order.order_no}', f'退款金額：NT${consult.refund_amount:,}',
        *([f'說明：{consult.refund_note}'] if consult.refund_note else []), '',
        '若一週內沒有收到款項，請直接回信與我們聯絡。',
    ])
    return _deliver(order, 'consult_refunded', recipient, f'【親紫之間】退款完成 {order.order_no}', body,
                    key=f'consult_refunded:{consult.id}')
