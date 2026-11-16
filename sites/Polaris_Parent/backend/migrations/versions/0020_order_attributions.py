"""order attributions: shop.order_attributions（官網訂單來源歸因）

2026-11-16：官網建單時一併記下客人的首次／最近一次來源（UTM、referrer host、落地頁）
與結帳頁的「你從哪裡知道我們」問卷。一筆訂單最多一筆，只有後台看得到；
純新增一張表，舊程式碼不受影響。寫入失敗不擋單（見 report_orders/attribution.py）。
first_touch_at：由 attribution.first.at 推得的首次接觸時間（UTC），驗證不過就留 NULL。

Revision ID: 0020_order_attributions
Revises: 0019_page_modules
Create Date: 2026-11-16
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = '0020_order_attributions'
down_revision = '0019_page_modules'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'order_attributions',
        sa.Column('order_id', sa.Integer(), sa.ForeignKey('shop.orders.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('first_touch', JSONB(), nullable=True),
        sa.Column('last_touch', JSONB(), nullable=True),
        sa.Column('first_touch_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('survey_choice', sa.String(20), nullable=True),
        sa.Column('survey_other', sa.String(100), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        schema='shop',
    )


def downgrade():
    op.drop_table('order_attributions', schema='shop')
