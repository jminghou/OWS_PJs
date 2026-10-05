"""
OWS Core Engine - Services Package

This package provides shared services for all sites:
- StorageService: File storage abstraction (LOCAL/GCS)
- RBACService: Role-based access control
- member_auth: 會員身分機制（註冊 hook、設定密碼 token / 信件）
"""

from core.backend_engine.services.storage import (
    StorageService,
    StorageBackend,
    LocalStorageBackend,
    GCSStorageBackend,
    upload_file,
    delete_file,
)

from core.backend_engine.services.rbac import (
    RBACService,
    require_permission,
)

from core.backend_engine.services.member_auth import (
    SignupHookResult,
    on_member_signup,
    run_signup_hooks,
    send_set_password_email,
    make_set_password_token,
    read_set_password_token,
    is_valid_email,
    normalise_email,
)

__all__ = [
    'SignupHookResult',
    'on_member_signup',
    'run_signup_hooks',
    'send_set_password_email',
    'make_set_password_token',
    'read_set_password_token',
    'is_valid_email',
    'normalise_email',
    'StorageService',
    'StorageBackend',
    'LocalStorageBackend',
    'GCSStorageBackend',
    'upload_file',
    'delete_file',
    'RBACService',
    'require_permission',
]
