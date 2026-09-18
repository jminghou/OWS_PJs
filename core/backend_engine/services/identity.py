"""Resolve the configured identity model without importing a particular site."""
from core.backend_engine.factory import db
from core.backend_engine.models import User, USER_FK_TARGET


def identity_model():
    table_name = USER_FK_TARGET.rsplit('.', 1)[0]
    if table_name == User.__table__.fullname:
        return User
    for mapper in db.Model.registry.mappers:
        if mapper.local_table.fullname == table_name:
            return mapper.class_
    raise RuntimeError('The configured identity model has not been registered')
