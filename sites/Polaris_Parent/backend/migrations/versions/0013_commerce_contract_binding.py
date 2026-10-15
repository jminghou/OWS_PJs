"""Reviewed external SKU mappings and one-to-one receipt/contract bindings."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = '0013_commerce_contract_binding'
down_revision = '0012_commerce_intake'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('commerce_product_mappings',
        sa.Column('id', sa.BigInteger(), primary_key=True),
        sa.Column('channel_id', sa.BigInteger(), sa.ForeignKey('shop.commerce_channels.id'), nullable=False),
        sa.Column('external_sku', sa.String(200), nullable=False),
        sa.Column('revision', sa.Integer(), nullable=False),
        sa.Column('active', sa.Boolean(), nullable=False),
        sa.Column('profile', JSONB(), nullable=False),
        sa.Column('policy_reference', sa.String(1000), nullable=False),
        sa.Column('review_note', sa.String(1000), nullable=False),
        sa.Column('reviewed_by', sa.BigInteger(), sa.ForeignKey('account.app_users.id'), nullable=False),
        sa.Column('valid_until', sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint('channel_id', 'external_sku', name='uq_commerce_product_mapping'),
        sa.CheckConstraint('revision > 0', name='ck_commerce_mapping_revision'), schema='shop')
    op.create_table('commerce_receipt_bindings',
        sa.Column('id', sa.BigInteger(), primary_key=True),
        sa.Column('receipt_id', sa.BigInteger(), sa.ForeignKey('shop.commerce_external_receipts.id'), nullable=False, unique=True),
        sa.Column('order_id', sa.Integer(), sa.ForeignKey('shop.orders.id'), nullable=False, unique=True),
        sa.Column('actor_id', sa.BigInteger(), sa.ForeignKey('account.app_users.id'), nullable=False),
        sa.Column('fingerprint', sa.String(64), nullable=False),
        sa.Column('snapshot', JSONB(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()), schema='shop')


def downgrade():
    for name in ('commerce_receipt_bindings', 'commerce_product_mappings'):
        if op.get_bind().execute(sa.text(f'SELECT 1 FROM shop.{name} LIMIT 1')).first():
            raise RuntimeError('External contract history exists; preserve mappings and bindings.')
    op.drop_table('commerce_receipt_bindings', schema='shop')
    op.drop_table('commerce_product_mappings', schema='shop')
