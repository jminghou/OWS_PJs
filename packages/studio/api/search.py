"""全域搜尋：專案、文件、草稿版本、卡片、標籤、來源、收集箱、附件（媒體庫）。

用 ILIKE 而不是 tsvector：core 現有的 to_tsvector('simple') 對中文無效（simple 只切空白）。
pg_trgm 的 GIN 索引由 0002 migration 建立（見 packages/studio/migrations），
沒有索引時 ILIKE 一樣正確，只是慢 —— 個人使用的資料量下可接受。
"""
from flask import jsonify, request
from sqlalchemy import or_

from core.backend_engine.factory import db
from core.backend_engine.models import Content
from packages.media_lib.models import MLFile
from packages.studio.blueprint import studio_bp as bp
from packages.studio.models import (
    StudioCard, StudioDocument, StudioInboxItem, StudioProject, StudioRevision, StudioSource, StudioTag,
)
from packages.studio.api._common import studio_read

ALL_TYPES = ('projects', 'documents', 'revisions', 'cards', 'tags', 'sources', 'inbox', 'files', 'articles')


def _snippet(text, q, width=90):
    if not text:
        return ''
    text = ' '.join(str(text).split())
    idx = text.lower().find(q.lower())
    if idx < 0:
        return text[:width]
    start = max(0, idx - width // 3)
    return ('…' if start else '') + text[start:start + width] + ('…' if start + width < len(text) else '')


@bp.route('/search', methods=['GET'])
@studio_read
def search():
    q = (request.args.get('q') or '').strip()
    limit = min(request.args.get('limit', 8, type=int), 30)
    types = [t for t in (request.args.get('types') or '').split(',') if t] or list(ALL_TYPES)
    if len(q) < 1:
        return jsonify({'q': q, 'results': {}})
    like = f'%{q}%'
    out = {}

    if 'projects' in types:
        rows = StudioProject.query.filter(or_(
            StudioProject.title.ilike(like), StudioProject.thesis.ilike(like), StudioProject.description.ilike(like),
        )).order_by(StudioProject.updated_at.desc()).limit(limit).all()
        out['projects'] = [{'id': p.id, 'title': p.title, 'stage': p.stage,
                            'snippet': _snippet(p.thesis or p.description, q)} for p in rows]

    if 'documents' in types:
        rows = (
            db.session.query(StudioDocument, StudioProject)
            .join(StudioProject, StudioProject.id == StudioDocument.project_id)
            .filter(or_(StudioDocument.title.ilike(like), StudioDocument.body.ilike(like)))
            .order_by(StudioDocument.updated_at.desc()).limit(limit).all()
        )
        out['documents'] = [{'id': d.id, 'title': d.title, 'platform': d.platform, 'stage': d.stage,
                             'project_id': p.id, 'project_title': p.title,
                             'snippet': _snippet(d.body, q)} for d, p in rows]

    if 'revisions' in types:
        rows = (
            db.session.query(StudioRevision, StudioDocument)
            .join(StudioDocument, StudioDocument.id == StudioRevision.document_id)
            .filter(or_(StudioRevision.label.ilike(like), StudioRevision.title.ilike(like), StudioRevision.body.ilike(like)))
            .order_by(StudioRevision.created_at.desc()).limit(limit).all()
        )
        out['revisions'] = [{'id': r.id, 'label': r.label, 'kind': r.kind, 'title': r.title,
                             'document_id': d.id, 'platform': d.platform,
                             'created_at': r.created_at.isoformat() if r.created_at else None,
                             'snippet': _snippet(r.body, q)} for r, d in rows]

    if 'cards' in types:
        rows = StudioCard.query.filter(or_(
            StudioCard.title.ilike(like), StudioCard.body.ilike(like), StudioCard.source_note.ilike(like),
        )).order_by(StudioCard.updated_at.desc()).limit(limit).all()
        out['cards'] = [{'id': c.id, 'title': c.title, 'kind': c.kind, 'status': c.status,
                         'snippet': _snippet(c.body, q)} for c in rows]

    if 'tags' in types:
        rows = StudioTag.query.filter(StudioTag.name.ilike(like)).order_by(StudioTag.name).limit(limit).all()
        out['tags'] = [t.to_dict() for t in rows]

    if 'sources' in types:
        rows = (
            db.session.query(StudioSource, StudioProject)
            .join(StudioProject, StudioProject.id == StudioSource.project_id)
            .filter(or_(StudioSource.title.ilike(like), StudioSource.url.ilike(like), StudioSource.note.ilike(like)))
            .order_by(StudioSource.created_at.desc()).limit(limit).all()
        )
        out['sources'] = [{'id': s.id, 'title': s.title, 'url': s.url, 'project_id': p.id,
                           'project_title': p.title, 'snippet': _snippet(s.note, q)} for s, p in rows]

    if 'inbox' in types:
        rows = StudioInboxItem.query.filter(or_(
            StudioInboxItem.title.ilike(like), StudioInboxItem.body.ilike(like), StudioInboxItem.url.ilike(like),
        )).order_by(StudioInboxItem.created_at.desc()).limit(limit).all()
        out['inbox'] = [{'id': i.id, 'title': i.title, 'kind': i.kind, 'status': i.status,
                         'snippet': _snippet(i.body or i.url, q)} for i in rows]

    if 'files' in types:
        rows = MLFile.query.filter(or_(
            MLFile.original_filename.ilike(like), MLFile.filename.ilike(like),
            MLFile.alt_text.ilike(like), MLFile.caption.ilike(like),
        )).order_by(MLFile.created_at.desc()).limit(limit).all()
        out['files'] = [{'id': f.id, 'filename': f.original_filename, 'public_url': f.public_url,
                         'mime_type': f.mime_type, 'snippet': _snippet(f.caption or f.alt_text, q)} for f in rows]

    if 'articles' in types:
        rows = Content.query.filter(or_(
            Content.title.ilike(like), Content.summary.ilike(like), Content.content.ilike(like),
        )).order_by(Content.updated_at.desc()).limit(limit).all()
        bound = {d.content_id: d.id for d in StudioDocument.query.filter(
            StudioDocument.content_id.in_([c.id for c in rows])).all()} if rows else {}
        out['articles'] = [{'id': c.id, 'title': c.title, 'slug': c.slug, 'status': c.status,
                            'document_id': bound.get(c.id), 'snippet': _snippet(c.summary or c.content, q)}
                           for c in rows]

    total = sum(len(v) for v in out.values())
    return jsonify({'q': q, 'total': total, 'results': out})
