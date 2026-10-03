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


def _frontend_url():
    return os.environ.get('FRONTEND_URL', 'http://localhost:3000').rstrip('/')


def _deliver(order, event, recipient, subject, body):
    key = f'{event}:{order.id}'
    note = OrderNotification(order_id=order.id, event=event, dedupe_key=key, recipient=recipient,
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


def send_order_created(order, recipient, payment_mode):
    item = order.order_items[0]
    call_name = ((item.customization or {}).get('audience') or {}).get('call_name') or ''
    lines = [
        '感謝你在親紫之間訂購客製命理報告，訂單已成立。',
        '',
        f'訂單編號：{order.order_no}',
        f'品項：{item.name}' + (f'（{call_name}）' if call_name else ''),
        f'金額：NT${order.amount:,}',
        '',
    ]
    if payment_mode == 'placeholder':
        lines += ['付款功能尚未開放，目前訂單保留為「待付款」。開放付款後我們會再通知你。', '']
    lines += [
        f'訂單詳情：{_frontend_url()}/report/orders/{order.order_no}',
        '',
        '本報告依你提供的出生資料個別製作，屬客製化商品，不適用七日解除權；付款後不受理取消或退款。',
    ]
    return _deliver(order, 'order_created', recipient, f'【親紫之間】訂單成立 {order.order_no}', '\n'.join(lines))
