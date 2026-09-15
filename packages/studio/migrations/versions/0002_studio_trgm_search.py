"""studio 全域搜尋索引 —— pg_trgm GIN 索引

Revision ID: 0002_studio_trgm_search
Revises: 0001_studio_baseline

ILIKE '%關鍵字%' 在 pg_trgm 的 GIN 索引上可走索引；沒有擴充時退化為全表掃描，
功能仍正確。擴充需要 superuser 或 Railway 預裝（Railway Postgres 內建 pg_trgm）。
建立失敗（無權限）只印警告、不擋 migration —— 搜尋是個人功能，慢一點不算壞。

這些索引不在 models 宣告（alembic compare_metadata 不比對 postgresql_using 的
表達式索引），所以 downgrade 要自己拆。
"""
import os

from alembic import op
import sqlalchemy as sa

revision = '0002_studio_trgm_search'
down_revision = '0001_studio_baseline'
branch_labels = None
depends_on = None

BLOG = os.environ.get('OWS_BLOG_SCHEMA') or None


def q(rest):
    return f'{BLOG}.{rest}' if BLOG else rest


# (索引名, 表, 欄位)
_INDEXES = [
    ('ix_trgm_studio_projects_title', 'studio_projects', 'title'),
    ('ix_trgm_studio_projects_thesis', 'studio_projects', 'thesis'),
    ('ix_trgm_studio_documents_title', 'studio_documents', 'title'),
    ('ix_trgm_studio_documents_body', 'studio_documents', 'body'),
    ('ix_trgm_studio_revisions_body', 'studio_revisions', 'body'),
    ('ix_trgm_studio_cards_title', 'studio_cards', 'title'),
    ('ix_trgm_studio_cards_body', 'studio_cards', 'body'),
    ('ix_trgm_studio_inbox_items_body', 'studio_inbox_items', 'body'),
    ('ix_trgm_studio_sources_note', 'studio_sources', 'note'),
]


def upgrade():
    bind = op.get_bind()
    try:
        bind.execute(sa.text('CREATE EXTENSION IF NOT EXISTS pg_trgm'))
    except Exception as exc:  # noqa: BLE001
        print(f'[studio] pg_trgm 擴充無法建立（{exc}），略過 trgm 索引；搜尋改走全表 ILIKE。')
        return
    for name, table, column in _INDEXES:
        op.execute(
            f'CREATE INDEX IF NOT EXISTS {name} ON {q(table)} USING gin ({column} gin_trgm_ops)'
        )


def downgrade():
    for name, _table, _column in _INDEXES:
        op.execute(f'DROP INDEX IF EXISTS {q(name)}')
