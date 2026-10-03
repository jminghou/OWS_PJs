"""membership v2: report_fulfillments / shipments / member_email_verifications

會員 v2（docs/membership-v2-ziwei-contract.md §3）：
- shop.report_fulfillments：報告訂單項目 ↔ 紫微命盤與工作單的交接狀態
- shop.shipments：實體書出貨（印刷廠在系統外，由管理者登錄）
- blog.member_email_verifications：會員 Email 驗證紀錄（哪個 Email、何時通過）

依賴 commerce 鏈 0002_orders_v2 的 shop.order_items，部署順序 core → commerce → 站台。
驗證紀錄不加在 blog.member_profiles：該表由 postgres 以 SQL 建立，
blog_app 不是擁有者、無法 ALTER，正式庫要另找 postgres 帳號執行，所以另建本站擁有的表。

Revision ID: 0004_membership_v2
Revises: 0003_media_lib
Create Date: 2026-10-03
"""
from alembic import op
import sqlalchemy as sa

revision = '0004_membership_v2'
down_revision = '0003_media_lib'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'member_email_verifications',
        sa.Column('app_user_id', sa.BigInteger(), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('verified_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['app_user_id'], ['account.app_users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('app_user_id'),
        schema='blog',
    )

    op.create_table(
        'report_fulfillments',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('order_item_id', sa.Integer(), nullable=False),
        sa.Column('request_no', sa.String(length=32), nullable=False),
        sa.Column('member_id', sa.BigInteger(), nullable=False),
        sa.Column('chart_id', sa.BigInteger(), nullable=True),
        sa.Column('person_user_id', sa.BigInteger(), nullable=True),
        sa.Column('environment', sa.String(length=10), nullable=True),
        sa.Column('handoff_status', sa.String(length=20), server_default='not_ready', nullable=False),
        sa.Column('handoff_attempts', sa.Integer(), server_default='0', nullable=False),
        sa.Column('last_error', sa.Text(), nullable=True),
        sa.Column('sent_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('ziwei_status', sa.String(length=20), nullable=True),
        sa.Column('member_note', sa.Text(), nullable=True),
        sa.Column('deliverable_ready_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('synced_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['member_id'], ['account.app_users.id']),
        sa.ForeignKeyConstraint(['order_item_id'], ['shop.order_items.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('order_item_id'),
        sa.UniqueConstraint('request_no'),
        sa.CheckConstraint(
            "handoff_status IN ('not_ready','pending','sent','failed','cancelled')",
            name='ck_report_fulfillments_handoff_status'),
        schema='shop',
    )
    op.create_index('ix_shop_report_fulfillments_member_id', 'report_fulfillments', ['member_id'], schema='shop')
    op.create_index('ix_shop_report_fulfillments_handoff_status', 'report_fulfillments', ['handoff_status'],
                    schema='shop')

    op.create_table(
        'shipments',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('order_item_id', sa.Integer(), nullable=False),
        sa.Column('recipient_name', sa.Text(), nullable=False),
        sa.Column('recipient_phone', sa.Text(), nullable=False),
        sa.Column('postal_code', sa.String(length=10), nullable=True),
        sa.Column('address', sa.Text(), nullable=False),
        sa.Column('status', sa.String(length=20), server_default='pending', nullable=False),
        sa.Column('printer', sa.Text(), nullable=True),
        sa.Column('carrier', sa.Text(), nullable=True),
        sa.Column('tracking_no', sa.Text(), nullable=True),
        sa.Column('print_sent_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('shipped_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('delivered_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('note', sa.Text(), nullable=True),
        sa.Column('updated_by', sa.BigInteger(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['order_item_id'], ['shop.order_items.id']),
        sa.ForeignKeyConstraint(['updated_by'], ['account.app_users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('order_item_id'),
        sa.CheckConstraint(
            "status IN ('pending','printing','shipped','delivered','cancelled')",
            name='ck_shipments_status'),
        schema='shop',
    )
    op.create_index('ix_shop_shipments_status', 'shipments', ['status'], schema='shop')


def downgrade():
    op.drop_table('shipments', schema='shop')
    op.drop_table('report_fulfillments', schema='shop')
    op.drop_table('member_email_verifications', schema='blog')
