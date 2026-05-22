"""Add composite index for public content list query

Revision ID: 0002_content_list_index
Revises: 0001_baseline_schema
Create Date: 2026-05-22

公開文章列表查詢會 filter (status, content_type, language) 並 order by published_at，
加一個複合索引讓資料量變大後仍快。資料量小時影響不大（單列查詢本來就快），
主要是為未來規模準備。對應 model: Content.__table_args__ 的 'ix_contents_list'。
"""
from alembic import op


revision = '0002_content_list_index'
down_revision = '0001_baseline_schema'
branch_labels = None
depends_on = None


def upgrade():
    op.create_index(
        'ix_contents_list',
        'contents',
        ['status', 'content_type', 'language', 'published_at'],
    )


def downgrade():
    op.drop_index('ix_contents_list', table_name='contents')
