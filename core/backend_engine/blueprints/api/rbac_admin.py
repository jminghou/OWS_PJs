"""
RBAC Admin API Routes

角色 / 權限 / 使用者角色指派的管理端點。皆需 users.update 權限
（目前僅 admin 角色具備，等同管理員專用）。

- GET    /admin/rbac/permissions          列出全部權限（依 module 分組）
- GET    /admin/rbac/roles                 列出角色（含各自的權限碼）
- POST   /admin/rbac/roles                 建立角色
- PUT    /admin/rbac/roles/<id>            更新角色（名稱 / 描述 / 權限）
- DELETE /admin/rbac/roles/<id>            刪除角色（系統角色不可刪）
- GET    /admin/users/<id>/roles           取得使用者的角色碼
- PUT    /admin/users/<id>/roles           設定使用者的角色（覆寫）
"""

from flask import jsonify, request
from flask_jwt_extended import jwt_required

from core.backend_engine.factory import db
from core.backend_engine.blueprints.api import bp
from core.backend_engine.models import Role, Permission, RolePermission, UserRole, User
from core.backend_engine.services.rbac import require_permission, RBACService


def _role_to_dict(role):
    perm_codes = [
        Permission.query.get(rp.permission_id).code
        for rp in RolePermission.query.filter_by(role_id=role.id).all()
        if Permission.query.get(rp.permission_id)
    ]
    return {
        'id': role.id,
        'code': role.code,
        'name': role.name,
        'description': role.description,
        'is_system': role.is_system,
        'is_active': role.is_active,
        'permissions': sorted(perm_codes),
    }


# ==================== Permissions ====================

@bp.route('/admin/rbac/permissions', methods=['GET'])
@jwt_required()
@require_permission('users.update')
def rbac_list_permissions():
    """List all permissions grouped by module."""
    perms = Permission.query.order_by(Permission.module, Permission.action).all()
    grouped = {}
    for p in perms:
        grouped.setdefault(p.module, []).append({
            'id': p.id, 'code': p.code, 'action': p.action, 'name': p.name,
        })
    return jsonify({'modules': grouped}), 200


# ==================== Roles ====================

@bp.route('/admin/rbac/roles', methods=['GET'])
@jwt_required()
@require_permission('users.update')
def rbac_list_roles():
    """List all roles with their permission codes."""
    roles = Role.query.order_by(Role.id).all()
    return jsonify({'roles': [_role_to_dict(r) for r in roles]}), 200


@bp.route('/admin/rbac/roles', methods=['POST'])
@jwt_required()
@require_permission('users.update')
def rbac_create_role():
    """Create a new (custom) role."""
    data = request.get_json() or {}
    code = (data.get('code') or '').strip()
    if not code:
        return jsonify({'message': 'Role code is required'}), 400
    if Role.query.filter_by(code=code).first():
        return jsonify({'message': f"Role '{code}' already exists"}), 400

    role = Role(
        code=code,
        name=data.get('name') or {'zh-TW': code, 'en': code},
        description=data.get('description') or {},
        is_system=False,
        is_active=data.get('is_active', True),
    )
    db.session.add(role)
    db.session.flush()
    _set_role_permissions(role, data.get('permissions', []))
    db.session.commit()
    return jsonify({'message': 'Role created', 'role': _role_to_dict(role)}), 201


@bp.route('/admin/rbac/roles/<int:role_id>', methods=['PUT'])
@jwt_required()
@require_permission('users.update')
def rbac_update_role(role_id):
    """Update a role's name/description/active/permissions."""
    role = Role.query.get_or_404(role_id)
    data = request.get_json() or {}

    if 'name' in data:
        role.name = data['name']
    if 'description' in data:
        role.description = data['description']
    if 'is_active' in data:
        role.is_active = data['is_active']
    if 'permissions' in data:
        _set_role_permissions(role, data['permissions'])

    db.session.commit()
    RBACService.clear_cache()  # role permissions changed → invalidate all
    return jsonify({'message': 'Role updated', 'role': _role_to_dict(role)}), 200


@bp.route('/admin/rbac/roles/<int:role_id>', methods=['DELETE'])
@jwt_required()
@require_permission('users.update')
def rbac_delete_role(role_id):
    """Delete a custom role (system roles cannot be deleted)."""
    role = Role.query.get_or_404(role_id)
    if role.is_system:
        return jsonify({'message': 'System roles cannot be deleted'}), 400

    UserRole.query.filter_by(role_id=role.id).delete()
    RolePermission.query.filter_by(role_id=role.id).delete()
    db.session.delete(role)
    db.session.commit()
    RBACService.clear_cache()
    return jsonify({'message': 'Role deleted'}), 200


def _set_role_permissions(role, permission_codes):
    """Replace a role's permissions with the given permission code list."""
    RolePermission.query.filter_by(role_id=role.id).delete()
    codes = set(permission_codes or [])
    if codes:
        perms = Permission.query.filter(Permission.code.in_(codes)).all()
        for p in perms:
            db.session.add(RolePermission(role_id=role.id, permission_id=p.id))


# ==================== User-Role assignment ====================

@bp.route('/admin/users/<int:user_id>/roles', methods=['GET'])
@jwt_required()
@require_permission('users.update')
def rbac_get_user_roles(user_id):
    """Get the role codes assigned to a user."""
    User.query.get_or_404(user_id)
    role_ids = [ur.role_id for ur in UserRole.query.filter_by(user_id=user_id).all()]
    codes = [r.code for r in Role.query.filter(Role.id.in_(role_ids)).all()] if role_ids else []
    return jsonify({'roles': codes}), 200


@bp.route('/admin/users/<int:user_id>/roles', methods=['PUT'])
@jwt_required()
@require_permission('users.update')
def rbac_set_user_roles(user_id):
    """Overwrite a user's role assignments with the given role code list."""
    user = User.query.get_or_404(user_id)
    data = request.get_json() or {}
    codes = set(data.get('roles', []))

    UserRole.query.filter_by(user_id=user.id).delete()
    if codes:
        roles = Role.query.filter(Role.code.in_(codes), Role.is_active == True).all()
        for r in roles:
            db.session.add(UserRole(user_id=user.id, role_id=r.id))

    db.session.commit()
    RBACService.clear_cache(user.id)
    return jsonify({'message': 'User roles updated', 'roles': sorted(codes)}), 200
