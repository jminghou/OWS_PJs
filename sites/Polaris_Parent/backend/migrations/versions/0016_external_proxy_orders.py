"""external proxy orders: shop.external_customers / shop.order_source_records / shipments.country

外部平台代客建單（2026-10-20；docs/external-proxy-orders-plan.md 第 1–4 節）：
  external_customers     外部平台客人檔案（底層是不能登入的會員帳號，之後可認領）
  order_source_records   訂單資料來源：平台、對話日期、對話摘錄／連結／截圖
  shipments.country      出貨國家（ISO 國碼；NULL＝台灣），postal_code 放寬到 12 字給海外郵遞區號
純新增；舊程式碼不受影響。

Revision ID: 0016_external_proxy_orders
Revises: 0015_report_print_proofs
Create Date: 2026-10-21
"""
from alembic import op
import sqlalchemy as sa

revision = '0016_external_proxy_orders'
down_revision = '0015_report_print_proofs'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('shipments', sa.Column('country', sa.String(2), nullable=True), schema='shop')
    op.alter_column('shipments', 'postal_code', type_=sa.String(12), existing_type=sa.String(10),
                    existing_nullable=True, schema='shop')
    op.create_table(
        'external_customers',
        sa.Column('id', sa.BigInteger(), primary_key=True),
        sa.Column('app_user_id', sa.BigInteger(), sa.ForeignKey('account.app_users.id'), nullable=False, unique=True),
        sa.Column('channel_id', sa.BigInteger(), sa.ForeignKey('shop.commerce_channels.id'), nullable=True),
        sa.Column('display_name', sa.Text(), nullable=False),
        sa.Column('platform_handle', sa.Text(), nullable=True),
        sa.Column('contact_note', sa.Text(), nullable=True),
        sa.Column('claim_code_digest', sa.String(64), nullable=True),
        sa.Column('claimed_by', sa.BigInteger(), sa.ForeignKey('account.app_users.id'), nullable=True),
        sa.Column('claimed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_by', sa.BigInteger(), sa.ForeignKey('account.app_users.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        schema='shop',
    )
    op.create_table(
        'order_source_records',
        sa.Column('id', sa.BigInteger(), primary_key=True),
        sa.Column('order_id', sa.Integer(), sa.ForeignKey('shop.orders.id', ondelete='CASCADE'), nullable=False),
        sa.Column('kind', sa.String(20), nullable=False),
        sa.Column('channel_id', sa.BigInteger(), sa.ForeignKey('shop.commerce_channels.id'), nullable=True),
        sa.Column('occurred_on', sa.Date(), nullable=True),
        sa.Column('summary', sa.Text(), nullable=True),
        sa.Column('url', sa.Text(), nullable=True),
        sa.Column('file_key', sa.Text(), nullable=True),
        sa.Column('filename', sa.Text(), nullable=True),
        sa.Column('content_type', sa.String(50), nullable=True),
        sa.Column('bytes', sa.BigInteger(), nullable=True),
        sa.Column('created_by', sa.BigInteger(), sa.ForeignKey('account.app_users.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.CheckConstraint("kind IN ('conversation','link','screenshot','note')", name='ck_order_source_records_kind'),
        schema='shop',
    )
    op.create_index('ix_shop_order_source_records_order_id', 'order_source_records', ['order_id'], schema='shop')


def downgrade():
    op.drop_index('ix_shop_order_source_records_order_id', table_name='order_source_records', schema='shop')
    op.drop_table('order_source_records', schema='shop')
    op.drop_table('external_customers', schema='shop')
    op.alter_column('shipments', 'postal_code', type_=sa.String(10), existing_type=sa.String(12),
                    existing_nullable=True, schema='shop')
    op.drop_column('shipments', 'country', schema='shop')
