"""report book designs: shop.report_book_designs / shop.report_design_assets

實體書「設計你的書」：封面、扉頁、頁面標註、指定跨頁的內容，以及會員上傳的照片
（docs/report-physical-addon-plan.md 階段 2）。照片檔案在私有儲存，這裡只記路徑。

Revision ID: 0008_report_book_designs
Revises: 0007_report_documents
Create Date: 2026-10-11
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0008_report_book_designs'
down_revision = '0007_report_documents'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'report_book_designs',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.BigInteger(), nullable=False),
        sa.Column('report_item_id', sa.Integer(), nullable=False),
        sa.Column('print_job_id', sa.BigInteger(), nullable=True),
        sa.Column('status', sa.String(length=20), server_default='draft', nullable=False),
        sa.Column('data', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='{}'),
        sa.Column('confirmed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.CheckConstraint("status IN ('draft','submitted','confirmed')", name='ck_report_book_designs_status'),
        sa.ForeignKeyConstraint(['user_id'], ['account.app_users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['report_item_id'], ['shop.order_items.id']),
        sa.ForeignKeyConstraint(['print_job_id'], ['shop.report_print_jobs.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('print_job_id'),
        schema='shop',
    )
    op.create_index('ix_shop_report_book_designs_user_id', 'report_book_designs', ['user_id'], schema='shop')
    op.create_index('ix_shop_report_book_designs_report_item_id', 'report_book_designs', ['report_item_id'], schema='shop')
    op.create_index('ix_shop_report_book_designs_status', 'report_book_designs', ['status'], schema='shop')

    op.create_table(
        'report_design_assets',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('design_id', sa.BigInteger(), nullable=False),
        sa.Column('file_key', sa.Text(), nullable=False),
        sa.Column('filename', sa.Text(), nullable=False),
        sa.Column('content_type', sa.String(length=50), nullable=False),
        sa.Column('bytes', sa.BigInteger(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['design_id'], ['shop.report_book_designs.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        schema='shop',
    )
    op.create_index('ix_shop_report_design_assets_design_id', 'report_design_assets', ['design_id'], schema='shop')


def downgrade():
    op.drop_index('ix_shop_report_design_assets_design_id', table_name='report_design_assets', schema='shop')
    op.drop_table('report_design_assets', schema='shop')
    op.drop_index('ix_shop_report_book_designs_status', table_name='report_book_designs', schema='shop')
    op.drop_index('ix_shop_report_book_designs_report_item_id', table_name='report_book_designs', schema='shop')
    op.drop_index('ix_shop_report_book_designs_user_id', table_name='report_book_designs', schema='shop')
    op.drop_table('report_book_designs', schema='shop')
