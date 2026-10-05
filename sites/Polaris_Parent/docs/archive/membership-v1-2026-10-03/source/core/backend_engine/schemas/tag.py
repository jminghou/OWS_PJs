"""
Tag Schema

Provides serialization for Tag model.
"""

from marshmallow import Schema, fields


class TagSchema(Schema):
    """Schema for Tag model serialization.

    Fields:
        id: Tag ID (read-only)
        name: Tag name (required)
        code: Tag code (unique identifier)
        slugs: Multi-language slugs (JSON)
        created_at: Creation timestamp (read-only)
        attributes: Custom attributes (JSONB)
    """
    id = fields.Int(dump_only=True)
    name = fields.Str(required=True)
    code = fields.Str()
    slugs = fields.Dict()  # JSON field for multi-language slugs
    created_at = fields.DateTime(dump_only=True)
    attributes = fields.Dict()  # JSONB field
