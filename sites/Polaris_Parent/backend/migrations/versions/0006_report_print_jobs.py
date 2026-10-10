"""report print jobs: shop.report_print_jobs / shop.report_consultations

實體書與專人解讀（docs/report-physical-addon-plan.md）：
- shop.report_print_jobs：每個實體書訂單項目一筆，記規格、特殊客製、計價明細、設計內容、確認送印、取消與退款；
  並為既有的實體書訂單項目補建紀錄（依訂單狀態推得目前狀態）
- shop.report_consultations：每個專人解讀訂單項目一筆，記次數、安排時間、取消與退款

Revision ID: 0006_report_print_jobs
Revises: 0005_member_email_codes
Create Date: 2026-10-09
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0006_report_print_jobs'
down_revision = '0005_member_email_codes'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'report_print_jobs',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('order_item_id', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(length=30), server_default='awaiting_payment', nullable=False),
        sa.Column('spec', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='{}'),
        sa.Column('custom', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='{}'),
        sa.Column('pricing', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='{}'),
        sa.Column('options', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='{}'),
        sa.Column('pages', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='[]'),
        sa.Column('customized_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('approved_proof_id', sa.BigInteger(), nullable=True),
        sa.Column('cancelled_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('cancelled_by', sa.String(length=10), nullable=True),
        sa.Column('cancel_reason', sa.Text(), nullable=True),
        sa.Column('refund_due', sa.Integer(), nullable=True),
        sa.Column('refund_amount', sa.Integer(), nullable=True),
        sa.Column('refunded_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('refund_note', sa.Text(), nullable=True),
        sa.Column('refunded_by', sa.BigInteger(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.CheckConstraint(
            "status IN ('awaiting_payment','awaiting_customization','awaiting_proof','proof_ready',"
            "'changes_requested','approved','printing','shipped','delivered','cancelled')",
            name='ck_report_print_jobs_status'),
        sa.ForeignKeyConstraint(['order_item_id'], ['shop.order_items.id']),
        sa.ForeignKeyConstraint(['refunded_by'], ['account.app_users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('order_item_id'),
        schema='shop',
    )
    op.create_index('ix_shop_report_print_jobs_status', 'report_print_jobs', ['status'], schema='shop')

    # 既有的實體書訂單項目補建紀錄：未付款 → awaiting_payment；已付款 → 依出貨進度；已取消 → cancelled
    op.execute("""
        INSERT INTO shop.report_print_jobs (order_item_id, status)
        SELECT i.id,
               CASE
                 WHEN o.status = 'cancelled' THEN 'cancelled'
                 WHEN o.status <> 'paid' THEN 'awaiting_payment'
                 WHEN s.status = 'printing' THEN 'printing'
                 WHEN s.status = 'shipped' THEN 'shipped'
                 WHEN s.status = 'delivered' THEN 'delivered'
                 WHEN s.status = 'cancelled' THEN 'cancelled'
                 ELSE 'awaiting_customization'
               END
        FROM shop.order_items i
        JOIN shop.orders o ON o.id = i.order_id
        LEFT JOIN shop.shipments s ON s.order_item_id = i.id
        WHERE i.variant = 'physical'
          AND NOT EXISTS (SELECT 1 FROM shop.report_print_jobs j WHERE j.order_item_id = i.id)
    """)


    op.create_table(
        'report_consultations',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('order_item_id', sa.Integer(), nullable=False),
        sa.Column('report_item_id', sa.Integer(), nullable=True),
        sa.Column('sessions', sa.Integer(), server_default='1', nullable=False),
        sa.Column('minutes', sa.Integer(), server_default='30', nullable=False),
        sa.Column('status', sa.String(length=20), server_default='awaiting_payment', nullable=False),
        sa.Column('scheduled_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('admin_note', sa.Text(), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('cancelled_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('cancel_reason', sa.Text(), nullable=True),
        sa.Column('refund_due', sa.Integer(), nullable=True),
        sa.Column('refund_amount', sa.Integer(), nullable=True),
        sa.Column('refunded_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('refund_note', sa.Text(), nullable=True),
        sa.Column('updated_by', sa.BigInteger(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.CheckConstraint(
            "status IN ('awaiting_payment','to_schedule','scheduled','completed','cancelled')",
            name='ck_report_consultations_status'),
        sa.ForeignKeyConstraint(['order_item_id'], ['shop.order_items.id']),
        sa.ForeignKeyConstraint(['report_item_id'], ['shop.order_items.id']),
        sa.ForeignKeyConstraint(['updated_by'], ['account.app_users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('order_item_id'),
        schema='shop',
    )
    op.create_index('ix_shop_report_consultations_status', 'report_consultations', ['status'], schema='shop')


def downgrade():
    op.drop_index('ix_shop_report_consultations_status', table_name='report_consultations', schema='shop')
    op.drop_table('report_consultations', schema='shop')
    op.drop_index('ix_shop_report_print_jobs_status', table_name='report_print_jobs', schema='shop')
    op.drop_table('report_print_jobs', schema='shop')
