"""
Category Schema

Provides serialization for Category model.
"""

from marshmallow import Schema, fields


class CategorySchema(Schema):
    """Schema for Category model serialization.

    Fields:
        id: Category ID (read-only)
        name: Category name (required)
        code: Category code (unique identifier)
        description: Category description
        parent_id: Parent category ID
        slugs: Multi-language slugs (JSON)
        sort_order: Display order
        is_active: Active status
        created_at: Creation timestamp (read-only)
        children: Nested child categories
        attributes: Custom attributes (JSONB)
    """
    id = fields.Int(dump_only=True)
    name = fields.Str(required=True)
    code = fields.Str()
    description = fields.Str()
    parent_id = fields.Int()
    slugs = fields.Dict()  # JSON field for multi-language slugs
    sort_order = fields.Int()
    is_active = fields.Bool()
    created_at = fields.DateTime(dump_only=True)
    attributes = fields.Dict()  # JSONB field

    # Nested child categories
    children = fields.List(fields.Nested("CategorySchema", only=("id", "name", "code", "slugs")))
