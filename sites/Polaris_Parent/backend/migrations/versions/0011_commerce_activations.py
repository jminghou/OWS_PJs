"""Account-bound activation codes; no historical grants or payment changes."""
from alembic import op
import sqlalchemy as sa

revision = '0011_commerce_activations'
down_revision = '0010_commerce_foundation'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('commerce_activations',
        sa.Column('id', sa.BigInteger(), primary_key=True),
        sa.Column('entitlement_id', sa.BigInteger(), sa.ForeignKey('shop.commerce_entitlements.id'), nullable=False),
        sa.Column('code_digest', sa.String(64), nullable=False, unique=True),
        sa.Column('recipient_id', sa.BigInteger(), sa.ForeignKey('account.app_users.id'), nullable=False),
        sa.Column('issued_by', sa.BigInteger(), sa.ForeignKey('account.app_users.id'), nullable=False),
        sa.Column('status', sa.String(20), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('redeemed_at', sa.DateTime(timezone=True)),
        sa.Column('revoked_at', sa.DateTime(timezone=True)),
        sa.Column('revoke_reason', sa.Text()),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint("status IN ('issued','redeemed','revoked')", name='ck_commerce_activation_status'),
        schema='shop')
    op.create_index('ix_shop_commerce_activations_entitlement_id', 'commerce_activations', ['entitlement_id'], schema='shop')
    op.create_index('uq_commerce_activation_open', 'commerce_activations', ['entitlement_id'], unique=True,
                    postgresql_where=sa.text("status = 'issued'"), schema='shop')


def downgrade():
    if op.get_bind().execute(sa.text('SELECT 1 FROM shop.commerce_activations LIMIT 1')).first():
        raise RuntimeError('Activation records exist; retain gates and audit history.')
    op.drop_table('commerce_activations', schema='shop')
