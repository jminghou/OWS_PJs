"""補建 media_lib 的 6 張表（baseline 在既有資料庫上整條跳過時漏掉的部分）

Revision ID: 0002_media_lib_backfill
Revises: 0001_core_baseline

為什麼需要這支：
    0001 的冪等保護只看 blog 的哨兵表（contents / categories / settings / tags），
    全部存在就整條 return —— 連 media_lib 的表一起跳過。Polaris 正式庫正是這樣：
    blog 表早就由站台鏈建好，media_lib 只有一個空 schema，後台媒體庫上傳在
    INSERT INTO media_lib.files 時失敗（2026-10-22）。

行為：
    media_lib.files 已存在 → 什麼都不做（新庫由 0001 建好、Claire 等既有庫亦同）。
    不存在 → 依 0001 同一份定義補建 6 張表。

    表結構刻意抄寫而非 import 0001：migration 一旦寫下就該凍結。

正式庫的前置條件（受限帳號 blog_app 跑這支之前，由 superuser 執行一次）：
    GRANT USAGE, CREATE ON SCHEMA media_lib TO blog_app;
"""
import os

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '0002_media_lib_backfill'
down_revision = '0001_core_baseline'
branch_labels = None
depends_on = None


BLOG = os.environ.get('OWS_BLOG_SCHEMA') or None
try:
    from packages.media_lib.config import SCHEMA_NAME as MEDIA_LIB
except Exception:  # pragma: no cover
    MEDIA_LIB = 'media_lib'

# 與 0001 讀同一組環境變數（見 0001 的說明）
_IDENTITY_MODE = (os.environ.get('OWS_IDENTITY_MODE') or 'local').strip().lower()
_EXTERNAL_USER_TABLE = os.environ.get('OWS_EXTERNAL_USER_TABLE') or 'account.app_users'

if _IDENTITY_MODE == 'external':
    USER_ID_TYPE = sa.BigInteger()
    USER_FK = f'{_EXTERNAL_USER_TABLE}.id'
else:
    USER_ID_TYPE = sa.Integer()
    USER_FK = None

_FOLDER_THUMB_FK = 'folders_thumbnail_id_fkey'


def q(schema, rest):
    return f'{schema}.{rest}' if schema else rest


def ix(schema, rest):
    return f'ix_{schema}_{rest}' if schema else f'ix_{rest}'


def _user_fk():
    return USER_FK if USER_FK else q(BLOG, 'users.id')


def upgrade():
    bind = op.get_bind()
    if not bind.execute(sa.text('SELECT 1 FROM pg_namespace WHERE nspname = :n'), {'n': MEDIA_LIB}).scalar():
        op.execute(f'CREATE SCHEMA {MEDIA_LIB}')

    if 'files' in set(sa.inspect(bind).get_table_names(schema=MEDIA_LIB)):
        return

    op.create_table('folders',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(length=255), nullable=False),
    sa.Column('parent_id', sa.Integer(), nullable=True),
    sa.Column('path', sa.String(length=500), nullable=False),
    sa.Column('created_by', USER_ID_TYPE, nullable=True),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('thumbnail_id', sa.Integer(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.Column('updated_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['created_by'], [_user_fk()], deferrable=True),
    sa.ForeignKeyConstraint(['parent_id'], [q(MEDIA_LIB, 'folders.id')], ),
    sa.PrimaryKeyConstraint('id'),
    schema=MEDIA_LIB
    )
    with op.batch_alter_table('folders', schema=MEDIA_LIB) as batch_op:
        batch_op.create_index(ix(MEDIA_LIB, 'folders_path'), ['path'], unique=False)

    op.create_table('files',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('filename', sa.String(length=255), nullable=False),
    sa.Column('original_filename', sa.String(length=255), nullable=False),
    sa.Column('gcs_path', sa.String(length=500), nullable=False),
    sa.Column('public_url', sa.String(length=700), nullable=False),
    sa.Column('file_size', sa.Integer(), nullable=True),
    sa.Column('mime_type', sa.String(length=100), nullable=True),
    sa.Column('width', sa.Integer(), nullable=True),
    sa.Column('height', sa.Integer(), nullable=True),
    sa.Column('alt_text', sa.String(length=500), nullable=True),
    sa.Column('caption', sa.Text(), nullable=True),
    sa.Column('folder_id', sa.Integer(), nullable=True),
    sa.Column('uploaded_by', USER_ID_TYPE, nullable=True),
    sa.Column('attributes', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.Column('updated_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['folder_id'], [q(MEDIA_LIB, 'folders.id')], ),
    sa.ForeignKeyConstraint(['uploaded_by'], [_user_fk()], deferrable=True),
    sa.PrimaryKeyConstraint('id'),
    schema=MEDIA_LIB
    )
    with op.batch_alter_table('files', schema=MEDIA_LIB) as batch_op:
        batch_op.create_index(ix(MEDIA_LIB, 'files_gcs_path'), ['gcs_path'], unique=False)

    op.create_foreign_key(
        _FOLDER_THUMB_FK, 'folders', 'files', ['thumbnail_id'], ['id'],
        source_schema=MEDIA_LIB, referent_schema=MEDIA_LIB,
    )

    op.create_table('tags',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(length=100), nullable=False),
    sa.Column('slug', sa.String(length=100), nullable=False),
    sa.Column('color', sa.String(length=7), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('name'),
    schema=MEDIA_LIB
    )
    with op.batch_alter_table('tags', schema=MEDIA_LIB) as batch_op:
        batch_op.create_index(ix(MEDIA_LIB, 'tags_slug'), ['slug'], unique=True)

    op.create_table('file_metadata',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('file_id', sa.Integer(), nullable=False),
    sa.Column('chart_id', sa.String(length=100), nullable=True),
    sa.Column('location', sa.String(length=255), nullable=True),
    sa.Column('rating', sa.SmallInteger(), nullable=True),
    sa.Column('status', sa.String(length=20), nullable=True),
    sa.Column('source', sa.String(length=255), nullable=True),
    sa.Column('license', sa.String(length=100), nullable=True),
    sa.Column('notes', sa.Text(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.Column('updated_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['file_id'], [q(MEDIA_LIB, 'files.id')], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    schema=MEDIA_LIB
    )
    with op.batch_alter_table('file_metadata', schema=MEDIA_LIB) as batch_op:
        batch_op.create_index(ix(MEDIA_LIB, 'file_metadata_chart_id'), ['chart_id'], unique=False)
        batch_op.create_index(ix(MEDIA_LIB, 'file_metadata_file_id'), ['file_id'], unique=True)

    op.create_table('file_tags',
    sa.Column('file_id', sa.Integer(), nullable=False),
    sa.Column('tag_id', sa.Integer(), nullable=False),
    sa.ForeignKeyConstraint(['file_id'], [q(MEDIA_LIB, 'files.id')], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['tag_id'], [q(MEDIA_LIB, 'tags.id')], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('file_id', 'tag_id'),
    schema=MEDIA_LIB
    )
    op.create_table('file_variants',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('file_id', sa.Integer(), nullable=False),
    sa.Column('variant_type', sa.String(length=20), nullable=False),
    sa.Column('gcs_path', sa.String(length=500), nullable=False),
    sa.Column('public_url', sa.String(length=700), nullable=False),
    sa.Column('width', sa.Integer(), nullable=True),
    sa.Column('height', sa.Integer(), nullable=True),
    sa.Column('file_size', sa.Integer(), nullable=True),
    sa.ForeignKeyConstraint(['file_id'], [q(MEDIA_LIB, 'files.id')], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    schema=MEDIA_LIB
    )
    with op.batch_alter_table('file_variants', schema=MEDIA_LIB) as batch_op:
        batch_op.create_index(ix(MEDIA_LIB, 'file_variants_file_id'), ['file_id'], unique=False)


def downgrade():
    # 刻意不刪表：新庫的這 6 張表是 0001 建的，在這裡 drop 會把 0001 的成果一起拆掉。
    pass
