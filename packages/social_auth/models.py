"""
Social Auth 模組的資料模型。

表 `social_auth_` 前綴、落在 BLOG schema。user_id 刻意不設外鍵：Polaris 的 users 是 view
（實體在 account.app_users），與 blog.member_email_verifications 相同採軟參照；也讓這條
migration 鏈不必分 local / external 身分模式。
"""
from datetime import datetime
from typing import Any, Dict, Optional

from core.backend_engine.factory import db
from core.backend_engine.models import BLOG_SCHEMA as _BLOG_SCHEMA

SOCIAL_AUTH_SCHEMA = _BLOG_SCHEMA


def _iso(value: Optional[datetime]) -> Optional[str]:
    return value.isoformat() if value else None


class SocialIdentity(db.Model):
    """一個社群帳號（provider＋subject）連到一個會員。"""
    __tablename__ = 'social_auth_identities'
    __table_args__ = (
        db.UniqueConstraint('provider', 'subject', name='uq_social_auth_identities_provider_subject'),
        # 一個會員每個 provider 只連一個帳號；同一會員可同時連 Google 與 LINE
        db.UniqueConstraint('user_id', 'provider', name='uq_social_auth_identities_user_provider'),
        {'schema': SOCIAL_AUTH_SCHEMA},
    )

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, nullable=False, index=True)
    provider = db.Column(db.String(20), nullable=False)
    subject = db.Column(db.String(255), nullable=False)
    # 以下只作紀錄（最後一次登入時 provider 給的資料），不拿來登入
    email = db.Column(db.String(255))
    display_name = db.Column(db.String(255))
    picture_url = db.Column(db.String(1000))
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    last_login_at = db.Column(db.DateTime)

    def to_dict(self) -> Dict[str, Any]:
        return {
            'provider': self.provider,
            'email': self.email,
            'display_name': self.display_name,
            'picture_url': self.picture_url,
            'created_at': _iso(self.created_at),
            'last_login_at': _iso(self.last_login_at),
        }
