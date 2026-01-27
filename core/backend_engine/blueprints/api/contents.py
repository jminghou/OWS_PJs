"""
Contents API Routes

Provides CRUD endpoints for content management:
- GET /contents - List contents with pagination and filters
- GET /contents/<id> - Get content by ID
- GET /contents/slug/<slug> - Get content by slug
- POST /contents - Create new content
- PUT /contents/<id> - Update content
- DELETE /contents/<id> - Delete content
- GET /categories - List categories
- POST /categories - Create category
- PUT /categories/<id> - Update category
- DELETE /categories/<id> - Delete category
- GET /tags - List tags
- POST /tags - Create tag
- PUT /tags/<id> - Update tag
- DELETE /tags/<id> - Delete tag
"""

from flask import jsonify, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
import pytz
import re
from sqlalchemy import func
from sqlalchemy.orm import joinedload, subqueryload

from core.backend_engine.factory import db, cache
from core.backend_engine.blueprints.api import bp
from core.backend_engine.blueprints.api.utils import (
    is_authenticated, is_i18n_enabled, get_i18n_setting,
    get_localized_slug, parse_tw_datetime, now_tw, utc_to_tw
)
from core.backend_engine.models import Content, Category, Tag, User, Comment
from core.backend_engine.schemas.content import ContentSchema
from core.backend_engine.schemas.category import CategorySchema
from core.backend_engine.schemas.tag import TagSchema
from core.backend_engine.schemas.user import UserSchema

content_schema = ContentSchema()
contents_schema = ContentSchema(many=True)
category_schema = CategorySchema()
categories_schema = CategorySchema(many=True)
tag_schema = TagSchema()
tags_schema = TagSchema(many=True)


def _decorate_content(content, data):
    """Private helper: Add extra fields and localization info expected by frontend"""
    # Compatibility patch: frontend expects post_type
    data['post_type'] = content.content_type

    # Handle category display name and slug (frontend expects category.name)
    if content.category:
        if not data.get('category'):
            data['category'] = {}
        localized_name = get_localized_slug(content.category, content.language)
        data['category']['name'] = localized_name
        data['category']['slug'] = localized_name
        data['category_display'] = localized_name  # Legacy compatibility

    # Handle tag display names and slugs
    if content.tags and 'tags' in data:
        for t_idx, t in enumerate(content.tags):
            if t_idx < len(data['tags']):
                localized_tag_name = get_localized_slug(t, content.language)
                data['tags'][t_idx]['name'] = localized_tag_name
                data['tags'][t_idx]['slug'] = localized_tag_name
                data['tags'][t_idx]['display_name'] = localized_tag_name

    # Handle available languages list
    if is_i18n_enabled():
        available_langs = [content.language]
        if content.original_id:
            original = Content.query.get(content.original_id)
            if original:
                available_langs = list(set([original.language] + [t.language for t in original.translations]))
        else:
            available_langs = list(set([content.language] + [t.language for t in content.translations]))
        data['available_languages'] = available_langs

        # Build translation details (for detail page)
        translations_info = []
        if content.original_id:
            original = Content.query.get(content.original_id)
            if original:
                translations_info.append({'language': original.language, 'id': original.id, 'slug': original.slug})
                for t in original.translations:
                    if t.id != content.id:
                        translations_info.append({'language': t.language, 'id': t.id, 'slug': t.slug})
        else:
            for t in content.translations:
                translations_info.append({'language': t.language, 'id': t.id, 'slug': t.slug})
        data['translations_info'] = translations_info

    return data


# ==================== Contents ====================

@bp.route('/contents', methods=['GET'])
def api_contents():
    """Get content list with pagination and filters"""
    page = request.args.get('page', 1, type=int)
    per_page = min(request.args.get('per_page', 10, type=int), 100)
    category_id = request.args.get('category_id', type=int)
    status = request.args.get('status', 'published')
    content_type = request.args.get('type')
    search = request.args.get('search')
    tag = request.args.get('tag')
    language = request.args.get('language')

    # Optimized query: Use eager loading to solve N+1 problem
    query = Content.query.options(
        joinedload(Content.author),
        joinedload(Content.category),
        subqueryload(Content.tags)
    )

    if is_i18n_enabled():
        if language:
            query = query.filter_by(language=language)
        else:
            default_lang = get_i18n_setting('i18n_default_language', 'zh-TW')
            query = query.filter_by(language=default_lang)
    else:
        query = query.filter(Content.original_id.is_(None))

    if category_id:
        query = query.filter_by(category_id=category_id)

    if status:
        query = query.filter_by(status=status)
        if status == 'published' and not is_authenticated():
            query = query.filter(
                (Content.published_at.is_(None)) |
                (Content.published_at <= datetime.utcnow())
            )

    if content_type:
        query = query.filter_by(content_type=content_type)

    if search:
        # Prefer PostgreSQL Full-Text Search
        if db.engine.name == 'postgresql':
            search_filter = func.to_tsvector('simple',
                Content.title + ' ' +
                (Content.summary if Content.summary else '') + ' ' +
                (Content.content if Content.content else '')
            ).match(search, postgresql_regconfig='simple')
        else:
            # Fallback to LIKE query for non-PostgreSQL
            search_filter = (
                Content.title.contains(search) |
                Content.summary.contains(search) |
                Content.content.contains(search)
            )
        query = query.filter(search_filter)

    if tag:
        query = query.join(Content.tags).filter(Tag.code == tag)

    contents_pagination = query.order_by(Content.published_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )

    # Serialize with Marshmallow and decorate
    contents_data = []
    dumped_data = contents_schema.dump(contents_pagination.items)
    for idx, content in enumerate(contents_pagination.items):
        contents_data.append(_decorate_content(content, dumped_data[idx]))

    return jsonify({
        'contents': contents_data,
        'pagination': {
            'page': contents_pagination.page,
            'pages': contents_pagination.pages,
            'per_page': contents_pagination.per_page,
            'total': contents_pagination.total,
            'has_next': contents_pagination.has_next,
            'has_prev': contents_pagination.has_prev
        }
    }), 200


@bp.route('/contents/<int:content_id>', methods=['GET'])
def api_content_detail(content_id):
    """Get content details by ID"""
    content = Content.query.options(
        joinedload(Content.author),
        joinedload(Content.category),
        subqueryload(Content.tags)
    ).get_or_404(content_id)
    is_preview = request.args.get('preview') == 'true'
    is_logged_in = is_authenticated()

    if not is_preview and not is_logged_in:
        if content.status != 'published' or (content.published_at and content.published_at > datetime.utcnow()):
            return jsonify({'error': 'Not found'}), 404
        content.increment_views()

    data = content_schema.dump(content)
    data = _decorate_content(content, data)

    return jsonify(data), 200


@bp.route('/contents/slug/<string:slug>', methods=['GET'])
def api_content_by_slug(slug):
    """Get content details by slug"""
    language = request.args.get('language')
    query = Content.query.options(
        joinedload(Content.author),
        joinedload(Content.category),
        subqueryload(Content.tags)
    ).filter_by(slug=slug)
    if is_i18n_enabled() and language:
        query = query.filter_by(language=language)

    content = query.first()
    if not content:
        return jsonify({'error': 'Not found'}), 404

    is_preview = request.args.get('preview') == 'true'
    is_logged_in = is_authenticated()

    if not is_preview and not is_logged_in:
        if content.status != 'published' or (content.published_at and content.published_at > datetime.utcnow()):
            return jsonify({'error': 'Not found'}), 404
        content.increment_views()

    data = content_schema.dump(content)
    data = _decorate_content(content, data)

    return jsonify(data), 200


@bp.route('/contents', methods=['POST'])
@jwt_required()
def api_create_content():
    """Create new content"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if not user or not user.is_editor():
        return jsonify({'message': 'Insufficient permissions'}), 403

    data = request.get_json()
    if not data or not data.get('title'):
        return jsonify({'message': 'Title is required'}), 422

    content_type = data.get('content_type', 'article')
    slug = data.get('slug')
    if not slug:
        slug = re.sub(r'[^\w\-]', '-', data.get('title', '').lower())
        slug = re.sub(r'-+', '-', slug).strip('-')
        base_slug = slug
        counter = 1
        while Content.query.filter_by(slug=slug).first():
            slug = f"{base_slug}-{counter}"
            counter += 1

    language = data.get('language', get_i18n_setting('i18n_default_language', 'zh-TW'))
    original_id = data.get('original_id')
    category_id = data.get('category_id')
    tag_ids = data.get('tag_ids', [])

    if original_id:
        original_content = Content.query.get(original_id)
        if original_content:
            category_id = original_content.category_id
            tag_ids = [t.id for t in original_content.tags]

    content = Content(
        title=data.get('title'),
        content=data.get('content'),
        summary=data.get('summary'),
        slug=slug,
        status=data.get('status', 'draft'),
        content_type=content_type,
        category_id=category_id,
        author_id=user_id,
        featured_image=data.get('featured_image'),
        cover_image=data.get('cover_image'),
        meta_title=data.get('meta_title'),
        meta_description=data.get('meta_description'),
        language=language,
        original_id=original_id
    )

    if 'published_at' in data and data['published_at']:
        content.published_at = parse_tw_datetime(data['published_at'])
    elif data.get('status') == 'published':
        content.published_at = datetime.utcnow()

    try:
        db.session.add(content)
        if tag_ids:
            tags = Tag.query.filter(Tag.id.in_(tag_ids)).all()
            content.tags = tags
        db.session.commit()
        return jsonify({'message': 'Content created successfully', 'id': content.id}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': f'Database error: {str(e)}'}), 422


@bp.route('/contents/<int:content_id>', methods=['PUT'])
@jwt_required()
def api_update_content(content_id):
    """Update content"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    content = Content.query.get_or_404(content_id)

    if not user or (not user.is_editor() and content.author_id != user_id):
        return jsonify({'message': 'Insufficient permissions'}), 403

    data = request.get_json()

    content.title = data.get('title', content.title)
    content.content = data.get('content', content.content)
    content.summary = data.get('summary', content.summary)
    content.slug = data.get('slug', content.slug)
    content.status = data.get('status', content.status)
    content.content_type = data.get('content_type', content.content_type)
    content.category_id = data.get('category_id', content.category_id)
    content.featured_image = data.get('featured_image', content.featured_image)
    content.cover_image = data.get('cover_image', content.cover_image)
    content.meta_title = data.get('meta_title', content.meta_title)
    content.meta_description = data.get('meta_description', content.meta_description)

    if 'language' in data:
        content.language = data.get('language')
    if 'original_id' in data:
        content.original_id = data.get('original_id')

    if 'published_at' in data:
        content.published_at = parse_tw_datetime(data['published_at']) if data['published_at'] else None
    elif data.get('status') == 'published' and not content.published_at:
        content.published_at = datetime.utcnow()

    if 'tag_ids' in data:
        tag_ids = data.get('tag_ids', [])
        content.tags = Tag.query.filter(Tag.id.in_(tag_ids)).all()

    try:
        db.session.commit()
        return jsonify({'message': 'Content updated successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': f'Database error: {str(e)}'}), 422


@bp.route('/contents/<int:content_id>', methods=['DELETE'])
@jwt_required()
def api_delete_content(content_id):
    """Delete content"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    content = Content.query.get_or_404(content_id)

    if not user or (not user.is_editor() and content.author_id != user_id):
        return jsonify({'message': 'Insufficient permissions'}), 403

    db.session.delete(content)
    db.session.commit()
    return jsonify({'message': 'Content deleted successfully'}), 200


# ==================== Categories ====================

@bp.route('/categories', methods=['GET'])
def api_categories():
    """Get category list"""
    categories = Category.query.filter_by(is_active=True).all()
    return jsonify(categories_schema.dump(categories)), 200


@bp.route('/categories', methods=['POST'])
@jwt_required()
def api_create_category():
    """Create new category"""
    user = User.query.get(int(get_jwt_identity()))
    if not user.is_editor():
        return jsonify({'message': 'Insufficient permissions'}), 403

    data = request.get_json()
    if not data.get('code'):
        return jsonify({'message': 'Category code cannot be empty'}), 400

    if Category.query.filter_by(code=data['code']).first():
        return jsonify({'message': 'Category code already exists'}), 400

    try:
        category = Category(
            code=data['code'],
            slugs=data.get('slugs', {}),
            parent_id=data.get('parent_id'),
            sort_order=data.get('sort_order', 0),
            is_active=True
        )
        db.session.add(category)
        db.session.commit()
        return jsonify({'message': 'Category created successfully', 'category': category_schema.dump(category)}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': f'Creation failed: {str(e)}'}), 500


@bp.route('/categories/<int:category_id>', methods=['PUT'])
@jwt_required()
def api_update_category(category_id):
    """Update category"""
    user = User.query.get(int(get_jwt_identity()))
    if not user.is_editor():
        return jsonify({'message': 'Insufficient permissions'}), 403

    category = Category.query.get_or_404(category_id)
    data = request.get_json()

    if 'code' in data:
        if Category.query.filter(Category.code == data['code'], Category.id != category_id).first():
            return jsonify({'message': 'Category code already exists'}), 400
        category.code = data['code']

    category.parent_id = data.get('parent_id', category.parent_id)
    category.sort_order = data.get('sort_order', category.sort_order)
    if 'slugs' in data:
        category.slugs = data['slugs']

    try:
        db.session.commit()
        return jsonify({'message': 'Category updated successfully', 'category': category_schema.dump(category)}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': f'Update failed: {str(e)}'}), 500


@bp.route('/categories/<int:category_id>', methods=['DELETE'])
@jwt_required()
def api_delete_category(category_id):
    """Delete category"""
    user = User.query.get(int(get_jwt_identity()))
    if not user.is_editor():
        return jsonify({'message': 'Insufficient permissions'}), 403

    category = Category.query.get_or_404(category_id)
    if Content.query.filter_by(category_id=category_id).count() > 0:
        return jsonify({'message': 'Cannot delete this category, still has contents using it'}), 400

    try:
        db.session.delete(category)
        db.session.commit()
        return jsonify({'message': 'Category deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': f'Deletion failed: {str(e)}'}), 500


# ==================== Tags ====================

@bp.route('/tags', methods=['GET'])
def api_tags():
    """Get tag list"""
    tags = Tag.query.all()
    return jsonify(tags_schema.dump(tags)), 200


@bp.route('/tags', methods=['POST'])
@jwt_required()
def api_create_tag():
    """Create new tag"""
    user = User.query.get(int(get_jwt_identity()))
    if not user.is_editor():
        return jsonify({'message': 'Insufficient permissions'}), 403

    data = request.get_json()
    if not data.get('code'):
        return jsonify({'message': 'Tag code cannot be empty'}), 400

    if Tag.query.filter_by(code=data['code']).first():
        return jsonify({'message': 'Tag code already exists'}), 400

    try:
        tag = Tag(code=data['code'], slugs=data.get('slugs', {}))
        db.session.add(tag)
        db.session.commit()
        return jsonify({'message': 'Tag created successfully', 'tag': tag_schema.dump(tag)}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': f'Creation failed: {str(e)}'}), 500


@bp.route('/tags/<int:tag_id>', methods=['PUT'])
@jwt_required()
def api_update_tag(tag_id):
    """Update tag"""
    user = User.query.get(int(get_jwt_identity()))
    if not user.is_editor():
        return jsonify({'message': 'Insufficient permissions'}), 403

    tag = Tag.query.get_or_404(tag_id)
    data = request.get_json()

    if 'code' in data:
        if Tag.query.filter(Tag.code == data['code'], Tag.id != tag_id).first():
            return jsonify({'message': 'Tag code already exists'}), 400
        tag.code = data['code']

    if 'slugs' in data:
        tag.slugs = data['slugs']

    try:
        db.session.commit()
        return jsonify({'message': 'Tag updated successfully', 'tag': tag_schema.dump(tag)}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': f'Update failed: {str(e)}'}), 500


@bp.route('/tags/<int:tag_id>', methods=['DELETE'])
@jwt_required()
def api_delete_tag(tag_id):
    """Delete tag"""
    user = User.query.get(int(get_jwt_identity()))
    if not user.is_editor():
        return jsonify({'message': 'Insufficient permissions'}), 403

    tag = Tag.query.get_or_404(tag_id)
    try:
        tag.contents.clear()
        db.session.delete(tag)
        db.session.commit()
        return jsonify({'message': 'Tag deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': f'Deletion failed: {str(e)}'}), 500
