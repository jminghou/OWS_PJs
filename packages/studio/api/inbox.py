"""收集箱：快速保存，之後整理成卡片／加入專案／建新專案／封存。"""
from flask import jsonify, request

from core.backend_engine.factory import db
from packages.studio.blueprint import studio_bp as bp
from packages.studio.card_kinds import active_kind_keys
from packages.studio.constants import INBOX_KINDS, INBOX_STATUSES
from packages.studio.models import StudioCard, StudioInboxItem, StudioProject, StudioSource
from packages.studio.api.projects import _unique_slug
from packages.studio.api._common import (
    attach_tags, bad_request, current_user_id, json_body, paginate, set_tags,
    studio_read, studio_write, with_session,
)


def _guess_kind(data: dict) -> str:
    if data.get('file_id'):
        return 'image'
    if data.get('url') and not (data.get('body') or '').strip():
        return 'link'
    body = (data.get('body') or '').strip()
    if body.startswith(('http://', 'https://')) and ' ' not in body and '\n' not in body:
        return 'link'
    return 'text'


@bp.route('/inbox', methods=['GET'])
@studio_read
def list_inbox():
    status = request.args.get('status') or 'new'
    query = StudioInboxItem.query
    if status != 'all':
        if status not in INBOX_STATUSES:
            return bad_request('Invalid status')
        query = query.filter_by(status=status)
    query = query.order_by(StudioInboxItem.created_at.desc())
    items, pagination = paginate(query, default_per_page=50)
    return jsonify({'items': attach_tags('inbox_item', [i.to_dict() for i in items]), 'pagination': pagination})


@bp.route('/inbox', methods=['POST'])
@studio_write
@with_session
def create_inbox_item():
    data = json_body()
    kind = data.get('kind') or _guess_kind(data)
    if kind not in INBOX_KINDS:
        return bad_request('Invalid kind')
    body = (data.get('body') or '').strip()
    url = (data.get('url') or '').strip()
    if kind == 'link' and not url and body.startswith(('http://', 'https://')):
        url, body = body, ''
    if not (body or url or data.get('file_id')):
        return bad_request('Nothing to save')
    item = StudioInboxItem(
        kind=kind,
        title=(data.get('title') or '').strip() or None,
        body=body or None,
        url=url or None,
        file_id=data.get('file_id'),
        status='new',
        created_by=current_user_id(),
    )
    db.session.add(item)
    db.session.flush()
    if 'tag_ids' in data:
        set_tags('inbox_item', item.id, data.get('tag_ids') or [])
    db.session.commit()
    return jsonify({'message': 'Saved to inbox', 'item': item.to_dict()}), 201


@bp.route('/inbox/<int:item_id>', methods=['PUT'])
@studio_write
@with_session
def update_inbox_item(item_id):
    item = StudioInboxItem.query.get_or_404(item_id)
    data = json_body()
    for field in ('title', 'body', 'url', 'file_id'):
        if field in data:
            setattr(item, field, data[field])
    if 'status' in data:
        if data['status'] not in INBOX_STATUSES:
            return bad_request('Invalid status')
        item.status = data['status']
    if 'tag_ids' in data:
        set_tags('inbox_item', item.id, data.get('tag_ids') or [])
    db.session.commit()
    return jsonify({'message': 'Inbox item updated', 'item': item.to_dict()})


@bp.route('/inbox/<int:item_id>', methods=['DELETE'])
@studio_write
@with_session
def delete_inbox_item(item_id):
    item = StudioInboxItem.query.get_or_404(item_id)
    db.session.delete(item)
    db.session.commit()
    return jsonify({'message': 'Inbox item deleted'})


# ==================== 整理動作 ====================

@bp.route('/inbox/<int:item_id>/to-card', methods=['POST'])
@studio_write
@with_session
def inbox_to_card(item_id):
    item = StudioInboxItem.query.get_or_404(item_id)
    data = json_body()
    active = active_kind_keys()
    kind = data.get('kind') or (active[0] if active else 'viewpoint')
    if kind not in active:
        return bad_request('Invalid kind')
    title = (data.get('title') or item.title or (item.body or item.url or '')[:80]).strip()
    if not title:
        return bad_request('Title is required')
    card = StudioCard(
        kind=kind, title=title,
        body=data.get('body') if 'body' in data else item.body,
        source_url=item.url,
        source_note=data.get('source_note'),
        status='active', created_by=current_user_id(),
        attributes={'from_inbox_item_id': item.id, 'file_id': item.file_id} if item.file_id else {'from_inbox_item_id': item.id},
    )
    db.session.add(card)
    db.session.flush()
    item.card_id = card.id
    item.status = 'organized'
    db.session.commit()
    return jsonify({'message': 'Card created from inbox', 'card': card.to_dict(), 'item': item.to_dict()}), 201


@bp.route('/inbox/<int:item_id>/to-project', methods=['POST'])
@studio_write
@with_session
def inbox_to_project(item_id):
    """加入既有專案：成為該專案的參考資料。"""
    item = StudioInboxItem.query.get_or_404(item_id)
    project_id = json_body().get('project_id')
    if not project_id:
        return bad_request('project_id required')
    project = StudioProject.query.get_or_404(int(project_id))
    source = StudioSource(
        project_id=project.id,
        title=item.title or (item.body or item.url or '')[:80] or None,
        url=item.url, note=item.body, file_id=item.file_id, inbox_item_id=item.id,
    )
    db.session.add(source)
    item.project_id = project.id
    item.status = 'organized'
    db.session.commit()
    return jsonify({'message': 'Added to project', 'source': source.to_dict(), 'item': item.to_dict()}), 201


@bp.route('/inbox/<int:item_id>/new-project', methods=['POST'])
@studio_write
@with_session
def inbox_new_project(item_id):
    """以這則收集建立新專案，並把它掛成參考資料。"""
    item = StudioInboxItem.query.get_or_404(item_id)
    data = json_body()
    title = (data.get('title') or item.title or (item.body or item.url or '')[:60]).strip()
    if not title:
        return bad_request('Title is required')
    project = StudioProject(
        title=title, slug=_unique_slug(title), stage='collect',
        thesis=data.get('thesis'), owner_id=current_user_id(),
    )
    db.session.add(project)
    db.session.flush()
    source = StudioSource(
        project_id=project.id, title=item.title, url=item.url, note=item.body,
        file_id=item.file_id, inbox_item_id=item.id,
    )
    db.session.add(source)
    item.project_id = project.id
    item.status = 'organized'
    db.session.commit()
    return jsonify({'message': 'Project created from inbox', 'project': project.to_dict(), 'item': item.to_dict()}), 201


@bp.route('/inbox/<int:item_id>/archive', methods=['POST'])
@studio_write
@with_session
def inbox_archive(item_id):
    item = StudioInboxItem.query.get_or_404(item_id)
    item.status = 'archived'
    db.session.commit()
    return jsonify({'message': 'Archived', 'item': item.to_dict()})


@bp.route('/inbox/<int:item_id>/restore', methods=['POST'])
@studio_write
@with_session
def inbox_restore(item_id):
    item = StudioInboxItem.query.get_or_404(item_id)
    item.status = 'new'
    db.session.commit()
    return jsonify({'message': 'Restored', 'item': item.to_dict()})
