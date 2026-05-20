"""
OWS Core Engine - RBAC Seed Definitions

權威的權限 / 角色定義來源（取代手動的 init_db.sql 種子）。
seed_rbac() 為冪等 (idempotent) 操作：只新增缺少的項目、補上缺少的對應，
不會刪除既有資料，因此可安全重複執行，也不會覆蓋管理 UI 對角色的自訂。
"""

from typing import Dict, List, Tuple


# =============================================================================
# Permission definitions: (code, module, action, name_zh, name_en)
# =============================================================================

PERMISSIONS: List[Tuple[str, str, str, str, str]] = [
    # Contents
    ('contents.create',  'contents', 'create',  '建立內容', 'Create Content'),
    ('contents.read',    'contents', 'read',    '閱讀內容', 'Read Content'),
    ('contents.update',  'contents', 'update',  '更新內容', 'Update Content'),
    ('contents.delete',  'contents', 'delete',  '刪除內容', 'Delete Content'),
    ('contents.publish', 'contents', 'publish', '發布內容', 'Publish Content'),
    # Products
    ('products.create',  'products', 'create',  '建立產品', 'Create Product'),
    ('products.read',    'products', 'read',    '閱讀產品', 'Read Product'),
    ('products.update',  'products', 'update',  '更新產品', 'Update Product'),
    ('products.delete',  'products', 'delete',  '刪除產品', 'Delete Product'),
    # Users
    ('users.create',     'users',    'create',  '建立用戶', 'Create User'),
    ('users.read',       'users',    'read',    '閱讀用戶', 'Read User'),
    ('users.update',     'users',    'update',  '更新用戶', 'Update User'),
    ('users.delete',     'users',    'delete',  '刪除用戶', 'Delete User'),
    # Media
    ('media.read',       'media',    'read',    '瀏覽媒體', 'Read Media'),
    ('media.upload',     'media',    'upload',  '上傳媒體', 'Upload Media'),
    ('media.delete',     'media',    'delete',  '刪除媒體', 'Delete Media'),
    # Settings
    ('settings.read',    'settings', 'read',    '閱讀設定', 'Read Settings'),
    ('settings.update',  'settings', 'update',  '更新設定', 'Update Settings'),
    # Orders
    ('orders.read',      'orders',   'read',    '閱讀訂單', 'Read Orders'),
    ('orders.update',    'orders',   'update',  '更新訂單', 'Update Orders'),
    # Submissions
    ('submissions.read',   'submissions', 'read',   '閱讀表單提交', 'Read Submissions'),
    ('submissions.update', 'submissions', 'update', '更新表單提交', 'Update Submissions'),
    ('submissions.delete', 'submissions', 'delete', '刪除表單提交', 'Delete Submissions'),
    # Payment methods
    ('payment_methods.read',   'payment_methods', 'read',   '閱讀付款方式', 'Read Payment Methods'),
    ('payment_methods.update', 'payment_methods', 'update', '管理付款方式', 'Manage Payment Methods'),
]


# =============================================================================
# Role definitions. permissions == '*' 表示全部權限。
# =============================================================================

ROLE_DEFS: Dict[str, dict] = {
    'admin': {
        'name': {'zh-TW': '管理員', 'en': 'Administrator'},
        'description': {'zh-TW': '系統管理員，擁有所有權限', 'en': 'System administrator with full access'},
        'is_system': True,
        'permissions': '*',
    },
    'editor': {
        'name': {'zh-TW': '編輯', 'en': 'Editor'},
        'description': {'zh-TW': '內容與媒體編輯者', 'en': 'Content & media editor'},
        'is_system': True,
        'permissions': [
            'contents.create', 'contents.read', 'contents.update',
            'contents.delete', 'contents.publish',
            'media.read', 'media.upload', 'media.delete',
            'products.read',
            'submissions.read',
        ],
    },
    'user': {
        'name': {'zh-TW': '一般用戶', 'en': 'User'},
        'description': {'zh-TW': '一般用戶', 'en': 'Regular user'},
        'is_system': True,
        'permissions': [
            'contents.read',
            'products.read',
        ],
    },
}


def seed_rbac(db, sync_legacy_users: bool = True) -> dict:
    """
    冪等地建立 / 補齊 permissions、roles、role_permissions。

    Args:
        db: SQLAlchemy instance
        sync_legacy_users: 若 True，將既有使用者的 legacy `role` 字串
            (admin/editor/user) 對應到 user_roles（補上 RBAC 指派的缺口）。

    Returns:
        dict 統計各項新增 / 既有數量。
    """
    from core.backend_engine.models import (
        Permission, Role, RolePermission, UserRole, User,
    )

    stats = {'permissions_added': 0, 'roles_added': 0,
             'role_perms_added': 0, 'user_roles_added': 0}

    # --- Permissions: upsert by code ---
    perm_by_code = {p.code: p for p in Permission.query.all()}
    for code, module, action, name_zh, name_en in PERMISSIONS:
        p = perm_by_code.get(code)
        name = {'zh-TW': name_zh, 'en': name_en}
        if p is None:
            p = Permission(code=code, module=module, action=action, name=name)
            db.session.add(p)
            perm_by_code[code] = p
            stats['permissions_added'] += 1
        else:
            # keep metadata current
            p.module, p.action, p.name = module, action, name
    db.session.flush()

    all_perm_codes = [c for (c, *_rest) in PERMISSIONS]

    # --- Roles + role_permissions: upsert ---
    role_by_code = {r.code: r for r in Role.query.all()}
    for code, rdef in ROLE_DEFS.items():
        r = role_by_code.get(code)
        if r is None:
            r = Role(code=code, name=rdef['name'],
                     description=rdef['description'], is_system=rdef['is_system'])
            db.session.add(r)
            db.session.flush()
            role_by_code[code] = r
            stats['roles_added'] += 1

        wanted = all_perm_codes if rdef['permissions'] == '*' else rdef['permissions']
        existing_pids = {rp.permission_id for rp in
                         RolePermission.query.filter_by(role_id=r.id).all()}
        for code_ in wanted:
            perm = perm_by_code.get(code_)
            if perm and perm.id not in existing_pids:
                db.session.add(RolePermission(role_id=r.id, permission_id=perm.id))
                stats['role_perms_added'] += 1
    db.session.flush()

    # --- Optionally sync legacy user.role -> user_roles ---
    if sync_legacy_users:
        for user in User.query.all():
            role = role_by_code.get(user.role)
            if not role:
                continue
            exists = UserRole.query.filter_by(user_id=user.id, role_id=role.id).first()
            if not exists:
                db.session.add(UserRole(user_id=user.id, role_id=role.id))
                stats['user_roles_added'] += 1

    db.session.commit()
    return stats
