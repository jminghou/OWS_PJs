"""commerce baseline —— 電商模組的資料表（選用模組）

Revision ID: 0001_commerce_baseline
Revises:

管理範圍：products / product_prices / product_tags / orders / payment_methods（SHOP schema）。
自 core/migrations 的 0001_core_baseline 移出：電商是選用模組，站台不掛就不該有這些表。

部署順序：core 鏈 → **commerce 鏈** → 站台鏈。products 的 FK 指向 core 的
categories / contents / tags，orders 指向 users，所以必須在 core 鏈之後。

對既有資料庫：Polaris / Claire 的這 5 張表早已存在。upgrade() 偵測到就整條跳過、
只記錄版本（版本表 alembic_version_commerce）。
"""
import os

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0001_commerce_baseline'
down_revision = None
branch_labels = None
depends_on = None

BLOG = os.environ.get('OWS_BLOG_SCHEMA') or None
SHOP = os.environ.get('OWS_SHOP_SCHEMA') or None
_IDENTITY_MODE = (os.environ.get('OWS_IDENTITY_MODE') or 'local').strip().lower()
_EXTERNAL_USER_TABLE = os.environ.get('OWS_EXTERNAL_USER_TABLE') or 'account.app_users'


def q(schema, rest):
    return f'{schema}.{rest}' if schema else rest


def ix(schema, rest):
    return f'ix_{schema}_{rest}' if schema else f'ix_{rest}'


if _IDENTITY_MODE == 'external':
    USER_ID_TYPE = sa.BigInteger()
    USER_FK = f'{_EXTERNAL_USER_TABLE}.id'
else:
    USER_ID_TYPE = sa.Integer()
    USER_FK = None


def _user_fk():
    return USER_FK if USER_FK else q(BLOG, 'users.id')


# 哨兵：在所有部署都一定是真表的兩張
_SENTINELS = ('products', 'payment_methods')


def upgrade():
    bind = op.get_bind()
    if SHOP:
        op.execute(f'CREATE SCHEMA IF NOT EXISTS {SHOP}')
    existing = set(sa.inspect(bind).get_table_names(schema=SHOP))
    present = existing & set(_SENTINELS)
    if present == set(_SENTINELS):
        return
    if present:
        raise RuntimeError(f"電商表只有部分存在：{sorted(present)}；請人工確認後再繼續。")

    op.create_table('payment_methods',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('code', sa.String(length=50), nullable=False),
    sa.Column('name', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('description', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('supported_currencies', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('is_active', sa.Boolean(), nullable=True),
    sa.Column('config', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('sort_order', sa.Integer(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.Column('updated_at', sa.DateTime(), nullable=True),
    sa.PrimaryKeyConstraint('id'),
    schema=SHOP
    )
    with op.batch_alter_table('payment_methods', schema=SHOP) as batch_op:
        batch_op.create_index(ix(SHOP, 'payment_methods_code'), ['code'], unique=True)
        batch_op.create_index(ix(SHOP, 'payment_methods_is_active'), ['is_active'], unique=False)

    op.create_table('products',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('product_id', sa.String(length=100), nullable=False),
    sa.Column('names', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('descriptions', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('short_descriptions', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('price', sa.Integer(), nullable=False),
    sa.Column('original_price', sa.Integer(), nullable=True),
    sa.Column('stock_quantity', sa.Integer(), nullable=True),
    sa.Column('stock_status', sa.String(length=20), nullable=True),
    sa.Column('featured_image', sa.String(length=500), nullable=True),
    sa.Column('gallery_images', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('category_id', sa.Integer(), nullable=True),
    sa.Column('is_active', sa.Boolean(), nullable=True),
    sa.Column('is_featured', sa.Boolean(), nullable=True),
    sa.Column('sort_order', sa.Integer(), nullable=True),
    sa.Column('meta_title', sa.String(length=200), nullable=True),
    sa.Column('meta_description', sa.Text(), nullable=True),
    sa.Column('views_count', sa.Integer(), nullable=True),
    sa.Column('sales_count', sa.Integer(), nullable=True),
    sa.Column('detail_content_id', sa.Integer(), nullable=True),
    sa.Column('language', sa.String(length=10), nullable=False),
    sa.Column('original_id', sa.Integer(), nullable=True),
    sa.Column('attributes', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('meta_data', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.Column('updated_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['category_id'], [q(BLOG, 'categories.id')], ),
    sa.ForeignKeyConstraint(['detail_content_id'], [q(BLOG, 'contents.id')], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['original_id'], [q(SHOP, 'products.id')], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('product_id', 'language', name='uq_product_id_language'),
    schema=SHOP
    )
    with op.batch_alter_table('products', schema=SHOP) as batch_op:
        batch_op.create_index(ix(SHOP, 'products_category_id'), ['category_id'], unique=False)
        batch_op.create_index(ix(SHOP, 'products_is_active'), ['is_active'], unique=False)
        batch_op.create_index(ix(SHOP, 'products_language'), ['language'], unique=False)
        batch_op.create_index(ix(SHOP, 'products_product_id'), ['product_id'], unique=False)

    op.create_table('product_prices',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('product_id', sa.Integer(), nullable=False),
    sa.Column('currency', sa.String(length=10), nullable=False),
    sa.Column('price', sa.Integer(), nullable=False),
    sa.Column('original_price', sa.Integer(), nullable=True),
    sa.Column('is_active', sa.Boolean(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.Column('updated_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['product_id'], [q(SHOP, 'products.id')], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('product_id', 'currency', name='uq_product_currency'),
    schema=SHOP
    )
    with op.batch_alter_table('product_prices', schema=SHOP) as batch_op:
        batch_op.create_index(ix(SHOP, 'product_prices_currency'), ['currency'], unique=False)
        batch_op.create_index(ix(SHOP, 'product_prices_is_active'), ['is_active'], unique=False)

    op.create_table('product_tags',
    sa.Column('product_id', sa.Integer(), nullable=False),
    sa.Column('tag_id', sa.Integer(), nullable=False),
    sa.ForeignKeyConstraint(['product_id'], [q(SHOP, 'products.id')], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['tag_id'], [q(BLOG, 'tags.id')], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('product_id', 'tag_id'),
    schema=SHOP
    )
    op.create_table('orders',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('order_no', sa.String(length=50), nullable=False),
    sa.Column('user_id', USER_ID_TYPE, nullable=False),
    sa.Column('amount', sa.Integer(), nullable=False),
    sa.Column('status', sa.String(length=20), nullable=True),
    sa.Column('items', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('language', sa.String(length=10), nullable=False),
    sa.Column('currency', sa.String(length=10), nullable=False),
    sa.Column('payment_method', sa.String(length=50), nullable=True),
    sa.Column('attributes', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.Column('paid_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['user_id'], [_user_fk()], ),
    sa.PrimaryKeyConstraint('id'),
    schema=SHOP
    )
    with op.batch_alter_table('orders', schema=SHOP) as batch_op:
        batch_op.create_index(ix(SHOP, 'orders_currency'), ['currency'], unique=False)
        batch_op.create_index(ix(SHOP, 'orders_order_no'), ['order_no'], unique=True)
        batch_op.create_index(ix(SHOP, 'orders_payment_method'), ['payment_method'], unique=False)
        batch_op.create_index(ix(SHOP, 'orders_status'), ['status'], unique=False)



def downgrade():
    if not (set(sa.inspect(op.get_bind()).get_table_names(schema=SHOP)) & set(_SENTINELS)):
        return
    for name in ('orders', 'product_tags', 'product_prices', 'products', 'payment_methods'):
        op.drop_table(name, schema=SHOP)
