"""
Newsletter 模組的資料模型。

表 `newsletter_` 前綴、落在 BLOG schema（見 packages/newsletter/__init__.py 的說明）。
刻意不設任何外鍵：訂閱者不必是會員，也讓這條 migration 鏈不必分 local / external 身分模式。
"""
import secrets
from datetime import datetime
from typing import Any, Dict, Optional

from core.backend_engine.factory import db
from core.backend_engine.models import BLOG_SCHEMA as _BLOG_SCHEMA

NEWSLETTER_SCHEMA = _BLOG_SCHEMA

STATUS_PENDING = 'pending'
STATUS_ACTIVE = 'active'
STATUS_UNSUBSCRIBED = 'unsubscribed'
STATUSES = (STATUS_PENDING, STATUS_ACTIVE, STATUS_UNSUBSCRIBED)


def _iso(value: Optional[datetime]) -> Optional[str]:
    return value.isoformat() if value else None


def new_token() -> str:
    return secrets.token_urlsafe(32)


class NewsletterSubscriber(db.Model):
    __tablename__ = 'newsletter_subscribers'
    __table_args__ = {'schema': NEWSLETTER_SCHEMA}

    id = db.Column(db.Integer, primary_key=True)
    # 一律存正規化後（trim + lower）的 email
    email = db.Column(db.String(254), unique=True, nullable=False, index=True)
    status = db.Column(db.String(16), default=STATUS_PENDING, nullable=False, index=True)
    # 確認與退訂共用。存在表裡而非簽章 token：匯出的 CSV 帶退訂連結給外部發報工具，
    # 連結必須永久有效、不受 SECRET_KEY 輪替影響。重新訂閱也不更換，舊信裡的連結才不會失效。
    token = db.Column(db.String(64), unique=True, nullable=False, index=True, default=new_token)
    locale = db.Column(db.String(10))
    source = db.Column(db.String(50))
    # 同意紀錄（訂閱當下）
    consent_at = db.Column(db.DateTime)
    consent_ip = db.Column(db.String(45))
    consent_user_agent = db.Column(db.String(255))
    confirm_sent_at = db.Column(db.DateTime)
    confirmed_at = db.Column(db.DateTime)
    confirmed_ip = db.Column(db.String(45))
    unsubscribed_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'email': self.email,
            'status': self.status,
            'locale': self.locale,
            'source': self.source,
            'consent_at': _iso(self.consent_at),
            'confirmed_at': _iso(self.confirmed_at),
            'unsubscribed_at': _iso(self.unsubscribed_at),
            'created_at': _iso(self.created_at),
        }
