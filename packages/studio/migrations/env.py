from __future__ import with_statement

import logging
import os
from logging.config import fileConfig

from flask import current_app

from alembic import context

# =============================================================================
# Studio 模組的 migration 鏈（見 docs/MIGRATIONS.md）
# =============================================================================
# 管理 packages/studio/models.py 的 studio_* 表。它們與 core 的表同住 BLOG schema，
# 所以這條鏈不能像電商那樣「整個 schema 都是我的」—— 只認 STUDIO_TABLES 裡的表名，
# 其餘一律不反射、不比對，避免 autogenerate 把 core 的表當成「要刪掉」。
#
# 版本表：alembic_version_studio，與 core / commerce / 站台鏈互不干擾。
# =============================================================================

STUDIO_VERSION_TABLE = 'alembic_version_studio'

from packages.studio.migrations_manifest import STUDIO_TABLES  # noqa: E402

_BLOG_SCHEMA = os.environ.get('OWS_BLOG_SCHEMA') or None
_OWNED_SCHEMAS = {s for s in (_BLOG_SCHEMA,) if s}

# 版本表跟著 blog schema 走（未設定則落在 public），與其他鏈的慣例一致。
_VERSION_TABLE_SCHEMA = _BLOG_SCHEMA


def _include_name(name, type_, parent_names):
    """只反射本鏈擁有的 schema，且表名限 studio_* 。"""
    if type_ == 'schema':
        return (name or 'public') in (_OWNED_SCHEMAS or {'public'})
    if type_ == 'table':
        return name in STUDIO_TABLES
    return True


def _table_managed(schema, table_name):
    if _OWNED_SCHEMAS and schema not in _OWNED_SCHEMAS:
        return False
    return table_name in STUDIO_TABLES


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
    'include_name': _include_name,
    'include_object': _include_object,
}

# 多條鏈共存的關鍵：版本表名稱不同。
_SCHEMA_KWARGS['version_table'] = STUDIO_VERSION_TABLE


config = context.config
fileConfig(config.config_file_name)
logger = logging.getLogger('alembic.env')


def get_engine():
    try:
        return current_app.extensions['migrate'].db.get_engine()
    except (TypeError, AttributeError):
        return current_app.extensions['migrate'].db.engine


def get_engine_url():
    try:
        return get_engine().url.render_as_string(hide_password=False).replace('%', '%%')
    except AttributeError:
        return str(get_engine().url).replace('%', '%%')


config.set_main_option('sqlalchemy.url', get_engine_url())
target_db = current_app.extensions['migrate'].db


def get_metadata():
    if hasattr(target_db, 'metadatas'):
        return target_db.metadatas[None]
    return target_db.metadata


def run_migrations_offline():
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url, target_metadata=get_metadata(), literal_binds=True,
        **_SCHEMA_KWARGS
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
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
        # 版本表若被指到 blog 等自訂 schema，alembic 會在跑任何 migration **之前**先建
        # 版本表 —— 那時 baseline 裡的 CREATE SCHEMA 還沒執行，全新資料庫會直接失敗。
        # 既有站台的 schema 都已存在，這裡的 IF NOT EXISTS 對它們是 no-op。
        # 先查存在與否再建：Postgres 對 CREATE SCHEMA IF NOT EXISTS 仍會檢查資料庫的 CREATE
        # 權限，正式環境的應用角色（如 Polaris 的 blog_app）沒有這個權限，schema 明明存在
        # 也會被拒絕。只有全新資料庫（schema 真的不存在）才需要建。
        if _VERSION_TABLE_SCHEMA:
            exists = connection.exec_driver_sql(
                'SELECT 1 FROM information_schema.schemata WHERE schema_name = %s',
                (_VERSION_TABLE_SCHEMA,),
            ).first()
            if not exists:
                connection.exec_driver_sql(f'CREATE SCHEMA {_VERSION_TABLE_SCHEMA}')
            # 一定要結束這裡自動開啟的交易，否則接下來 alembic 的 migration 會跑在同一個
            # 交易裡而永遠不 commit（表建了又整個回滾）。
            connection.commit()

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
