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
    item = order.order_items[0]
    call_name = ((item.customization or {}).get('audience') or {}).get('call_name') or ''
    return f'品項：{item.name}' + (f'（{call_name}）' if call_name else '')


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
    body = '\n'.join([
        '我們已確認收到你的款項，報告將開始製作。', '',
        f'訂單編號：{order.order_no}', _item_line(order), f'金額：NT${order.amount:,}', '',
        '製作完成後會再寄信通知你到會員中心下載。',
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
