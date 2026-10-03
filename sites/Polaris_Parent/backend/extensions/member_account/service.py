"""
會員 v2 Email 驗證碼與驗證紀錄（docs/membership-v2-architecture.md §5）。

規則：
- 6 位數驗證碼，只存 HMAC-SHA256 雜湊（以 SECRET_KEY 為鑰，綁定 email 與用途）。
- 10 分鐘有效；同一組碼最多錯 5 次；重新索取會讓同 email＋用途的舊碼作廢。
- 同 email＋用途 60 秒內不能重寄，一小時最多 5 次。
- 已驗證的是「哪個 Email」：會員改 Email 後，舊紀錄對不上即視為未驗證。
"""

import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

from flask import current_app

from core.backend_engine.factory import db
from sites.Polaris_Parent.backend.models import MemberEmailCode, MemberEmailVerification

CODE_TTL = timedelta(minutes=10)
MAX_ATTEMPTS = 5
RESEND_COOLDOWN = timedelta(seconds=60)
HOURLY_LIMIT = 5
PURPOSES = ('register', 'reset', 'verify')


class CodeError(Exception):
    """驗證碼無效；message 可直接顯示給使用者。"""


class RateLimited(Exception):
    def __init__(self, retry_after: int):
        super().__init__(retry_after)
        self.retry_after = retry_after


def _now():
    return datetime.now(timezone.utc)


def _aware(dt):
    # SQLite 測試庫回傳 naive datetime；正式庫是 timestamptz
    return dt if dt is None or dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _hash(email: str, purpose: str, code: str) -> str:
    key = current_app.config['SECRET_KEY'].encode('utf-8')
    return hmac.new(key, f'{email}|{purpose}|{code}'.encode('utf-8'), hashlib.sha256).hexdigest()


def issue_code(email: str, purpose: str) -> str:
    """建立新驗證碼並作廢舊碼；超過頻率限制拋 RateLimited。回傳明碼（只用於寄信）。"""
    now = _now()
    recent = (MemberEmailCode.query
              .filter(MemberEmailCode.email == email, MemberEmailCode.purpose == purpose,
                      MemberEmailCode.created_at >= now - timedelta(hours=1))
              .order_by(MemberEmailCode.created_at.desc())
              .all())
    if recent:
        wait = RESEND_COOLDOWN - (now - _aware(recent[0].created_at))
        if wait.total_seconds() > 0:
            raise RateLimited(int(wait.total_seconds()) + 1)
        if len(recent) >= HOURLY_LIMIT:
            oldest = _aware(recent[-1].created_at)
            raise RateLimited(int((oldest + timedelta(hours=1) - now).total_seconds()) + 1)

    (MemberEmailCode.query
     .filter(MemberEmailCode.email == email, MemberEmailCode.purpose == purpose,
             MemberEmailCode.consumed_at.is_(None))
     .update({MemberEmailCode.consumed_at: now}, synchronize_session=False))

    code = f'{secrets.randbelow(10 ** 6):06d}'
    db.session.add(MemberEmailCode(email=email, purpose=purpose, code_hash=_hash(email, purpose, code),
                                   expires_at=now + CODE_TTL, attempts=0, created_at=now))
    db.session.commit()
    return code


def consume_code(email: str, purpose: str, code: str) -> None:
    """驗證並消耗驗證碼；失敗拋 CodeError（錯誤次數會先落庫）。"""
    code = (code or '').strip()
    row = (MemberEmailCode.query
           .filter(MemberEmailCode.email == email, MemberEmailCode.purpose == purpose,
                   MemberEmailCode.consumed_at.is_(None))
           .order_by(MemberEmailCode.created_at.desc())
           .first())
    if row is None or _aware(row.expires_at) <= _now():
        raise CodeError('驗證碼已失效，請重新取得')
    if row.attempts >= MAX_ATTEMPTS:
        raise CodeError('錯誤次數過多，請重新取得驗證碼')
    if not hmac.compare_digest(row.code_hash, _hash(email, purpose, code)):
        row.attempts += 1
        db.session.commit()
        left = MAX_ATTEMPTS - row.attempts
        raise CodeError(f'驗證碼錯誤，還可再試 {left} 次' if left > 0 else '錯誤次數過多，請重新取得驗證碼')
    row.consumed_at = _now()


def mark_verified(app_user_id, email: str) -> None:
    """記錄此會員的 email 已驗證（不 commit，由呼叫端與其他寫入一起提交）。"""
    row = db.session.get(MemberEmailVerification, app_user_id)
    if row is None:
        db.session.add(MemberEmailVerification(app_user_id=app_user_id, email=email, verified_at=_now()))
    else:
        row.email = email
        row.verified_at = _now()


def is_email_verified(app_user_id, email: str) -> bool:
    row = db.session.get(MemberEmailVerification, app_user_id)
    return row is not None and row.email == (email or '').strip().lower()


# ── 寄信 ─────────────────────────────────────────────────────────────────────
_SUBJECTS = {
    'register': '【親紫之間】註冊驗證碼',
    'reset': '【親紫之間】重設密碼驗證碼',
    'verify': '【親紫之間】Email 驗證碼',
}
_ACTIONS = {'register': '完成註冊', 'reset': '重設密碼', 'verify': '驗證您的 Email'}


def _send(email: str, subject: str, body: str, dev_hint: str) -> None:
    try:
        from flask_mail import Message

        from core.backend_engine.factory import mail

        mail.send(Message(subject=subject, recipients=[email],
                          sender=current_app.config.get('MAIL_DEFAULT_SENDER'), body=body))
    except Exception as exc:  # noqa: BLE001 - 寄信失敗不擋流程；正式環境不把驗證碼寫進 log
        if current_app.config.get('IS_DEV_MODE'):
            current_app.logger.warning(f'驗證信無法寄出（本機可能無 SMTP）：{exc}；{dev_hint}')
        else:
            current_app.logger.error(f'驗證信無法寄出 {email}：{exc}')


def send_code_email(email: str, purpose: str, code: str) -> None:
    minutes = int(CODE_TTL.total_seconds() // 60)
    body = (f'您的驗證碼是：{code}\n\n'
            f'請於 {minutes} 分鐘內輸入此驗證碼以{_ACTIONS[purpose]}。\n'
            '若這不是您本人的操作，請忽略這封信。')
    _send(email, _SUBJECTS[purpose], body, dev_hint=f'{email} {purpose} 驗證碼：{code}')


def send_already_member_email(email: str) -> None:
    """有人以已註冊的 Email 申請註冊：不寄驗證碼，改提醒直接登入或重設密碼。"""
    body = ('有人以這個 Email 申請註冊親紫之間會員，但這個 Email 已經是會員了。\n\n'
            '請直接登入；如果忘記密碼，可在登入頁選擇「忘記密碼」重設。\n'
            '若這不是您本人的操作，請忽略這封信。')
    _send(email, '【親紫之間】這個 Email 已經是會員', body, dev_hint=f'{email} 已是會員（未寄驗證碼）')
