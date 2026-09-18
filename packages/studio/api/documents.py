"""各平台文件、自動儲存、版本、與 core contents 的同步。"""
from datetime import datetime

from flask import jsonify, request

from core.backend_engine.blueprints.api.contents import _revalidate_content_pages
from core.backend_engine.blueprints.api.utils import invalidate_public_cache
from core.backend_engine.factory import db
from core.backend_engine.models import Content, Tag
from core.backend_engine.services.rbac import RBACService
from packages.studio.blueprint import studio_bp as bp
from packages.studio.constants import (
    AUTOSAVE_KEEP, PLATFORMS, PLATFORMS_BOUND_TO_CONTENT, STAGES,
)
from packages.studio.models import (
    StudioCard, StudioCardRef, StudioDocument, StudioProject, StudioRevision,
)
from packages.studio.api._common import (
    attach_tags, bad_request, current_user_id, json_body, parse_dt, set_tags,
    studio_read, studio_write, with_session,
)


def _iso(dt):
    return dt.isoformat() if dt else None


def _content_summary(content: Content) -> dict:
    return {
        'id': content.id,
        'title': content.title,
        'slug': content.slug,
        'status': content.status,
        'published_at': _iso(content.published_at),
        'updated_at': _iso(content.updated_at),
        'language': content.language,
    }


def _unique_content_slug(title: str) -> str:
    import re
    base = re.sub(r'[^\w\-]', '-', (title or '').strip().lower())
    base = re.sub(r'-+', '-', base).strip('-') or 'post'
    slug, counter = base, 1
    while Content.query.filter_by(slug=slug).first():
        slug = f'{base}-{counter}'
        counter += 1
    return slug


def _snapshot(document: StudioDocument, kind: str, label=None) -> StudioRevision:
    rev = StudioRevision(
        document_id=document.id,
        kind=kind,
        label=label,
        title=document.title,
        body=document.body,
        created_by=current_user_id(),
    )
    db.session.add(rev)
    db.session.flush()
    return rev


def _mark_synced(document: StudioDocument) -> None:
    """記下「上次同步時文章的 updated_at」。content-status 用它判斷文章是否在文章管理頁又被改過；
    直接比 document.updated_at 會被 onupdate 的微秒差誤判（同一次 commit 裡文章永遠比文件晚幾微秒）。"""
    content = document.content
    if content is None:
        return
    db.session.flush()
    db.session.refresh(content)
    attrs = dict(document.attributes or {})
    attrs['content_synced_at'] = _iso(content.updated_at)
    attrs['content_synced_title'] = content.title
    document.attributes = attrs


def _prune_autosaves(document_id: int) -> None:
    stale = (
        StudioRevision.query.filter_by(document_id=document_id, kind='autosave')
        .order_by(StudioRevision.created_at.desc(), StudioRevision.id.desc())
        .offset(AUTOSAVE_KEEP).all()
    )
    for rev in stale:
        db.session.delete(rev)


def _document_detail(document: StudioDocument) -> dict:
    data = attach_tags('document', [document.to_dict()])[0]
    data['project'] = {'id': document.project.id, 'title': document.project.title, 'stage': document.project.stage}
    data['content'] = _content_summary(document.content) if document.content else None
    refs = StudioCardRef.query.filter_by(target_type='document', target_id=document.id).all()
    card_ids = [r.card_id for r in refs]
    cards = StudioCard.query.filter(StudioCard.id.in_(card_ids)).all() if card_ids else []
    data['cards'] = [c.to_dict() for c in cards]
    latest = (
        StudioRevision.query.filter_by(document_id=document.id)
        .order_by(StudioRevision.created_at.desc(), StudioRevision.id.desc()).first()
    )
    data['latest_revision'] = latest.to_dict() if latest else None
    from packages.studio.api.languages import decorate_document
    return decorate_document(document, data)


# ==================== Documents ====================

@bp.route('/projects/<int:project_id>/documents', methods=['GET'])
@studio_read
def list_documents(project_id):
    StudioProject.query.get_or_404(project_id)
    docs = (
        StudioDocument.query.filter_by(project_id=project_id)
        .order_by(StudioDocument.platform, StudioDocument.updated_at.desc()).all()
    )
    return jsonify({'documents': attach_tags('document', [d.to_dict(include_body=False) for d in docs])})


@bp.route('/projects/<int:project_id>/documents', methods=['POST'])
@studio_write
@with_session
def create_document(project_id):
    """新增平台版本。blog：帶 content_id 綁既有文章，或不帶 → 以標題新建草稿文章。"""
    project = StudioProject.query.get_or_404(project_id)
    data = json_body()
    platform = data.get('platform')
    if platform not in PLATFORMS:
        return bad_request('Invalid platform')
    title = (data.get('title') or project.title).strip()
    body = data.get('body') or ''
    from packages.studio.api.languages import language_options
    options = language_options()
    language = data.get('language') or options['default_language']
    if language not in options['languages']:
        return bad_request('This language is not enabled')
    if data.get('stage', 'write') not in STAGES or data.get('stage') in ('published', 'scheduled'):
        return bad_request('Create a draft before publishing')
    content = None

    if platform in PLATFORMS_BOUND_TO_CONTENT:
        content_id = data.get('content_id')
        if content_id:
            return bad_request('Use the article adoption endpoint to preserve its language family', 409)
        else:
            content = Content(
                title=title,
                content=body,
                summary=data.get('summary'),
                slug=_unique_content_slug(title),
                status='draft',
                content_type='article',
                author_id=current_user_id(),
                language=language,
            )
            db.session.add(content)
            db.session.flush()

    document = StudioDocument(
        project_id=project.id,
        platform=platform,
        language=language,
        title=title,
        body=body,
        stage=data.get('stage') or 'write',
        content_id=content.id if content else None,
        attributes=data.get('attributes') or {},
    )
    db.session.add(document)
    db.session.flush()
    if 'tag_ids' in data:
        set_tags('document', document.id, data.get('tag_ids') or [])
    if content:
        _mark_synced(document)
    db.session.commit()
    if content:
        invalidate_public_cache()
    return jsonify({'message': 'Document created', 'id': document.id, 'document': _document_detail(document)}), 201


@bp.route('/documents/<int:document_id>', methods=['GET'])
@studio_read
def get_document(document_id):
    document = StudioDocument.query.get_or_404(document_id)
    return jsonify(_document_detail(document))


@bp.route('/documents/<int:document_id>', methods=['PUT'])
@studio_write
@with_session
def update_document(document_id):
    """明確儲存（非自動）：更新欄位，不產生版本。"""
    document = StudioDocument.query.get_or_404(document_id)
    data = json_body()
    if document.content_id and any(k in data for k in ('stage', 'scheduled_at', 'published_at')):
        if 'scheduled_at' in data or 'published_at' in data or data.get('stage') in ('published','scheduled') or document.content.status == 'published':
            return bad_request('Use publication actions for website articles')
    if 'title' in data:
        document.title = (data.get('title') or '').strip() or document.title
    if 'body' in data:
        document.body = data['body']
    if 'stage' in data:
        if data['stage'] not in STAGES:
            return bad_request('Invalid stage')
        document.stage = data['stage']
    if 'scheduled_at' in data:
        document.scheduled_at = parse_dt(data['scheduled_at'])
    if 'published_url' in data:
        document.published_url = data['published_url']
    if 'attributes' in data:
        return bad_request('Use dedicated article settings and translation review actions')
    if 'tag_ids' in data:
        set_tags('document', document.id, data.get('tag_ids') or [])
    db.session.commit()
    return jsonify({'message': 'Document updated', 'document': _document_detail(document)})


@bp.route('/documents/<int:document_id>', methods=['DELETE'])
@studio_write
@with_session
def delete_document(document_id):
    document = StudioDocument.query.get_or_404(document_id)
    if document.content_id or StudioDocument.query.filter_by(translation_source_id=document.id).first():
        return bad_request('Archive this document; website articles and translation sources cannot be deleted')
    StudioCardRef.query.filter_by(target_type='document', target_id=document.id).delete()
    db.session.delete(document)   # 綁定的 contents 不刪：文章是公開站的資產
    db.session.commit()
    return jsonify({'message': 'Document deleted'})


# ==================== Autosave / Revisions ====================

@bp.route('/documents/<int:document_id>/autosave', methods=['POST'])
@studio_write
@with_session
def autosave_document(document_id):
    """自動儲存：更新工作草稿 + 寫一筆 autosave 版本 + 修剪。內容沒變就不寫版本。"""
    document = StudioDocument.query.get_or_404(document_id)
    data = json_body()
    new_title = (data.get('title') if 'title' in data else document.title) or document.title
    new_body = data.get('body') if 'body' in data else document.body
    if new_title == document.title and (new_body or '') == (document.body or ''):
        return jsonify({'message': 'No changes', 'saved_at': _iso(document.updated_at), 'revision': None})
    document.title = new_title
    document.body = new_body
    document.updated_at = datetime.utcnow()
    rev = _snapshot(document, 'autosave')
    _prune_autosaves(document.id)
    db.session.commit()
    return jsonify({'message': 'Autosaved', 'saved_at': _iso(document.updated_at), 'revision': rev.to_dict()})


@bp.route('/documents/<int:document_id>/revisions', methods=['GET'])
@studio_read
def list_revisions(document_id):
    StudioDocument.query.get_or_404(document_id)
    kind = request.args.get('kind')
    query = StudioRevision.query.filter_by(document_id=document_id)
    if kind:
        query = query.filter_by(kind=kind)
    revisions = query.order_by(StudioRevision.created_at.desc(), StudioRevision.id.desc()).limit(200).all()
    return jsonify({'revisions': [r.to_dict() for r in revisions]})


@bp.route('/documents/<int:document_id>/revisions', methods=['POST'])
@studio_write
@with_session
def create_named_revision(document_id):
    """命名版本：先把（可能一併送來的）最新內容寫入文件，再快照。"""
    document = StudioDocument.query.get_or_404(document_id)
    data = json_body()
    label = (data.get('label') or '').strip()
    if not label:
        return bad_request('Label is required')
    if 'title' in data and data['title']:
        document.title = data['title']
    if 'body' in data:
        document.body = data['body']
    rev = _snapshot(document, 'named', label=label)
    document.current_revision_id = rev.id
    db.session.commit()
    return jsonify({'message': 'Revision saved', 'revision': rev.to_dict()}), 201


@bp.route('/revisions/<int:revision_id>', methods=['GET'])
@studio_read
def get_revision(revision_id):
    rev = StudioRevision.query.get_or_404(revision_id)
    return jsonify(rev.to_dict(include_body=True))


@bp.route('/revisions/<int:revision_id>', methods=['PUT'])
@studio_write
@with_session
def rename_revision(revision_id):
    rev = StudioRevision.query.get_or_404(revision_id)
    data = json_body()
    label = (data.get('label') or '').strip()
    if not label:
        return bad_request('Label is required')
    rev.label = label
    if rev.kind == 'autosave':
        rev.kind = 'named'   # 幫自動儲存命名 = 升格為命名版本，不再被修剪
    db.session.commit()
    return jsonify({'message': 'Revision renamed', 'revision': rev.to_dict()})


@bp.route('/revisions/<int:revision_id>/restore', methods=['POST'])
@studio_write
@with_session
def restore_revision(revision_id):
    """還原：先把目前內容快照成一筆命名版本（可回頭），再把版本內容寫回文件。"""
    rev = StudioRevision.query.get_or_404(revision_id)
    document = rev.document
    backup = _snapshot(document, 'named', label=f'還原前備份 {datetime.utcnow():%m-%d %H:%M}')
    document.title = rev.title or document.title
    document.body = rev.body
    document.current_revision_id = rev.id
    db.session.commit()
    return jsonify({
        'message': 'Revision restored',
        'document': _document_detail(document),
        'backup_revision': backup.to_dict(),
    })


# ==================== Blog ↔ contents 同步 ====================

@bp.route('/documents/<int:document_id>/content-status', methods=['GET'])
@studio_read
def content_status(document_id):
    """文章是否在文章管理頁被改得比工作草稿新。"""
    document = StudioDocument.query.get_or_404(document_id)
    if not document.content:
        return jsonify({'bound': False})
    content = document.content
    synced_at = (document.attributes or {}).get('content_synced_at')
    if synced_at:
        newer = bool(content.updated_at and _iso(content.updated_at) > synced_at)
    else:
        newer = bool(content.updated_at and document.updated_at and content.updated_at > document.updated_at)
    diverged = (content.content or '') != (document.body or '') or (content.title or '') != (document.title or '')
    return jsonify({
        'bound': True,
        'content': _content_summary(content),
        'content_newer': newer,
        'diverged': diverged,
    })


@bp.route('/documents/<int:document_id>/load-from-content', methods=['POST'])
@studio_write
@with_session
def load_from_content(document_id):
    """把文章目前的標題／內容載入工作草稿（先備份現況）。"""
    document = StudioDocument.query.get_or_404(document_id)
    if not document.content:
        return bad_request('Document is not bound to an article')
    _snapshot(document, 'named', label=f'載入文章前備份 {datetime.utcnow():%m-%d %H:%M}')
    document.title = document.content.title
    document.body = document.content.content or ''
    _mark_synced(document)
    db.session.commit()
    return jsonify({'message': 'Loaded from article', 'document': _document_detail(document)})


@bp.route('/documents/<int:document_id>/sync-to-content', methods=['POST'])
@studio_write
@with_session
def sync_to_content(document_id):
    """Publish one language explicitly; autosaves never mutate the public article."""
    from packages.studio.api.languages import article_settings, validate_settings
    document = StudioDocument.query.get_or_404(document_id)
    if not document.content:
        return bad_request('Document is not bound to an article')
    data = json_body()
    mode = data.get('mode', 'save')
    if mode not in ('save', 'publish', 'schedule', 'unpublish'):
        return bad_request('Invalid publication action')
    permission = 'contents.update' if mode == 'save' else 'contents.publish'
    if not RBACService.has_any_permission(current_user_id(), [permission]):
        return bad_request('Permission denied', 403)
    content = document.content
    if mode == 'save' and content.status == 'published':
        return bad_request('The working draft is saved separately; publish to update the website', 409)
    if mode in ('publish', 'schedule'):
        if (document.attributes or {}).get('translation_review_pending'):
            return bad_request('Review this translation before publishing')
        if not (document.body or '').strip():
            return bad_request('Article body is required')
    published_at = datetime.utcnow()
    if mode == 'schedule':
        published_at = parse_dt(data.get('published_at'))
        if not published_at or published_at <= datetime.utcnow():
            return bad_request('Choose a future publication time')
    old_slug = content.slug
    rev = None
    if mode == 'unpublish':
        content.status = 'draft'
        content.published_at = None
        document.stage = 'write'
        document.published_at = None
        document.scheduled_at = None
    else:
        try:
            settings = validate_settings(document, article_settings(document))
        except (ValueError, TypeError) as exc:
            return bad_request(str(exc))
        content.title = document.title or content.title
        content.content = document.body or ''
        for key, value in settings.items():
            if key == 'tag_ids':
                content.tags = Tag.query.filter(Tag.id.in_(value)).all()
            else:
                setattr(content, key, value)
        if mode in ('publish', 'schedule'):
            content.status = 'published'
            content.published_at = published_at
            document.published_at = published_at
            document.stage = 'scheduled' if mode == 'schedule' else 'published'
            document.scheduled_at = published_at if mode == 'schedule' else None
            rev = _snapshot(document, 'published', label=f'{mode} {published_at:%Y-%m-%d %H:%M}')
            document.current_revision_id = rev.id
    _mark_synced(document)
    db.session.commit()
    invalidate_public_cache()
    _revalidate_content_pages(old_slug, content.slug)
    return jsonify({'message': mode, 'document': _document_detail(document),
                    'revision': rev.to_dict() if rev else None})
