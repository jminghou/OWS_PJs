"""
Core Schemas Package

Provides Marshmallow schemas for serialization/deserialization:
- BaseSchema: Base schema with SQLAlchemy integration
- UserSchema: User model serialization
- ContentSchema: Content model serialization
- CategorySchema: Category model serialization
- TagSchema: Tag model serialization
"""

from core.backend_engine.schemas.base import BaseSchema
from core.backend_engine.schemas.user import UserSchema
from core.backend_engine.schemas.content import ContentSchema
from core.backend_engine.schemas.category import CategorySchema
from core.backend_engine.schemas.tag import TagSchema

__all__ = [
    'BaseSchema',
    'UserSchema',
    'ContentSchema',
    'CategorySchema',
    'TagSchema',
]
