"""orders v2 —— 結帳資訊、訂單項目、付款嘗試／通知、發票、通知信紀錄

Revision ID: 0002_orders_v2
Revises: 0001_commerce_baseline

只新增表，不改既有表：Claire 的庫不跑 commerce 鏈，若在 orders 加欄位，
Order 模型查詢就會在 Claire 失敗。新表只有站台用到新流程時才會被查詢。

  order_checkouts        1:1 orders：送出冪等鍵、交易政策同意、待付款期限
  order_items            每項購買一列，對外 item_no；加購以 parent_item_id 指向原項目
  payment_attempts       每次付款嘗試（attempt_no ≤20 英數，對應綠界 MerchantTradeNo）；
                         部分唯一索引保證同一訂單最多一筆 succeeded
  payment_notifications  每則金流通知原文與處理結果
  order_invoices         發票選項快照與開立結果（未開發票功能時 status=not_applicable）
  order_notifications    通知信紀錄，dedupe_key 唯一，重送不重複寄信
"""
import os

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0002_orders_v2'
down_revision = '0001_commerce_baseline'
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
    USER_FK = q(BLOG, 'users.id')

JSONB = postgresql.JSONB(astext_type=sa.Text())


def upgrade():
    op.create_table('order_checkouts',
        sa.Column('order_id', sa.Integer(), nullable=False),
        sa.Column('submission_key', sa.String(length=64), nullable=False),
        sa.Column('policy_version', sa.String(length=32), nullable=True),
        sa.Column('policy_consented_at', sa.DateTime(), nullable=True),
        sa.Column('expires_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['order_id'], [q(SHOP, 'orders.id')], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('order_id'),
        sa.UniqueConstraint('submission_key'),
        schema=SHOP,
    )
    op.create_index(ix(SHOP, 'order_checkouts_expires_at'), 'order_checkouts', ['expires_at'], schema=SHOP)

    op.create_table('order_items',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('order_id', sa.Integer(), nullable=False),
        sa.Column('item_no', sa.String(length=32), nullable=False),
        sa.Column('product_id', sa.Integer(), nullable=True),
        sa.Column('product_code', sa.String(length=100), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('variant', sa.String(length=30), nullable=True),
        sa.Column('kind', sa.String(length=20), nullable=False),
        sa.Column('parent_item_id', sa.Integer(), nullable=True),
        sa.Column('unit_price', sa.Integer(), nullable=False),
        sa.Column('currency', sa.String(length=10), nullable=False),
        sa.Column('quantity', sa.Integer(), nullable=False),
        sa.Column('customization', JSONB, nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['order_id'], [q(SHOP, 'orders.id')], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['parent_item_id'], [q(SHOP, 'order_items.id')], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['product_id'], [q(SHOP, 'products.id')], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        schema=SHOP,
    )
    op.create_index(ix(SHOP, 'order_items_item_no'), 'order_items', ['item_no'], unique=True, schema=SHOP)
    op.create_index(ix(SHOP, 'order_items_order_id'), 'order_items', ['order_id'], schema=SHOP)
    op.create_index(ix(SHOP, 'order_items_parent_item_id'), 'order_items', ['parent_item_id'], schema=SHOP)
    op.create_index(ix(SHOP, 'order_items_product_id'), 'order_items', ['product_id'], schema=SHOP)

    op.create_table('payment_attempts',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('attempt_no', sa.String(length=20), nullable=False),
        sa.Column('order_id', sa.Integer(), nullable=False),
        sa.Column('provider', sa.String(length=20), nullable=False),
        sa.Column('environment', sa.String(length=10), nullable=False),
        sa.Column('amount', sa.Integer(), nullable=False),
        sa.Column('currency', sa.String(length=10), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('provider_trade_no', sa.String(length=64), nullable=True),
        sa.Column('paid_at', sa.DateTime(), nullable=True),
        sa.Column('confirmed_by', USER_ID_TYPE, nullable=True),
        sa.Column('manual_reference', sa.String(length=64), nullable=True),
        sa.Column('note', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['confirmed_by'], [USER_FK]),
        sa.ForeignKeyConstraint(['order_id'], [q(SHOP, 'orders.id')]),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('provider', 'provider_trade_no', name='uq_payment_attempts_provider_trade_no'),
        schema=SHOP,
    )
    op.create_index(ix(SHOP, 'payment_attempts_attempt_no'), 'payment_attempts', ['attempt_no'],
                    unique=True, schema=SHOP)
    op.create_index(ix(SHOP, 'payment_attempts_order_id'), 'payment_attempts', ['order_id'], schema=SHOP)
    op.create_index(ix(SHOP, 'payment_attempts_status'), 'payment_attempts', ['status'], schema=SHOP)
    op.create_index('uq_payment_attempts_one_success', 'payment_attempts', ['order_id'], unique=True,
                    schema=SHOP, postgresql_where=sa.text("status = 'succeeded'"))

    op.create_table('payment_notifications',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('provider', sa.String(length=20), nullable=False),
        sa.Column('environment', sa.String(length=10), nullable=False),
        sa.Column('attempt_id', sa.Integer(), nullable=True),
        sa.Column('provider_trade_no', sa.String(length=64), nullable=True),
        sa.Column('payload', JSONB, nullable=False),
        sa.Column('signature_valid', sa.Boolean(), nullable=True),
        sa.Column('result', sa.String(length=30), nullable=True),
        sa.Column('error', sa.Text(), nullable=True),
        sa.Column('received_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['attempt_id'], [q(SHOP, 'payment_attempts.id')], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        schema=SHOP,
    )
    op.create_index(ix(SHOP, 'payment_notifications_attempt_id'), 'payment_notifications',
                    ['attempt_id'], schema=SHOP)
    op.create_index(ix(SHOP, 'payment_notifications_provider_trade_no'), 'payment_notifications',
                    ['provider_trade_no'], schema=SHOP)

    op.create_table('order_invoices',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('order_id', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('carrier_type', sa.String(length=20), nullable=True),
        sa.Column('carrier_num', sa.String(length=64), nullable=True),
        sa.Column('buyer_tax_id', sa.String(length=8), nullable=True),
        sa.Column('buyer_name', sa.String(length=100), nullable=True),
        sa.Column('love_code', sa.String(length=7), nullable=True),
        sa.Column('notify_email', sa.String(length=255), nullable=True),
        sa.Column('invoice_no', sa.String(length=10), nullable=True),
        sa.Column('invoice_date', sa.DateTime(), nullable=True),
        sa.Column('random_number', sa.String(length=4), nullable=True),
        sa.Column('issued_via', sa.String(length=10), nullable=True),
        sa.Column('error', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['order_id'], [q(SHOP, 'orders.id')], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('order_id'),
        schema=SHOP,
    )

    op.create_table('order_notifications',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('order_id', sa.Integer(), nullable=False),
        sa.Column('order_item_id', sa.Integer(), nullable=True),
        sa.Column('event', sa.String(length=50), nullable=False),
        sa.Column('dedupe_key', sa.String(length=120), nullable=False),
        sa.Column('recipient', sa.String(length=255), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('attempts', sa.Integer(), nullable=False),
        sa.Column('error', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('sent_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['order_id'], [q(SHOP, 'orders.id')], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['order_item_id'], [q(SHOP, 'order_items.id')], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('dedupe_key'),
        schema=SHOP,
    )
    op.create_index(ix(SHOP, 'order_notifications_order_id'), 'order_notifications', ['order_id'], schema=SHOP)


def downgrade():
    for name in ('order_notifications', 'order_invoices', 'payment_notifications',
                 'payment_attempts', 'order_items', 'order_checkouts'):
        op.drop_table(name, schema=SHOP)
