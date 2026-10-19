"""report print proofs: shop.report_print_proofs + shop.report_print_jobs.extra_revisions

階段 1 ②打樣流程（2026-10-19）：管理者上傳打樣 PDF → 會員確認送印或提出修改。
規則（使用者 2026-10-19 決定）：免費修改 1 次（管理者可額外給次數，記在 extra_revisions）；
會員 7 天內沒回應就自動確認送印。純新增一張表與一個有預設值的欄位，舊程式碼不受影響。

Revision ID: 0015_report_print_proofs
Revises: 0014_report_mail_outbox_jobs
Create Date: 2026-10-19
"""
from alembic import op
import sqlalchemy as sa

revision = '0015_report_print_proofs'
down_revision = '0014_report_mail_outbox_jobs'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('report_print_jobs',
                  sa.Column('extra_revisions', sa.Integer(), nullable=False, server_default='0'), schema='shop')
    op.create_table(
        'report_print_proofs',
        sa.Column('id', sa.BigInteger(), primary_key=True),
        sa.Column('print_job_id', sa.BigInteger(),
                  sa.ForeignKey('shop.report_print_jobs.id', ondelete='CASCADE'), nullable=False),
        sa.Column('version', sa.Integer(), nullable=False),
        sa.Column('file_key', sa.Text(), nullable=False),
        sa.Column('filename', sa.Text(), nullable=False),
        sa.Column('bytes', sa.BigInteger(), nullable=False),
        sa.Column('sha256', sa.String(64), nullable=False),
        sa.Column('admin_note', sa.Text(), nullable=True),
        sa.Column('uploaded_by', sa.BigInteger(),
                  sa.ForeignKey('account.app_users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column('due_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('decision', sa.String(20), nullable=True),
        sa.Column('comment', sa.Text(), nullable=True),
        sa.Column('decided_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('decided_by', sa.BigInteger(), nullable=True),
        sa.UniqueConstraint('print_job_id', 'version', name='uq_report_print_proofs_version'),
        sa.CheckConstraint(
            "decision IS NULL OR decision IN ('approved','changes_requested','auto_approved','admin_approved','superseded')",
            name='ck_report_print_proofs_decision'),
        schema='shop',
    )
    op.create_index('ix_shop_report_print_proofs_print_job_id', 'report_print_proofs', ['print_job_id'], schema='shop')


def downgrade():
    op.drop_index('ix_shop_report_print_proofs_print_job_id', table_name='report_print_proofs', schema='shop')
    op.drop_table('report_print_proofs', schema='shop')
    op.drop_column('report_print_jobs', 'extra_revisions', schema='shop')
