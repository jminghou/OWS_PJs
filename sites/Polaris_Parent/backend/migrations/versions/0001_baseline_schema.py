"""Baseline schema — create all tables (core + media_lib)

Revision ID: 0001_baseline_schema
Revises:
Create Date: 2026-05-20

此為全新的 baseline migration，取代先前「假的」initial migration
（舊的 b9a6821ec682 只 alter index、假設表已由 db.create_all() 建立）。

本 migration 是建表的唯一來源：
- public schema 的 core 資料表（users / contents / products / orders ...）
- media_lib schema 的媒體庫資料表（files / folders / variants ...）

實作上以 db.metadata.create_all() 建立目前 model 定義的全部資料表，
因 media_lib 採跨 schema 設計，這比 autogenerate 的靜態 DDL 更不易出錯，
且與先前 db.create_all() 建出的 schema 完全一致。

往後的 schema 變更請以新的增量 migration 處理，啟動時不再自動 create_all。
"""
from alembic import op


revision = '0001_baseline_schema'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    from core.backend_engine.factory import db

    bind = op.get_bind()
    # media_lib 資料表位於獨立 schema，需先建立 schema
    op.execute('CREATE SCHEMA IF NOT EXISTS media_lib')
    # 依 model metadata 建立全部資料表（SQLAlchemy 自動處理 FK 依賴順序）
    db.metadata.create_all(bind=bind)


def downgrade():
    from core.backend_engine.factory import db

    bind = op.get_bind()
    db.metadata.drop_all(bind=bind)
    op.execute('DROP SCHEMA IF EXISTS media_lib CASCADE')
