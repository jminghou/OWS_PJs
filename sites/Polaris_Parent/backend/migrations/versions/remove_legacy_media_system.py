"""Remove legacy Media system (replaced by packages/media_lib)

Revision ID: remove_legacy_media_system
Revises: add_hero_slide_features
Create Date: 2026-05-20

舊的 Media/MediaFolder/content_media 已停用，前端改用 packages/media_lib
(MLFile/MLFolder, media_lib schema)。Product 的圖片改以 public_url 字串儲存。

本 migration 使用防禦性 IF EXISTS / IF NOT EXISTS，因兩站的 schema 可能由
db.create_all() 建立而與 migration 歷史不完全一致。
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


revision = 'remove_legacy_media_system'
down_revision = 'add_hero_slide_features'
branch_labels = None
depends_on = None


def upgrade():
    # products: featured_image_id (FK -> media) 改為 featured_image 字串 (MLFile public_url)
    op.execute('ALTER TABLE products DROP COLUMN IF EXISTS featured_image_id')
    op.execute('ALTER TABLE products ADD COLUMN IF NOT EXISTS featured_image VARCHAR(500)')

    # 依 FK 依賴順序移除舊表：content_media -> media -> media_folders
    op.execute('DROP TABLE IF EXISTS content_media')
    op.execute('DROP TABLE IF EXISTS media')
    op.execute('DROP TABLE IF EXISTS media_folders')


def downgrade():
    # 重建 media_folders
    op.create_table(
        'media_folders',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('parent_id', sa.Integer, sa.ForeignKey('media_folders.id'), nullable=True),
        sa.Column('path', sa.String(500), nullable=False),
        sa.Column('created_by', sa.Integer, sa.ForeignKey('users.id')),
        sa.Column('created_at', sa.DateTime),
    )

    # 重建 media
    op.create_table(
        'media',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('filename', sa.String(255), nullable=False),
        sa.Column('original_filename', sa.String(255), nullable=False),
        sa.Column('file_path', sa.String(500), nullable=False),
        sa.Column('file_size', sa.Integer),
        sa.Column('mime_type', sa.String(100)),
        sa.Column('alt_text', sa.String(255)),
        sa.Column('caption', sa.Text),
        sa.Column('folder_id', sa.Integer, sa.ForeignKey('media_folders.id'), nullable=True),
        sa.Column('uploaded_by', sa.Integer, sa.ForeignKey('users.id')),
        sa.Column('attributes', JSONB, server_default='{}'),
        sa.Column('created_at', sa.DateTime),
    )

    # 重建 content_media
    op.create_table(
        'content_media',
        sa.Column('content_id', sa.Integer, sa.ForeignKey('contents.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('media_id', sa.Integer, sa.ForeignKey('media.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('display_order', sa.Integer, server_default='0'),
    )

    # products: 還原 featured_image_id (FK -> media)，移除 featured_image 字串
    op.execute('ALTER TABLE products DROP COLUMN IF EXISTS featured_image')
    op.add_column('products', sa.Column('featured_image_id', sa.Integer, sa.ForeignKey('media.id'), nullable=True))
