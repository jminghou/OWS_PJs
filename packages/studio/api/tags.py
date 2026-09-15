"""扁平標籤：列表（含計數）、重新命名、合併、指派、查看相關內容。"""
from flask import jsonify, request
from sqlalchemy import func

from core.backend_engine.factory import db
from packages.studio.blueprint import studio_bp as bp
from packages.studio.constants import TAG_TARGETS
from packages.studio.models import (
    StudioCard, StudioDocument, StudioInboxItem, StudioProject, StudioTag, StudioTagging,
)
from packages.studio.api._common import (
    bad_request, ensure_tags_by_name, json_body, set_tags, studio_read, studio_write, with_session,
)


@bp.route('/tags', methods=['GET'])
@studio_read
def list_tags():
    search = (request.args.get('search') or '').strip()
    query = StudioTag.query
    if search:
        query = query.filter(StudioTag.name.ilike(f'%{search}%'))
    tags = query.order_by(StudioTag.name).all()
    counts = {}
    if request.args.get('with_counts'):
        rows = (
            db.session.query(StudioTagging.tag_id, StudioTagging.target_type, func.count())
            .group_by(StudioTagging.tag_id, StudioTagging.target_type).all()
        )
        for tag_id, target_type, n in rows:
            counts.setdefault(tag_id, {})[target_type] = n
    data = []
    for tag in tags:
        item = tag.to_dict()
        by_type = counts.get(tag.id, {})
        item['counts'] = by_type
        item['total'] = sum(by_type.values())
        data.append(item)
    return jsonify({'tags': data})


@bp.route('/tags', methods=['POST'])
@studio_write
@with_session
def create_tag():
    name = (json_body().get('name') or '').strip()
    if not name:
        return bad_request('Name is required')
    tags = ensure_tags_by_name([name])
    db.session.commit()
    return jsonify({'message': 'Tag ready', 'tag': tags[0].to_dict()}), 201


@bp.route('/tags/<int:tag_id>', methods=['PUT'])
@studio_write
@with_session
def rename_tag(tag_id):
    tag = StudioTag.query.get_or_404(tag_id)
    name = (json_body().get('name') or '').strip()
    if not name:
        return bad_request('Name is required')
    clash = StudioTag.query.filter(StudioTag.name == name, StudioTag.id != tag.id).first()
    if clash:
        return bad_request('A tag with this name already exists; merge instead', 409)
    tag.name = name
    db.session.commit()
    return jsonify({'message': 'Tag renamed', 'tag': tag.to_dict()})


@bp.route('/tags/<int:tag_id>', methods=['DELETE'])
@studio_write
@with_session
def delete_tag(tag_id):
    tag = StudioTag.query.get_or_404(tag_id)
    db.session.delete(tag)
    db.session.commit()
    return jsonify({'message': 'Tag deleted'})


@bp.route('/tags/merge', methods=['POST'])
@studio_write
@with_session
def merge_tags():
    """把 source_ids 的所有關聯重指到 target_id，再刪掉來源標籤。"""
    data = json_body()
    target_id = data.get('target_id')
    source_ids = [int(i) for i in (data.get('source_ids') or []) if int(i) != target_id]
    if not target_id or not source_ids:
        return bad_request('target_id and source_ids required')
    target = StudioTag.query.get_or_404(int(target_id))
    existing = {
        (t.target_type, t.target_id)
        for t in StudioTagging.query.filter_by(tag_id=target.id).all()
    }
    moved = 0
    for tagging in StudioTagging.query.filter(StudioTagging.tag_id.in_(source_ids)).all():
        key = (tagging.target_type, tagging.target_id)
        if key in existing:
            db.session.delete(tagging)
        else:
            db.session.delete(tagging)
            db.session.add(StudioTagging(tag_id=target.id, target_type=key[0], target_id=key[1]))
            existing.add(key)
            moved += 1
    db.session.flush()
    StudioTag.query.filter(StudioTag.id.in_(source_ids)).delete(synchronize_session=False)
    db.session.commit()
    return jsonify({'message': 'Tags merged', 'tag': target.to_dict(), 'moved': moved})


@bp.route('/tags/<int:tag_id>/items', methods=['GET'])
@studio_read
def tag_items(tag_id):
    """這個標籤掛在哪些內容上。"""
    tag = StudioTag.query.get_or_404(tag_id)
    taggings = StudioTagging.query.filter_by(tag_id=tag.id).all()
    by_type = {}
    for t in taggings:
        by_type.setdefault(t.target_type, []).append(t.target_id)

    def fetch(model, ids):
        return model.query.filter(model.id.in_(ids)).all() if ids else []

    projects = fetch(StudioProject, by_type.get('project'))
    documents = fetch(StudioDocument, by_type.get('document'))
    cards = fetch(StudioCard, by_type.get('card'))
    inbox = fetch(StudioInboxItem, by_type.get('inbox_item'))
    return jsonify({
        'tag': tag.to_dict(),
        'projects': [p.to_dict() for p in projects],
        'documents': [d.to_dict(include_body=False) for d in documents],
        'cards': [c.to_dict() for c in cards],
        'inbox_items': [i.to_dict() for i in inbox],
    })


@bp.route('/tags/assign', methods=['PUT'])
@studio_write
@with_session
def assign_tags():
    """整組覆寫某目標的標籤。可給 tag_ids，或給 names（自動建立）。"""
    data = json_body()
    target_type, target_id = data.get('target_type'), data.get('target_id')
    if target_type not in TAG_TARGETS or not target_id:
        return bad_request('target_type / target_id required')
    tag_ids = list(data.get('tag_ids') or [])
    if data.get('names'):
        tag_ids += [t.id for t in ensure_tags_by_name(data['names'])]
    set_tags(target_type, int(target_id), tag_ids)
    db.session.commit()
    tags = StudioTag.query.filter(StudioTag.id.in_(tag_ids)).order_by(StudioTag.name).all() if tag_ids else []
    return jsonify({'message': 'Tags assigned', 'tags': [t.to_dict() for t in tags]})
