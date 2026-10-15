"""report consultation preferences: shop.report_consultations.preferences / preferences_at

專人解讀付款後，會員可填幾個方便的時段給管理者參考（會員中心改版，2026-10-12）。

Revision ID: 0009_consult_preferences
Revises: 0008_report_book_designs
Create Date: 2026-10-12
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0009_consult_preferences'
down_revision = '0008_report_book_designs'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('report_consultations',
                  sa.Column('preferences', postgresql.JSONB(astext_type=sa.Text()), nullable=True), schema='shop')
    op.add_column('report_consultations',
                  sa.Column('preferences_at', sa.DateTime(timezone=True), nullable=True), schema='shop')


def downgrade():
    op.drop_column('report_consultations', 'preferences_at', schema='shop')
    op.drop_column('report_consultations', 'preferences', schema='shop')
