"""知識卡片、引用（專案／文件）、卡片間關聯。"""
from flask import jsonify, request
from sqlalchemy import func, or_

from core.backend_engine.factory import db
from packages.studio.blueprint import studio_bp as bp
from packages.studio.card_kinds import active_kind_keys
from packages.studio.constants import CARD_REF_TARGETS, CARD_STATUSES
from packages.studio.models import (
    StudioCard, StudioCardRef, StudioDocument, StudioProject, studio_card_links,
)
from packages.studio.api._common import (
    attach_tags, bad_request, current_user_id, json_body, paginate, set_tags,
    studio_read, studio_write, with_session,
)


def _ref_counts(card_ids):
    if not card_ids:
        return {}
    rows = (
        db.session.query(StudioCardRef.card_id, func.count())
        .filter(StudioCardRef.card_id.in_(card_ids))
        .group_by(StudioCardRef.card_id).all()
    )
    return dict(rows)


def _resolve_refs(refs):
    """把 refs 換成帶標題的清單，方便右欄／卡片頁顯示。"""
    project_ids = [r.target_id for r in refs if r.target_type == 'project']
    document_ids = [r.target_id for r in refs if r.target_type == 'document']
    projects = {p.id: p for p in StudioProject.query.filter(StudioProject.id.in_(project_ids)).all()} if project_ids else {}
    documents = {d.id: d for d in StudioDocument.query.filter(StudioDocument.id.in_(document_ids)).all()} if document_ids else {}
    out = []
    for r in refs:
        item = r.to_dict()
        if r.target_type == 'project':
            p = projects.get(r.target_id)
            item['title'] = p.title if p else None
        else:
            d = documents.get(r.target_id)
            item['title'] = d.title if d else None
            item['platform'] = d.platform if d else None
            item['project_id'] = d.project_id if d else None
        out.append(item)
    return out


def _related_cards(card: StudioCard):
    rows = db.session.execute(
        studio_card_links.select().where(
            or_(studio_card_links.c.card_id == card.id, studio_card_links.c.related_card_id == card.id)
        )
    ).all()
    other_ids = {(b if a == card.id else a) for a, b in rows}
    if not other_ids:
        return []
    return [c.to_dict() for c in StudioCard.query.filter(StudioCard.id.in_(other_ids)).all()]


@bp.route('/cards', methods=['GET'])
@studio_read
def list_cards():
    kind = request.args.get('kind')
    status = request.args.get('status') or 'active'
    search = (request.args.get('search') or '').strip()
    query = StudioCard.query
    if kind and kind != 'all':
        query = query.filter_by(kind=kind)
    if status != 'all':
        query = query.filter_by(status=status)
    if search:
        like = f'%{search}%'
        query = query.filter(or_(StudioCard.title.ilike(like), StudioCard.body.ilike(like)))
    query = query.order_by(StudioCard.updated_at.desc())
    items, pagination = paginate(query, default_per_page=50)
    data = attach_tags('card', [c.to_dict() for c in items])
    counts = _ref_counts([c.id for c in items])
    for item in data:
        item['ref_count'] = counts.get(item['id'], 0)
    return jsonify({'cards': data, 'pagination': pagination})


@bp.route('/cards', methods=['POST'])
@studio_write
@with_session
def create_card():
    data = json_body()
    title = (data.get('title') or '').strip()
    if not title:
        return bad_request('Title is required')
    active = active_kind_keys()
    kind = data.get('kind') or (active[0] if active else 'viewpoint')
    if kind not in active:
        return bad_request('Invalid kind')
    card = StudioCard(
        kind=kind, title=title, body=data.get('body'),
        source_url=data.get('source_url'), source_note=data.get('source_note'),
        status='active', created_by=current_user_id(), attributes=data.get('attributes') or {},
    )
    db.session.add(card)
    db.session.flush()
    if 'tag_ids' in data:
        set_tags('card', card.id, data.get('tag_ids') or [])
    for ref in data.get('refs') or []:
        if ref.get('target_type') in CARD_REF_TARGETS and ref.get('target_id'):
            db.session.add(StudioCardRef(card_id=card.id, target_type=ref['target_type'], target_id=int(ref['target_id'])))
    db.session.commit()
    return jsonify({'message': 'Card created', 'id': card.id, 'card': card.to_dict()}), 201


@bp.route('/cards/<int:card_id>', methods=['GET'])
@studio_read
def get_card(card_id):
    card = StudioCard.query.get_or_404(card_id)
    data = attach_tags('card', [card.to_dict()])[0]
    data['refs'] = _resolve_refs(card.refs.all())
    data['related_cards'] = _related_cards(card)
    return jsonify(data)


@bp.route('/cards/<int:card_id>', methods=['PUT'])
@studio_write
@with_session
def update_card(card_id):
    card = StudioCard.query.get_or_404(card_id)
    data = json_body()
    if 'title' in data:
        title = (data.get('title') or '').strip()
        if not title:
            return bad_request('Title is required')
        card.title = title
    if 'kind' in data:
        # 改類型只能改成啟用中的；維持原本（可能已停用）的類型不動則不檢查
        if data['kind'] != card.kind and data['kind'] not in active_kind_keys():
            return bad_request('Invalid kind')
        card.kind = data['kind']
    if 'status' in data:
        if data['status'] not in CARD_STATUSES:
            return bad_request('Invalid status')
        card.status = data['status']
    for field in ('body', 'source_url', 'source_note', 'attributes'):
        if field in data:
            setattr(card, field, data[field])
    if 'tag_ids' in data:
        set_tags('card', card.id, data.get('tag_ids') or [])
    db.session.commit()
    return jsonify({'message': 'Card updated', 'card': card.to_dict()})


@bp.route('/cards/<int:card_id>', methods=['DELETE'])
@studio_write
@with_session
def delete_card(card_id):
    card = StudioCard.query.get_or_404(card_id)
    db.session.delete(card)
    db.session.commit()
    return jsonify({'message': 'Card deleted'})


@bp.route('/cards/batch', methods=['POST'])
@studio_write
@with_session
def batch_cards():
    """批次：刪除或改類型。body: {ids: [...], action: 'delete' | 'set_kind', kind?: str}"""
    data = json_body()
    ids = [int(i) for i in (data.get('ids') or [])]
    action = data.get('action')
    if not ids or action not in ('delete', 'set_kind'):
        return bad_request('ids and action required')
    cards = StudioCard.query.filter(StudioCard.id.in_(ids)).all()
    if action == 'delete':
        for card in cards:
            db.session.delete(card)
    else:
        kind = data.get('kind')
        if kind not in active_kind_keys():
            return bad_request('Invalid kind')
        for card in cards:
            card.kind = kind
    db.session.commit()
    return jsonify({'message': 'ok', 'count': len(cards)})


# ==================== Refs 引用 ====================

@bp.route('/cards/<int:card_id>/refs', methods=['POST'])
@studio_write
@with_session
def add_card_ref(card_id):
    StudioCard.query.get_or_404(card_id)
    data = json_body()
    target_type, target_id = data.get('target_type'), data.get('target_id')
    if target_type not in CARD_REF_TARGETS or not target_id:
        return bad_request('target_type / target_id required')
    existing = StudioCardRef.query.filter_by(card_id=card_id, target_type=target_type, target_id=int(target_id)).first()
    if existing:
        return jsonify({'message': 'Already referenced', 'ref': existing.to_dict()})
    ref = StudioCardRef(card_id=card_id, target_type=target_type, target_id=int(target_id))
    db.session.add(ref)
    db.session.commit()
    return jsonify({'message': 'Reference added', 'ref': ref.to_dict()}), 201


@bp.route('/cards/<int:card_id>/refs', methods=['DELETE'])
@studio_write
@with_session
def remove_card_ref(card_id):
    data = json_body()
    StudioCardRef.query.filter_by(
        card_id=card_id, target_type=data.get('target_type'), target_id=data.get('target_id')
    ).delete()
    db.session.commit()
    return jsonify({'message': 'Reference removed'})


@bp.route('/refs', methods=['GET'])
@studio_read
def list_refs_for_target():
    """某個專案／文件引用了哪些卡片（右欄用）。"""
    target_type = request.args.get('target_type')
    target_id = request.args.get('target_id', type=int)
    if target_type not in CARD_REF_TARGETS or not target_id:
        return bad_request('target_type / target_id required')
    refs = StudioCardRef.query.filter_by(target_type=target_type, target_id=target_id).all()
    card_ids = [r.card_id for r in refs]
    cards = StudioCard.query.filter(StudioCard.id.in_(card_ids)).order_by(StudioCard.kind, StudioCard.title).all() if card_ids else []
    return jsonify({'cards': attach_tags('card', [c.to_dict() for c in cards])})


# ==================== Links 卡片關聯 ====================

@bp.route('/cards/<int:card_id>/links', methods=['POST'])
@studio_write
@with_session
def add_card_link(card_id):
    StudioCard.query.get_or_404(card_id)
    other_id = json_body().get('related_card_id')
    if not other_id or int(other_id) == card_id:
        return bad_request('related_card_id required')
    StudioCard.query.get_or_404(int(other_id))
    a, b = sorted((card_id, int(other_id)))
    exists = db.session.execute(
        studio_card_links.select().where(studio_card_links.c.card_id == a, studio_card_links.c.related_card_id == b)
    ).first()
    if not exists:
        db.session.execute(studio_card_links.insert().values(card_id=a, related_card_id=b))
        db.session.commit()
    return jsonify({'message': 'Linked'}), 201


@bp.route('/cards/<int:card_id>/links/<int:other_id>', methods=['DELETE'])
@studio_write
@with_session
def remove_card_link(card_id, other_id):
    a, b = sorted((card_id, other_id))
    db.session.execute(
        studio_card_links.delete().where(studio_card_links.c.card_id == a, studio_card_links.c.related_card_id == b)
    )
    db.session.commit()
    return jsonify({'message': 'Unlinked'})
