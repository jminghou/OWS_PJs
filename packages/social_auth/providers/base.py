"""Provider 的共同介面：驗證成功後一律交出 ProviderProfile。"""
from dataclasses import dataclass
from typing import Optional


class ProviderError(Exception):
    """provider 的憑證無效；message 可直接顯示給使用者。"""


@dataclass(frozen=True)
class ProviderProfile:
    provider: str
    subject: str                 # provider 的永久使用者 ID（sub）
    email: Optional[str]         # 已正規化（小寫、去空白）；provider 沒給時為 None
    email_verified: bool
    # 這個信箱是否由 provider 本身掌管（Gmail、Google Workspace）。只有 True 才可自動連結既有會員。
    email_authoritative: bool
    name: Optional[str] = None
    picture: Optional[str] = None
