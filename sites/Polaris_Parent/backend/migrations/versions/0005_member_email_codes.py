"""member email codes: blog.member_email_codes

會員 v2 註冊／重設密碼／登入後驗證用的 Email 驗證碼（只存 HMAC 雜湊）。

Revision ID: 0005_member_email_codes
Revises: 0004_membership_v2
Create Date: 2026-10-03
"""
from alembic import op
import sqlalchemy as sa

revision = '0005_member_email_codes'
down_revision = '0004_membership_v2'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'member_email_codes',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('purpose', sa.String(length=20), nullable=False),
        sa.Column('code_hash', sa.String(length=64), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('attempts', sa.Integer(), server_default='0', nullable=False),
        sa.Column('consumed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint("purpose IN ('register','reset','verify')", name='ck_member_email_codes_purpose'),
        schema='blog',
    )
    op.create_index('ix_blog_member_email_codes_email_purpose', 'member_email_codes',
                    ['email', 'purpose'], schema='blog')


def downgrade():
    op.drop_table('member_email_codes', schema='blog')
