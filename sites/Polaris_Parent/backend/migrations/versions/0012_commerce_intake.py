"""Channel reviews and external evidence staging; no payment or entitlement changes."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = '0012_commerce_intake'
down_revision = '0011_commerce_activations'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('commerce_channels',
        sa.Column('id', sa.BigInteger(), primary_key=True),
        sa.Column('channel', sa.String(40), nullable=False),
        sa.Column('store_key', sa.String(100), nullable=False),
        sa.Column('revision', sa.Integer(), nullable=False),
        sa.Column('manual_import', sa.Boolean(), nullable=False),
        sa.Column('policy_reference', sa.String(1000), nullable=False),
        sa.Column('review_note', sa.String(1000), nullable=False),
        sa.Column('reviewed_by', sa.BigInteger(), sa.ForeignKey('account.app_users.id'), nullable=False),
        sa.Column('valid_until', sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint('channel', 'store_key', name='uq_commerce_channel_store'),
        sa.CheckConstraint('revision > 0', name='ck_commerce_channel_revision'), schema='shop')
    op.create_table('commerce_external_receipts',
        sa.Column('id', sa.BigInteger(), primary_key=True),
        sa.Column('channel_id', sa.BigInteger(), sa.ForeignKey('shop.commerce_channels.id'), nullable=False),
        sa.Column('external_order_id', sa.String(200), nullable=False),
        sa.Column('member_id', sa.BigInteger(), sa.ForeignKey('account.app_users.id'), nullable=False),
        sa.Column('amount', sa.Integer(), nullable=False),
        sa.Column('currency', sa.String(10), nullable=False),
        sa.Column('lines', JSONB(), nullable=False),
        sa.Column('fingerprint', sa.String(64), nullable=False),
        sa.Column('status', sa.String(20), nullable=False),
        sa.Column('channel_revision', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint('channel_id', 'external_order_id', name='uq_commerce_external_receipt'),
        sa.CheckConstraint("status IN ('pending','verified','rejected','voided')", name='ck_commerce_receipt_status'),
        sa.CheckConstraint('amount > 0', name='ck_commerce_receipt_amount'), schema='shop')
    op.create_table('commerce_intake_events',
        sa.Column('id', sa.BigInteger(), primary_key=True),
        sa.Column('channel_id', sa.BigInteger(), sa.ForeignKey('shop.commerce_channels.id'), nullable=False),
        sa.Column('receipt_id', sa.BigInteger(), sa.ForeignKey('shop.commerce_external_receipts.id')),
        sa.Column('actor_id', sa.BigInteger(), sa.ForeignKey('account.app_users.id'), nullable=False),
        sa.Column('event_type', sa.String(40), nullable=False),
        sa.Column('detail', JSONB(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()), schema='shop')


def downgrade():
    for name in ('commerce_intake_events', 'commerce_external_receipts', 'commerce_channels'):
        if op.get_bind().execute(sa.text(f'SELECT 1 FROM shop.{name} LIMIT 1')).first():
            raise RuntimeError('External commerce evidence exists; preserve review history.')
    for name in ('commerce_intake_events', 'commerce_external_receipts', 'commerce_channels'):
        op.drop_table(name, schema='shop')
