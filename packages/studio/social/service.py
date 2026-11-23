"""發布請求的狀態操作。不呼叫 Graph，也不把 failed / unknown 自動送回去。"""
import os
from datetime import datetime
from typing import Optional

from sqlalchemy import text, update
from sqlalchemy.orm import noload

from core.backend_engine.blueprints.api.utils import parse_tw_datetime
from core.backend_engine.factory import db
from core.backend_engine.services.identity import identity_model
from packages.media_lib.models import MLFile
from packages.studio.models import (
    StudioDocument,
    StudioDocumentMedia,
    StudioPublishEvent,
    StudioPublishRequest,
)
from packages.studio.social.checks import has_block, run_checks
from packages.studio.social.hashing import content_hash_from_parts, normalize_message, stable_ts
from packages.studio.social.state import (
    EVENT_APPROVAL_VOIDED,
    EVENT_APPROVED,
    EVENT_CANCELLED,
    EVENT_CHECKED,
    EVENT_PUBLISH_STARTED,
    EVENT_REJECTED,
    EVENT_SUBMITTED,
    EVENTS,
    OPEN_STATES,
    STATE_APPROVED,
    STATE_PENDING_APPROVAL,
    STATE_PENDING_REVIEW,
    TARGET_FACEBOOK_PAGE,
    UNSENT_STATES,
    next_state,
)

MANUAL_STAGE_MESSAGE = 'Facebook publication is managed by a publish request'
APPROVER_ENV = 'STUDIO_PUBLISH_APPROVER_USER_IDS'


class PublishError(Exception):
    def __init__(self, message: str, status: int = 422):
        super().__init__(message)
        self.message = message
        self.status = status


def is_bot_account(user) -> bool:
    """服務帳號永遠不能確認。username 以 -bot / _bot 結尾、role=bot，或 attributes.is_bot。"""
    if user is None:
        return False
    username = (getattr(user, 'username', None) or '').strip().lower()
    if username.endswith('-bot') or username.endswith('_bot'):
        return True
    if (getattr(user, 'role', None) or '').strip().lower() == 'bot':
        return True
    attrs = getattr(user, 'attributes', None)
    return isinstance(attrs, dict) and attrs.get('is_bot') is True


def actor_via_for(user) -> str:
    return 'bot' if is_bot_account(user) else 'ui'


def approver_allowlist() -> set:
    """逗號分隔的 user id。環境變數沒設或空的，就沒有人能確認。"""
    raw = os.environ.get(APPROVER_ENV) or ''
    ids = set()
    for part in raw.split(','):
        part = part.strip()
        if not part:
            continue
        try:
            ids.add(int(part))
        except ValueError:
            continue
    return ids


def _require_approver(user) -> None:
    if is_bot_account(user):
        raise PublishError('Bot accounts cannot approve publication', 403)
    if user.id not in approver_allowlist():
        raise PublishError('Approver is not on the allowlist', 403)


def _user(actor_id: Optional[int]):
    if actor_id is None:
        return None
    return db.session.get(identity_model(), actor_id)


def add_event(request_id: int, event: str, *, actor_id=None, actor_via=None, detail=None) -> StudioPublishEvent:
    if event not in EVENTS:
        raise PublishError('Invalid publish event')
    row = StudioPublishEvent(
        request_id=request_id,
        event=event,
        actor_id=actor_id,
        actor_via=actor_via,
        detail=detail or {},
        created_at=datetime.utcnow(),
    )
    db.session.add(row)
    return row


def media_rows(document_id: int):
    return (
        db.session.query(StudioDocumentMedia, MLFile)
        .options(noload(MLFile.variants))
        .join(MLFile, MLFile.id == StudioDocumentMedia.file_id)
        .filter(StudioDocumentMedia.document_id == document_id)
        .order_by(StudioDocumentMedia.position.asc(), StudioDocumentMedia.id.asc())
        .all()
    )


def compose(document: StudioDocument, *, target: str, target_ref: str, link, scheduled_for):
    rows = media_rows(document.id)
    payload_media = []
    hash_media = []
    for _media, file in rows:
        payload_media.append({
            'file_id': file.id,
            'public_url': file.public_url,
            'mime': file.mime_type,
            'size': file.file_size,
            'w': file.width,
            'h': file.height,
        })
        hash_media.append({
            'file_id': file.id,
            'gcs_path': file.gcs_path,
            'file_size': file.file_size,
            'updated_at': stable_ts(file.updated_at),
        })
    message = normalize_message(document.body or '')
    payload = {
        'message': message,
        'link': link or None,
        'media': payload_media,
        'scheduled_for': scheduled_for or None,
    }
    digest = content_hash_from_parts(
        target=target,
        target_ref=target_ref or '',
        message=message,
        link=link,
        media=hash_media,
        scheduled_for=scheduled_for,
    )
    return payload, digest


def _link_for(document: StudioDocument, req: Optional[StudioPublishRequest]):
    attrs = document.attributes or {}
    if isinstance(attrs, dict) and 'link' in attrs:
        return attrs.get('link') or None
    if req is not None:
        return (req.payload or {}).get('link') or None
    return None


def compose_for_request(document: StudioDocument, req: StudioPublishRequest):
    return compose(
        document,
        target=req.target,
        target_ref=req.target_ref or '',
        link=_link_for(document, req),
        scheduled_for=(req.payload or {}).get('scheduled_for'),
    )


def _apply_checks(req: StudioPublishRequest, *, actor_id, actor_via) -> None:
    report = run_checks(req.payload)
    req.check_report = report
    req.checked_at = datetime.utcnow()
    req.updated_at = req.checked_at
    if req.state in (STATE_PENDING_REVIEW, STATE_PENDING_APPROVAL):
        event = 'checked_blocked' if has_block(report) else 'checked_clear'
        req.state = next_state(req.state, event)
    add_event(
        req.id, EVENT_CHECKED, actor_id=actor_id, actor_via=actor_via,
        detail={
            'blocked': has_block(report),
            'warn': sum(1 for item in report if item['level'] == 'warn'),
            'state': req.state,
        },
    )


def _void_approval(req: StudioPublishRequest, digest: str, *, actor_id, actor_via) -> None:
    previous = req.content_hash
    req.approved_by = None
    req.approved_at = None
    req.approved_hash = None
    req.state = next_state(req.state, 'void')
    add_event(
        req.id, EVENT_APPROVAL_VOIDED, actor_id=actor_id, actor_via=actor_via,
        detail={'previous_hash': previous, 'content_hash': digest},
    )


def note_content_changed(document: StudioDocument, actor_id: Optional[int]) -> None:
    """文件內文、附圖或連結變了就重算雜湊。已確認的請求作廢並重跑核查。"""
    user = _user(actor_id)
    via = actor_via_for(user) if user is not None else 'ui'
    rows = (
        StudioPublishRequest.query
        .filter(
            StudioPublishRequest.document_id == document.id,
            StudioPublishRequest.state.in_((STATE_PENDING_REVIEW, STATE_PENDING_APPROVAL, STATE_APPROVED)),
        )
        .all()
    )
    for req in rows:
        payload, digest = compose_for_request(document, req)
        if digest == req.content_hash:
            continue
        if req.state == STATE_APPROVED:
            _void_approval(req, digest, actor_id=actor_id, actor_via=via)
        req.payload = payload
        req.content_hash = digest
        _apply_checks(req, actor_id=actor_id, actor_via=via)


def manual_publish_blocked(document: StudioDocument) -> bool:
    """FB 文件有進行中的發布請求時，不能再手動把 stage 改成 published / scheduled。"""
    if document.platform != 'facebook':
        return False
    return (
        StudioPublishRequest.query
        .filter(
            StudioPublishRequest.document_id == document.id,
            StudioPublishRequest.state.in_(tuple(OPEN_STATES)),
        )
        .first()
        is not None
    )


def clean_link(value):
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def parse_scheduled_for(value):
    if value in (None, ''):
        return None
    if not isinstance(value, str):
        raise PublishError('Invalid scheduled_for')
    parsed = parse_tw_datetime(value)
    if parsed is None:
        raise PublishError('Invalid scheduled_for')
    return parsed.strftime('%Y-%m-%dT%H:%M:%S')


def _open_request(document_id: int):
    return (
        StudioPublishRequest.query
        .filter(
            StudioPublishRequest.document_id == document_id,
            StudioPublishRequest.state.in_(tuple(OPEN_STATES)),
        )
        .first()
    )


def submit_request(document: StudioDocument, user, *, target: str, link, scheduled_for, external_id):
    if target != TARGET_FACEBOOK_PAGE:
        raise PublishError('Invalid target')
    if document.platform != 'facebook':
        raise PublishError('Only a Facebook document can be submitted')
    if external_id is not None:
        external_id = str(external_id).strip() or None
    if external_id and len(external_id) > 100:
        raise PublishError('external_id is too long')
    if _open_request(document.id):
        raise PublishError('This document already has an open publish request', 409)
    if external_id and StudioPublishRequest.query.filter_by(target=target, external_id=external_id).first():
        raise PublishError('external_id is already used', 409)
    scheduled_token = parse_scheduled_for(scheduled_for)
    attrs = dict(document.attributes or {})
    attrs['link'] = clean_link(link)
    document.attributes = attrs
    page_id = (os.environ.get('FB_PAGE_ID') or '').strip() or None
    payload, digest = compose(
        document,
        target=target,
        target_ref=page_id or '',
        link=attrs['link'],
        scheduled_for=scheduled_token,
    )
    now = datetime.utcnow()
    req = StudioPublishRequest(
        document_id=document.id,
        target=target,
        target_ref=page_id,
        state=STATE_PENDING_REVIEW,
        payload=payload,
        content_hash=digest,
        submitted_by=user.id,
        submitted_via=actor_via_for(user),
        external_id=external_id,
        mode='schedule' if scheduled_token else 'now',
        created_at=now,
        updated_at=now,
    )
    db.session.add(req)
    db.session.flush()
    add_event(
        req.id, EVENT_SUBMITTED, actor_id=user.id, actor_via=req.submitted_via,
        detail={'target': target, 'external_id': external_id},
    )
    _apply_checks(req, actor_id=user.id, actor_via=req.submitted_via)
    return req


def recheck_request(req: StudioPublishRequest, user) -> StudioPublishRequest:
    if req.state not in UNSENT_STATES:
        raise PublishError('Publish request cannot be rechecked in this state', 409)
    document = req.document
    payload, digest = compose_for_request(document, req)
    via = actor_via_for(user)
    if digest != req.content_hash and req.state == STATE_APPROVED:
        _void_approval(req, digest, actor_id=user.id, actor_via=via)
    req.payload = payload
    req.content_hash = digest
    _apply_checks(req, actor_id=user.id, actor_via=via)
    return req


def cancel_request(req: StudioPublishRequest, user) -> StudioPublishRequest:
    if req.state not in UNSENT_STATES:
        raise PublishError('Only an unsent publish request can be cancelled', 409)
    req.state = next_state(req.state, 'cancel')
    req.updated_at = datetime.utcnow()
    add_event(req.id, EVENT_CANCELLED, actor_id=user.id, actor_via=actor_via_for(user))
    return req


def approve_request(req: StudioPublishRequest, user, content_hash: str) -> StudioPublishRequest:
    _require_approver(user)
    if not isinstance(content_hash, str) or not content_hash.strip():
        raise PublishError('content_hash is required')
    if req.state != STATE_PENDING_APPROVAL:
        raise PublishError('Publish request cannot be approved in this state', 409)
    _payload, digest = compose_for_request(req.document, req)
    if digest != req.content_hash:
        via = actor_via_for(user)
        if req.state == STATE_APPROVED:
            _void_approval(req, digest, actor_id=user.id, actor_via=via)
        req.payload = _payload
        req.content_hash = digest
        _apply_checks(req, actor_id=user.id, actor_via=via)
        # 送審當下的雜湊已經過期。先把新結果留下，再回 409，避免外層 rollback 把它清掉。
        db.session.commit()
        raise PublishError('Content hash does not match', 409)
    if content_hash != req.content_hash:
        raise PublishError('Content hash does not match', 409)
    now = datetime.utcnow()
    req.state = next_state(req.state, 'approve')
    req.approved_by = user.id
    req.approved_at = now
    req.approved_hash = digest
    req.updated_at = now
    add_event(
        req.id, EVENT_APPROVED, actor_id=user.id, actor_via='ui',
        detail={'content_hash': digest},
    )
    return req


def reject_request(req: StudioPublishRequest, user, reason: str) -> StudioPublishRequest:
    _require_approver(user)
    text = (reason or '').strip() if isinstance(reason, str) else ''
    if not text:
        raise PublishError('reason is required')
    if req.state not in UNSENT_STATES:
        raise PublishError('Publish request cannot be rejected in this state', 409)
    now = datetime.utcnow()
    req.state = next_state(req.state, 'reject')
    req.rejected_by = user.id
    req.rejected_reason = text
    req.approved_by = None
    req.approved_at = None
    req.approved_hash = None
    req.updated_at = now
    add_event(
        req.id, EVENT_REJECTED, actor_id=user.id, actor_via='ui',
        detail={'reason': text},
    )
    return req


def claim_statement(request_id: int, approved_hash: str, now: datetime):
    """WHERE state='approved' AND approved_hash=:hash，通過才把 state 改成 publishing。"""
    return (
        update(StudioPublishRequest)
        .where(StudioPublishRequest.id == request_id)
        .where(StudioPublishRequest.state == STATE_APPROVED)
        .where(StudioPublishRequest.approved_hash == approved_hash)
        .values(state='publishing', attempt_started_at=now, updated_at=now)
    )


def claim_publishing(request_id: int, approved_hash: str) -> bool:
    """進入 publishing 的唯一入口。不呼叫 Graph。失敗與未知不會從這裡重試。"""
    if not approved_hash:
        return False
    now = datetime.utcnow()
    result = db.session.execute(
        claim_statement(request_id, approved_hash, now),
        execution_options={'synchronize_session': False},
    )
    changed = result.rowcount
    if db.session.get_bind().dialect.name == 'sqlite':
        changed = db.session.execute(text('SELECT changes()')).scalar()
    if changed != 1:
        db.session.rollback()
        return False
    add_event(
        request_id, EVENT_PUBLISH_STARTED, actor_via='system',
        detail={'approved_hash': approved_hash},
    )
    db.session.commit()
    return True
