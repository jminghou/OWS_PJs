"""
客製報告的付款：人工收款模式與「付款成功」的共用處理（docs/membership-v2-architecture.md §3）。

人工收款：
- 會員依訂單頁的匯款資訊轉帳，回報末五碼與轉帳日期 → 一筆 provider='manual'、status='created'
  的付款嘗試（同一訂單同時只有一筆待確認，重報會更新它）。
- 管理者對帳後確認收款：實收金額必須等於訂單金額；記錄操作人。之後與綠界付款共用
  mark_paid()：訂單改已付款、報告交接改為待送出，同一個 transaction。
- 管理者也可退回回報（附原因），會員可重新回報。
- 匯款期限過了、而且會員沒有回報轉帳的訂單，自動改為已取消；已回報的留給管理者判斷。
"""

import re
import secrets
import string
from datetime import date, datetime, timedelta

from flask import current_app

from core.backend_engine.factory import db
from packages.commerce.models import Order, OrderCheckout, PaymentAttempt
from sites.Polaris_Parent.backend.models import ReportFulfillment, Shipment

from .service import OrderError

_LAST5_RE = re.compile(r'^\d{5}$')
_NOTE_MAX = 200


# ── 設定 ─────────────────────────────────────────────────────────────────────
def manual_bank_info():
    """回傳匯款資訊；任一必要欄位未設定時回 None（此時不接受人工收款訂單）。"""
    cfg = current_app.config
    info = {
        'bank_name': (cfg.get('MANUAL_PAYMENT_BANK_NAME') or '').strip(),
        'bank_code': (cfg.get('MANUAL_PAYMENT_BANK_CODE') or '').strip(),
        'account_no': (cfg.get('MANUAL_PAYMENT_ACCOUNT_NO') or '').strip(),
        'account_name': (cfg.get('MANUAL_PAYMENT_ACCOUNT_NAME') or '').strip(),
    }
    return info if all(info.values()) else None


def deadline_days():
    try:
        return max(1, int(current_app.config.get('MANUAL_PAYMENT_DEADLINE_DAYS', 3)))
    except (TypeError, ValueError):
        return 3


def new_attempt_no():
    """綠界 MerchantTradeNo 相容：≤20 字元英數。P + YYMMDDHHmm + 8 碼隨機 = 19 字元。"""
    alphabet = string.ascii_uppercase + string.digits
    return 'P' + datetime.utcnow().strftime('%y%m%d%H%M') + ''.join(secrets.choice(alphabet) for _ in range(8))


# ── 查詢 ─────────────────────────────────────────────────────────────────────
def pending_manual_attempt(order):
    return (PaymentAttempt.query
            .filter_by(order_id=order.id, provider='manual', status='created')
            .order_by(PaymentAttempt.id.desc()).first())


def latest_manual_attempt(order):
    return (PaymentAttempt.query.filter_by(order_id=order.id, provider='manual')
            .order_by(PaymentAttempt.id.desc()).first())


def attempt_view(attempt):
    if attempt is None:
        return None
    return {
        'status': attempt.status,  # created=待確認 / succeeded=已確認 / failed=已退回 / expired
        'last5': attempt.manual_reference,
        'transferred_on': attempt.transferred_on.isoformat() if attempt.transferred_on else None,
        'reported_amount': attempt.amount,
        'member_note': attempt.payer_note,
        'review_note': attempt.review_note,
        'reported_at': attempt.created_at.isoformat() if attempt.created_at else None,
        'paid_at': attempt.paid_at.isoformat() if attempt.paid_at else None,
    }


# ── 會員回報轉帳 ─────────────────────────────────────────────────────────────
def _ensure_open_manual_order(order):
    if order.payment_method != 'manual':
        raise OrderError('這筆訂單不是轉帳付款', 409, 'not_manual')
    if order.status != 'pending':
        raise OrderError('這筆訂單已不是待付款狀態', 409, 'not_pending')


def report_transfer(order, data, today=None):
    """會員回報轉帳。回傳付款嘗試；驗證失敗拋 OrderError(errors=...)。"""
    _ensure_open_manual_order(order)
    if order.checkout and order.checkout.expires_at and order.checkout.expires_at < datetime.utcnow():
        raise OrderError('已超過匯款期限，訂單將會取消；若已轉帳請聯絡客服', 409, 'expired')

    today = today or date.today()
    errors = {}
    last5 = str(data.get('last5') or '').strip()
    if not _LAST5_RE.match(last5):
        errors['last5'] = '請填寫轉出帳號末五碼（5 位數字）'
    raw_date = str(data.get('transferred_on') or '').strip()
    try:
        transferred_on = date.fromisoformat(raw_date)
        if transferred_on > today:
            errors['transferred_on'] = '轉帳日期不能晚於今天'
        elif order.created_at and transferred_on < order.created_at.date() - timedelta(days=1):
            errors['transferred_on'] = '轉帳日期早於訂單成立日期'
    except ValueError:
        errors['transferred_on'] = '請填寫轉帳日期'
    amount = data.get('amount')
    if not isinstance(amount, int) or amount <= 0:
        errors['amount'] = '請填寫轉帳金額'
    member_note = str(data.get('note') or '').strip()
    if len(member_note) > _NOTE_MAX:
        errors['note'] = f'備註請在 {_NOTE_MAX} 字以內'
    if errors:
        err = OrderError('轉帳資料有誤，請檢查後再送出', 400, 'invalid')
        err.errors = errors
        raise err

    attempt = pending_manual_attempt(order)
    if attempt is None:
        attempt = PaymentAttempt(attempt_no=new_attempt_no(), order_id=order.id, provider='manual',
                                 environment='live', currency=order.currency, status='created')
        db.session.add(attempt)
    attempt.amount = amount  # 會員回報的金額；確認時以管理者實收金額為準
    attempt.manual_reference = last5
    attempt.transferred_on = transferred_on
    attempt.payer_note = member_note or None
    attempt.review_note = None
    db.session.commit()
    return attempt


# ── 管理者 ──────────────────────────────────────────────────────────────────
def mark_paid(order, attempt, paid_at=None):
    """付款成功的共用處理（人工收款與之後的綠界通知都走這裡）。不 commit，由呼叫端提交。"""
    paid_at = paid_at or datetime.utcnow()
    attempt.status = 'succeeded'
    attempt.paid_at = paid_at
    order.status = 'paid'
    order.paid_at = paid_at
    for item in order.order_items:
        f = ReportFulfillment.query.filter_by(order_item_id=item.id).first()
        if f is not None and f.handoff_status == 'not_ready':
            f.handoff_status = 'pending'  # 待送出：交給紫微建立工作單
            f.environment = attempt.environment


def confirm_manual_payment(order, admin_id, received_amount, last5=None, note=None):
    _ensure_open_manual_order(order)
    if not isinstance(received_amount, int) or received_amount != order.amount:
        raise OrderError(f'實收金額必須等於訂單金額 NT${order.amount:,}；金額不符請先與會員聯絡', 400,
                         'amount_mismatch')
    last5 = (str(last5).strip() if last5 else '') or None
    if last5 and not _LAST5_RE.match(last5):
        raise OrderError('末五碼必須是 5 位數字', 400, 'invalid')

    attempt = pending_manual_attempt(order)
    if attempt is None:  # 會員沒回報，管理者直接依對帳結果確認
        attempt = PaymentAttempt(attempt_no=new_attempt_no(), order_id=order.id, provider='manual',
                                 environment='live', currency=order.currency, status='created')
        db.session.add(attempt)
    attempt.amount = received_amount
    attempt.confirmed_by = admin_id
    if last5:
        attempt.manual_reference = last5
    attempt.review_note = (note or '').strip()[:_NOTE_MAX] or None
    mark_paid(order, attempt)
    db.session.commit()
    return attempt


def reject_transfer(order, admin_id, reason):
    _ensure_open_manual_order(order)
    reason = (reason or '').strip()
    if not reason:
        raise OrderError('請填寫退回原因（會寄給會員）', 400, 'invalid')
    attempt = pending_manual_attempt(order)
    if attempt is None:
        raise OrderError('這筆訂單沒有待確認的轉帳回報', 409, 'no_report')
    attempt.status = 'failed'
    attempt.confirmed_by = admin_id
    attempt.review_note = reason[:_NOTE_MAX]
    db.session.commit()
    return attempt


def expire_overdue(now=None):
    """取消已過匯款期限、且會員未回報轉帳的人工收款訂單。回傳被取消的訂單。"""
    now = now or datetime.utcnow()
    candidates = (Order.query.join(OrderCheckout, OrderCheckout.order_id == Order.id)
                  .filter(Order.status == 'pending', Order.payment_method == 'manual',
                          OrderCheckout.expires_at.isnot(None), OrderCheckout.expires_at < now)
                  .all())
    expired = []
    for order in candidates:
        if pending_manual_attempt(order) is not None:
            continue  # 已回報轉帳：留給管理者對帳
        order.status = 'cancelled'
        for item in order.order_items:
            f = ReportFulfillment.query.filter_by(order_item_id=item.id).first()
            if f is not None and f.handoff_status == 'not_ready':
                f.handoff_status = 'cancelled'
            s = Shipment.query.filter_by(order_item_id=item.id).first()
            if s is not None and s.status == 'pending':
                s.status = 'cancelled'
        expired.append(order)
    if expired:
        db.session.commit()
    return expired
