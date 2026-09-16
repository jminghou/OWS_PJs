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

import os

from flask import jsonify, request
from flask_jwt_extended import jwt_required

from core.backend_engine.factory import db
from core.backend_engine.blueprints.api import bp
from core.backend_engine.models import Role, Permission, RolePermission, UserRole, User
from core.backend_engine.services.rbac import require_permission, RBACService

# 統一身分模型（§11）：Polaris 用 account.app_users.role（單一）+ permissions JSONB，
# 無自有 RBAC 四表。以下提供與前端相容的「固定角色/權限」視圖，並把使用者角色
# 的讀/寫對應到 app_users.role（經 blog.users view）。其他站（Claire）維持原 RBAC。
# P5-C 把「表放哪個 schema」(OWS_BLOG_SCHEMA) 和「用哪種身分模型」(OWS_IDENTITY_MODE) 拆開了，
# 這裡必須跟著看身分模型 —— 否則任何把表放進 blog schema 的新站台（身分明明是 local、
# 有自己的 users 與 RBAC 四表）都會被當成 Polaris 去查不存在的 account.app_users 而 500。
# Polaris 的 .env 明確設 external；Claire 兩個都沒設 → local。行為都不變。
#
# 相容規則：OWS_IDENTITY_MODE **未設** 但有 OWS_BLOG_SCHEMA → 仍視為 external。
# 正式環境的 Polaris（Railway）只設了 OWS_BLOG_SCHEMA / OWS_SHOP_SCHEMA，沒設 IDENTITY_MODE；
# 若在這裡直接改成只看 IDENTITY_MODE，下一次部署 Polaris 的後台權限就會整個壞掉。
# 新站台一律明確寫 OWS_IDENTITY_MODE=local（scripts/create_site.py 的 .env.example 已預設）。
_IDENTITY_MODE = (os.environ.get('OWS_IDENTITY_MODE') or '').strip().lower()
_EXTERNAL_IDENTITY = (
    _IDENTITY_MODE == 'external'
    or (not _IDENTITY_MODE and bool(os.environ.get('OWS_BLOG_SCHEMA')))
)
_EXTERNAL_USER_TABLE = os.environ.get('OWS_EXTERNAL_USER_TABLE') or 'account.app_users'
# 設定單一角色時的優先序（前端可能傳多個碼，統一模型取其一）
_ROLE_PRIORITY = ['admin', 'editor', 'member', 'user']


def _polaris_role_perms():
    """回傳 Polaris 固定角色 → (zh, en, 權限碼list) 對應。"""
    from core.backend_engine.services.rbac import _EDITOR_PERMS, _READER_PERMS
    from core.backend_engine.services.rbac_seed import PERMISSIONS
    all_codes = sorted({p[0] for p in PERMISSIONS})
    return {
        'admin':  ('管理員', 'Administrator', all_codes),
        'editor': ('編輯者', 'Editor', sorted(_EDITOR_PERMS)),
        'member': ('會員', 'Member', sorted(_READER_PERMS)),
        'user':   ('一般使用者', 'User', sorted(_READER_PERMS)),
    }


def _polaris_roles_payload():
    return [
        {'id': i + 1, 'code': code, 'name': {'zh-TW': zh, 'en': en},
         'description': {}, 'is_system': True, 'is_active': True, 'permissions': perms}
        for i, (code, (zh, en, perms)) in enumerate(_polaris_role_perms().items())
    ]


def _polaris_permissions_payload():
    from core.backend_engine.services.rbac_seed import PERMISSIONS
    grouped = {}
    for i, (code, module, action, zh, en) in enumerate(PERMISSIONS):
        grouped.setdefault(module, []).append(
            {'id': i + 1, 'code': code, 'action': action, 'name': {'zh-TW': zh, 'en': en}})
    return grouped


_POLARIS_ROLE_UNSUPPORTED = (
    {'message': '統一身分模型不支援自訂角色：角色為 account.app_users.role 的固定值'
                '（admin/editor/member/user）。請於使用者編輯指派角色。'}, 400)


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
    if _EXTERNAL_IDENTITY:
        return jsonify({'modules': _polaris_permissions_payload()}), 200
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
    if _EXTERNAL_IDENTITY:
        return jsonify({'roles': _polaris_roles_payload()}), 200
    roles = Role.query.order_by(Role.id).all()
    return jsonify({'roles': [_role_to_dict(r) for r in roles]}), 200


@bp.route('/admin/rbac/roles', methods=['POST'])
@jwt_required()
@require_permission('users.update')
def rbac_create_role():
    """Create a new (custom) role."""
    if _EXTERNAL_IDENTITY:
        return jsonify(_POLARIS_ROLE_UNSUPPORTED[0]), _POLARIS_ROLE_UNSUPPORTED[1]
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
    if _EXTERNAL_IDENTITY:
        return jsonify(_POLARIS_ROLE_UNSUPPORTED[0]), _POLARIS_ROLE_UNSUPPORTED[1]
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
    if _EXTERNAL_IDENTITY:
        return jsonify(_POLARIS_ROLE_UNSUPPORTED[0]), _POLARIS_ROLE_UNSUPPORTED[1]
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
    if _EXTERNAL_IDENTITY:
        u = User.query.get_or_404(user_id)
        return jsonify({'roles': [u.role] if u.role else []}), 200
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

    if _EXTERNAL_IDENTITY:
        # 統一模型：單一 app_users.role（依優先序取一），經 view trigger 寫入
        chosen = next((r for r in _ROLE_PRIORITY if r in codes), None) or 'user'
        user.role = chosen
        db.session.commit()
        RBACService.clear_cache(user.id)
        return jsonify({'message': 'User role updated', 'roles': [chosen]}), 200

    UserRole.query.filter_by(user_id=user.id).delete()
    if codes:
        roles = Role.query.filter(Role.code.in_(codes), Role.is_active == True).all()
        for r in roles:
            db.session.add(UserRole(user_id=user.id, role_id=r.id))

    db.session.commit()
    RBACService.clear_cache(user.id)
    return jsonify({'message': 'User roles updated', 'roles': sorted(codes)}), 200
