"""
客製報告的訂單通知信（docs/membership-v2-architecture.md §9）。

每封信先寫一筆 shop.order_notifications（dedupe_key 唯一），已寄過就不重寄；
標題與內文同時存進 shop.report_mail_outbox，當下立刻寄一次。寄失敗不影響訂單：
依 RETRY_BACKOFF 由背景排程（jobs.py）自動重寄，次數用完就停並通知管理者；後台也可以手動重寄。
信中不放出生資料，只用訂單編號與主角稱呼辨識。
"""

import os
from datetime import datetime, timedelta

from flask import current_app
from sqlalchemy.exc import IntegrityError

from core.backend_engine.factory import db
from packages.commerce.models import Order, OrderNotification
from sites.Polaris_Parent.backend.models import ReportMailOutbox

from . import money

# 第 n 次寄失敗後，隔多久再試；用完（共 MAX_ATTEMPTS 次）就停，並通知管理者
RETRY_BACKOFF = (timedelta(minutes=5), timedelta(minutes=15), timedelta(hours=1), timedelta(hours=4),
                 timedelta(hours=12))
MAX_ATTEMPTS = len(RETRY_BACKOFF) + 1
# 剛寫入、當下寄送中的信：若程序在寄送途中被中止（部署、當機），排程在這段時間後接手
INFLIGHT_GRACE = timedelta(minutes=10)
# 不再重試的信，內文保留多久供後台查看與手動重寄；之後清除內文，只留帳本
BODY_RETENTION = timedelta(days=30)

EVENT_LABELS = {
    'order_created': '訂單成立', 'payment_reminder': '匯款期限提醒', 'transfer_reported': '待確認收款（後台）',
    'payment_confirmed': '已確認收款', 'transfer_rejected': '轉帳資料需確認', 'order_expired': '逾期取消',
    'report_ready': '報告完成', 'design_confirmed': '實體書內容已確認（後台）',
    'physical_cancelled': '實體書取消', 'physical_cancelled_admin': '實體書取消（後台）',
    'physical_shipped': '實體書出貨', 'refund_recorded': '退款完成',
    'consult_preferences': '解讀時段（後台）', 'consult_scheduled': '解讀時間確認',
    'consult_cancelled': '解讀取消', 'consult_refunded': '解讀退款', 'mail_failed_admin': '寄信失敗警示（後台）',
    'handoff_failed_admin': '報告交接失敗（後台）',
    'proof_ready': '打樣待確認', 'proof_reminder': '打樣確認提醒', 'proof_auto_approved': '打樣自動確認送印',
    'proof_changes_admin': '會員要求修改打樣（後台）', 'proof_approved_admin': '打樣已確認送印（後台）',
}

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
        db.session.flush()
    except IntegrityError:
        db.session.rollback()
        return False  # 已寄過（或正在寄）
    if _undeliverable(recipient):
        # 代客建單的外部客人沒有信箱（保留網域 .invalid）：記一筆「已略過」就好，不重試、不發警示
        note.status, note.error = 'skipped', '外部平台客人沒有信箱（代客建單），不寄送'
        db.session.commit()
        return False
    db.session.add(ReportMailOutbox(notification_id=note.id, subject=subject, body=body,
                                    next_attempt_at=datetime.utcnow() + INFLIGHT_GRACE))
    db.session.commit()
    return attempt(note)


def _undeliverable(recipient):
    """.invalid 是保留網域（RFC 2606），永遠收不到信；代客建單的客人帳號用它。"""
    return str(recipient or '').strip().lower().endswith('.invalid')


def outbox_of(note):
    return ReportMailOutbox.query.filter_by(notification_id=note.id).first()


def attempt(note, now=None):
    """寄一次。成功標 sent；失敗依 RETRY_BACKOFF 排下次重試，次數用完就停並通知管理者。回傳是否已寄出。

    note 必須已存進資料庫。沒有 outbox（0014 之前的舊信）或內文已清除的信無法重寄，原樣回傳。
    """
    now = now or datetime.utcnow()
    box = outbox_of(note)
    if box is None or box.body is None:
        return note.status == 'sent'
    note.attempts = (note.attempts or 0) + 1
    box.last_attempt_at = now
    exhausted = False
    try:
        from flask_mail import Message

        from core.backend_engine.factory import mail

        mail.send(Message(subject=box.subject, recipients=[note.recipient],
                          sender=current_app.config.get('MAIL_DEFAULT_SENDER'), body=box.body))
        note.status, note.sent_at, note.error = 'sent', now, None
        box.next_attempt_at = None
    except Exception as exc:  # noqa: BLE001
        note.status, note.error = 'failed', str(exc)[:500]
        if note.attempts < MAX_ATTEMPTS:
            box.next_attempt_at = now + RETRY_BACKOFF[note.attempts - 1]
            current_app.logger.warning(f'訂單通知信寄送失敗（第 {note.attempts} 次，'
                                       f'{box.next_attempt_at:%H:%M} UTC 重試）{note.dedupe_key}：{exc}')
        else:
            box.next_attempt_at, exhausted = None, True
            # ERROR 等級會進 Sentry
            current_app.logger.error(f'訂單通知信寄送 {note.attempts} 次仍失敗，已停止重試 {note.dedupe_key}：{exc}')
    db.session.commit()
    if exhausted:
        _alert_exhausted(note)
    return note.status == 'sent'


def _alert_exhausted(note):
    """重試用完：寄一封警示給管理者（警示信自己失敗不再警示，避免循環）。"""
    to = _admin_to()
    order = db.session.get(Order, note.order_id)
    if note.event == 'mail_failed_admin' or not to or order is None:
        return False
    body = '\n'.join([
        f'有一封訂單通知信重試 {note.attempts} 次仍寄不出去，系統已停止自動重試。', '',
        f'訂單編號：{order.order_no}', f'信件：{EVENT_LABELS.get(note.event, note.event)}',
        f'收件者：{note.recipient}', f'錯誤：{note.error or "-"}', '',
        '確認問題排除後，可以到後台「寄信紀錄」手動重寄：',
        f'{_frontend_url()}/admin/report-notifications',
    ])
    return _deliver(order, 'mail_failed_admin', to, f'【親紫之間後台】通知信寄送失敗 {order.order_no}', body,
                    key=f'mail_failed:{note.id}')


def retry_due(now=None, limit=50):
    """背景排程：重寄到期的信。逐筆上鎖（Postgres 會略過別人正在處理的列），回傳 (寄出, 仍失敗)。"""
    now = now or datetime.utcnow()
    ids = [row[0] for row in (
        db.session.query(OrderNotification.id)
        .join(ReportMailOutbox, ReportMailOutbox.notification_id == OrderNotification.id)
        .filter(OrderNotification.status != 'sent', ReportMailOutbox.next_attempt_at.isnot(None),
                ReportMailOutbox.next_attempt_at <= now)
        .order_by(ReportMailOutbox.next_attempt_at).limit(limit).all())]
    db.session.commit()
    sent = failed = 0
    for nid in ids:
        note = OrderNotification.query.filter_by(id=nid).with_for_update(skip_locked=True).first()
        box = outbox_of(note) if note is not None else None
        if (note is None or note.status == 'sent' or box is None or box.next_attempt_at is None
                or box.next_attempt_at > now):
            db.session.commit()  # 已被別人處理：放掉鎖
            continue
        if attempt(note, now):
            sent += 1
        else:
            failed += 1
    return sent, failed


def resend(note_id):
    """後台手動重寄（不受重試次數限制）。回傳是否寄出；不能重寄時丟 ValueError。"""
    note = OrderNotification.query.filter_by(id=note_id).with_for_update().first()
    if note is None:
        db.session.commit()
        raise LookupError('找不到這封信')
    box = outbox_of(note)
    if note.status == 'sent':
        db.session.commit()
        raise ValueError('這封信已經寄出')
    if box is None or box.body is None:
        db.session.commit()
        raise ValueError('這封信沒有保留內文（較舊或已超過保留期限），無法重寄')
    return attempt(note)


def purge_bodies(now=None):
    """清除不再重試、且超過保留期限的信件內文（帳本保留）。回傳筆數。"""
    cutoff = (now or datetime.utcnow()) - BODY_RETENTION
    n = (ReportMailOutbox.query
         .filter(ReportMailOutbox.next_attempt_at.is_(None), ReportMailOutbox.body.isnot(None),
                 ReportMailOutbox.created_at < cutoff)
         .update({ReportMailOutbox.body: None}, synchronize_session=False))
    db.session.commit()
    return n


def _iso(dt):
    return dt.isoformat() if dt else None


def notification_view(note, box=None, order_no=None, with_body=False):
    box = box if box is not None else outbox_of(note)
    view = {
        'id': note.id, 'order_no': order_no, 'event': note.event,
        'event_label': EVENT_LABELS.get(note.event, note.event), 'recipient': note.recipient,
        'status': note.status, 'attempts': note.attempts, 'max_attempts': MAX_ATTEMPTS, 'error': note.error,
        'created_at': _iso(note.created_at), 'sent_at': _iso(note.sent_at),
        'subject': box.subject if box else None,
        'next_attempt_at': _iso(box.next_attempt_at) if box else None,
        'last_attempt_at': _iso(box.last_attempt_at) if box else None,
        'can_resend': bool(box is not None and box.body is not None and note.status != 'sent'),
    }
    if with_body:
        view['body'] = box.body if box else None
    return view


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
            from .physical import print_job_for
            job = print_job_for(item)
            copies = (job.pricing or {}).get('quantity', item.quantity) if job else item.quantity
            names.append(f'{item.name} × {copies} 本')
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
        f'金額：{money.fmt(order.amount, order.currency)}',
    ]
    if deadline:
        lines.append(f'匯款期限：{_fmt_time(deadline)}（台灣時間）前，逾期未回報訂單將自動取消')
    return lines


def send_order_created(order, recipient, payment_mode, bank=None):
    lines = ['感謝你在親紫之間訂購客製命理報告，訂單已成立。', '',
             f'訂單編號：{order.order_no}', _item_line(order), f'金額：{money.fmt(order.amount, order.currency)}', '']
    if payment_mode == 'manual' and bank:
        lines += _bank_lines(bank, order) + ['']
    elif payment_mode == 'placeholder':
        lines += ['付款功能尚未開放，目前訂單保留為「待付款」。開放付款後我們會再通知你。', '']
    lines += [f'訂單詳情：{_order_link(order)}', '', POLICY_NOTE]
    return _deliver(order, 'order_created', recipient, f'【親紫之間】訂單成立 {order.order_no}', '\n'.join(lines))


def send_payment_reminder(order, recipient, bank):
    """背景排程：匯款期限前提醒（會員還沒回報轉帳）。每張訂單只寄一次。"""
    lines = ['提醒你：這筆訂單還沒有收到轉帳回報，期限到了訂單會自動取消。', '',
             f'訂單編號：{order.order_no}', _item_line(order), ''] + _bank_lines(bank, order) + [
             '', f'回報轉帳：{_order_link(order)}', '', '若你已經轉帳，回報末五碼後我們就會開始對帳。']
    return _deliver(order, 'payment_reminder', recipient, f'【親紫之間】匯款期限提醒 {order.order_no}',
                    '\n'.join(lines), key=f'payment_reminder:{order.id}')


def send_transfer_reported(order, attempt, buyer_email):
    """通知管理者：會員回報了轉帳，請對帳確認。未設定 REPORT_ADMIN_NOTIFY_EMAIL 時不寄。"""
    to = (current_app.config.get('REPORT_ADMIN_NOTIFY_EMAIL') or '').strip()
    if not to:
        return False
    body = '\n'.join([
        '有會員回報了轉帳，請對帳後到後台「人工收款」確認。', '',
        f'訂單編號：{order.order_no}', f'購買者：{buyer_email}', f'訂單金額：{money.fmt(order.amount, order.currency)}',
        f'回報金額：{money.fmt(attempt.amount, order.currency)}', f'末五碼：{attempt.manual_reference}',
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
        f'訂單編號：{order.order_no}', _item_line(order), f'金額：{money.fmt(order.amount, order.currency)}', '',
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
        lines += [f'應退金額：{money.fmt(refund, order.currency)}。我們會以轉帳退款，完成後再寄信通知你。', '']
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
                          f'購買者：{recipient}', f'應退金額：{money.fmt(refund, order.currency)}' if refund else '應退金額：無（尚未付款）', '',
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
        f'訂單編號：{order.order_no}', f'退款金額：{money.fmt(job.refund_amount, order.currency)}',
        *( [f'說明：{job.refund_note}'] if job.refund_note else [] ), '',
        '若一週內沒有收到款項，請直接回信與我們聯絡。',
    ])
    return _deliver(order, 'refund_recorded', recipient, f'【親紫之間】退款完成 {order.order_no}', body,
                    key=f'refund_recorded:{job.id}')


# ── 打樣 ─────────────────────────────────────────────────────────────────────
def send_proof_ready(order, job, proof, recipient, revisions_left):
    lines = ['你的實體書打樣完成了，請到訂單頁打開打樣 PDF 檢查內容。', '',
             f'訂單編號：{order.order_no}', _item_line(order), f'打樣版本：第 {proof.version} 版', '']
    if proof.admin_note:
        lines += [f'這一版的說明：{proof.admin_note}', '']
    lines += [f'請在 {_fmt_time(proof.due_at)}（台灣時間）前確認送印，或提出修改。',
              '期限內沒有回覆，系統會自動確認送印。',
              (f'你還有 {revisions_left} 次免費修改。' if revisions_left else '免費修改次數已用完，這一版請確認送印；若仍需修改請直接回信與我們聯絡。'),
              '', f'查看打樣：{_order_link(order)}']
    return _deliver(order, 'proof_ready', recipient, f'【親紫之間】實體書打樣請確認 {order.order_no}',
                    '\n'.join(lines), key=f'proof_ready:{proof.id}')


def send_proof_reminder(order, job, proof, recipient):
    body = '\n'.join([
        '提醒你：實體書打樣還沒有確認。', '',
        f'訂單編號：{order.order_no}', f'打樣版本：第 {proof.version} 版', '',
        f'請在 {_fmt_time(proof.due_at)}（台灣時間）前確認送印或提出修改，期限到了系統會自動確認送印。',
        '', f'查看打樣：{_order_link(order)}',
    ])
    return _deliver(order, 'proof_reminder', recipient, f'【親紫之間】打樣確認提醒 {order.order_no}', body,
                    key=f'proof_reminder:{proof.id}')


def send_proof_auto_approved(order, job, proof, recipient):
    body = '\n'.join([
        '你的實體書打樣已超過確認期限，系統已依約自動確認送印，接下來會進入印製。', '',
        f'訂單編號：{order.order_no}', f'確認的打樣：第 {proof.version} 版', '',
        '若有任何問題，請盡快直接回信與我們聯絡。', f'訂單詳情：{_order_link(order)}',
    ])
    return _deliver(order, 'proof_auto_approved', recipient, f'【親紫之間】實體書打樣已確認送印 {order.order_no}', body,
                    key=f'proof_auto_approved:{proof.id}')


def send_proof_changes_admin(order, job, proof, buyer_email):
    """通知管理者：會員要求修改打樣。未設定 REPORT_ADMIN_NOTIFY_EMAIL 時不寄。"""
    to = _admin_to()
    if not to:
        return False
    body = '\n'.join([f'會員要求修改第 {proof.version} 版打樣：', '', proof.comment or '-', '',
                      f'訂單編號：{order.order_no}', f'購買者：{buyer_email}', '',
                      f'後台：{_frontend_url()}/admin/report-shipments'])
    return _deliver(order, 'proof_changes_admin', to, f'【親紫之間後台】打樣要修改 {order.order_no}', body,
                    key=f'proof_changes:{proof.id}')


def send_proof_approved_admin(order, job, proof, buyer_email):
    """通知管理者：打樣已確認送印（會員確認、自動確認或代為確認）。未設定 REPORT_ADMIN_NOTIFY_EMAIL 時不寄。"""
    to = _admin_to()
    if not to:
        return False
    how = {'approved': '會員確認', 'auto_approved': '超過期限自動確認', 'admin_approved': '管理者代為確認'}
    body = '\n'.join([f'第 {proof.version} 版打樣已確認送印（{how.get(proof.decision, proof.decision)}），可以送印了。', '',
                      f'訂單編號：{order.order_no}', f'購買者：{buyer_email}',
                      *([f'說明：{proof.comment}'] if proof.comment else []), '',
                      f'後台：{_frontend_url()}/admin/report-shipments'])
    return _deliver(order, 'proof_approved_admin', to, f'【親紫之間後台】打樣已確認送印 {order.order_no}', body,
                    key=f'proof_approved:{proof.id}')


# ── 報告完成 ─────────────────────────────────────────────────────────────────
def send_report_ready(order, recipient, design_jobs):
    lines = ['你的客製報告已經完成，可以到訂單頁下載。', '', f'訂單編號：{order.order_no}', _item_line(order), '']
    if design_jobs:
        lines += ['你也訂購了實體書：現在可以到訂單頁，用整本書的預覽設計封面、扉頁，並標註想修改的地方。', '']
    lines += [f'訂單詳情：{_order_link(order)}']
    return _deliver(order, 'report_ready', recipient, f'【親紫之間】你的報告完成了 {order.order_no}', '\n'.join(lines))


def send_design_confirmed(order, buyer_email):
    """通知管理者：會員確認了實體書內容，可以開始製作打樣。未設定 REPORT_ADMIN_NOTIFY_EMAIL 時不寄。"""
    to = (current_app.config.get('REPORT_ADMIN_NOTIFY_EMAIL') or '').strip()
    if not to:
        return False
    body = '\n'.join(['會員確認了實體書的設計內容，可以開始製作打樣。', '',
                      f'訂單編號：{order.order_no}', f'購買者：{buyer_email}', '',
                      f'後台：{_frontend_url()}/admin/report-shipments'])
    return _deliver(order, 'design_confirmed', to, f'【親紫之間後台】實體書內容已確認 {order.order_no}', body)


# ── 專人解讀 ─────────────────────────────────────────────────────────────────
def _fmt_time(dt):
    # 存的是 UTC（_parse_dt 已正規化）；信件以台灣時間顯示。
    # 沒帶時區的值（SQLite 讀回時會丟掉時區）視為 UTC，不依伺服器時區解讀。
    from datetime import timedelta, timezone
    if not dt:
        return '-'
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone(timedelta(hours=8))).strftime('%Y-%m-%d %H:%M')


def send_consult_preferences(order, consult, buyer_email):
    """通知管理者：會員填了專人解讀的方便時段。未設定 REPORT_ADMIN_NOTIFY_EMAIL 時不寄。"""
    from .physical import CONSULT_PERIODS

    to = (current_app.config.get('REPORT_ADMIN_NOTIFY_EMAIL') or '').strip()
    if not to:
        return False
    prefs = consult.preferences or {}
    slots = [f"・{s['date']} {CONSULT_PERIODS.get(s['period'], s['period'])}" for s in prefs.get('slots') or []]
    body = '\n'.join(['會員填了專人解讀方便的時段：', '', *slots,
                      *([f"備註：{prefs['note']}"] if prefs.get('note') else []), '',
                      f'訂單編號：{order.order_no}', f'購買者：{buyer_email}', '',
                      f'後台：{_frontend_url()}/admin/report-consultations'])
    key = f'consult_prefs:{consult.id}:{consult.preferences_at.isoformat() if consult.preferences_at else ""}'
    return _deliver(order, 'consult_preferences', to, f'【親紫之間後台】專人解讀時段 {order.order_no}', body, key=key)


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
        lines += [f'應退金額：{money.fmt(consult.refund_due, order.currency)}。我們會以轉帳退款，完成後再寄信通知你。']
    return _deliver(order, 'consult_cancelled', recipient, f'【親紫之間】專人解讀已取消 {order.order_no}',
                    '\n'.join(lines), key=f'consult_cancelled:{consult.id}')


def send_consult_refunded(order, consult, recipient):
    body = '\n'.join([
        '我們已完成退款。', '',
        f'訂單編號：{order.order_no}', f'退款金額：{money.fmt(consult.refund_amount, order.currency)}',
        *([f'說明：{consult.refund_note}'] if consult.refund_note else []), '',
        '若一週內沒有收到款項，請直接回信與我們聯絡。',
    ])
    return _deliver(order, 'consult_refunded', recipient, f'【親紫之間】退款完成 {order.order_no}', body,
                    key=f'consult_refunded:{consult.id}')
