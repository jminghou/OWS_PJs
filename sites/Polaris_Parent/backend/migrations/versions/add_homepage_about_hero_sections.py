"""Add about_us and hero_section columns to homepage_settings

Revision ID: add_homepage_about_hero
Revises: b9a6821ec682
Create Date: 2026-02-05

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


# revision identifiers, used by Alembic.
revision = 'add_homepage_about_hero'
down_revision = 'b9a6821ec682'
branch_labels = None
depends_on = None


def upgrade():
    # Add about_us column to homepage_settings table
    op.add_column('homepage_settings', sa.Column('about_us', JSONB, nullable=True, server_default='{}'))
    # Add hero_section column to homepage_settings table
    op.add_column('homepage_settings', sa.Column('hero_section', JSONB, nullable=True, server_default='{}'))


def downgrade():
    # Remove hero_section column from homepage_settings table
    op.drop_column('homepage_settings', 'hero_section')
    # Remove about_us column from homepage_settings table
    op.drop_column('homepage_settings', 'about_us')
