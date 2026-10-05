"""
OWS Core Engine - 會員身分服務

平台級的會員機制（註冊 / 設定密碼 / 重寄設定信），與任何領域無關。
第三、第四個站台不需要紫微斗數，但一定需要這一套。

## 為什麼有 signup hook

Polaris 的註冊流程要順便把「剛排好的命盤」歸戶到新會員。那是**領域**行為，
不該寫進 core。但它又必須發生在建立 User 之前 —— 因為外部命盤服務會先在
共用的 account.app_users 建好身分，core 這邊必須「先查再建」才不會撞 unique。

所以擴充點是 **pre-signup**：在 email 查重之後、建立 User 之前呼叫。
hook 可以在外部系統預先建好身分，core 隨後一律先查再建。

站台這樣掛：

    from core.backend_engine.services.member_auth import on_member_signup

    @on_member_signup
    def attach_chart(email, data):
        chart = data.get('chart')
        if not chart:
            return None
        ...
        return SignupHookResult(extra={'chart_id': cid}, warning=None)

hook 拋出的例外一律被吞掉並記 log —— 領域功能失敗不該擋住註冊本身
（Polaris 的既有行為就是「命盤存不起來也要讓人註冊成功」，這裡忠實保留）。
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Callable, Optional

from flask import current_app


@dataclass
class SignupHookResult:
    """pre-signup hook 的回傳值。

    extra:   併進註冊 API 回應的欄位（例如 {'chart_id': 'abc'}）
    warning: 領域步驟失敗但不擋註冊時，回給前端顯示的訊息
    """

    extra: dict = field(default_factory=dict)
    warning: Optional[str] = None


SignupHook = Callable[[str, dict], Optional[SignupHookResult]]

_signup_hooks: list[SignupHook] = []


def on_member_signup(fn: SignupHook) -> SignupHook:
    """註冊一個 pre-signup 擴充點（可當 decorator 用）。"""
    if fn not in _signup_hooks:
        _signup_hooks.append(fn)
    return fn


def clear_signup_hooks() -> None:
    """清空擴充點（測試用）。"""
    _signup_hooks.clear()


def run_signup_hooks(email: str, data: dict) -> SignupHookResult:
    """依序執行所有 pre-signup hook，合併結果。

    單一 hook 失敗只記 log 並轉成 warning，不中斷註冊 —— 領域功能不該擋住身分建立。
    """
    merged = SignupHookResult()
    for hook in _signup_hooks:
        try:
            result = hook(email, data)
        except Exception as exc:  # noqa: BLE001 - 領域擴充失敗不擋註冊
            current_app.logger.warning(
                f"signup hook {getattr(hook, '__name__', hook)} 失敗，已略過：{exc}"
            )
            continue
        if result is None:
            continue
        if result.extra:
            merged.extra.update(result.extra)
        if result.warning and not merged.warning:
            merged.warning = result.warning
    return merged


# =============================================================================
# 設定密碼信
# =============================================================================

SET_PASSWORD_SALT = 'set-password'
SET_PASSWORD_MAX_AGE = 24 * 3600  # 24 小時


def _serializer():
    from itsdangerous import URLSafeTimedSerializer

    return URLSafeTimedSerializer(current_app.config['SECRET_KEY'], salt=SET_PASSWORD_SALT)


def make_set_password_token(member_id, email: str) -> str:
    """簽章一枚設定密碼 token（無需額外資料表）。"""
    return _serializer().dumps({"member_id": member_id, "email": email})


def read_set_password_token(token: str):
    """驗證 token。回 (payload, error_message)；error_message 為 None 表示成功。"""
    from itsdangerous import BadSignature, SignatureExpired

    try:
        return _serializer().loads(token, max_age=SET_PASSWORD_MAX_AGE), None
    except SignatureExpired:
        return None, "連結已過期，請重新申請"
    except BadSignature:
        return None, "連結無效"


def send_set_password_email(member_id, email: str) -> None:
    """寄設定密碼信（best-effort；無 SMTP 時記 log 含連結，方便本機開發）。"""
    try:
        from flask_mail import Message

        from core.backend_engine.factory import mail

        token = make_set_password_token(member_id, email)
        frontend = os.environ.get('FRONTEND_URL', 'http://localhost:3000').rstrip('/')
        link = f"{frontend}/set-password?token={token}"
        try:
            mail.send(Message(
                subject="設定您的會員密碼",
                recipients=[email],
                sender=current_app.config.get('MAIL_DEFAULT_SENDER'),
                body=f"歡迎成為會員！請於 24 小時內點擊連結設定密碼：\n{link}",
            ))
            current_app.logger.info(f"set-password email sent to {email}")
        except Exception as send_err:  # noqa: BLE001
            current_app.logger.warning(
                f"set-password 信無法寄出（本機可能無 SMTP）：{send_err}；連結：{link}")
    except Exception as exc:  # noqa: BLE001
        current_app.logger.error(f"set-password token 產生失敗：{exc}")


# =============================================================================
# 共用驗證
# =============================================================================

def is_valid_email(email: str) -> bool:
    return "@" in email and "." in email.split("@")[-1]


def normalise_email(raw) -> str:
    return (raw or "").strip().lower()
