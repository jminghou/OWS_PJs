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


# =============================================================================
# 會員商業循環（親紫之間 會員系統 §6）—— 驗證消費 → 審核 → 發券
#
# 這些表由部落格後端擁有（shop / blog schema），與站內金流的 shop.orders 無關：
#   - 規格明確「非目標：站內金流」，本流程只「登錄外部訂單號 → 人工審核 → 解鎖共用折扣碼」。
# 跨 schema 參照 account.app_users.id（BIGINT）沿用 shop.orders.user_id 既有授權模式。
# chart_id 為對 account.user_profiles.chart_id 的「軟參照」(不下硬 FK)，
#   因 blog_app 對 account.user_profiles 無 REFERENCES 權限；歸屬正確性於提交時呼叫紫微 API 驗證。
# =============================================================================


class ProductType(db.Model):
    """shop.product_types — 外部商品（蝦皮/Pinkoi 導流連結）；輕量，非站內金流商品目錄。"""
    __tablename__ = 'product_types'
    __table_args__ = {'schema': 'shop'}

    id = db.Column(db.BigInteger, primary_key=True)
    name = db.Column(db.Text, nullable=False)               # 分析報告 / 祝福命理書 / 真人解讀
    platform = db.Column(db.Text)                           # 蝦皮 / Pinkoi
    external_url = db.Column(db.Text)                       # 平台商品連結
    active = db.Column(db.Boolean, nullable=False, server_default=db.text('true'))
    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now())
    updated_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now())

    def to_dict(self):
        return {
            'id': self.id, 'name': self.name, 'platform': self.platform,
            'external_url': self.external_url, 'active': self.active,
        }

    def __repr__(self):
        return f'<ProductType {self.name}>'


class CouponConfig(db.Model):
    """shop.coupon_configs — 目前有效的共用折扣碼（A 全開放）；每平台同時間一個 active。"""
    __tablename__ = 'coupon_configs'
    __table_args__ = {'schema': 'shop'}

    id = db.Column(db.BigInteger, primary_key=True)
    code = db.Column(db.Text, nullable=False)               # 平台既有共用碼（本系統不自產唯一碼）
    platform = db.Column(db.Text)
    discount_desc = db.Column(db.Text)                      # 例：8折
    valid_from = db.Column(db.DateTime(timezone=True))
    valid_to = db.Column(db.DateTime(timezone=True))
    active = db.Column(db.Boolean, nullable=False, server_default=db.text('true'))
    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now())
    updated_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now())

    def to_dict(self):
        return {
            'id': self.id, 'code': self.code, 'platform': self.platform,
            'discount_desc': self.discount_desc,
            'valid_from': self.valid_from.isoformat() if self.valid_from else None,
            'valid_to': self.valid_to.isoformat() if self.valid_to else None,
            'active': self.active,
        }

    def __repr__(self):
        return f'<CouponConfig {self.code} {self.platform}>'


class OrderSubmission(db.Model):
    """shop.order_submissions — 會員登錄的外部訂單號（待審核 → 通過 / 退回）。"""
    __tablename__ = 'order_submissions'
    __table_args__ = (
        db.UniqueConstraint('platform', 'external_order_no',
                            name='uq_order_submissions_platform_no'),
        db.CheckConstraint("status IN ('待審核','通過','退回')",
                           name='ck_order_submissions_status'),
        {'schema': 'shop'},
    )

    id = db.Column(db.BigInteger, primary_key=True)
    member_id = db.Column(
        db.BigInteger, db.ForeignKey('account.app_users.id', ondelete='CASCADE'),
        nullable=False, index=True)
    chart_id = db.Column(db.BigInteger)                     # 軟參照 account.user_profiles.chart_id（可空）
    product_type_id = db.Column(
        db.BigInteger, db.ForeignKey('shop.product_types.id'), nullable=False)
    platform = db.Column(db.Text, nullable=False)
    external_order_no = db.Column(db.Text, nullable=False)
    # index=True 補宣告：0002 migration 早就建了 ix_shop_order_submissions_status
    # （審核流程按狀態查詢），但 model 沒寫，schema 漂移偵測會抓到這個落差。
    status = db.Column(db.Text, nullable=False, server_default='待審核', index=True)
    note = db.Column(db.Text)
    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now())
    reviewed_at = db.Column(db.DateTime(timezone=True))

    def __repr__(self):
        return f'<OrderSubmission {self.platform}/{self.external_order_no} {self.status}>'


class RewardGrant(db.Model):
    """shop.reward_grants — 一筆通過的訂單對應一張券（折扣碼快照），規格 §7 一對一。"""
    __tablename__ = 'reward_grants'
    __table_args__ = {'schema': 'shop'}

    id = db.Column(db.BigInteger, primary_key=True)
    member_id = db.Column(
        db.BigInteger, db.ForeignKey('account.app_users.id', ondelete='CASCADE'),
        nullable=False, index=True)
    order_submission_id = db.Column(
        db.BigInteger, db.ForeignKey('shop.order_submissions.id', ondelete='CASCADE'),
        nullable=False, unique=True)
    coupon_code_snapshot = db.Column(db.Text, nullable=False)
    granted_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now())

    def __repr__(self):
        return f'<RewardGrant {self.coupon_code_snapshot}>'


class SavedArticle(db.Model):
    """blog.saved_articles — 會員收藏的站內文章（可選擇關聯一張命盤）。"""
    __tablename__ = 'saved_articles'
    __table_args__ = (
        db.UniqueConstraint('member_id', 'content_id',
                            name='uq_saved_articles_member_content'),
        {'schema': 'blog'},
    )

    id = db.Column(db.BigInteger, primary_key=True)
    member_id = db.Column(
        db.BigInteger, db.ForeignKey('account.app_users.id', ondelete='CASCADE'),
        nullable=False, index=True)
    content_id = db.Column(
        db.Integer, db.ForeignKey('blog.contents.id', ondelete='CASCADE'),
        nullable=False)
    related_chart_id = db.Column(db.BigInteger)            # 軟參照（可空）
    saved_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now())

    def __repr__(self):
        return f'<SavedArticle member={self.member_id} content={self.content_id}>'
