"""Add commerce contracts without changing shared orders or granting historical rights.

Revision ID: 0010_commerce_foundation
Revises: 0009_consult_preferences
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql as pg

revision = '0010_commerce_foundation'
down_revision = '0009_consult_preferences'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('commerce_sources',
        sa.Column('order_id', sa.Integer(), sa.ForeignKey('shop.orders.id'), primary_key=True),
        sa.Column('channel', sa.String(40), nullable=False),
        sa.Column('store_key', sa.String(100), nullable=False),
        sa.Column('external_order_id', sa.String(200)),
        sa.Column('contract_version', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint('channel', 'store_key', 'external_order_id', name='uq_commerce_source_external'), schema='shop')
    op.create_table('commerce_lines',
        sa.Column('order_item_id', sa.Integer(), sa.ForeignKey('shop.order_items.id'), primary_key=True),
        sa.Column('unit_amount', sa.Integer(), nullable=False),
        sa.Column('quantity', sa.Integer(), nullable=False),
        sa.Column('line_total', sa.Integer(), nullable=False),
        sa.Column('currency', sa.String(10), nullable=False),
        sa.Column('currency_exponent', sa.Integer(), nullable=False),
        sa.Column('print_copies', sa.Integer(), nullable=False),
        sa.Column('components', pg.JSONB(), nullable=False),
        sa.Column('rights', pg.JSONB(), nullable=False),
        sa.CheckConstraint('unit_amount >= 0 AND quantity > 0 AND print_copies >= 0', name='ck_commerce_line_amounts'),
        sa.CheckConstraint('line_total = unit_amount * quantity', name='ck_commerce_line_total'), schema='shop')
    op.create_table('commerce_entitlements',
        sa.Column('id', sa.BigInteger(), primary_key=True),
        sa.Column('order_item_id', sa.Integer(), sa.ForeignKey('shop.order_items.id'), nullable=False),
        sa.Column('kind', sa.String(40), nullable=False),
        sa.Column('unit_index', sa.Integer(), nullable=False),
        sa.Column('holder_id', sa.BigInteger(), sa.ForeignKey('account.app_users.id'), nullable=False),
        sa.Column('operator_id', sa.BigInteger(), sa.ForeignKey('account.app_users.id'), nullable=False),
        sa.Column('status', sa.String(20), nullable=False),
        sa.Column('rights', pg.JSONB(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('revoked_at', sa.DateTime(timezone=True)),
        sa.Column('revoke_reason', sa.Text()),
        sa.UniqueConstraint('order_item_id', 'kind', 'unit_index', name='uq_commerce_entitlement_unit'),
        sa.CheckConstraint("status IN ('available','in_use','completed','revoked')", name='ck_commerce_entitlement_status'),
        sa.CheckConstraint('unit_index > 0', name='ck_commerce_entitlement_unit'), schema='shop')
    op.create_index('ix_shop_commerce_entitlements_order_item_id', 'commerce_entitlements', ['order_item_id'], schema='shop')
    op.create_table('commerce_tasks',
        sa.Column('id', sa.BigInteger(), primary_key=True),
        sa.Column('entitlement_id', sa.BigInteger(), sa.ForeignKey('shop.commerce_entitlements.id'), nullable=False, unique=True),
        sa.Column('target_kind', sa.String(40), nullable=False),
        sa.Column('target_id', sa.BigInteger(), nullable=False),
        sa.Column('status', sa.String(20), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint("status IN ('started','completed','cancelled')", name='ck_commerce_task_status'), schema='shop')
    op.create_table('commerce_events',
        sa.Column('id', sa.BigInteger(), primary_key=True),
        sa.Column('order_id', sa.Integer(), sa.ForeignKey('shop.orders.id'), nullable=False),
        sa.Column('entitlement_id', sa.BigInteger(), sa.ForeignKey('shop.commerce_entitlements.id')),
        sa.Column('event_key', sa.String(160), nullable=False, unique=True),
        sa.Column('event_type', sa.String(40), nullable=False),
        sa.Column('actor_id', sa.BigInteger(), sa.ForeignKey('account.app_users.id')),
        sa.Column('detail', pg.JSONB(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()), schema='shop')
    op.create_index('ix_shop_commerce_events_order_id', 'commerce_events', ['order_id'], schema='shop')


def downgrade():
    # Refuse to erase production audit/rights records through an accidental rollback.
    conn = op.get_bind()
    for name in ('commerce_sources', 'commerce_lines', 'commerce_entitlements', 'commerce_tasks', 'commerce_events'):
        if conn.execute(sa.text(f'SELECT 1 FROM shop.{name} LIMIT 1')).first():
            raise RuntimeError('Commerce records exist; retain tables and roll back application code only.')
    for name in ('commerce_events', 'commerce_tasks', 'commerce_entitlements', 'commerce_lines', 'commerce_sources'):
        op.drop_table(name, schema='shop')
