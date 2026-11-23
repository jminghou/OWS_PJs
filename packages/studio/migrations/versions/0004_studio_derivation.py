"""Platform derivation: a social / newsletter / script version records the main document it was split from.

derived_from_id   → 主體文件（同專案、原始語言的那一份）；主體刪除時解除（SET NULL），衍生版本變獨立
derived_fingerprint → 上次「依主體更新」時主體的指紋；和主體現值不同 → 標示「主體已更新」

回填：專案裡恰好只有一個部落格作品時，把其餘原始語言版本（非翻譯）掛到那篇部落格的原始語言文件，
並視為已同步（指紋取現值）。有多篇部落格或沒有部落格的專案不猜，留給使用者在介面上指定。
"""
import os
import hashlib
import json
from alembic import op
import sqlalchemy as sa

revision = '0004_studio_derivation'
down_revision = '0003_studio_languages'
branch_labels = None
depends_on = None
SCHEMA = os.environ.get('OWS_BLOG_SCHEMA') or None


def _fingerprint(row):
    return hashlib.sha256(json.dumps([row['title'] or '', row['body'] or ''], ensure_ascii=False).encode()).hexdigest()


def upgrade():
    op.add_column('studio_documents', sa.Column('derived_from_id', sa.Integer()), schema=SCHEMA)
    op.add_column('studio_documents', sa.Column('derived_fingerprint', sa.String(64)), schema=SCHEMA)
    bind = op.get_bind()
    # SQLite 不能 ALTER 外鍵。欄位與索引照建；自我參照外鍵只在 Postgres 建立。
    if bind.dialect.name != 'sqlite':
        op.create_foreign_key('fk_studio_derived_from', 'studio_documents', 'studio_documents',
                              ['derived_from_id'], ['id'], source_schema=SCHEMA, referent_schema=SCHEMA, ondelete='SET NULL')
    op.create_index('ix_studio_documents_derived_from_id', 'studio_documents', ['derived_from_id'], schema=SCHEMA)

    bind = op.get_bind()
    docs = sa.Table('studio_documents', sa.MetaData(), schema=SCHEMA, autoload_with=bind)
    rows = list(bind.execute(sa.select(docs)).mappings())
    by_project = {}
    for r in rows:
        by_project.setdefault(r['project_id'], []).append(r)
    for project_rows in by_project.values():
        blog_roots = [r for r in project_rows if r['platform'] == 'blog' and not r['translation_source_id']]
        if len({r['work_id'] for r in blog_roots}) != 1 or len(blog_roots) != 1:
            continue
        main = blog_roots[0]
        for r in project_rows:
            if r['work_id'] == main['work_id'] or r['translation_source_id']:
                continue
            bind.execute(docs.update().where(docs.c.id == r['id']).values(
                derived_from_id=main['id'], derived_fingerprint=_fingerprint(main)))


def downgrade():
    op.drop_index('ix_studio_documents_derived_from_id', 'studio_documents', schema=SCHEMA)
    if op.get_bind().dialect.name != 'sqlite':
        op.drop_constraint('fk_studio_derived_from', 'studio_documents', schema=SCHEMA, type_='foreignkey')
    op.drop_column('studio_documents', 'derived_fingerprint', schema=SCHEMA)
    op.drop_column('studio_documents', 'derived_from_id', schema=SCHEMA)
