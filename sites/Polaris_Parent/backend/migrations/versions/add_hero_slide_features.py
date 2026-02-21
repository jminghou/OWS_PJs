"""Add hero slide advanced features (10 improvements)

Revision ID: add_hero_slide_features
Revises: add_homepage_about_hero
Create Date: 2026-02-21

Features added:
1. cta_url / cta_text / cta_new_tab  - per-slide CTA link
2. autoplay_delay                     - per-slide autoplay duration (ms)
3. video_url / media_type             - video support (youtube / mp4)
4. focal_point                        - image focal point for RWD
5. overlay_opacity                    - per-slide overlay opacity (0-100)
6. titles                             - per-slide title override (multilang)
7. pause_on_hover (settings)          - global hover pause toggle
8. start_date / end_date              - scheduled publish/unpublish
9. lazy_loading (settings)            - global lazy loading toggle
10. srcset RWD images (no DB column needed, uses existing getImageUrl variants)
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


revision = 'add_hero_slide_features'
down_revision = 'add_homepage_about_hero'
branch_labels = None
depends_on = None


def upgrade():
    # === homepage_slides: 11 new columns ===

    # Feature 1: Per-slide CTA link
    op.add_column('homepage_slides', sa.Column(
        'cta_url', sa.String(500), nullable=True))
    op.add_column('homepage_slides', sa.Column(
        'cta_text', JSONB, nullable=True, server_default='{}'))
    op.add_column('homepage_slides', sa.Column(
        'cta_new_tab', sa.Boolean, nullable=True, server_default='false'))

    # Feature 2: Per-slide autoplay delay (NULL = use global 6000ms)
    op.add_column('homepage_slides', sa.Column(
        'autoplay_delay', sa.Integer, nullable=True))

    # Feature 3: Video support
    op.add_column('homepage_slides', sa.Column(
        'video_url', sa.String(500), nullable=True))
    op.add_column('homepage_slides', sa.Column(
        'media_type', sa.String(20), nullable=True, server_default="'image'"))

    # Feature 4: Image focal point (CSS object-position value)
    op.add_column('homepage_slides', sa.Column(
        'focal_point', sa.String(30), nullable=True, server_default="'center center'"))

    # Feature 5: Overlay opacity (0-100, default 40 = from-black/40)
    op.add_column('homepage_slides', sa.Column(
        'overlay_opacity', sa.Integer, nullable=True, server_default='40'))

    # Feature 6: Per-slide title override (multilang JSONB)
    op.add_column('homepage_slides', sa.Column(
        'titles', JSONB, nullable=True, server_default='{}'))

    # Feature 8: Scheduled publish/unpublish
    op.add_column('homepage_slides', sa.Column(
        'start_date', sa.DateTime, nullable=True))
    op.add_column('homepage_slides', sa.Column(
        'end_date', sa.DateTime, nullable=True))

    # === homepage_settings: 2 new columns ===

    # Feature 7: Global hover pause toggle
    op.add_column('homepage_settings', sa.Column(
        'pause_on_hover', sa.Boolean, nullable=True, server_default='true'))

    # Feature 9: Global lazy loading toggle
    op.add_column('homepage_settings', sa.Column(
        'lazy_loading', sa.Boolean, nullable=True, server_default='true'))


def downgrade():
    for col in [
        'cta_url', 'cta_text', 'cta_new_tab',
        'autoplay_delay',
        'video_url', 'media_type',
        'focal_point',
        'overlay_opacity',
        'titles',
        'start_date', 'end_date',
    ]:
        op.drop_column('homepage_slides', col)

    op.drop_column('homepage_settings', 'pause_on_hover')
    op.drop_column('homepage_settings', 'lazy_loading')
