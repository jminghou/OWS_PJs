"""網站預覽連結：把 blog 文件的工作草稿套進正式文章版型，給拿到連結的人看，讀者與搜尋引擎看不到。

- 連結是簽章 token（含文件 id 與文件上的 preview_nonce），7 天後失效；撤銷＝換 nonce，舊連結全部作廢。
- 一篇文章的各語言版本（同 work_id）一起管理：拿到其中一個語言的連結，預覽頁上可以切到其他語言版本；
  撤銷時整篇文章所有語言一起換 nonce。網址帶語言前綴（/ja/preview/…），頁首頁尾用該語言。
- 預覽內容 = 綁定文章的現況 + 工作草稿的標題／內文／文章設定，序列化走 core 的 ContentSchema，
  前台用同一個 PostDetailContent 呈現，看到的就是發布後的樣子。
- 只讀：套用草稿時關掉 autoflush，結束一律 rollback，不會改到正式文章。
"""
import secrets
from datetime import datetime, timedelta

from flask import current_app, jsonify
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

from core.backend_engine.blueprints.api.contents import _decorate_content, content_schema
from core.backend_engine.blueprints.api.utils import get_i18n_setting
from core.backend_engine.factory import db
from core.backend_engine.models import Category, Content, Tag
from packages.studio.blueprint import studio_bp as bp
from packages.studio.models import StudioDocument
from packages.studio.api._common import bad_request, studio_write, with_session

PREVIEW_SALT = 'studio-preview-v1'
PREVIEW_MAX_AGE = 7 * 24 * 3600


def _serializer():
    return URLSafeTimedSerializer(current_app.config['SECRET_KEY'], salt=PREVIEW_SALT)


def _nonce(document: StudioDocument, rotate: bool = False) -> str:
    attrs = dict(document.attributes or {})
    if rotate or not attrs.get('preview_nonce'):
        attrs['preview_nonce'] = secrets.token_urlsafe(12)
        document.attributes = attrs
    return attrs['preview_nonce']


def _previewable(document: StudioDocument) -> bool:
    return bool(document and document.content and document.stage != 'archived')


def _versions(document: StudioDocument):
    """同一篇文章（work_id）可預覽的所有語言版本，含自己。"""
    docs = StudioDocument.query.filter_by(work_id=document.work_id, platform='blog').order_by(StudioDocument.language).all()
    return [d for d in docs if _previewable(d)]


def _token(document: StudioDocument) -> str:
    return _serializer().dumps({'d': document.id, 'n': _nonce(document)})


def _path(document: StudioDocument, token: str) -> str:
    default = get_i18n_setting('i18n_default_language', 'zh-TW')
    prefix = '' if document.language == default else f'/{document.language}'
    return f'{prefix}/preview/{token}'


def _no_index(response, status=200):
    response.status_code = status
    response.headers['Cache-Control'] = 'private, no-store'
    response.headers['X-Robots-Tag'] = 'noindex, nofollow'
    return response


@bp.route('/documents/<int:document_id>/preview-link', methods=['POST'])
@studio_write
@with_session
def create_preview_link(document_id):
    document = StudioDocument.query.get_or_404(document_id)
    if not _previewable(document):
        return bad_request('Only website articles can be previewed')
    for version in _versions(document):
        _nonce(version)   # 其他語言版本也備好 nonce，預覽頁才能列出切換連結
    token = _token(document)
    db.session.commit()
    return jsonify({
        'token': token,
        'path': _path(document, token),
        'expires_at': (datetime.utcnow() + timedelta(seconds=PREVIEW_MAX_AGE)).isoformat(),
    })


@bp.route('/documents/<int:document_id>/preview-link', methods=['DELETE'])
@studio_write
@with_session
def revoke_preview_links(document_id):
    document = StudioDocument.query.get_or_404(document_id)
    for version in {document, *_versions(document)}:
        _nonce(version, rotate=True)
    db.session.commit()
    return jsonify({'message': 'Preview links revoked'})


def _apply_draft(content: Content, document: StudioDocument) -> None:
    """把工作草稿套到 session 內的文章物件（呼叫端負責 rollback）。關係欄位直接指定物件，
    不靠 flush 後重載，所以 autoflush 關著也拿得到新的分類／作者／標籤。"""
    from packages.studio.api.languages import ARTICLE_FIELDS, article_settings
    settings = article_settings(document) or {}
    content.title = document.title or content.title
    content.content = document.body or ''
    for key in ARTICLE_FIELDS:
        if key in settings:
            setattr(content, key, settings[key])
    if 'category_id' in settings:
        content.category = db.session.get(Category, settings['category_id']) if settings['category_id'] else None
    if settings.get('author_id'):
        author = db.session.get(Content.author.property.mapper.class_, settings['author_id'])
        if author:
            content.author = author
    if 'tag_ids' in settings:
        ids = settings['tag_ids'] or []
        content.tags = Tag.query.filter(Tag.id.in_(ids)).all() if ids else []


@bp.route('/preview/<string:token>', methods=['GET'])
def preview_article(token):
    """公開端點（不需登入）：憑簽章 token 讀工作草稿。失效、撤銷、封存一律 404，不透露原因。"""
    try:
        payload = _serializer().loads(token, max_age=PREVIEW_MAX_AGE)
    except (SignatureExpired, BadSignature):
        return _no_index(jsonify({'error': 'Not found'}), 404)
    document = db.session.get(StudioDocument, payload.get('d')) if isinstance(payload, dict) else None
    if not _previewable(document) or (document.attributes or {}).get('preview_nonce') != payload.get('n'):
        return _no_index(jsonify({'error': 'Not found'}), 404)

    content = document.content
    meta = {
        'document_id': document.id,
        'language': document.language,
        'website_status': content.status,
        'draft_updated_at': document.updated_at.isoformat() if document.updated_at else None,
        # 同一篇文章的其他語言版本（只列已備好 nonce 的，避免在公開端點寫入資料）
        'versions': [
            {'language': v.language, 'title': v.title, 'website_status': v.content.status,
             'path': _path(v, _serializer().dumps({'d': v.id, 'n': v.attributes['preview_nonce']}))}
            for v in _versions(document) if (v.attributes or {}).get('preview_nonce')
        ],
    }
    try:
        with db.session.no_autoflush:
            _apply_draft(content, document)
            data = _decorate_content(content, content_schema.dump(content))
    finally:
        db.session.rollback()
    data['preview'] = meta
    return _no_index(jsonify(data))
