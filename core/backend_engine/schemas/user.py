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
    created_at = fields.DateTime(dump_only=True)
    updated_at = fields.DateTime(dump_only=True)
    last_login = fields.DateTime(dump_only=True)
    attributes = fields.Dict()  # JSONB field

    def get_permissions(self, user):
        """Compute the user's effective permission codes (sorted)."""
        try:
            from core.backend_engine.services.rbac import RBACService
            return sorted(RBACService.get_user_permissions(user.id))
        except Exception:
            return []
