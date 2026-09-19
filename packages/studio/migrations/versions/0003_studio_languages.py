"""Language variants share a work, independently of project/platform."""
import os
import hashlib
import json
from uuid import uuid5, NAMESPACE_URL
from alembic import op
import sqlalchemy as sa

revision = '0003_studio_languages'
down_revision = '0002_studio_trgm_search'
branch_labels = None
depends_on = None
SCHEMA = os.environ.get('OWS_BLOG_SCHEMA') or None


def upgrade():
    bind = op.get_bind()
    meta = sa.MetaData()
    contents = sa.Table('contents', meta, schema=SCHEMA, autoload_with=bind)
    docs = sa.Table('studio_documents', meta, schema=SCHEMA, autoload_with=bind)
    existing = {r.id: r for r in bind.execute(sa.select(contents)).mappings()}
    def root(cid):
        seen = set()
        while existing[cid]['original_id']:
            if cid in seen or existing[cid]['original_id'] not in existing:
                raise RuntimeError('Invalid article translation chain; repair before migration')
            seen.add(cid)
            cid = existing[cid]['original_id']
        return cid
    groups, rows = {}, list(bind.execute(sa.select(docs)).mappings())
    for d in rows:
        if d['content_id']:
            c = existing[d['content_id']]
            key = root(c['id'])
            group = groups.setdefault(key, {'project': d['project_id'], 'languages': set()})
            if group['project'] != d['project_id'] or c['language'] in group['languages']:
                raise RuntimeError('Translation group crosses projects or duplicates a language; review first')
            group['languages'].add(c['language'])
    op.add_column('studio_documents', sa.Column('work_id', sa.String(36)), schema=SCHEMA)
    op.add_column('studio_documents', sa.Column('language', sa.String(10)), schema=SCHEMA)
    op.add_column('studio_documents', sa.Column('translation_source_id', sa.Integer()), schema=SCHEMA)
    op.add_column('studio_documents', sa.Column('source_fingerprint', sa.String(64)), schema=SCHEMA)
    docs = sa.Table('studio_documents', sa.MetaData(), schema=SCHEMA, autoload_with=bind)
    default_language = bind.execute(sa.text(
        f"SELECT value FROM {SCHEMA + '.' if SCHEMA else ''}settings WHERE key='i18n_default_language'"
    )).scalar() or 'zh-TW'
    for d in rows:
        cid = d['content_id']
        key = f'content:{root(cid)}' if cid else f'document:{d["id"]}'
        language = existing[cid]['language'] if cid else default_language
        bind.execute(docs.update().where(docs.c.id == d['id']).values(
            work_id=str(uuid5(NAMESPACE_URL, 'ows-studio/' + key)), language=language))
    bound = {d['content_id']: d for d in rows if d['content_id']}
    for d in rows:
        cid = d['content_id']
        source = bound.get(root(cid)) if cid else None
        if source and source['id'] != d['id']:
            digest = hashlib.sha256(json.dumps([source['title'] or '', source['body'] or ''], ensure_ascii=False).encode()).hexdigest()
            bind.execute(docs.update().where(docs.c.id == d['id']).values(
                translation_source_id=source['id'], source_fingerprint=digest))
    op.alter_column('studio_documents', 'work_id', nullable=False, schema=SCHEMA)
    op.alter_column('studio_documents', 'language', nullable=False, schema=SCHEMA)
    op.create_unique_constraint('uq_studio_document_work_language', 'studio_documents', ['work_id','language'], schema=SCHEMA)
    op.create_foreign_key('fk_studio_translation_source', 'studio_documents', 'studio_documents',
                         ['translation_source_id'], ['id'], source_schema=SCHEMA, referent_schema=SCHEMA, ondelete='SET NULL')


def downgrade():
    op.drop_constraint('fk_studio_translation_source', 'studio_documents', schema=SCHEMA, type_='foreignkey')
    op.drop_constraint('uq_studio_document_work_language', 'studio_documents', schema=SCHEMA, type_='unique')
    for column in ['source_fingerprint','translation_source_id','language','work_id']:
        op.drop_column('studio_documents', column, schema=SCHEMA)
