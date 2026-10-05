"""
User Schema

Provides serialization for User model.
"""

from marshmallow import Schema, fields


class UserSchema(Schema):
    """Schema for User model serialization.

    Fields:
        id: User ID (read-only)
        username: Username (required)
        email: Email address
        role: User role (admin/editor/user) — legacy field
        permissions: Effective permission codes (computed via RBAC, read-only)
        is_active: Account active status
        created_at: Creation timestamp (read-only)
        updated_at: Last update timestamp (read-only)
        last_login: Last login timestamp (read-only)
        attributes: Custom user attributes (JSONB)
    """
    id = fields.Int(dump_only=True)
    username = fields.Str(required=True)
    email = fields.Str()
    role = fields.Str()
    permissions = fields.Method('get_permissions', dump_only=True)
    is_active = fields.Bool()
    avatar = fields.Str(allow_none=True)
    created_at = fields.DateTime(dump_only=True)
    updated_at = fields.DateTime(dump_only=True)
    last_login = fields.DateTime(dump_only=True)
    attributes = fields.Dict()  # JSONB field (holds author profile: display_name/title/bio/...)

    def get_permissions(self, user):
        """Compute the user's effective permission codes (sorted)."""
        try:
            from core.backend_engine.services.rbac import RBACService
            return sorted(RBACService.get_user_permissions(user.id))
        except Exception:
            return []


class PublicAuthorSchema(Schema):
    """Public author profile (E-E-A-T). Curated, public-safe subset derived from
    User.attributes — never exposes email/role/permissions. Used as the nested
    `author` on Content and by the public /authors endpoints."""

    def get_attribute(self, obj, key, default):
        # Pull every field from the model's curated public profile dict.
        # Stateless (no instance cache) — the schema singleton is shared across requests.
        if hasattr(obj, 'public_author_profile'):
            return obj.public_author_profile().get(key, default)
        if isinstance(obj, dict):
            return obj.get(key, default)
        return default

    id = fields.Int(dump_only=True)
    username = fields.Str()
    slug = fields.Str()
    name = fields.Str()
    avatar = fields.Str(allow_none=True)
    title = fields.Str(allow_none=True)
    bio = fields.Str(allow_none=True)
    expertise = fields.List(fields.Str())
    social_links = fields.Dict()
    credentials = fields.Str(allow_none=True)
