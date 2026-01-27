"""
OWS Core Engine - RBAC Service

Provides role-based access control functionality.

Usage:
    from core.backend_engine.services.rbac import require_permission, RBACService

    # As decorator
    @bp.route('/admin/contents', methods=['POST'])
    @jwt_required()
    @require_permission('contents.create')
    def create_content():
        ...

    # Programmatic check
    if RBACService.has_permission(user_id, 'contents.delete'):
        # Do something
"""

from functools import wraps
from typing import List, Optional, Set

from flask import jsonify
from flask_jwt_extended import get_jwt_identity

from core.backend_engine.factory import db


# =============================================================================
# RBAC Service
# =============================================================================

class RBACService:
    """Role-Based Access Control service."""

    # Cache for user permissions (cleared on user role change)
    _permissions_cache: dict = {}

    @classmethod
    def get_user_permissions(cls, user_id: int, use_cache: bool = True) -> Set[str]:
        """
        Get all permission codes for a user.

        This aggregates permissions from:
        1. Legacy role field (backward compatibility)
        2. RBAC tables (roles, permissions, role_permissions, user_roles)

        Args:
            user_id: The user's ID
            use_cache: Whether to use cached permissions

        Returns:
            Set of permission codes
        """
        from core.backend_engine.models import User, Permission

        # Check cache first
        cache_key = f"user_perms_{user_id}"
        if use_cache and cache_key in cls._permissions_cache:
            return cls._permissions_cache[cache_key]

        user = User.query.get(user_id)
        if not user:
            return set()

        permissions = set()

        # =====================================================================
        # Legacy role field support (backward compatibility)
        # =====================================================================
        if user.role == 'admin':
            # Admin has all permissions
            all_perms = Permission.query.all()
            permissions = {p.code for p in all_perms}
            cls._permissions_cache[cache_key] = permissions
            return permissions

        elif user.role == 'editor':
            # Editor permissions from legacy system
            permissions.update([
                'contents.create', 'contents.read', 'contents.update', 'contents.publish',
                'media.upload', 'media.delete',
                'products.read',
            ])

        elif user.role == 'user':
            # Basic user permissions
            permissions.update([
                'contents.read',
                'products.read',
            ])

        # =====================================================================
        # RBAC tables permissions (if user has roles assigned)
        # =====================================================================
        if hasattr(user, 'user_roles') and user.user_roles:
            for user_role in user.user_roles:
                # Check if role is active and not expired
                role = user_role.role
                if not role or not role.is_active:
                    continue

                # Check expiration
                if user_role.expires_at:
                    from datetime import datetime
                    if user_role.expires_at < datetime.utcnow():
                        continue

                # Get permissions from role_permissions
                if hasattr(role, 'role_permissions'):
                    for rp in role.role_permissions:
                        if hasattr(rp, 'permission') and rp.permission:
                            permissions.add(rp.permission.code)

        # Cache the result
        cls._permissions_cache[cache_key] = permissions
        return permissions

    @classmethod
    def has_permission(cls, user_id: int, permission_code: str) -> bool:
        """
        Check if a user has a specific permission.

        Args:
            user_id: The user's ID
            permission_code: The permission code to check (e.g., 'contents.create')

        Returns:
            True if user has the permission
        """
        permissions = cls.get_user_permissions(user_id)
        return permission_code in permissions

    @classmethod
    def has_any_permission(cls, user_id: int, permission_codes: List[str]) -> bool:
        """
        Check if a user has any of the specified permissions.

        Args:
            user_id: The user's ID
            permission_codes: List of permission codes to check

        Returns:
            True if user has at least one of the permissions
        """
        permissions = cls.get_user_permissions(user_id)
        return bool(permissions.intersection(permission_codes))

    @classmethod
    def has_all_permissions(cls, user_id: int, permission_codes: List[str]) -> bool:
        """
        Check if a user has all of the specified permissions.

        Args:
            user_id: The user's ID
            permission_codes: List of permission codes to check

        Returns:
            True if user has all of the permissions
        """
        permissions = cls.get_user_permissions(user_id)
        return all(code in permissions for code in permission_codes)

    @classmethod
    def clear_cache(cls, user_id: Optional[int] = None):
        """
        Clear the permissions cache.

        Args:
            user_id: If provided, only clear cache for this user.
                     If None, clear all cache.
        """
        if user_id is not None:
            cache_key = f"user_perms_{user_id}"
            cls._permissions_cache.pop(cache_key, None)
        else:
            cls._permissions_cache.clear()

    @classmethod
    def assign_role(cls, user_id: int, role_code: str, assigned_by: Optional[int] = None):
        """
        Assign a role to a user.

        Args:
            user_id: The user's ID
            role_code: The role code to assign
            assigned_by: ID of the user making the assignment
        """
        from core.backend_engine.models import UserRole, Role

        role = Role.query.filter_by(code=role_code, is_active=True).first()
        if not role:
            raise ValueError(f"Role '{role_code}' not found or inactive")

        # Check if already assigned
        existing = UserRole.query.filter_by(user_id=user_id, role_id=role.id).first()
        if existing:
            return  # Already assigned

        user_role = UserRole(
            user_id=user_id,
            role_id=role.id,
            assigned_by=assigned_by
        )
        db.session.add(user_role)
        db.session.commit()

        # Clear cache
        cls.clear_cache(user_id)

    @classmethod
    def revoke_role(cls, user_id: int, role_code: str):
        """
        Revoke a role from a user.

        Args:
            user_id: The user's ID
            role_code: The role code to revoke
        """
        from core.backend_engine.models import UserRole, Role

        role = Role.query.filter_by(code=role_code).first()
        if not role:
            return

        UserRole.query.filter_by(user_id=user_id, role_id=role.id).delete()
        db.session.commit()

        # Clear cache
        cls.clear_cache(user_id)


# =============================================================================
# Permission Decorator
# =============================================================================

def require_permission(*permission_codes: str, require_all: bool = False):
    """
    Decorator to require specific permissions.

    Must be used after @jwt_required() decorator.

    Args:
        *permission_codes: One or more permission codes required
        require_all: If True, all permissions are required.
                     If False (default), any one permission is sufficient.

    Usage:
        @bp.route('/admin/contents', methods=['POST'])
        @jwt_required()
        @require_permission('contents.create')
        def create_content():
            ...

        @bp.route('/admin/dangerous', methods=['DELETE'])
        @jwt_required()
        @require_permission('contents.delete', 'users.delete', require_all=True)
        def dangerous_operation():
            ...
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # Get current user from JWT
            user_id = get_jwt_identity()
            if not user_id:
                return jsonify({'message': 'Authentication required'}), 401

            try:
                user_id = int(user_id)
            except (TypeError, ValueError):
                return jsonify({'message': 'Invalid user identity'}), 401

            # Check permissions
            if require_all:
                has_access = RBACService.has_all_permissions(user_id, list(permission_codes))
            else:
                has_access = RBACService.has_any_permission(user_id, list(permission_codes))

            if not has_access:
                return jsonify({
                    'message': 'Permission denied',
                    'required_permissions': list(permission_codes)
                }), 403

            return f(*args, **kwargs)
        return decorated_function
    return decorator


def require_role(*role_codes: str):
    """
    Decorator to require specific roles (legacy support).

    Must be used after @jwt_required() decorator.

    Args:
        *role_codes: One or more role codes required (e.g., 'admin', 'editor')

    Usage:
        @bp.route('/admin/users', methods=['GET'])
        @jwt_required()
        @require_role('admin')
        def list_users():
            ...
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            from core.backend_engine.models import User

            user_id = get_jwt_identity()
            if not user_id:
                return jsonify({'message': 'Authentication required'}), 401

            try:
                user_id = int(user_id)
            except (TypeError, ValueError):
                return jsonify({'message': 'Invalid user identity'}), 401

            user = User.query.get(user_id)
            if not user:
                return jsonify({'message': 'User not found'}), 401

            if user.role not in role_codes:
                return jsonify({
                    'message': 'Permission denied',
                    'required_roles': list(role_codes)
                }), 403

            return f(*args, **kwargs)
        return decorated_function
    return decorator


# =============================================================================
# Exports
# =============================================================================

__all__ = [
    'RBACService',
    'require_permission',
    'require_role',
]
