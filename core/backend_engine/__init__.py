"""
OWS Core Backend Engine

This package provides the shared core functionality for all OWS sites:
- Flask application factory with dynamic blueprint mounting
- Shared ORM models
- Storage services (LOCAL/GCS)
- RBAC (Role-Based Access Control) services
- Common utilities and helpers

Usage:
    from core.backend_engine.factory import create_app, BlueprintConfig
    from core.backend_engine.models import User, Content, Product
    from core.backend_engine.services import StorageService, RBACService
"""

from core.backend_engine.factory import (
    create_app,
    BlueprintConfig,
    db,
    migrate,
    login_manager,
    mail,
    jwt,
    cache,
    limiter,
)

__version__ = '1.0.0'

__all__ = [
    'create_app',
    'BlueprintConfig',
    'db',
    'migrate',
    'login_manager',
    'mail',
    'jwt',
    'cache',
    'limiter',
]
