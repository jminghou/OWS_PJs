"""Facebook 粉專發文的送審 API。沒有 publish / reconcile；publish 固定 409。"""
from functools import wraps

from flask import jsonify, request
from sqlalchemy.exc import IntegrityError
from werkzeug.exceptions import HTTPException

from core.backend_engine.factory import db
from core.backend_engine.services.identity import identity_model
from packages.media_lib.models import MLFile
from packages.studio.api._common import (
    bad_request, current_user_id, json_body, paginate, studio_publish_approve,
    studio_publish_request, studio_read, studio_write,
)
from packages.studio.blueprint import studio_bp as bp
from packages.studio.models import StudioDocument, StudioDocumentMedia, StudioPublishEvent, StudioPublishRequest
from packages.studio.social.service import (
    PublishError, approve_request, cancel_request, clean_link, note_content_changed,
    recheck_request, reject_request, submit_request,
)
from packages.studio.social.state import ALL_STATES, InvalidTransition


def _guard(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        try:
            return f(*args, **kwargs)
        except HTTPException:
            raise
        except PublishError as exc:
            db.session.rollback()
            return jsonify({'message': exc.message}), exc.status
        except InvalidTransition as exc:
            db.session.rollback()
            return jsonify({'message': str(exc)}), 409
        except IntegrityError:
            db.session.rollback()
            return jsonify({'message': 'This document already has an open publish request'}), 409
        except Exception as exc:  # noqa: BLE001
            db.session.rollback()
            return jsonify({'message': f'Database error: {exc}'}), 422
    return wrapper


def _actor():
    return db.session.get(identity_model(), current_user_id())


def _events(request_id: int):
    return (
        StudioPublishEvent.query.filter_by(request_id=request_id)
        .order_by(StudioPublishEvent.created_at.asc(), StudioPublishEvent.id.asc())
        .all()
    )


@bp.route('/documents/<int:document_id>/media', methods=['PUT'])
@studio_write
@_guard
def replace_document_media(document_id):
    """整組覆寫文件附圖。順序就是 position；重複 position 或找不到檔案都不寫入。"""
    document = StudioDocument.query.get_or_404(document_id)
    items = json_body().get('items')
    if not isinstance(items, list):
        return bad_request('items must be a list')
    cleaned = []
    seen = set()
    for index, item in enumerate(items):
        if not isinstance(item, dict) or item.get('file_id') in (None, ''):
            return bad_request('file_id is required')
        try:
            file_id = int(item['file_id'])
            position = int(item['position']) if item.get('position') is not None else index
        except (TypeError, ValueError):
            return bad_request('Invalid media item')
        if position < 0:
            return bad_request('Invalid media position')
        if position in seen:
            return bad_request('Duplicate media position')
        seen.add(position)
        file = db.session.get(MLFile, file_id)
        if file is None:
            return bad_request('Media file not found')
        alt = item.get('alt_text')
        alt = str(alt).strip() if alt else None
        if alt and len(alt) > 500:
            return bad_request('alt_text is too long')
        cleaned.append((file_id, position, alt or None))
    StudioDocumentMedia.query.filter_by(document_id=document.id).delete()
    for file_id, position, alt in cleaned:
        db.session.add(StudioDocumentMedia(
            document_id=document.id, file_id=file_id, position=position, alt_text=alt,
        ))
    db.session.flush()
    note_content_changed(document, current_user_id())
    db.session.commit()
    rows = (
        StudioDocumentMedia.query.filter_by(document_id=document.id)
        .order_by(StudioDocumentMedia.position.asc()).all()
    )
    return jsonify({'media': [row.to_dict() for row in rows]})


@bp.route('/documents/<int:document_id>/publish-requests', methods=['POST'])
@studio_publish_request
@_guard
def create_publish_request(document_id):
    document = StudioDocument.query.get_or_404(document_id)
    data = json_body()
    if not data.get('target'):
        return bad_request('target is required')
    if 'link' in data:
        link = clean_link(data.get('link'))
    else:
        link = clean_link((document.attributes or {}).get('link'))
    req = submit_request(
        document, _actor(),
        target=data.get('target'),
        link=link,
        scheduled_for=data.get('scheduled_for'),
        external_id=data.get('external_id'),
    )
    db.session.commit()
    return jsonify({
        'id': req.id,
        'state': req.state,
        'check_report': req.check_report or [],
        'content_hash': req.content_hash,
        'request': req.to_dict(),
    }), 201


@bp.route('/publish-requests', methods=['GET'])
@studio_read
def list_publish_requests():
    state = (request.args.get('state') or '').strip()
    if state and state not in ALL_STATES:
        return bad_request('Invalid state')
    query = StudioPublishRequest.query
    if state:
        query = query.filter_by(state=state)
    document_id = request.args.get('document_id', type=int)
    if document_id:
        query = query.filter_by(document_id=document_id)
    external_id = (request.args.get('external_id') or '').strip()
    if external_id:
        query = query.filter_by(external_id=external_id)
    query = query.order_by(StudioPublishRequest.id.desc())
    rows, pagination = paginate(query)
    return jsonify({'publish_requests': [row.to_dict() for row in rows], 'pagination': pagination})


@bp.route('/publish-requests/<int:request_id>', methods=['GET'])
@studio_read
def get_publish_request(request_id):
    req = StudioPublishRequest.query.get_or_404(request_id)
    data = req.to_dict()
    data['events'] = [event.to_dict() for event in _events(req.id)]
    return jsonify(data)


@bp.route('/publish-requests/<int:request_id>/recheck', methods=['POST'])
@studio_publish_request
@_guard
def recheck_publish_request(request_id):
    req = StudioPublishRequest.query.get_or_404(request_id)
    recheck_request(req, _actor())
    db.session.commit()
    return jsonify({'state': req.state, 'check_report': req.check_report or [], 'content_hash': req.content_hash})


@bp.route('/publish-requests/<int:request_id>/cancel', methods=['POST'])
@studio_publish_request
@_guard
def cancel_publish_request(request_id):
    req = StudioPublishRequest.query.get_or_404(request_id)
    cancel_request(req, _actor())
    db.session.commit()
    return jsonify({'state': req.state, 'request': req.to_dict()})


@bp.route('/publish-requests/<int:request_id>/approve', methods=['POST'])
@studio_publish_approve
@_guard
def approve_publish_request(request_id):
    req = StudioPublishRequest.query.get_or_404(request_id)
    data = json_body()
    if 'content_hash' not in data:
        return bad_request('content_hash is required')
    approve_request(req, _actor(), data.get('content_hash'))
    db.session.commit()
    return jsonify({'state': req.state, 'content_hash': req.content_hash, 'approved_hash': req.approved_hash})


@bp.route('/publish-requests/<int:request_id>/reject', methods=['POST'])
@studio_publish_approve
@_guard
def reject_publish_request(request_id):
    req = StudioPublishRequest.query.get_or_404(request_id)
    reject_request(req, _actor(), json_body().get('reason'))
    db.session.commit()
    return jsonify({'state': req.state, 'request': req.to_dict()})


@bp.route('/publish-requests/<int:request_id>/publish', methods=['POST'])
@studio_publish_request
def publish_request_disabled(request_id):
    """這個 PR 不發文。端點固定 409，不讀請求內容、不呼叫 Graph、不進入 publishing。"""
    StudioPublishRequest.query.get_or_404(request_id)
    return jsonify({'message': 'Facebook publishing is not available in this release'}), 409
