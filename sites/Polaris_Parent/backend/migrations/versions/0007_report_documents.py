"""report documents: shop.report_documents

報告成品檔（PDF）：管理者在後台上傳，會員下載數位報告、實體書「設計你的書」整本預覽都用它
（docs/report-physical-addon-plan.md 階段 2）。檔案本身在私有儲存，這裡只記路徑與檢查碼。

Revision ID: 0007_report_documents
Revises: 0006_report_print_jobs
Create Date: 2026-10-11
"""
from alembic import op
import sqlalchemy as sa

revision = '0007_report_documents'
down_revision = '0006_report_print_jobs'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'report_documents',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('order_item_id', sa.Integer(), nullable=False),
        sa.Column('kind', sa.String(length=20), server_default='book_pdf', nullable=False),
        sa.Column('file_key', sa.Text(), nullable=False),
        sa.Column('filename', sa.Text(), nullable=False),
        sa.Column('bytes', sa.BigInteger(), nullable=False),
        sa.Column('sha256', sa.String(length=64), nullable=False),
        sa.Column('is_current', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('uploaded_by', sa.BigInteger(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['order_item_id'], ['shop.order_items.id']),
        sa.ForeignKeyConstraint(['uploaded_by'], ['account.app_users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        schema='shop',
    )
    op.create_index('ix_shop_report_documents_order_item_id', 'report_documents', ['order_item_id'], schema='shop')


def downgrade():
    op.drop_index('ix_shop_report_documents_order_item_id', table_name='report_documents', schema='shop')
    op.drop_table('report_documents', schema='shop')
