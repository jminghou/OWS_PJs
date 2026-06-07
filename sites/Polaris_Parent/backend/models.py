"""
Polaris Parent — 站專屬模型（統一資料庫架構 §11，Option B）

這些模型**只在 Polaris 載入**（app.py after_init 的 `from sites.Polaris_Parent.backend import models`），
不放共用 core，以免污染 Claire（其 DB 無 account schema）。

- AppUser       → account.app_users（身分核心，紫微擁有寫入；本站讀取 + 提供 FK 解析）
- MemberProfile → blog.member_profiles（部落格/會員側擴充，本站擁有）

兩者皆由 SQL 自管（account.app_users 由紫微；blog.member_profiles 由 init_member_profiles.sql），
故 Alembic autogenerate 已於 migrations/env.py 的 include_object 排除，不會重複建立。
"""

from sqlalchemy.dialects.postgresql import JSONB

from core.backend_engine.factory import db


class AppUser(db.Model):
    """account.app_users — 唯一身分/登入帳號（與紫微系統共用）。"""
    __tablename__ = 'app_users'
    __table_args__ = {'schema': 'account'}

    id = db.Column(db.BigInteger, primary_key=True)
    username = db.Column(db.Text, nullable=False)
    password_hash = db.Column(db.Text, nullable=False)
    display_name = db.Column(db.Text)
    role = db.Column(db.Text, nullable=False)
    is_active = db.Column(db.Boolean, nullable=False)
    permissions = db.Column(JSONB, nullable=False)
    allowed_collectors = db.Column(JSONB, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True))
    updated_at = db.Column(db.DateTime(timezone=True))

    def __repr__(self):
        return f'<AppUser {self.username}>'


class MemberProfile(db.Model):
    """blog.member_profiles — 部落格/會員側身分擴充（1:1 對 account.app_users）。"""
    __tablename__ = 'member_profiles'
    __table_args__ = {'schema': 'blog'}

    app_user_id = db.Column(
        db.BigInteger,
        db.ForeignKey('account.app_users.id', ondelete='CASCADE'),
        primary_key=True,
    )
    email = db.Column(db.String(100), unique=True)
    avatar = db.Column(db.String(500))
    attributes = db.Column(JSONB, default=dict)
    meta_data = db.Column(JSONB, default=dict)
    last_login = db.Column(db.DateTime(timezone=True))
    created_at = db.Column(db.DateTime(timezone=True))
    updated_at = db.Column(db.DateTime(timezone=True))

    def __repr__(self):
        return f'<MemberProfile {self.app_user_id}>'
