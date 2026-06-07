import logging
import os
from logging.config import fileConfig

from flask import current_app

from alembic import context

# =============================================================================
# 統一資料庫架構（見 ARCHITECTURE_UNIFIED_DB.md）
# 本站的表只在 blog/shop schema；版本表放 blog schema，與紫微系統的
# public.alembic_version 互不干擾。include_name 嚴格限定 autogenerate 只比對
# blog/shop，避免把 account/graph/public 既有表誤判為「待刪除」。
# =============================================================================
_OWNED_SCHEMAS = {s for s in (
    os.environ.get('OWS_BLOG_SCHEMA'),
    os.environ.get('OWS_SHOP_SCHEMA'),
) if s}
_VERSION_TABLE_SCHEMA = os.environ.get('OWS_BLOG_SCHEMA') or None


def _include_name(name, type_, parent_names):
    """只讓 autogenerate 反射本站擁有的 schema（blog/shop）。"""
    if type_ == 'schema':
        return name in _OWNED_SCHEMAS
    return True


# 第二期：blog.users 改為 view、RBAC 四表淘汰、member_profiles 由 SQL 自管，
# 這些不歸 Alembic 管理 → 從 autogenerate 排除（避免誤建/誤刪）。
_BLOG_SCHEMA_NAME = os.environ.get('OWS_BLOG_SCHEMA')
_BLOG_UNMANAGED_TABLES = {
    'users', 'roles', 'permissions', 'role_permissions', 'user_roles', 'member_profiles',
}


def _table_managed(schema, table_name):
    if schema not in _OWNED_SCHEMAS:
        return False
    if schema == _BLOG_SCHEMA_NAME and table_name in _BLOG_UNMANAGED_TABLES:
        return False
    return True


def _include_object(object_, name, type_, reflected, compare_to):
    """只比對 blog/shop 中由 Alembic 管理的物件；media_lib / account / graph / public、
    以及 blog 的 view/RBAC/member_profiles 一律略過，確保不誤建或誤刪其他子系統的表。"""
    if type_ == 'table':
        return _table_managed(object_.schema, object_.name)
    tbl = getattr(object_, 'table', None)
    if tbl is not None:
        return _table_managed(tbl.schema, tbl.name)
    return True


# 本站擁有的 schema 設定（None 代表未設環境變數，退回單一 public 行為）
_SCHEMA_KWARGS = {
    'include_schemas': True,
    'version_table_schema': _VERSION_TABLE_SCHEMA,
    'include_name': _include_name,
    'include_object': _include_object,
} if _OWNED_SCHEMAS else {}

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
fileConfig(config.config_file_name)
logger = logging.getLogger('alembic.env')


def get_engine():
    try:
        # this works with Flask-SQLAlchemy<3 and Alchemical
        return current_app.extensions['migrate'].db.get_engine()
    except (TypeError, AttributeError):
        # this works with Flask-SQLAlchemy>=3
        return current_app.extensions['migrate'].db.engine


def get_engine_url():
    try:
        return get_engine().url.render_as_string(hide_password=False).replace(
            '%', '%%')
    except AttributeError:
        return str(get_engine().url).replace('%', '%%')


# add your model's MetaData object here
# for 'autogenerate' support
# from myapp import mymodel
# target_metadata = mymodel.Base.metadata
config.set_main_option('sqlalchemy.url', get_engine_url())
target_db = current_app.extensions['migrate'].db

# other values from the config, defined by the needs of env.py,
# can be acquired:
# my_important_option = config.get_main_option("my_important_option")
# ... etc.


def get_metadata():
    if hasattr(target_db, 'metadatas'):
        return target_db.metadatas[None]
    return target_db.metadata


def run_migrations_offline():
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url, target_metadata=get_metadata(), literal_binds=True,
        **_SCHEMA_KWARGS
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.

    """

    # this callback is used to prevent an auto-migration from being generated
    # when there are no changes to the schema
    # reference: http://alembic.zzzcomputing.com/en/latest/cookbook.html
    def process_revision_directives(context, revision, directives):
        if getattr(config.cmd_opts, 'autogenerate', False):
            script = directives[0]
            if script.upgrade_ops.is_empty():
                directives[:] = []
                logger.info('No changes in schema detected.')

    conf_args = current_app.extensions['migrate'].configure_args
    if conf_args.get("process_revision_directives") is None:
        conf_args["process_revision_directives"] = process_revision_directives

    connectable = get_engine()

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=get_metadata(),
            **_SCHEMA_KWARGS,
            **conf_args
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
