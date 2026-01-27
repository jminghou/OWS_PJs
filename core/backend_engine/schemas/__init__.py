"""
Core Schemas Package

Provides Marshmallow schemas for serialization/deserialization:
- BaseSchema: Base schema with SQLAlchemy integration
- UserSchema: User model serialization
- ContentSchema: Content model serialization
- CategorySchema: Category model serialization
- TagSchema: Tag model serialization
- MediaSchema: Media model serialization
- MediaFolderSchema: MediaFolder model serialization
- ProductSchema: Product model serialization
- OrderSchema: Order model serialization
- PaymentMethodSchema: PaymentMethod model serialization
"""

from core.backend_engine.schemas.base import BaseSchema
from core.backend_engine.schemas.user import UserSchema
from core.backend_engine.schemas.content import ContentSchema
from core.backend_engine.schemas.category import CategorySchema
from core.backend_engine.schemas.tag import TagSchema
from core.backend_engine.schemas.media import MediaSchema, MediaFolderSchema
from core.backend_engine.schemas.ecommerce import (
    ProductSchema,
    ProductPriceSchema,
    OrderSchema,
    PaymentMethodSchema
)

__all__ = [
    'BaseSchema',
    'UserSchema',
    'ContentSchema',
    'CategorySchema',
    'TagSchema',
    'MediaSchema',
    'MediaFolderSchema',
    'ProductSchema',
    'ProductPriceSchema',
    'OrderSchema',
    'PaymentMethodSchema',
]
