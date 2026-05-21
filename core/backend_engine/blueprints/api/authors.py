"""
Authors API Routes (public)

Public author pages for E-E-A-T (lets AI/search attribute content to a credible
person with a bio, expertise and verified social profiles):

- GET /authors               - List authors that have published content (for sitemap/index)
- GET /authors/<identifier>  - Public author profile + their published contents

Author profile data lives in User.attributes (no migration); only the curated,
public-safe subset (PublicAuthorSchema) is ever exposed — never email/role.
Only users who have at least one published content are exposed, so this cannot
be used to enumerate accounts.
"""

from datetime import datetime

from flask import jsonify, request
from sqlalchemy.orm import joinedload

from core.backend_engine.blueprints.api import bp
from core.backend_engine.blueprints.api.utils import is_i18n_enabled, get_localized_slug
from core.backend_engine.models import User, Content
from core.backend_engine.schemas.user import PublicAuthorSchema

public_author_schema = PublicAuthorSchema()
public_authors_schema = PublicAuthorSchema(many=True)


def _published(query):
    """Restrict a Content query to publicly-visible (published, date passed) rows."""
    return query.filter(Content.status == 'published').filter(
        (Content.published_at.is_(None)) | (Content.published_at <= datetime.utcnow())
    )


def _content_card(content):
    """Lightweight content projection for author-page article lists."""
    return {
        'id': content.id,
        'title': content.title,
        'slug': content.slug,
        'summary': content.summary,
        'featured_image': content.featured_image,
        'cover_image': content.cover_image,
        'published_at': content.published_at.isoformat() if content.published_at else None,
        'language': content.language,
        'category': (
            {
                'name': get_localized_slug(content.category, content.language),
                'slug': get_localized_slug(content.category, content.language),
            }
            if content.category else None
        ),
    }


@bp.route('/authors', methods=['GET'])
def api_authors():
    """List authors that have at least one published content."""
    rows = _published(Content.query).with_entities(Content.author_id).distinct().all()
    author_ids = [r[0] for r in rows if r[0] is not None]
    if not author_ids:
        return jsonify({'authors': []}), 200
    users = User.query.filter(User.id.in_(author_ids), User.is_active.is_(True)).all()
    return jsonify({'authors': public_authors_schema.dump(users)}), 200


@bp.route('/authors/<identifier>', methods=['GET'])
def api_author_detail(identifier):
    """Public author profile + published contents. Identifier = username."""
    user = User.query.filter_by(username=identifier).first()
    if not user or not user.is_active:
        return jsonify({'error': 'Not found'}), 404

    language = request.args.get('language')
    query = Content.query.options(joinedload(Content.category)).filter_by(author_id=user.id)
    query = _published(query)
    if language and is_i18n_enabled():
        query = query.filter_by(language=language)
    contents = query.order_by(Content.published_at.desc()).limit(60).all()

    # Only expose authors who actually have published content (privacy + relevance).
    if not contents:
        return jsonify({'error': 'Not found'}), 404

    return jsonify({
        'author': public_author_schema.dump(user),
        'contents': [_content_card(c) for c in contents],
    }), 200
