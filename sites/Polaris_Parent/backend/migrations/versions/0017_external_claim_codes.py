"""external claim codes: shop.external_customers 認領碼的發出時間、期限、唯一索引

外部平台客人認領（2026-10-21；docs/external-proxy-orders-plan.md 第 8 節）：
管理者為客人檔案發一組認領碼（只存 HMAC 雜湊，0016 已有 claim_code_digest），客人到官網註冊後輸入，
這份檔案的訂單與命盤轉到他的正式帳號。重發＝舊碼作廢；用過即失效。
  claim_code_issued_at   發出時間（後台顯示「已發碼」）
  claim_code_expires_at  期限（預設 90 天，過期要重發）
  uq_external_customers_claim_code  雜湊唯一（查碼走索引；兩份檔案不會撞同一組碼）
  ziwei_transferred_at / ziwei_transfer_attempts / ziwei_transfer_error
                         認領後把紫微那邊的命主歸屬與工作單轉給會員（PolarisUI /public/members/transfer）的同步狀態：
                         官網資料庫角色不能寫紫微的表，所以這一步走服務 API，失敗由背景排程重試
純新增；舊程式碼不受影響。

Revision ID: 0017_external_claim_codes
Revises: 0016_external_proxy_orders
Create Date: 2026-10-21
"""
from alembic import op
import sqlalchemy as sa

revision = '0017_external_claim_codes'
down_revision = '0016_external_proxy_orders'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('external_customers', sa.Column('claim_code_issued_at', sa.DateTime(timezone=True), nullable=True),
                  schema='shop')
    op.add_column('external_customers', sa.Column('claim_code_expires_at', sa.DateTime(timezone=True), nullable=True),
                  schema='shop')
    op.add_column('external_customers', sa.Column('ziwei_transferred_at', sa.DateTime(timezone=True), nullable=True),
                  schema='shop')
    op.add_column('external_customers', sa.Column('ziwei_transfer_attempts', sa.Integer(), nullable=False,
                                                  server_default='0'), schema='shop')
    op.add_column('external_customers', sa.Column('ziwei_transfer_error', sa.Text(), nullable=True), schema='shop')
    op.create_index('uq_external_customers_claim_code', 'external_customers', ['claim_code_digest'], unique=True,
                    schema='shop', postgresql_where=sa.text('claim_code_digest IS NOT NULL'))


def downgrade():
    op.drop_index('uq_external_customers_claim_code', table_name='external_customers', schema='shop')
    op.drop_column('external_customers', 'ziwei_transfer_error', schema='shop')
    op.drop_column('external_customers', 'ziwei_transfer_attempts', schema='shop')
    op.drop_column('external_customers', 'ziwei_transferred_at', schema='shop')
    op.drop_column('external_customers', 'claim_code_expires_at', schema='shop')
    op.drop_column('external_customers', 'claim_code_issued_at', schema='shop')
