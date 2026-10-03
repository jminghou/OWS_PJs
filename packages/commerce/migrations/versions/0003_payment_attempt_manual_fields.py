"""payment_attempts：人工收款的回報欄位

Revision ID: 0003_payment_manual_fields
Revises: 0002_orders_v2

付款人回報的轉帳日期、備註，以及管理者確認／退回時的備註。
payment_attempts 是 0002 新建的表、只有用到新流程的站台會查詢，加欄位不影響 Claire。
"""
import os

from alembic import op
import sqlalchemy as sa

revision = '0003_payment_manual_fields'
down_revision = '0002_orders_v2'
branch_labels = None
depends_on = None

SHOP = os.environ.get('OWS_SHOP_SCHEMA') or None


def upgrade():
    op.add_column('payment_attempts', sa.Column('transferred_on', sa.Date(), nullable=True), schema=SHOP)
    op.add_column('payment_attempts', sa.Column('payer_note', sa.Text(), nullable=True), schema=SHOP)
    op.add_column('payment_attempts', sa.Column('review_note', sa.Text(), nullable=True), schema=SHOP)


def downgrade():
    for col in ('review_note', 'payer_note', 'transferred_on'):
        op.drop_column('payment_attempts', col, schema=SHOP)
