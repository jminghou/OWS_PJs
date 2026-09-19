"""發布中心：跨專案的各平台文件狀態、預定日、發布日、網址。"""
from datetime import datetime

from flask import jsonify, request
from sqlalchemy import and_, or_, not_

from core.backend_engine.factory import db
from packages.studio.blueprint import studio_bp as bp
from packages.studio.constants import PLATFORMS, STAGES
from packages.studio.models import StudioDocument, StudioProject, StudioRevision
from packages.studio.api._common import (
    bad_request, current_user_id, json_body, paginate, parse_dt, studio_read, studio_write, with_session,
)


def _row(doc: StudioDocument, project: StudioProject) -> dict:
    data = doc.to_dict(include_body=False)
    data['project'] = {'id': project.id, 'title': project.title}
    if doc.content:
        data['content'] = {'id': doc.content.id, 'slug': doc.content.slug, 'status': doc.content.status}
    return data


@bp.route('/publishing', methods=['GET'])
@studio_read
def list_publishing():
    platform = request.args.get('platform')
    stage = request.args.get('stage')
    project_id = request.args.get('project_id', type=int)
    date_from = parse_dt(request.args.get('from'))
    date_to = parse_dt(request.args.get('to'))
    query = db.session.query(StudioDocument, StudioProject).join(StudioProject, StudioProject.id == StudioDocument.project_id)
    if request.args.get('language'):
        query = query.filter(StudioDocument.language == request.args['language'])
    if platform and platform != 'all':
        if platform not in PLATFORMS:
            return bad_request('Invalid platform')
        query = query.filter(StudioDocument.platform == platform)
    if stage and stage != 'all':
        if stage not in STAGES:
            return bad_request('Invalid stage')
        due = and_(StudioDocument.content_id.isnot(None), StudioDocument.stage == 'scheduled',
                   StudioDocument.scheduled_at.isnot(None), StudioDocument.scheduled_at <= datetime.utcnow())
        if stage == 'published':
            query = query.filter(or_(StudioDocument.stage == 'published', due))
        elif stage == 'scheduled':
            query = query.filter(StudioDocument.stage == 'scheduled', not_(due))
        else:
            query = query.filter(StudioDocument.stage == stage)
    else:
        query = query.filter(StudioDocument.stage != 'archived')
    if project_id:
        query = query.filter(StudioDocument.project_id == project_id)
    if date_from:
        query = query.filter(StudioDocument.scheduled_at >= date_from)
    if date_to:
        query = query.filter(StudioDocument.scheduled_at <= date_to)
    query = query.order_by(
        StudioDocument.scheduled_at.asc().nulls_last(), StudioDocument.updated_at.desc()
    )
    rows, pagination = paginate(query, default_per_page=50)
    return jsonify({'items': [_row(doc, project) for doc, project in rows], 'pagination': pagination})


@bp.route('/documents/<int:document_id>/publishing', methods=['PUT'])
@studio_write
@with_session
def update_publishing(document_id):
    """更新發布欄位。stage 改成 published 時寫一筆正式版快照。"""
    doc = StudioDocument.query.get_or_404(document_id)
    data = json_body()
    if doc.content_id:
        return bad_request('Manage website publication in the writing workspace', 409)
    if 'scheduled_at' in data:
        doc.scheduled_at = parse_dt(data['scheduled_at'])
    if 'published_at' in data:
        doc.published_at = parse_dt(data['published_at'])
    if 'published_url' in data:
        doc.published_url = (data['published_url'] or '').strip() or None
    revision = None
    if 'stage' in data:
        stage = data['stage']
        if stage not in STAGES:
            return bad_request('Invalid stage')
        if stage == 'published' and doc.stage != 'published':
            doc.published_at = doc.published_at or datetime.utcnow()
            revision = StudioRevision(
                document_id=doc.id, kind='published',
                label=f'發布 {doc.published_at:%Y-%m-%d %H:%M}',
                title=doc.title, body=doc.body, created_by=current_user_id(),
            )
            db.session.add(revision)
            db.session.flush()
            doc.current_revision_id = revision.id
        doc.stage = stage
    db.session.commit()
    return jsonify({
        'message': 'Publishing updated',
        'document': _row(doc, doc.project),
        'revision': revision.to_dict() if revision else None,
    })
