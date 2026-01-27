"""
Content Schema

Provides serialization for Content model.
"""

from marshmallow import Schema, fields


class ContentSchema(Schema):
    """Schema for Content model serialization.

    Fields:
        id: Content ID (read-only)
        title: Content title (required)
        content: Main content body
        summary: Content summary
        slug: URL slug
        status: Publication status (draft/published/archived)
        content_type: Type of content (article/page/etc)
        category_id: Associated category ID
        author_id: Author user ID
        featured_image: Featured image URL
        cover_image: Cover image URL
        meta_title: SEO meta title
        meta_description: SEO meta description
        views_count: View count
        likes_count: Like count
        published_at: Publication timestamp
        created_at: Creation timestamp (read-only)
        updated_at: Last update timestamp (read-only)
        language: Content language code
        original_id: Original content ID for translations
        attributes: Custom attributes (JSONB)
        meta_data: Additional metadata (JSONB)

    Nested:
        author: Author user info
        category: Category info
        tags: Associated tags
        translations: Translation versions
    """
    id = fields.Int(dump_only=True)
    title = fields.Str(required=True)
    content = fields.Str()
    summary = fields.Str()
    slug = fields.Str()
    status = fields.Str()
    content_type = fields.Str()
    category_id = fields.Int()
    author_id = fields.Int()
    featured_image = fields.Str()
    cover_image = fields.Str()
    meta_title = fields.Str()
    meta_description = fields.Str()
    views_count = fields.Int()
    likes_count = fields.Int()
    published_at = fields.DateTime()
    created_at = fields.DateTime(dump_only=True)
    updated_at = fields.DateTime(dump_only=True)
    language = fields.Str()
    original_id = fields.Int()
    attributes = fields.Dict()  # JSONB field
    meta_data = fields.Dict()  # JSONB field

    # Nested relationships
    author = fields.Nested("UserSchema", only=("id", "username"))
    category = fields.Nested("CategorySchema", only=("id", "code", "slugs"))
    tags = fields.Nested("TagSchema", many=True, only=("id", "code", "slugs"))

    # Translation relationship (manually defined to avoid recursion)
    translations = fields.List(fields.Nested("ContentSchema", only=("id", "title", "slug", "language")))
