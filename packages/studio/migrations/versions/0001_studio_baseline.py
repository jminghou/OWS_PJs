"""studio baseline —— 內容與知識管理模組的資料表（選用模組）

Revision ID: 0001_studio_baseline
Revises:

管理範圍：studio_projects / studio_documents / studio_revisions / studio_cards /
studio_card_refs / studio_card_links / studio_inbox_items / studio_sources /
studio_tags / studio_taggings（BLOG schema，表名 studio_ 前綴）。

部署順序：core 鏈 → commerce 鏈 → **studio 鏈** → 站台鏈。
studio_documents.content_id 指向 core 的 contents，inbox/sources 的 file_id 指向 media_lib.files，
所以必須在 core 鏈之後。

冪等：偵測到哨兵表已存在就整條跳過、只記錄版本（版本表 alembic_version_studio）。
"""
import os

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0001_studio_baseline'
down_revision = None
branch_labels = None
depends_on = None

BLOG = os.environ.get('OWS_BLOG_SCHEMA') or None
MEDIA = 'media_lib'
_IDENTITY_MODE = (os.environ.get('OWS_IDENTITY_MODE') or 'local').strip().lower()
_EXTERNAL_USER_TABLE = os.environ.get('OWS_EXTERNAL_USER_TABLE') or 'account.app_users'


def q(schema, rest):
    return f'{schema}.{rest}' if schema else rest


def ix(schema, rest):
    return f'ix_{schema}_{rest}' if schema else f'ix_{rest}'


if _IDENTITY_MODE == 'external':
    USER_ID_TYPE = sa.BigInteger()
    USER_FK = f'{_EXTERNAL_USER_TABLE}.id'
else:
    USER_ID_TYPE = sa.Integer()
    USER_FK = None


def _user_fk():
    return USER_FK if USER_FK else q(BLOG, 'users.id')


def _media_fk(bind):
    """指向 media_lib.files 的外鍵需要該表的 REFERENCES 權限。正式庫的受限帳號（blog_app）沒有，
    這時退成純整數欄位（不建 FK），功能不受影響，只少了刪檔時自動清空的保護。
    之後以 superuser 執行 GRANT USAGE ON SCHEMA media_lib TO blog_app; GRANT REFERENCES ON media_lib.files TO blog_app;
    再手動 ALTER TABLE ... ADD FOREIGN KEY 即可補上。"""
    # 沒有 schema USAGE 時，連 has_table_privilege 都會因為看不到表而報錯，所以分兩步問
    ok = bind.execute(sa.text("SELECT has_schema_privilege(current_user, :s, 'USAGE')"), {'s': MEDIA}).scalar()
    if ok:
        ok = bind.execute(sa.text("SELECT has_table_privilege(current_user, :t, 'REFERENCES')"),
                          {'t': f'{MEDIA}.files'}).scalar()
    if not ok:
        print(f'[studio] 目前帳號沒有 {MEDIA}.files 的 REFERENCES 權限，file_id 欄位不建外鍵。')
    return ok


_SENTINELS = ('studio_projects', 'studio_tags')
_ALL_TABLES = (
    'studio_taggings', 'studio_tags', 'studio_sources', 'studio_inbox_items',
    'studio_card_links', 'studio_card_refs', 'studio_cards',
    'studio_revisions', 'studio_documents', 'studio_projects',
)


def upgrade():
    bind = op.get_bind()
    # 正式庫用的是受限帳號（blog_app）：即使 schema 已存在，CREATE SCHEMA IF NOT EXISTS 仍需要
    # 資料庫層級的 CREATE 權限而失敗。所以先查 pg_namespace，真的不存在才建。
    if BLOG and not bind.execute(sa.text('SELECT 1 FROM pg_namespace WHERE nspname = :n'), {'n': BLOG}).scalar():
        op.execute(f'CREATE SCHEMA {BLOG}')
    existing = set(sa.inspect(bind).get_table_names(schema=BLOG))
    present = existing & set(_SENTINELS)
    if present == set(_SENTINELS):
        return
    if present:
        raise RuntimeError(f"Studio 表只有部分存在：{sorted(present)}；請人工確認後再繼續。")

    JSONB = postgresql.JSONB(astext_type=sa.Text())
    media_fk = _media_fk(bind)

    op.create_table('studio_projects',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('title', sa.String(length=200), nullable=False),
    sa.Column('slug', sa.String(length=200), nullable=False),
    sa.Column('stage', sa.String(length=20), nullable=False),
    sa.Column('thesis', sa.Text(), nullable=True),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('cover_image', sa.String(length=500), nullable=True),
    sa.Column('owner_id', USER_ID_TYPE, nullable=True),
    sa.Column('attributes', JSONB, nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.Column('updated_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['owner_id'], [_user_fk()], ),
    sa.PrimaryKeyConstraint('id'),
    schema=BLOG
    )
    with op.batch_alter_table('studio_projects', schema=BLOG) as batch_op:
        batch_op.create_index(ix(BLOG, 'studio_projects_slug'), ['slug'], unique=True)
        batch_op.create_index(ix(BLOG, 'studio_projects_stage'), ['stage'], unique=False)
        batch_op.create_index(ix(BLOG, 'studio_projects_owner_id'), ['owner_id'], unique=False)

    op.create_table('studio_documents',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('project_id', sa.Integer(), nullable=False),
    sa.Column('platform', sa.String(length=20), nullable=False),
    sa.Column('title', sa.String(length=200), nullable=True),
    sa.Column('body', sa.Text(), nullable=True),
    sa.Column('stage', sa.String(length=20), nullable=False),
    sa.Column('content_id', sa.Integer(), nullable=True),
    sa.Column('scheduled_at', sa.DateTime(), nullable=True),
    sa.Column('published_at', sa.DateTime(), nullable=True),
    sa.Column('published_url', sa.String(length=500), nullable=True),
    sa.Column('current_revision_id', sa.Integer(), nullable=True),
    sa.Column('attributes', JSONB, nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.Column('updated_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['project_id'], [q(BLOG, 'studio_projects.id')], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['content_id'], [q(BLOG, 'contents.id')], ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('content_id'),
    schema=BLOG
    )
    with op.batch_alter_table('studio_documents', schema=BLOG) as batch_op:
        batch_op.create_index(ix(BLOG, 'studio_documents_project_id'), ['project_id'], unique=False)
        batch_op.create_index(ix(BLOG, 'studio_documents_platform'), ['platform'], unique=False)
        batch_op.create_index(ix(BLOG, 'studio_documents_stage'), ['stage'], unique=False)
        batch_op.create_index(ix(BLOG, 'studio_documents_scheduled_at'), ['scheduled_at'], unique=False)

    op.create_table('studio_revisions',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('document_id', sa.Integer(), nullable=False),
    sa.Column('kind', sa.String(length=20), nullable=False),
    sa.Column('label', sa.String(length=200), nullable=True),
    sa.Column('title', sa.String(length=200), nullable=True),
    sa.Column('body', sa.Text(), nullable=True),
    sa.Column('created_by', USER_ID_TYPE, nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['document_id'], [q(BLOG, 'studio_documents.id')], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['created_by'], [_user_fk()], ),
    sa.PrimaryKeyConstraint('id'),
    schema=BLOG
    )
    with op.batch_alter_table('studio_revisions', schema=BLOG) as batch_op:
        batch_op.create_index(ix(BLOG, 'studio_revisions_document_id'), ['document_id'], unique=False)
        batch_op.create_index(ix(BLOG, 'studio_revisions_kind'), ['kind'], unique=False)
        batch_op.create_index(ix(BLOG, 'studio_revisions_created_at'), ['created_at'], unique=False)

    op.create_table('studio_cards',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('kind', sa.String(length=20), nullable=False),
    sa.Column('title', sa.String(length=200), nullable=False),
    sa.Column('body', sa.Text(), nullable=True),
    sa.Column('source_url', sa.String(length=500), nullable=True),
    sa.Column('source_note', sa.Text(), nullable=True),
    sa.Column('status', sa.String(length=20), nullable=False),
    sa.Column('created_by', USER_ID_TYPE, nullable=True),
    sa.Column('attributes', JSONB, nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.Column('updated_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['created_by'], [_user_fk()], ),
    sa.PrimaryKeyConstraint('id'),
    schema=BLOG
    )
    with op.batch_alter_table('studio_cards', schema=BLOG) as batch_op:
        batch_op.create_index(ix(BLOG, 'studio_cards_kind'), ['kind'], unique=False)
        batch_op.create_index(ix(BLOG, 'studio_cards_status'), ['status'], unique=False)

    op.create_table('studio_card_refs',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('card_id', sa.Integer(), nullable=False),
    sa.Column('target_type', sa.String(length=20), nullable=False),
    sa.Column('target_id', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['card_id'], [q(BLOG, 'studio_cards.id')], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('card_id', 'target_type', 'target_id', name='uq_studio_card_refs_target'),
    schema=BLOG
    )
    with op.batch_alter_table('studio_card_refs', schema=BLOG) as batch_op:
        batch_op.create_index(ix(BLOG, 'studio_card_refs_card_id'), ['card_id'], unique=False)
        batch_op.create_index('ix_studio_card_refs_target', ['target_type', 'target_id'], unique=False)

    op.create_table('studio_card_links',
    sa.Column('card_id', sa.Integer(), nullable=False),
    sa.Column('related_card_id', sa.Integer(), nullable=False),
    sa.ForeignKeyConstraint(['card_id'], [q(BLOG, 'studio_cards.id')], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['related_card_id'], [q(BLOG, 'studio_cards.id')], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('card_id', 'related_card_id'),
    schema=BLOG
    )

    op.create_table('studio_inbox_items',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('kind', sa.String(length=20), nullable=False),
    sa.Column('title', sa.String(length=200), nullable=True),
    sa.Column('body', sa.Text(), nullable=True),
    sa.Column('url', sa.String(length=1000), nullable=True),
    sa.Column('file_id', sa.Integer(), nullable=True),
    sa.Column('status', sa.String(length=20), nullable=False),
    sa.Column('project_id', sa.Integer(), nullable=True),
    sa.Column('card_id', sa.Integer(), nullable=True),
    sa.Column('created_by', USER_ID_TYPE, nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    *([sa.ForeignKeyConstraint(['file_id'], [f'{MEDIA}.files.id'], ondelete='SET NULL')] if media_fk else []),
    sa.ForeignKeyConstraint(['project_id'], [q(BLOG, 'studio_projects.id')], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['card_id'], [q(BLOG, 'studio_cards.id')], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['created_by'], [_user_fk()], ),
    sa.PrimaryKeyConstraint('id'),
    schema=BLOG
    )
    with op.batch_alter_table('studio_inbox_items', schema=BLOG) as batch_op:
        batch_op.create_index(ix(BLOG, 'studio_inbox_items_status'), ['status'], unique=False)
        batch_op.create_index(ix(BLOG, 'studio_inbox_items_created_at'), ['created_at'], unique=False)

    op.create_table('studio_sources',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('project_id', sa.Integer(), nullable=False),
    sa.Column('title', sa.String(length=200), nullable=True),
    sa.Column('url', sa.String(length=1000), nullable=True),
    sa.Column('note', sa.Text(), nullable=True),
    sa.Column('file_id', sa.Integer(), nullable=True),
    sa.Column('inbox_item_id', sa.Integer(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['project_id'], [q(BLOG, 'studio_projects.id')], ondelete='CASCADE'),
    *([sa.ForeignKeyConstraint(['file_id'], [f'{MEDIA}.files.id'], ondelete='SET NULL')] if media_fk else []),
    sa.ForeignKeyConstraint(['inbox_item_id'], [q(BLOG, 'studio_inbox_items.id')], ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id'),
    schema=BLOG
    )
    with op.batch_alter_table('studio_sources', schema=BLOG) as batch_op:
        batch_op.create_index(ix(BLOG, 'studio_sources_project_id'), ['project_id'], unique=False)

    op.create_table('studio_tags',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(length=100), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.PrimaryKeyConstraint('id'),
    schema=BLOG
    )
    with op.batch_alter_table('studio_tags', schema=BLOG) as batch_op:
        batch_op.create_index(ix(BLOG, 'studio_tags_name'), ['name'], unique=True)

    op.create_table('studio_taggings',
    sa.Column('tag_id', sa.Integer(), nullable=False),
    sa.Column('target_type', sa.String(length=20), nullable=False),
    sa.Column('target_id', sa.Integer(), nullable=False),
    sa.ForeignKeyConstraint(['tag_id'], [q(BLOG, 'studio_tags.id')], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('tag_id', 'target_type', 'target_id'),
    schema=BLOG
    )
    with op.batch_alter_table('studio_taggings', schema=BLOG) as batch_op:
        batch_op.create_index('ix_studio_taggings_target', ['target_type', 'target_id'], unique=False)


def downgrade():
    if not (set(sa.inspect(op.get_bind()).get_table_names(schema=BLOG)) & set(_SENTINELS)):
        return
    for name in _ALL_TABLES:
        op.drop_table(name, schema=BLOG)
