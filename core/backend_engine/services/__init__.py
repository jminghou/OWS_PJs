"""
OWS Core Engine - Services Package

This package provides shared services for all sites:
- StorageService: File storage abstraction (LOCAL/GCS)
- RBACService: Role-based access control
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

__all__ = [
    'StorageService',
    'StorageBackend',
    'LocalStorageBackend',
    'GCSStorageBackend',
    'upload_file',
    'delete_file',
    'RBACService',
    'require_permission',
]
