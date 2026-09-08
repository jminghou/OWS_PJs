from __future__ import with_statement

import logging
import os
from logging.config import fileConfig

from flask import current_app

from alembic import context

# =============================================================================
# 共用平台 schema 的 migration 鏈（見 docs/MIGRATIONS.md）
# =============================================================================
# 這條鏈管理**所有站台共用**的資料表：
#   - core/backend_engine/models.py 的 20 張表（內容、商品、訂單、設定、RBAC…）
#   - packages/media_lib 的 6 張媒體庫表
#
# 為什麼要獨立一條鏈：
#   在此之前 core 的表由「各站自己的 migration」建立，所以 core 模型改一個欄位
#   就要手寫兩份 migration，沒有任何機制保證兩份一致。這正是「改一次後端、
#   所有站台一起改」在資料庫層不成立的地方。
#
#   現在 core 改一次 → 這裡寫一份 migration → 所有掛載本鏈的站台都吃到同一份。
#
# 版本表：alembic_version_core，與站台自己的 alembic_version 互不干擾，
# 兩條鏈可以各自演進。
#
# schema 名稱一律從環境變數讀，**不寫死** —— 站台可以把 core 的表放在
# public（Claire 的做法）或 blog/shop（Polaris 的做法），同一份 migration 通用。
# =============================================================================

CORE_VERSION_TABLE = 'alembic_version_core'

try:
    from packages.media_lib.config import SCHEMA_NAME as _MEDIA_LIB_SCHEMA
except Exception:  # pragma: no cover - 未安裝媒體庫時不擋 migration
    _MEDIA_LIB_SCHEMA = None

_BLOG_SCHEMA = os.environ.get('OWS_BLOG_SCHEMA') or None
_SHOP_SCHEMA = os.environ.get('OWS_SHOP_SCHEMA') or None

_OWNED_SCHEMAS = {s for s in (_BLOG_SCHEMA, _SHOP_SCHEMA, _MEDIA_LIB_SCHEMA) if s}

# 版本表跟著 blog schema 走（未設定則落在 public），與站台鏈的慣例一致。
_VERSION_TABLE_SCHEMA = _BLOG_SCHEMA

# 由 SQL / 外部系統自管，不歸本鏈：
#   Polaris 第二期把 blog.users 改成指向 account.app_users 的 view、RBAC 四表淘汰、
#   member_profiles 由 init_member_profiles.sql 建立。這些表在 core models 裡有定義，
#   但實體由站台的 SQL 決定，所以 autogenerate 不能碰。
#
# 站台用環境變數 OWS_CORE_UNMANAGED_TABLES（逗號分隔）宣告自己的例外，
# 預設全部納管 —— 新站台不該繼承 Polaris 的歷史包袱。
_UNMANAGED = {
    t.strip() for t in os.environ.get('OWS_CORE_UNMANAGED_TABLES', '').split(',') if t.strip()
}


def _include_name(name, type_, parent_names):
    """只反射本鏈擁有的 schema。"""
    if type_ == 'schema':
        return (name or 'public') in (_OWNED_SCHEMAS or {'public'})
    return True


try:
    from packages.commerce.migrations_manifest import COMMERCE_TABLES as _COMMERCE_TABLES
except Exception:  # pragma: no cover
    _COMMERCE_TABLES = frozenset()


def _table_managed(schema, table_name):
    if _OWNED_SCHEMAS and schema not in _OWNED_SCHEMAS:
        return False
    # 電商表歸 packages/commerce/migrations（選用模組），core 鏈不碰 ——
    # 否則站台掛了電商時，core 的 autogenerate 會把 shop.products 當成自己漏建的表。
    if table_name in _COMMERCE_TABLES:
        return False
    return table_name not in _UNMANAGED


def _include_object(object_, name, type_, reflected, compare_to):
    if type_ == 'table':
        return _table_managed(object_.schema, object_.name)
    tbl = getattr(object_, 'table', None)
    if tbl is not None:
        return _table_managed(tbl.schema, tbl.name)
    return True


_SCHEMA_KWARGS = {
    'include_schemas': True,
    'version_table_schema': _VERSION_TABLE_SCHEMA,
    'include_name': _include_name,
    'include_object': _include_object,
} if _OWNED_SCHEMAS else {
    'include_object': _include_object,
}

# 兩條鏈共存的關鍵：版本表名稱不同。
_SCHEMA_KWARGS['version_table'] = CORE_VERSION_TABLE


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
