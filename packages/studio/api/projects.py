"""內容專案 + 專案參考資料。"""
import re

from flask import jsonify, request
from sqlalchemy import func

from core.backend_engine.factory import db
from packages.studio.blueprint import studio_bp as bp
from packages.studio.constants import FLOW_STEPS, STAGES
from packages.studio.models import (
    StudioCard, StudioCardRef, StudioDocument, StudioProject, StudioSource,
)
from packages.studio.api._common import (
    attach_tags, bad_request, current_user_id, json_body, paginate, set_tags,
    studio_read, studio_write, with_session,
)


def _unique_slug(title: str, exclude_id=None) -> str:
    base = re.sub(r'[^\w\-]', '-', (title or '').strip().lower())
    base = re.sub(r'-+', '-', base).strip('-') or 'project'
    slug, counter = base, 1
    while True:
        q = StudioProject.query.filter_by(slug=slug)
        if exclude_id:
            q = q.filter(StudioProject.id != exclude_id)
        if not q.first():
            return slug
        slug = f'{base}-{counter}'
        counter += 1


def apply_flow_filter(query, flow: str):
    """五步流程列的篩選。adapt = 有任何非 blog 版本的專案（不看 stage，封存除外）。"""
    if flow == 'adapt':
        has_other = db.session.query(StudioDocument.id).filter(
            StudioDocument.project_id == StudioProject.id, StudioDocument.platform != 'blog',
        ).exists()
        return query.filter(has_other, StudioProject.stage != 'archived')
    return query.filter(StudioProject.stage.in_(FLOW_STEPS[flow]))


def _document_counts(project_ids):
    if not project_ids:
        return {}
    rows = (
        db.session.query(StudioDocument.project_id, StudioDocument.platform, func.count())
        .filter(StudioDocument.project_id.in_(project_ids))
        .group_by(StudioDocument.project_id, StudioDocument.platform)
        .all()
    )
    result = {}
    for pid, platform, n in rows:
        result.setdefault(pid, {})[platform] = n
    return result


@bp.route('/projects', methods=['GET'])
@studio_read
def list_projects():
    stage = request.args.get('stage')
    flow = request.args.get('flow')
    search = (request.args.get('search') or '').strip()
    query = StudioProject.query
    if flow in FLOW_STEPS:
        query = apply_flow_filter(query, flow)
    elif stage and stage != 'all':
        query = query.filter_by(stage=stage)
    elif not request.args.get('include_archived'):
        query = query.filter(StudioProject.stage != 'archived')
    if search:
        query = query.filter(StudioProject.title.ilike(f'%{search}%'))
    query = query.order_by(StudioProject.updated_at.desc())
    items, pagination = paginate(query)
    data = attach_tags('project', [p.to_dict() for p in items])
    counts = _document_counts([p.id for p in items])
    for item in data:
        item['document_counts'] = counts.get(item['id'], {})
    return jsonify({'projects': data, 'pagination': pagination})


@bp.route('/projects', methods=['POST'])
@studio_write
@with_session
def create_project():
    data = json_body()
    title = (data.get('title') or '').strip()
    if not title:
        return bad_request('Title is required')
    stage = data.get('stage') or 'collect'
    if stage not in STAGES:
        return bad_request('Invalid stage')
    project = StudioProject(
        title=title,
        slug=_unique_slug(data.get('slug') or title),
        stage=stage,
        thesis=data.get('thesis'),
        description=data.get('description'),
        cover_image=data.get('cover_image'),
        owner_id=current_user_id(),
        attributes=data.get('attributes') or {},
    )
    db.session.add(project)
    db.session.flush()
    if 'tag_ids' in data:
        set_tags('project', project.id, data.get('tag_ids') or [])
    db.session.commit()
    return jsonify({'message': 'Project created', 'id': project.id, 'project': project.to_dict()}), 201


@bp.route('/projects/<int:project_id>', methods=['GET'])
@studio_read
def get_project(project_id):
    project = StudioProject.query.get_or_404(project_id)
    data = attach_tags('project', [project.to_dict()])[0]
    docs = project.documents.order_by(StudioDocument.platform, StudioDocument.updated_at.desc()).all()
    data['documents'] = attach_tags('document', [d.to_dict(include_body=False) for d in docs])
    data['sources'] = [s.to_dict() for s in project.sources.order_by(StudioSource.created_at.desc()).all()]
    refs = StudioCardRef.query.filter_by(target_type='project', target_id=project.id).all()
    card_ids = [r.card_id for r in refs]
    cards = StudioCard.query.filter(StudioCard.id.in_(card_ids)).all() if card_ids else []
    data['cards'] = [c.to_dict() for c in cards]
    return jsonify(data)


@bp.route('/projects/<int:project_id>', methods=['PUT'])
@studio_write
@with_session
def update_project(project_id):
    project = StudioProject.query.get_or_404(project_id)
    data = json_body()
    if 'title' in data:
        title = (data.get('title') or '').strip()
        if not title:
            return bad_request('Title is required')
        project.title = title
    if 'slug' in data and data['slug']:
        project.slug = _unique_slug(data['slug'], exclude_id=project.id)
    if 'stage' in data:
        if data['stage'] not in STAGES:
            return bad_request('Invalid stage')
        project.stage = data['stage']
    for field in ('thesis', 'description', 'cover_image', 'attributes'):
        if field in data:
            setattr(project, field, data[field])
    if 'tag_ids' in data:
        set_tags('project', project.id, data.get('tag_ids') or [])
    db.session.commit()
    return jsonify({'message': 'Project updated', 'project': project.to_dict()})


@bp.route('/projects/<int:project_id>/stage', methods=['PUT'])
@studio_write
@with_session
def update_project_stage(project_id):
    project = StudioProject.query.get_or_404(project_id)
    stage = json_body().get('stage')
    if stage not in STAGES:
        return bad_request('Invalid stage')
    project.stage = stage
    db.session.commit()
    return jsonify({'message': 'Stage updated', 'stage': stage})


@bp.route('/projects/<int:project_id>', methods=['DELETE'])
@studio_write
@with_session
def delete_project(project_id):
    project = StudioProject.query.get_or_404(project_id)
    if any(d.content_id for d in project.documents.all()):
        return bad_request('Archive projects containing website articles instead of deleting them')
    StudioCardRef.query.filter_by(target_type='project', target_id=project.id).delete()
    doc_ids = [d.id for d in project.documents.all()]
    if doc_ids:
        StudioCardRef.query.filter(
            StudioCardRef.target_type == 'document', StudioCardRef.target_id.in_(doc_ids)
        ).delete(synchronize_session=False)
    db.session.delete(project)
    db.session.commit()
    return jsonify({'message': 'Project deleted'})


# ==================== Sources 參考資料 ====================

@bp.route('/projects/<int:project_id>/sources', methods=['GET'])
@studio_read
def list_sources(project_id):
    StudioProject.query.get_or_404(project_id)
    sources = StudioSource.query.filter_by(project_id=project_id).order_by(StudioSource.created_at.desc()).all()
    return jsonify({'sources': [s.to_dict() for s in sources]})


@bp.route('/projects/<int:project_id>/sources', methods=['POST'])
@studio_write
@with_session
def create_source(project_id):
    StudioProject.query.get_or_404(project_id)
    data = json_body()
    if not any(data.get(k) for k in ('title', 'url', 'note', 'file_id')):
        return bad_request('Source needs at least a title, url, note or file')
    source = StudioSource(
        project_id=project_id,
        title=data.get('title'),
        url=data.get('url'),
        note=data.get('note'),
        file_id=data.get('file_id'),
        inbox_item_id=data.get('inbox_item_id'),
    )
    db.session.add(source)
    db.session.commit()
    return jsonify({'message': 'Source created', 'source': source.to_dict()}), 201


@bp.route('/sources/<int:source_id>', methods=['PUT'])
@studio_write
@with_session
def update_source(source_id):
    source = StudioSource.query.get_or_404(source_id)
    data = json_body()
    for field in ('title', 'url', 'note', 'file_id'):
        if field in data:
            setattr(source, field, data[field])
    db.session.commit()
    return jsonify({'message': 'Source updated', 'source': source.to_dict()})


@bp.route('/sources/<int:source_id>', methods=['DELETE'])
@studio_write
@with_session
def delete_source(source_id):
    source = StudioSource.query.get_or_404(source_id)
    db.session.delete(source)
    db.session.commit()
    return jsonify({'message': 'Source deleted'})
