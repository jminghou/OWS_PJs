"""Language variants, article settings and adoption of existing website articles."""
from datetime import datetime
import hashlib
import json
from uuid import uuid4, uuid5, NAMESPACE_URL
from flask import jsonify, request
from sqlalchemy import text
from core.backend_engine.factory import db
from core.backend_engine.models import Content, User, Category, Tag
from core.backend_engine.blueprints.api.utils import get_i18n_setting
from core.backend_engine.services.rbac import require_permission
from core.backend_engine.services.identity import identity_model
from packages.studio.blueprint import studio_bp as bp
from packages.studio.models import StudioDocument, StudioProject
from packages.studio.api._common import studio_read, studio_write, with_session, json_body, bad_request, current_user_id, paginate

ARTICLE_FIELDS = ('summary','slug','featured_image','cover_image','meta_title','meta_description','author_id','category_id')


def fingerprint(doc):
    return hashlib.sha256(json.dumps([doc.title or '',doc.body or ''],ensure_ascii=False).encode()).hexdigest()


def language_options():
    default = get_i18n_setting('i18n_default_language','zh-TW')
    enabled = get_i18n_setting('i18n_enabled','false').lower() == 'true'
    languages = list(dict.fromkeys(x.strip() for x in get_i18n_setting('i18n_languages',default).split(',') if x.strip())) if enabled else [default]
    if default not in languages: languages.insert(0,default)
    try: names=json.loads(get_i18n_setting('i18n_language_names','{}'))
    except (ValueError,TypeError): names={}
    return {'default_language':default,'languages':languages,'language_names':names,'enabled':enabled}


def article_settings(doc):
    if not doc.content: return None
    result={k:getattr(doc.content,k) for k in ARTICLE_FIELDS}
    result['tag_ids']=[t.id for t in doc.content.tags]
    result.update((doc.attributes or {}).get('article_settings') or {})
    return result


def decorate_document(doc, data):
    variants=StudioDocument.query.filter_by(work_id=doc.work_id).order_by(StudioDocument.language).all()
    data['language_versions']=[dict(v.to_dict(include_body=False),
        website_status=v.content.status if v.content else None) for v in variants]
    source=db.session.get(StudioDocument,doc.translation_source_id) if doc.translation_source_id else None
    data['source_changed']=bool(source and doc.source_fingerprint != fingerprint(source))
    data['source_title']=source.title if source else None
    data['article_settings']=article_settings(doc)
    return data


def root_content(content):
    seen=set()
    while content.original_id:
        if content.id in seen: raise ValueError('Invalid translation chain')
        seen.add(content.id)
        content=db.session.get(Content,content.original_id)
        if not content: raise ValueError('Missing source article')
    return content


@bp.route('/editor-options',methods=['GET'])
@studio_read
def editor_options():
    return jsonify(dict(language_options(),
        authors=[{'id':u.id,'name':getattr(u,'display_name',None) or (getattr(u,'attributes',None) or {}).get('display_name') or u.username} for u in identity_model().query.filter_by(is_active=True).all()],
        categories=[{'id':c.id,'name':c.get_slug()} for c in Category.query.order_by(Category.sort_order).all()],
        tags=[{'id':t.id,'name':t.get_slug()} for t in Tag.query.order_by(Tag.code).all()]))


@bp.route('/documents/<int:document_id>/translations',methods=['POST'])
@studio_write
@with_session
def create_translation(document_id):
    from packages.studio.api.documents import _document_detail, _unique_content_slug, _snapshot, _mark_synced
    source=StudioDocument.query.get_or_404(document_id)
    # One transaction per work prevents duplicate variants even from simultaneous clicks.
    db.session.execute(text('SELECT pg_advisory_xact_lock(hashtext(:key))'),{'key':source.work_id})
    data=json_body(); language=data.get('language')
    if language not in language_options()['languages']: return bad_request('This language is not enabled')
    if StudioDocument.query.filter_by(work_id=source.work_id,language=language).first():
        return bad_request('Language version already exists',409)
    mode=data.get('mode','blank')
    if mode not in ('blank','copy'): return bad_request('Invalid translation mode')
    title=source.title if mode=='copy' else f'{source.project.title} · {language}'
    body=(source.body or '') if mode=='copy' else ''
    settings=article_settings(source)
    attrs={'translation_review_pending':True}
    content=None
    if source.platform=='blog':
        if not source.content: return bad_request('Source has no bound article')
        root=root_content(source.content)
        if any(root_content(c).id == root.id for c in Content.query.filter_by(content_type='article',language=language).all()):
            return bad_request('An existing website translation must be adopted first',409)
        content=Content(title=title,content=body,slug=_unique_content_slug(f'{root.slug}-{language.lower()}'),
            language=language,original_id=root.id,status='draft',content_type='article',
            author_id=source.content.author_id,category_id=source.content.category_id,
            featured_image=source.content.featured_image,cover_image=source.content.cover_image)
        content.tags=list(source.content.tags)
        db.session.add(content);db.session.flush()
        # Do not silently publish untranslated SEO copied from the source language.
        attrs['article_settings']={**settings,'slug':content.slug,'summary':'','meta_title':'','meta_description':''}
    doc=StudioDocument(project_id=source.project_id,platform=source.platform,work_id=source.work_id,
        language=language,title=title,body=body,stage='write',content_id=content.id if content else None,
        translation_source_id=source.id,source_fingerprint=fingerprint(source),attributes=attrs)
    db.session.add(doc);db.session.flush()
    if content: _mark_synced(doc)
    revision=_snapshot(doc,'named','建立語言版本');doc.current_revision_id=revision.id
    db.session.commit()
    return jsonify({'id':doc.id,'document':_document_detail(doc)}),201


@bp.route('/documents/<int:document_id>/translation-reviewed',methods=['POST'])
@studio_write
@with_session
def review_translation(document_id):
    from packages.studio.api.documents import _document_detail
    doc=StudioDocument.query.get_or_404(document_id)
    source=db.session.get(StudioDocument,doc.translation_source_id) if doc.translation_source_id else None
    if source: doc.source_fingerprint=fingerprint(source)
    doc.attributes={**(doc.attributes or {}),'translation_review_pending':False}
    db.session.commit()
    return jsonify({'document':_document_detail(doc)})


def validate_settings(doc,data):
    values={k:data.get(k) for k in ARTICLE_FIELDS if k in data}
    for key in ('summary','slug','featured_image','cover_image','meta_title','meta_description'):
        if key in values and values[key] is not None and not isinstance(values[key],str): raise ValueError(f'Invalid {key}')
    slug=values.get('slug')
    if 'slug' in values:
        if not slug or len(slug)>200 or any(c in slug for c in '/?# '): raise ValueError('Invalid article URL slug')
        if Content.query.filter(Content.slug==slug,Content.id!=doc.content_id).first(): raise ValueError('Article URL already exists')
    for key,model in [('author_id',identity_model()),('category_id',Category)]:
        if key in values and values[key] is not None:
            if type(values[key]) != int: raise ValueError(f'Invalid {key}')
            obj=db.session.get(model,values[key])
            if not obj or (key=='author_id' and not obj.is_active): raise ValueError(f'Invalid {key}')
    if 'tag_ids' in data:
        ids=data['tag_ids']
        if not isinstance(ids,list) or any(type(i)!=int for i in ids): raise ValueError('Invalid tags')
        if Tag.query.filter(Tag.id.in_(ids)).count()!=len(set(ids)): raise ValueError('Unknown tags')
        values['tag_ids']=list(dict.fromkeys(ids))
    for key,limit in [('meta_title',200),('featured_image',500),('cover_image',500)]:
        if len(values.get(key) or '')>limit: raise ValueError(f'{key} too long')
    return values


@bp.route('/documents/<int:document_id>/article-settings',methods=['PUT'])
@studio_write
@require_permission('contents.update')
@with_session
def save_article_settings(document_id):
    from packages.studio.api.documents import _document_detail
    doc=StudioDocument.query.get_or_404(document_id)
    if not doc.content: return bad_request('Not a website article')
    try: values=validate_settings(doc,json_body())
    except (ValueError,TypeError) as exc: return bad_request(str(exc))
    doc.attributes={**(doc.attributes or {}),'article_settings':{**article_settings(doc),**values}}
    db.session.commit()
    return jsonify({'document':_document_detail(doc)})


@bp.route('/articles',methods=['GET'])
@studio_read
def article_catalog():
    query=Content.query.filter_by(content_type='article')
    if request.args.get('search'): query=query.filter(Content.title.ilike('%'+request.args['search']+'%'))
    rows,pagination=paginate(query.order_by(Content.updated_at.desc()))
    ids=[c.id for c in rows]
    bound={d.content_id:d.id for d in StudioDocument.query.filter(StudioDocument.content_id.in_(ids)).all()}
    return jsonify({'items':[{'id':c.id,'title':c.title,'language':c.language,'status':c.status,'document_id':bound.get(c.id)} for c in rows], 'pagination':pagination})


@bp.route('/articles/<int:content_id>/adopt',methods=['POST'])
@studio_write
@require_permission('contents.update')
@with_session
def adopt_article(content_id):
    from packages.studio.api.documents import _document_detail,_mark_synced,_snapshot
    content=Content.query.get_or_404(content_id)
    if content.content_type != 'article': return bad_request('Only articles can be adopted')
    root=root_content(content)
    db.session.execute(text('SELECT pg_advisory_xact_lock(719102, :id)'),{'id':root.id})
    # Follow legacy chains; every version is rebound directly to the root.
    all_contents=Content.query.filter_by(content_type='article').all()
    family=[c for c in all_contents if root_content(c).id==root.id]
    if len({c.language for c in family})!=len(family): return bad_request('Duplicate languages require review',409)
    existing=StudioDocument.query.filter(StudioDocument.content_id.in_([c.id for c in family])).all()
    if len({d.work_id for d in existing})>1: return bad_request('Versions belong to different works',409)
    if len({d.project_id for d in existing})>1: return bad_request('Versions belong to different projects',409)
    if existing:
        project=existing[0].project;work_id=existing[0].work_id
    else:
        project=StudioProject(title=root.title,slug='article-'+str(root.id)+'-'+str(uuid4())[:8],stage='write',owner_id=current_user_id())
        db.session.add(project);db.session.flush()
        work_id=str(uuid5(NAMESPACE_URL,'ows-studio/content:'+str(root.id)))
    by_content={d.content_id:d for d in existing}
    for c in family:
        c.original_id=root.id if c.id!=root.id else None
        if c.id in by_content: continue
        doc=StudioDocument(project_id=project.id,platform='blog',work_id=work_id,language=c.language,
            title=c.title,body=c.content or '',stage=('scheduled' if c.published_at and c.published_at > datetime.utcnow() else 'published') if c.status=='published' else 'write',content_id=c.id,
            published_at=c.published_at, scheduled_at=c.published_at if c.status=="published" and c.published_at and c.published_at > datetime.utcnow() else None)
        db.session.add(doc);db.session.flush();_mark_synced(doc)
        rev=_snapshot(doc,'named','接管既有文章');doc.current_revision_id=rev.id
        by_content[c.id]=doc
    root_doc=by_content[root.id]
    for doc in by_content.values():
        if doc.id != root_doc.id and not doc.translation_source_id:
            doc.translation_source_id=root_doc.id;doc.source_fingerprint=fingerprint(root_doc)
    db.session.commit()
    doc=by_content[content_id]
    return jsonify({'id':doc.id,'document':_document_detail(doc)})
