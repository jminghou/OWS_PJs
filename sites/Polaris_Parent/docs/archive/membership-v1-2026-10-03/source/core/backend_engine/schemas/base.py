"""
Base Schema

Provides the base schema class with SQLAlchemy integration.
"""

from marshmallow_sqlalchemy import SQLAlchemyAutoSchema
from marshmallow import fields

from core.backend_engine.factory import db


class BaseSchema(SQLAlchemyAutoSchema):
    """Base schema with SQLAlchemy session integration.

    Inherit from this class when you need automatic model field detection
    and database session binding for load_instance feature.

    Example:
        class MyModelSchema(BaseSchema):
            class Meta(BaseSchema.Meta):
                model = MyModel
    """
    class Meta:
        load_instance = True
        include_fk = True
        sqla_session = db.session
