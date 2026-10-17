"""report mail outbox + background jobs: shop.report_mail_outbox / shop.report_job_runs

階段 1 ①排程與寄信重試（2026-10-17）：
  report_mail_outbox  訂單通知信的標題與內文（與 shop.order_notifications 一對一），寄失敗時排程依退避時間重寄
  report_job_runs     背景排程每個工作的最後執行結果（到期判斷、後台顯示排程是否正常）
純新增兩張表，舊程式碼跑在新 schema 上不受影響。

Revision ID: 0014_report_mail_outbox_jobs
Revises: 0013_commerce_contract_binding
Create Date: 2026-10-17
"""
from alembic import op
import sqlalchemy as sa

revision = '0014_report_mail_outbox_jobs'
down_revision = '0013_commerce_contract_binding'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'report_mail_outbox',
        sa.Column('id', sa.BigInteger(), primary_key=True),
        sa.Column('notification_id', sa.Integer(),
                  sa.ForeignKey('shop.order_notifications.id', ondelete='CASCADE'), nullable=False),
        sa.Column('subject', sa.Text(), nullable=False),
        sa.Column('body', sa.Text(), nullable=True),
        sa.Column('next_attempt_at', sa.DateTime(), nullable=True),
        sa.Column('last_attempt_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.UniqueConstraint('notification_id', name='uq_report_mail_outbox_notification'),
        schema='shop',
    )
    op.create_index('ix_shop_report_mail_outbox_next_attempt_at', 'report_mail_outbox', ['next_attempt_at'],
                    schema='shop')
    op.create_table(
        'report_job_runs',
        sa.Column('job', sa.String(50), primary_key=True),
        sa.Column('last_started_at', sa.DateTime(), nullable=True),
        sa.Column('last_finished_at', sa.DateTime(), nullable=True),
        sa.Column('last_status', sa.String(20), nullable=True),
        sa.Column('last_result', sa.Text(), nullable=True),
        sa.Column('last_error', sa.Text(), nullable=True),
        schema='shop',
    )


def downgrade():
    op.drop_table('report_job_runs', schema='shop')
    op.drop_index('ix_shop_report_mail_outbox_next_attempt_at', table_name='report_mail_outbox', schema='shop')
    op.drop_table('report_mail_outbox', schema='shop')
