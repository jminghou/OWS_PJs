"""page modules: shop.page_modules（行銷管理「模組管理」）

2026-10-28：商品頁與目錄頁的內容區塊（介紹、亮點、FAQ…）改成獨立模組，商品用選單引用。
一個模組一種語言一筆（unique module_key + language）。純新增一張表，舊程式碼不受影響；
商品還沒指定模組時前台照舊讀 attributes.report_display。

Revision ID: 0019_page_modules
Revises: 0018_direct_proxy_orders
Create Date: 2026-10-28
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = '0019_page_modules'
down_revision = '0018_direct_proxy_orders'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'page_modules',
        sa.Column('id', sa.BigInteger(), primary_key=True),
        sa.Column('module_key', sa.String(80), nullable=False),
        sa.Column('language', sa.String(10), nullable=False),
        sa.Column('type', sa.String(30), nullable=False),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('data', JSONB(), nullable=False, server_default='{}'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('original_id', sa.BigInteger(),
                  sa.ForeignKey('shop.page_modules.id', ondelete='SET NULL'), nullable=True),
        sa.Column('meta_data', JSONB(), nullable=False, server_default='{}'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.UniqueConstraint('module_key', 'language', name='uq_page_modules_key_language'),
        schema='shop',
    )
    op.create_index('ix_shop_page_modules_module_key', 'page_modules', ['module_key'], schema='shop')


def downgrade():
    op.drop_index('ix_shop_page_modules_module_key', table_name='page_modules', schema='shop')
    op.drop_table('page_modules', schema='shop')
