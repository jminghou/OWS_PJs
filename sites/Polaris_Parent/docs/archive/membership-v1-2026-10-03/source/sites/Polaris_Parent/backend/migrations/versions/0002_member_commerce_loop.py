"""member commerce loop: product_types / coupon_configs / order_submissions / reward_grants / saved_articles

親紫之間 會員系統 §6：驗證消費 → 審核 → 發券。
所有新表落在 shop / blog schema；跨 schema FK 指 account.app_users.id（沿用既有 orders.user_id 模式）。
chart_id / related_chart_id 為對 account.user_profiles.chart_id 的軟參照（不下硬 FK）。

Revision ID: 0002_member_commerce_loop
Revises: 0001_phase2_identity
Create Date: 2026-06-09

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0002_member_commerce_loop'
down_revision = '0001_phase2_identity'
branch_labels = None
depends_on = None


def upgrade():
    # ── shop.product_types（外部商品：蝦皮/Pinkoi 導流連結）──────────────
    op.create_table(
        'product_types',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('name', sa.Text(), nullable=False),
        sa.Column('platform', sa.Text(), nullable=True),
        sa.Column('external_url', sa.Text(), nullable=True),
        sa.Column('active', sa.Boolean(), server_default=sa.text('true'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        schema='shop',
    )

    # ── shop.coupon_configs（目前有效共用折扣碼，A 全開放）────────────────
    op.create_table(
        'coupon_configs',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('code', sa.Text(), nullable=False),
        sa.Column('platform', sa.Text(), nullable=True),
        sa.Column('discount_desc', sa.Text(), nullable=True),
        sa.Column('valid_from', sa.DateTime(timezone=True), nullable=True),
        sa.Column('valid_to', sa.DateTime(timezone=True), nullable=True),
        sa.Column('active', sa.Boolean(), server_default=sa.text('true'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        schema='shop',
    )

    # ── shop.order_submissions（會員登錄的外部訂單號）─────────────────────
    op.create_table(
        'order_submissions',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('member_id', sa.BigInteger(), nullable=False),
        sa.Column('chart_id', sa.BigInteger(), nullable=True),
        sa.Column('product_type_id', sa.BigInteger(), nullable=False),
        sa.Column('platform', sa.Text(), nullable=False),
        sa.Column('external_order_no', sa.Text(), nullable=False),
        sa.Column('status', sa.Text(), server_default='待審核', nullable=False),
        sa.Column('note', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['member_id'], ['account.app_users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['product_type_id'], ['shop.product_types.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('platform', 'external_order_no', name='uq_order_submissions_platform_no'),
        sa.CheckConstraint("status IN ('待審核','通過','退回')", name='ck_order_submissions_status'),
        schema='shop',
    )
    with op.batch_alter_table('order_submissions', schema='shop') as batch_op:
        batch_op.create_index(batch_op.f('ix_shop_order_submissions_member_id'), ['member_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_shop_order_submissions_status'), ['status'], unique=False)

    # ── shop.reward_grants（通過訂單對應一張券，一對一）──────────────────
    op.create_table(
        'reward_grants',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('member_id', sa.BigInteger(), nullable=False),
        sa.Column('order_submission_id', sa.BigInteger(), nullable=False),
        sa.Column('coupon_code_snapshot', sa.Text(), nullable=False),
        sa.Column('granted_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['member_id'], ['account.app_users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['order_submission_id'], ['shop.order_submissions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('order_submission_id', name='uq_reward_grants_order_submission'),
        schema='shop',
    )
    with op.batch_alter_table('reward_grants', schema='shop') as batch_op:
        batch_op.create_index(batch_op.f('ix_shop_reward_grants_member_id'), ['member_id'], unique=False)

    # ── blog.saved_articles（會員收藏站內文章，可關聯命盤）────────────────
    op.create_table(
        'saved_articles',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('member_id', sa.BigInteger(), nullable=False),
        sa.Column('content_id', sa.Integer(), nullable=False),
        sa.Column('related_chart_id', sa.BigInteger(), nullable=True),
        sa.Column('saved_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['member_id'], ['account.app_users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['content_id'], ['blog.contents.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('member_id', 'content_id', name='uq_saved_articles_member_content'),
        schema='blog',
    )
    with op.batch_alter_table('saved_articles', schema='blog') as batch_op:
        batch_op.create_index(batch_op.f('ix_blog_saved_articles_member_id'), ['member_id'], unique=False)


def downgrade():
    with op.batch_alter_table('saved_articles', schema='blog') as batch_op:
        batch_op.drop_index(batch_op.f('ix_blog_saved_articles_member_id'))
    op.drop_table('saved_articles', schema='blog')

    with op.batch_alter_table('reward_grants', schema='shop') as batch_op:
        batch_op.drop_index(batch_op.f('ix_shop_reward_grants_member_id'))
    op.drop_table('reward_grants', schema='shop')

    with op.batch_alter_table('order_submissions', schema='shop') as batch_op:
        batch_op.drop_index(batch_op.f('ix_shop_order_submissions_status'))
        batch_op.drop_index(batch_op.f('ix_shop_order_submissions_member_id'))
    op.drop_table('order_submissions', schema='shop')

    op.drop_table('coupon_configs', schema='shop')
    op.drop_table('product_types', schema='shop')
