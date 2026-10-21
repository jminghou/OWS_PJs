"""
Polaris Parent — 站專屬模型（統一資料庫架構 §11，Option B）

這些模型**只在 Polaris 載入**（app.py after_init 的 `from sites.Polaris_Parent.backend import models`），
不放共用 core，以免污染 Claire（其 DB 無 account schema）。

- AppUser       → account.app_users（身分核心，紫微擁有寫入；本站讀取 + 提供 FK 解析）
- MemberProfile → blog.member_profiles（部落格/會員側擴充，本站擁有）

兩者皆由 SQL 自管（account.app_users 由紫微；blog.member_profiles 由 init_member_profiles.sql），
故 Alembic autogenerate 已於 migrations/env.py 的 include_object 排除，不會重複建立。
"""

from datetime import datetime

from sqlalchemy.dialects.postgresql import JSONB

from core.backend_engine.factory import db
from core.backend_engine.models import SHOP_SCHEMA as _SHOP_SCHEMA, qualify as _q

# Additive commerce tables are owned by this site's migration chain.
from .commerce_models import CommerceSource, CommerceLine, CommerceEntitlement, CommerceTask, CommerceEvent  # noqa: F401


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


# =============================================================================
# 會員 v2：客製報告的生產交接與實體出貨（見 docs/membership-v2-ziwei-contract.md）
#
# 以 shop.order_items.id 關聯共用電商的訂單項目；購買者填的出生資料與讀者設定
# 存在 order_items.customization（送出時快照），這裡不重複存。
# chart_id / person_user_id 為對紫微 account.* 的軟參照（blog_app 對 user_profiles
# 無 REFERENCES 權限），歸屬於建單時經紫微 save-and-register 確認。
# =============================================================================

# order_items 屬共用電商模組，落在 OWS_SHOP_SCHEMA（Polaris 為 shop）；外鍵跟著同一個設定走
_ORDER_ITEMS_FK = _q('order_items.id', _SHOP_SCHEMA)


class MemberEmailVerification(db.Model):
    """blog.member_email_verifications — 會員 Email 驗證紀錄（1:1 對 account.app_users）。

    記錄「哪個 Email」在何時驗證通過；會員改 Email 後，舊紀錄的 email 對不上即視為未驗證。
    不放在 member_profiles：該表由 postgres 以 SQL 建立，blog_app 不是擁有者、無法加欄位。
    """
    __tablename__ = 'member_email_verifications'
    __table_args__ = {'schema': 'blog'}

    app_user_id = db.Column(
        db.BigInteger, db.ForeignKey('account.app_users.id', ondelete='CASCADE'), primary_key=True)
    email = db.Column(db.String(255), nullable=False)
    verified_at = db.Column(db.DateTime(timezone=True), nullable=False)

    def __repr__(self):
        return f'<MemberEmailVerification {self.app_user_id} {self.email}>'


class MemberEmailCode(db.Model):
    """blog.member_email_codes — Email 驗證碼（註冊／重設密碼／登入後驗證）。

    只存 HMAC 雜湊，不存明碼；每次重新索取會讓同 email+用途的舊碼作廢。
    """
    __tablename__ = 'member_email_codes'
    __table_args__ = (
        db.CheckConstraint("purpose IN ('register','reset','verify')", name='ck_member_email_codes_purpose'),
        db.Index('ix_blog_member_email_codes_email_purpose', 'email', 'purpose'),
        {'schema': 'blog'},
    )

    id = db.Column(db.BigInteger, primary_key=True)
    email = db.Column(db.String(255), nullable=False)
    purpose = db.Column(db.String(20), nullable=False)
    code_hash = db.Column(db.String(64), nullable=False)
    expires_at = db.Column(db.DateTime(timezone=True), nullable=False)
    attempts = db.Column(db.Integer, nullable=False, server_default='0')
    consumed_at = db.Column(db.DateTime(timezone=True))
    created_at = db.Column(db.DateTime(timezone=True), nullable=False)

    def __repr__(self):
        return f'<MemberEmailCode {self.email} {self.purpose}>'


class ReportFulfillment(db.Model):
    """shop.report_fulfillments — 一個報告訂單項目對應一筆；記錄命盤關聯、交接紫微工作單的狀態與同步快取。

    handoff_status：not_ready（未付款）→ pending（待送出）→ sent（紫微已建工作單）；
    送出失敗為 failed（可重送）；例外取消為 cancelled。
    """
    __tablename__ = 'report_fulfillments'
    __table_args__ = (
        db.CheckConstraint(
            "handoff_status IN ('not_ready','pending','sent','failed','cancelled')",
            name='ck_report_fulfillments_handoff_status'),
        {'schema': 'shop'},
    )

    id = db.Column(db.BigInteger, primary_key=True)
    order_item_id = db.Column(
        db.Integer, db.ForeignKey(_ORDER_ITEMS_FK), nullable=False, unique=True)
    request_no = db.Column(db.String(32), nullable=False, unique=True)  # 紫微工作單編號（= order_items.item_no）
    member_id = db.Column(
        db.BigInteger, db.ForeignKey('account.app_users.id'), nullable=False, index=True)
    chart_id = db.Column(db.BigInteger)                  # 軟參照 account.user_profiles.chart_id
    person_user_id = db.Column(db.BigInteger)            # 軟參照 account.users.user_id（命主）
    environment = db.Column(db.String(10))               # 付款環境 test / live；交接時帶給紫微
    handoff_status = db.Column(db.String(20), nullable=False, server_default='not_ready', index=True)
    handoff_attempts = db.Column(db.Integer, nullable=False, server_default='0')
    last_error = db.Column(db.Text)
    sent_at = db.Column(db.DateTime(timezone=True))
    ziwei_status = db.Column(db.String(20))              # 紫微工作單狀態快取（queued / in_progress / …）
    member_note = db.Column(db.Text)                     # 紫微提供、可顯示給會員的進度說明
    deliverable_ready_at = db.Column(db.DateTime(timezone=True))
    synced_at = db.Column(db.DateTime(timezone=True))
    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now())
    updated_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now(), onupdate=db.func.now())

    def __repr__(self):
        return f'<ReportFulfillment {self.request_no} {self.handoff_status}>'


class Shipment(db.Model):
    """shop.shipments — 實體書出貨（合作印刷廠在系統外，由管理者登錄進度與物流單號）。"""
    __tablename__ = 'shipments'
    __table_args__ = (
        db.CheckConstraint(
            "status IN ('pending','printing','shipped','delivered','cancelled')",
            name='ck_shipments_status'),
        {'schema': 'shop'},
    )

    id = db.Column(db.BigInteger, primary_key=True)
    order_item_id = db.Column(
        db.Integer, db.ForeignKey(_ORDER_ITEMS_FK), nullable=False, unique=True)
    recipient_name = db.Column(db.Text, nullable=False)  # 收件資料為下單時快照
    recipient_phone = db.Column(db.Text, nullable=False)
    postal_code = db.Column(db.String(12))
    address = db.Column(db.Text, nullable=False)
    country = db.Column(db.String(2))  # ISO 3166 國碼；NULL＝台灣（2026-10-20 前的資料都是國內）
    status = db.Column(db.String(20), nullable=False, server_default='pending', index=True)
    printer = db.Column(db.Text)
    carrier = db.Column(db.Text)
    tracking_no = db.Column(db.Text)
    print_sent_at = db.Column(db.DateTime(timezone=True))
    shipped_at = db.Column(db.DateTime(timezone=True))
    delivered_at = db.Column(db.DateTime(timezone=True))
    note = db.Column(db.Text)
    updated_by = db.Column(
        db.BigInteger, db.ForeignKey('account.app_users.id', ondelete='SET NULL'))
    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now())
    updated_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now(), onupdate=db.func.now())

    def __repr__(self):
        return f'<Shipment item={self.order_item_id} {self.status}>'


# 實體書生命週期（docs/report-physical-addon-plan.md §5）
PRINT_JOB_STATUSES = (
    'awaiting_payment',        # 訂單尚未付款
    'awaiting_customization',  # 已付款，待會員填實體書內容設定
    'awaiting_proof',          # 待管理者出打樣
    'proof_ready',             # 打樣已上傳，待會員確認
    'changes_requested',       # 會員提出修改，待管理者改版
    'approved',                # 會員已確認送印
    'printing',                # 已送印
    'shipped',                 # 已出貨
    'delivered',               # 已送達
    'cancelled',               # 已取消（送印前）
)
# 會員還能取消的狀態（確認送印前）
PRINT_JOB_CANCELLABLE = ('awaiting_payment', 'awaiting_customization', 'awaiting_proof', 'proof_ready',
                         'changes_requested')


class ReportPrintJob(db.Model):
    """shop.report_print_jobs — 每個實體書訂單項目一筆（下單選實體書版、或事後加購）。

    規格、特殊客製、計價明細是下單時的快照（影響價格）；options／pages 是會員設計的內容（階段 2）。
    物流資訊仍記在 shop.shipments；status 是實體書流程的唯一真相，出貨表的 status 跟著同步。
    取消後若已付款，refund_due 記應退金額，管理者人工退款後登錄 refunded_*。
    """
    __tablename__ = 'report_print_jobs'
    __table_args__ = (
        db.CheckConstraint(
            "status IN ('awaiting_payment','awaiting_customization','awaiting_proof','proof_ready',"
            "'changes_requested','approved','printing','shipped','delivered','cancelled')",
            name='ck_report_print_jobs_status'),
        {'schema': 'shop'},
    )

    id = db.Column(db.BigInteger, primary_key=True)
    order_item_id = db.Column(
        db.Integer, db.ForeignKey(_ORDER_ITEMS_FK), nullable=False, unique=True)
    status = db.Column(db.String(30), nullable=False, server_default='awaiting_payment', index=True)
    spec = db.Column(JSONB, nullable=False, default=dict)          # {key, label, price_delta} 快照
    custom = db.Column(JSONB, nullable=False, default=dict)        # 特殊客製 {options: [key…], spreads: n}
    pricing = db.Column(JSONB, nullable=False, default=dict)       # 計價明細快照（見 physical.price_physical）
    options = db.Column(JSONB, nullable=False, default=dict)       # 封面名字／款式／贈言（設計內容）
    pages = db.Column(JSONB, nullable=False, default=list)         # 頁面標註與指定跨頁（設計內容）
    customized_at = db.Column(db.DateTime(timezone=True))
    approved_at = db.Column(db.DateTime(timezone=True))
    approved_proof_id = db.Column(db.BigInteger)                   # 確認送印的那一版打樣
    extra_revisions = db.Column(db.Integer, nullable=False, server_default='0')  # 管理者額外給的打樣修改次數
    cancelled_at = db.Column(db.DateTime(timezone=True))
    cancelled_by = db.Column(db.String(10))                        # member / admin / system
    cancel_reason = db.Column(db.Text)
    refund_due = db.Column(db.Integer)                             # 取消時應退金額（未付款為 None）
    refund_amount = db.Column(db.Integer)
    refunded_at = db.Column(db.DateTime(timezone=True))
    refund_note = db.Column(db.Text)
    refunded_by = db.Column(
        db.BigInteger, db.ForeignKey('account.app_users.id', ondelete='SET NULL'))
    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now())
    updated_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now(), onupdate=db.func.now())

    def __repr__(self):
        return f'<ReportPrintJob item={self.order_item_id} {self.status}>'


PROOF_DECISIONS = ('approved', 'changes_requested', 'auto_approved', 'admin_approved', 'superseded')


class ReportPrintProof(db.Model):
    """shop.report_print_proofs — 實體書打樣，每一版一筆（階段 1 ②，2026-10-19）。

    管理者上傳打樣 PDF（私有儲存）→ 會員在 due_at 前確認送印或提出修改。
    decision：approved（會員確認）／changes_requested（會員要求修改）／auto_approved（期限到未回應，系統確認）／
    admin_approved（管理者代為確認）／superseded（會員決定前就被新版取代）；NULL＝等待會員決定。
    免費修改次數＝設定值＋ReportPrintJob.extra_revisions，已用次數＝changes_requested 的版數。
    """
    __tablename__ = 'report_print_proofs'
    __table_args__ = (
        db.UniqueConstraint('print_job_id', 'version', name='uq_report_print_proofs_version'),
        db.CheckConstraint(
            "decision IS NULL OR decision IN ('approved','changes_requested','auto_approved','admin_approved','superseded')",
            name='ck_report_print_proofs_decision'),
        {'schema': 'shop'},
    )

    id = db.Column(db.BigInteger, primary_key=True)
    print_job_id = db.Column(db.BigInteger, db.ForeignKey('shop.report_print_jobs.id', ondelete='CASCADE'),
                             nullable=False, index=True)
    version = db.Column(db.Integer, nullable=False)
    file_key = db.Column(db.Text, nullable=False)
    filename = db.Column(db.Text, nullable=False)
    bytes = db.Column(db.BigInteger, nullable=False)
    sha256 = db.Column(db.String(64), nullable=False)
    admin_note = db.Column(db.Text)                     # 給會員看的說明（這版改了什麼）
    uploaded_by = db.Column(db.BigInteger, db.ForeignKey('account.app_users.id', ondelete='SET NULL'))
    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now())
    due_at = db.Column(db.DateTime(timezone=True))       # 會員回覆期限；過了沒回應就自動確認送印
    decision = db.Column(db.String(20))
    comment = db.Column(db.Text)                        # 會員的修改意見，或管理者代為確認的說明
    decided_at = db.Column(db.DateTime(timezone=True))
    decided_by = db.Column(db.BigInteger)               # 會員或管理者的 app_users.id；系統自動確認為 NULL

    def __repr__(self):
        return f'<ReportPrintProof job={self.print_job_id} v{self.version} {self.decision}>'


CONSULTATION_STATUSES = ('awaiting_payment', 'to_schedule', 'scheduled', 'completed', 'cancelled')


class ReportConsultation(db.Model):
    """shop.report_consultations — 專人解讀（每個解讀訂單項目一筆，可含多次 30 分鐘）。

    付款後進入「待安排」，會員可在訂單頁填幾個方便的時段（preferences），
    管理者參考後以 Email／電話約時間並登錄；可由管理者代為取消並登錄退款
    （取消規則不對外公開）。
    """
    __tablename__ = 'report_consultations'
    __table_args__ = (
        db.CheckConstraint(
            "status IN ('awaiting_payment','to_schedule','scheduled','completed','cancelled')",
            name='ck_report_consultations_status'),
        {'schema': 'shop'},
    )

    id = db.Column(db.BigInteger, primary_key=True)
    order_item_id = db.Column(
        db.Integer, db.ForeignKey(_ORDER_ITEMS_FK), nullable=False, unique=True)
    report_item_id = db.Column(db.Integer, db.ForeignKey(_ORDER_ITEMS_FK))  # 解讀的是哪一份報告
    sessions = db.Column(db.Integer, nullable=False, server_default='1')
    minutes = db.Column(db.Integer, nullable=False, server_default='30')
    status = db.Column(db.String(20), nullable=False, server_default='awaiting_payment', index=True)
    scheduled_at = db.Column(db.DateTime(timezone=True))
    # 會員填的方便時段：{'slots': [{'date': 'YYYY-MM-DD', 'period': 'morning|afternoon|evening'}], 'note': str}
    preferences = db.Column(JSONB)
    preferences_at = db.Column(db.DateTime(timezone=True))
    admin_note = db.Column(db.Text)
    completed_at = db.Column(db.DateTime(timezone=True))
    cancelled_at = db.Column(db.DateTime(timezone=True))
    cancel_reason = db.Column(db.Text)
    refund_due = db.Column(db.Integer)
    refund_amount = db.Column(db.Integer)
    refunded_at = db.Column(db.DateTime(timezone=True))
    refund_note = db.Column(db.Text)
    updated_by = db.Column(
        db.BigInteger, db.ForeignKey('account.app_users.id', ondelete='SET NULL'))
    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now())
    updated_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now(), onupdate=db.func.now())

    def __repr__(self):
        return f'<ReportConsultation item={self.order_item_id} {self.status}>'


class ReportDocument(db.Model):
    """shop.report_documents — 報告成品檔（PDF），存在私有檔案儲存（extensions/report_orders/private_storage.py）。

    一份報告可以有多次上傳（例如更正後重傳），最新一筆 is_current=True；會員下載與整本預覽都用最新一筆。
    目前由管理者在後台上傳；之後紫微交接自動化時改由紫微提供。
    """
    __tablename__ = 'report_documents'
    __table_args__ = {'schema': 'shop'}

    id = db.Column(db.BigInteger, primary_key=True)
    order_item_id = db.Column(db.Integer, db.ForeignKey(_ORDER_ITEMS_FK), nullable=False, index=True)
    kind = db.Column(db.String(20), nullable=False, server_default='book_pdf')  # book_pdf（會員版）
    file_key = db.Column(db.Text, nullable=False)          # 私有儲存的路徑
    filename = db.Column(db.Text, nullable=False)          # 原始檔名（下載時使用）
    bytes = db.Column(db.BigInteger, nullable=False)
    sha256 = db.Column(db.String(64), nullable=False)
    is_current = db.Column(db.Boolean, nullable=False, server_default='true')
    uploaded_by = db.Column(
        db.BigInteger, db.ForeignKey('account.app_users.id', ondelete='SET NULL'))
    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now())

    def __repr__(self):
        return f'<ReportDocument item={self.order_item_id} {self.filename}>'


DESIGN_STATUSES = ('draft', 'submitted', 'confirmed')


class ReportBookDesign(db.Model):
    """shop.report_book_designs — 實體書「設計你的書」的內容（docs/report-physical-addon-plan.md 階段 2）。

    - draft：付款前在加購頁設計中，還沒有訂單（print_job_id 為空）
    - submitted：已連到某本實體書（下單時帶入，或付款後在訂單頁開始設計），還能修改
    - confirmed：會員按「確認內容，開始製作打樣」後鎖定
    data：{cover_name, cover_style, cover_asset_id, dedication,
           annotations: [{id, page, type: text|image|fix, text, asset_ids}],
           spreads: [{index, after_page, text, asset_ids}]}
    放棄的草稿與已取消實體書的設計，30 天後由 cleanup-designs 指令刪除（含照片）。
    """
    __tablename__ = 'report_book_designs'
    __table_args__ = (
        db.CheckConstraint("status IN ('draft','submitted','confirmed')", name='ck_report_book_designs_status'),
        {'schema': 'shop'},
    )

    id = db.Column(db.BigInteger, primary_key=True)
    user_id = db.Column(db.BigInteger, db.ForeignKey('account.app_users.id', ondelete='CASCADE'), nullable=False,
                        index=True)
    report_item_id = db.Column(db.Integer, db.ForeignKey(_ORDER_ITEMS_FK), nullable=False, index=True)
    print_job_id = db.Column(db.BigInteger, db.ForeignKey('shop.report_print_jobs.id', ondelete='SET NULL'),
                             unique=True)
    status = db.Column(db.String(20), nullable=False, server_default='draft', index=True)
    data = db.Column(JSONB, nullable=False, default=dict)
    confirmed_at = db.Column(db.DateTime(timezone=True))
    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now())
    updated_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now(), onupdate=db.func.now())

    def __repr__(self):
        return f'<ReportBookDesign {self.id} {self.status}>'


class ReportDesignAsset(db.Model):
    """shop.report_design_assets — 會員為實體書上傳的照片（私有儲存）。"""
    __tablename__ = 'report_design_assets'
    __table_args__ = {'schema': 'shop'}

    id = db.Column(db.BigInteger, primary_key=True)
    design_id = db.Column(db.BigInteger, db.ForeignKey('shop.report_book_designs.id', ondelete='CASCADE'),
                          nullable=False, index=True)
    file_key = db.Column(db.Text, nullable=False)
    filename = db.Column(db.Text, nullable=False)
    content_type = db.Column(db.String(50), nullable=False)
    bytes = db.Column(db.BigInteger, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now())

    def __repr__(self):
        return f'<ReportDesignAsset {self.id} design={self.design_id}>'


class ReportMailOutbox(db.Model):
    """shop.report_mail_outbox — 訂單通知信的內容，讓寄失敗的信可以重試（階段 1 ①，2026-10-17）。

    與 shop.order_notifications 一對一：那張表仍是「寄過沒有／寄幾次／錯誤」的帳本（dedupe_key 防重寄），
    這張只存重寄需要的標題、內文與下次重試時間。放在站台鏈而不是 commerce 鏈：
    order_notifications 屬共用套件，改它會連帶要求 Claire 的正式庫升級。
    next_attempt_at：NULL＝不再自動重試（已寄出或已用完次數）；寄出 30 天後內文會被清除（只留帳本）。
    """
    __tablename__ = 'report_mail_outbox'
    __table_args__ = (db.UniqueConstraint('notification_id', name='uq_report_mail_outbox_notification'),
                      {'schema': 'shop'})

    id = db.Column(db.BigInteger, primary_key=True)
    notification_id = db.Column(db.Integer, db.ForeignKey(_q('order_notifications.id', _SHOP_SCHEMA), ondelete='CASCADE'),
                                nullable=False)
    subject = db.Column(db.Text, nullable=False)
    body = db.Column(db.Text, nullable=True)
    next_attempt_at = db.Column(db.DateTime, nullable=True, index=True)  # UTC（與 order_notifications 一致，不帶時區）
    last_attempt_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<ReportMailOutbox notification={self.notification_id}>'


class ReportJobRun(db.Model):
    """shop.report_job_runs — 背景排程每個工作最後一次執行的結果（extensions/report_orders/jobs.py）。

    用途：決定工作是否到期（例：清理每天一次），以及讓後台看得出排程是不是還活著。
    """
    __tablename__ = 'report_job_runs'
    __table_args__ = {'schema': 'shop'}

    job = db.Column(db.String(50), primary_key=True)
    last_started_at = db.Column(db.DateTime, nullable=True)   # UTC
    last_finished_at = db.Column(db.DateTime, nullable=True)
    last_status = db.Column(db.String(20), nullable=True)     # ok / error
    last_result = db.Column(db.Text, nullable=True)
    last_error = db.Column(db.Text, nullable=True)

    def __repr__(self):
        return f'<ReportJobRun {self.job} {self.last_status}>'



class ExternalCustomer(db.Model):
    """shop.external_customers — 外部平台客人檔案（代客建單，2026-10-20；docs/external-proxy-orders-plan.md）。

    底層是一個不能登入的會員帳號（信箱為 *@customers.polaris-parent.invalid，寄信一律略過），
    讓訂單與命盤依客人歸檔；之後客人可用認領碼把檔案轉到自己的正式帳號（第五項）。
    """
    __tablename__ = 'external_customers'
    __table_args__ = {'schema': 'shop'}

    id = db.Column(db.BigInteger, primary_key=True)
    app_user_id = db.Column(db.BigInteger, db.ForeignKey('account.app_users.id'), nullable=False, unique=True)
    channel_id = db.Column(db.BigInteger, db.ForeignKey('shop.commerce_channels.id'))  # 第一次認識的平台
    display_name = db.Column(db.Text, nullable=False)       # 平台上的名稱（給管理者辨識）
    platform_handle = db.Column(db.Text)                    # 平台帳號／ID
    contact_note = db.Column(db.Text)                       # 聯絡備註（只在後台）
    claim_code_digest = db.Column(db.String(64), unique=True)  # 認領碼 HMAC 雜湊（第五項；claims.py）
    claim_code_issued_at = db.Column(db.DateTime(timezone=True))
    claim_code_expires_at = db.Column(db.DateTime(timezone=True))
    # 認領後紫微那邊（命主歸屬、工作單）的轉移狀態：走 PolarisUI 服務 API，失敗由背景排程重試（claims.py）
    ziwei_transferred_at = db.Column(db.DateTime(timezone=True))
    ziwei_transfer_attempts = db.Column(db.Integer, nullable=False, default=0, server_default='0')
    ziwei_transfer_error = db.Column(db.Text)
    claimed_by = db.Column(db.BigInteger, db.ForeignKey('account.app_users.id'))
    claimed_at = db.Column(db.DateTime(timezone=True))
    created_by = db.Column(db.BigInteger, db.ForeignKey('account.app_users.id'))
    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now())
    updated_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now(), onupdate=db.func.now())

    def __repr__(self):
        return f'<ExternalCustomer {self.id} {self.display_name}>'


SOURCE_KINDS = ('conversation', 'link', 'screenshot', 'note')


class OrderSourceRecord(db.Model):
    """shop.order_source_records — 訂單資料的來源：哪個平台、哪天、哪段對話給的（代客建單）。

    文字摘錄／連結直接存；截圖存私有儲存（file_key），以短效憑證開啟。只有後台看得到。
    """
    __tablename__ = 'order_source_records'
    __table_args__ = (
        db.CheckConstraint("kind IN ('conversation','link','screenshot','note')", name='ck_order_source_records_kind'),
        {'schema': 'shop'},
    )

    id = db.Column(db.BigInteger, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey(_q('orders.id', _SHOP_SCHEMA), ondelete='CASCADE'),
                         nullable=False, index=True)
    kind = db.Column(db.String(20), nullable=False)
    channel_id = db.Column(db.BigInteger, db.ForeignKey('shop.commerce_channels.id'))
    occurred_on = db.Column(db.Date)                         # 對話日期
    summary = db.Column(db.Text)                             # 對話摘錄或說明
    url = db.Column(db.Text)
    file_key = db.Column(db.Text)
    filename = db.Column(db.Text)
    content_type = db.Column(db.String(50))
    bytes = db.Column(db.BigInteger)
    created_by = db.Column(db.BigInteger, db.ForeignKey('account.app_users.id'))
    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now())

    def __repr__(self):
        return f'<OrderSourceRecord order={self.order_id} {self.kind}>'
