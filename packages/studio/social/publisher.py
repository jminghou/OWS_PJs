"""把已確認的發布請求送出或對帳。failed / unknown 不會自動再送一次。"""
import logging
from datetime import datetime, timedelta
from typing import Optional
from urllib.parse import urlsplit

from core.backend_engine.factory import db
from packages.studio.models import StudioDocument, StudioPublishRequest, StudioRevision
from packages.studio.social import service as publish_service
from packages.studio.social.config import (
    access_token,
    graph_base_url,
    page_id,
    publish_mode,
)
from packages.studio.social.graph import GraphCallError, GraphClient, build_http_client, scrub
from packages.studio.social.hashing import normalize_message
from packages.studio.social.service import PublishError, note_content_changed
from packages.studio.social.state import (
    EVENT_PUBLISHED,
    EVENT_RECONCILED,
    STATE_APPROVED,
    STATE_FAILED,
    STATE_PUBLISHED,
    STATE_PUBLISHING,
    STATE_UNKNOWN,
)

logger = logging.getLogger(__name__)

_WINDOW = timedelta(seconds=120)


def _host(url: str):
    parts = urlsplit(url)
    return parts.scheme.lower(), (parts.hostname or '').lower()


def assert_base_url(mode: str) -> None:
    scheme, host = _host(graph_base_url())
    if mode == 'fake' and (scheme not in ('http', 'https') or host not in ('localhost', '127.0.0.1')):
        raise PublishError('fake_graph_host_rejected', 409)
    if mode == 'live' and (scheme != 'https' or host != 'graph.facebook.com'):
        raise PublishError('live_graph_host_rejected', 409)


def _page(req: StudioPublishRequest) -> str:
    return page_id() or req.target_ref or ''


def _message(req: StudioPublishRequest) -> str:
    return (req.payload or {}).get('message') or ''


def _link(req: StudioPublishRequest):
    return (req.payload or {}).get('link') or None


def _media(req: StudioPublishRequest) -> list:
    media = (req.payload or {}).get('media') or []
    return media if isinstance(media, list) else []


def _planned_calls(req: StudioPublishRequest) -> list:
    """真正會送出的呼叫，還沒有 token。dry_run 把這份遮罩後寫進 event。"""
    page = _page(req)
    message = _message(req)
    link = _link(req)
    media = _media(req)
    if len(media) <= 0:
        body = {}
        if message:
            body['message'] = message
        if link:
            body['link'] = link
        return [('POST', f'{page}/feed', body)]
    if len(media) == 1:
        body = {'url': media[0].get('public_url'), 'published': True}
        if message:
            body['message'] = message
        return [('POST', f'{page}/photos', body)]
    calls = [('POST', f'{page}/photos', {'url': item.get('public_url'), 'published': False}) for item in media]
    feed = {'message': message, 'attached_media': []}
    if link:
        feed['link'] = link
    calls.append(('POST', f'{page}/feed', feed))
    return calls


def _reload(request_id: int) -> StudioPublishRequest:
    db.session.expire_all()
    req = db.session.get(StudioPublishRequest, request_id)
    if req is None:
        raise PublishError('Publish request not found', 404)
    return req


def _record_outcome(req: StudioPublishRequest, outcome: str, *, detail: dict, user_id, error: Optional[GraphCallError] = None):
    now = datetime.utcnow()
    req.state = outcome
    req.attempt_finished_at = now
    req.updated_at = now
    if error is not None:
        req.error_code = error.code
        req.error_subcode = error.subcode
        req.error_message = error.safe_message
        req.fbtrace_id = error.fbtrace_id
    event = EVENT_PUBLISHED if outcome == STATE_PUBLISHED else outcome
    publish_service.add_event(
        req.id, event, actor_id=user_id, actor_via='ui', detail=scrub(detail),
    )
    db.session.commit()


def _write_document(req: StudioPublishRequest, url: Optional[str], user_id, when: datetime) -> None:
    document = db.session.get(StudioDocument, req.document_id)
    if document is None:
        return
    document.published_at = when
    document.published_url = url
    document.stage = 'published'
    revision = StudioRevision(
        document_id=document.id, kind='published',
        label=f'發布 {when:%Y-%m-%d %H:%M}',
        title=document.title, body=document.body, created_by=user_id,
    )
    db.session.add(revision)
    db.session.flush()
    document.current_revision_id = revision.id


def _mark_published(req: StudioPublishRequest, *, post_id: Optional[str], url: Optional[str], user_id, detail: dict, touch_document: bool):
    now = datetime.utcnow()
    if post_id:
        req.external_post_id = str(post_id)[:100]
        req.external_url = (url or '')[:500] or None
        req.published_at = now
    req.error_code = None
    req.error_subcode = None
    req.error_message = None
    req.fbtrace_id = None
    if touch_document:
        _write_document(req, req.external_url, user_id, now)
    _record_outcome(req, STATE_PUBLISHED, detail=detail, user_id=user_id)


def _execute(client: GraphClient, req: StudioPublishRequest):
    page = _page(req)
    message = _message(req)
    link = _link(req)
    media = _media(req)
    logger.info('facebook publish plan %s', scrub(_planned_calls(req)))
    if len(media) <= 0:
        body = {}
        if message:
            body['message'] = message
        if link:
            body['link'] = link
        data = client.post(f'{page}/feed', body)
        return data.get('id'), data.get('permalink_url'), data
    if len(media) == 1:
        body = {'url': media[0].get('public_url'), 'published': True}
        if message:
            body['message'] = message
        data = client.post(f'{page}/photos', body)
        post_id = data.get('post_id') or data.get('id')
        return post_id, data.get('permalink_url'), data
    attached = []
    for item in media:
        photo = client.post(f'{page}/photos', {'url': item.get('public_url'), 'published': False})
        photo_id = photo.get('id')
        if not photo_id:
            raise GraphCallError('unknown', message='missing id')
        attached.append({'media_fbid': photo_id})
    feed = {'attached_media': attached}
    if message:
        feed['message'] = message
    if link:
        feed['link'] = link
    data = client.post(f'{page}/feed', feed)
    return data.get('id'), data.get('permalink_url'), data


def _permalink(client: GraphClient, post_id: str, fallback: Optional[str]) -> Optional[str]:
    if fallback:
        return fallback
    try:
        data = client.get(post_id, {'fields': 'permalink_url'})
    except GraphCallError:
        return None
    return data.get('permalink_url')


def publish(request_id: int, user, *, client: Optional[GraphClient] = None) -> StudioPublishRequest:
    publish_service._require_approver(user)
    user_id = user.id
    mode = publish_mode()
    if mode == 'off':
        raise PublishError('publishing_disabled', 409)
    assert_base_url(mode)
    if mode == 'live' and (not page_id() or not access_token()):
        raise PublishError('publishing_disabled', 409)
    req = db.session.get(StudioPublishRequest, request_id)
    if req is None:
        raise PublishError('Publish request not found', 404)
    if req.state != STATE_APPROVED:
        raise PublishError('Publish request is no longer approved', 409)
    note_content_changed(req.document, user_id)
    if req.state != STATE_APPROVED or not req.approved_hash or req.approved_hash != req.content_hash:
        db.session.commit()
        raise PublishError('Content hash does not match', 409)
    approved_hash = req.approved_hash
    if not publish_service.claim_publishing(req.id, approved_hash):
        raise PublishError('Publish request is no longer approved', 409)
    db.session.remove()
    req = _reload(request_id)
    if mode == 'dry_run':
        _mark_published(
            req, post_id=None, url=None, user_id=user_id, touch_document=False,
            detail={'result': 'published(dry_run)', 'requests': _planned_calls(req)},
        )
        return _reload(request_id)
    graph = client or build_http_client()
    try:
        post_id, permalink, _data = _execute(graph, req)
        if not post_id:
            raise GraphCallError('unknown', message='missing id')
        permalink = _permalink(graph, post_id, permalink)
    except GraphCallError as exc:
        logger.info('facebook publish %s %s', exc.outcome, exc.safe_message)
        current = _reload(request_id)
        if current.state != STATE_PUBLISHING:
            return current
        outcome = STATE_FAILED if exc.outcome == 'failed' else STATE_UNKNOWN
        _record_outcome(current, outcome, detail={'error': exc.safe_message, 'code': exc.code}, user_id=user_id, error=exc)
        return _reload(request_id)
    current = _reload(request_id)
    _mark_published(
        current, post_id=str(post_id), url=permalink, user_id=user_id, touch_document=True,
        detail={'result': 'published', 'post_id': str(post_id)},
    )
    return _reload(request_id)


def _prefix(text: Optional[str]) -> str:
    return normalize_message(text or '')[:80]


def _in_window(created, req: StudioPublishRequest) -> bool:
    if created is None or req.attempt_started_at is None:
        return False
    start = req.attempt_started_at - _WINDOW
    finish = (req.attempt_finished_at or datetime.utcnow()) + _WINDOW
    return start <= created <= finish


def _parse_time(value):
    """Graph 的 created_time 對到 attempt 的 naive UTC。"""
    if not value or not isinstance(value, str):
        return None
    text = value.strip()
    if text.endswith('Z'):
        text = text[:-1]
    if '+' in text[10:]:
        text = text.split('+', 1)[0]
    try:
        return datetime.fromisoformat(text)
    except ValueError:
        return None


def reconcile(request_id: int, user, *, client: Optional[GraphClient] = None) -> StudioPublishRequest:
    publish_service._require_approver(user)
    user_id = user.id
    mode = publish_mode()
    if mode in ('off', 'dry_run'):
        raise PublishError('publishing_disabled', 409)
    assert_base_url(mode)
    req = db.session.get(StudioPublishRequest, request_id)
    if req is None:
        raise PublishError('Publish request not found', 404)
    if req.state != STATE_UNKNOWN:
        raise PublishError('Only an unknown publish request can be reconciled', 409)
    graph = client or build_http_client()
    page = _page(req)
    try:
        payload = graph.get(f'{page}/feed', {'fields': 'id,message,created_time,is_published'})
    except GraphCallError as exc:
        logger.info('facebook reconcile %s', exc.safe_message)
        raise PublishError('Reconcile did not reach Graph', 409)
    wanted = _prefix(_message(req))
    match = None
    for item in payload.get('data') or []:
        if not isinstance(item, dict) or not item.get('id'):
            continue
        if item.get('is_published') is False:
            continue
        if not wanted or _prefix(item.get('message')) != wanted:
            continue
        created = _parse_time(item.get('created_time'))
        if not _in_window(created, req):
            continue
        match = item
        break
    if match is None:
        publish_service.add_event(
            req.id, EVENT_RECONCILED, actor_id=user_id, actor_via='ui',
            detail=scrub({'matched': False}),
        )
        db.session.commit()
        return _reload(request_id)
    post_id = str(match['id'])
    permalink = match.get('permalink_url')
    try:
        permalink = _permalink(graph, post_id, permalink)
    except GraphCallError:
        permalink = match.get('permalink_url')
    _mark_published(
        req, post_id=post_id, url=permalink, user_id=user.id, touch_document=True,
        detail={'result': 'reconciled', 'post_id': post_id},
    )
    publish_service.add_event(
        req.id, EVENT_RECONCILED, actor_id=user_id, actor_via='ui',
        detail=scrub({'matched': True, 'post_id': post_id}),
    )
    db.session.commit()
    return _reload(request_id)


def health(*, client: Optional[GraphClient] = None) -> dict:
    mode = publish_mode()
    configured_page = page_id() is not None
    configured_token = access_token() is not None
    matches = False
    if mode in ('fake', 'live') and configured_page and configured_token:
        assert_base_url(mode)
        graph = client or build_http_client()
        try:
            data = graph.get('me', {'fields': 'id'})
            matches = str(data.get('id') or '') == str(page_id())
        except GraphCallError:
            matches = False
    return {
        'mode': mode,
        'page_id_configured': configured_page,
        'token_configured': configured_token,
        'page_id_matches': matches,
    }
