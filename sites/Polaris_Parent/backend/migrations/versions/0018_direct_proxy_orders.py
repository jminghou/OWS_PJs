"""direct proxy orders: commerce_external_receipts 金額允許 0（直接接單的贈送／內部製作）

直接接單（非平台，2026-10-23；report_orders/proxy.py DIRECT_CHANNEL）：管理者幫親友、線下或私訊委託的人建單，
不經外部平台、不必先建渠道。沿用代客建單的成交紀錄（系統內建渠道 direct），所以贈送或內部製作的 0 元單也要
能記一筆成交紀錄 → ck_commerce_receipt_amount 從 amount > 0 放寬為 amount >= 0。
一般平台訂單（外部訂單查證、平台代客建單）仍在程式裡要求金額大於 0，行為不變。

Revision ID: 0018_direct_proxy_orders
Revises: 0017_external_claim_codes
Create Date: 2026-10-23
"""
from alembic import op

revision = '0018_direct_proxy_orders'
down_revision = '0017_external_claim_codes'
branch_labels = None
depends_on = None


def upgrade():
    op.drop_constraint('ck_commerce_receipt_amount', 'commerce_external_receipts', schema='shop', type_='check')
    op.create_check_constraint('ck_commerce_receipt_amount', 'commerce_external_receipts', 'amount >= 0', schema='shop')


def downgrade():
    op.drop_constraint('ck_commerce_receipt_amount', 'commerce_external_receipts', schema='shop', type_='check')
    op.create_check_constraint('ck_commerce_receipt_amount', 'commerce_external_receipts', 'amount > 0', schema='shop')
