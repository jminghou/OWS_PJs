"""
Studio 模組的資料模型。

所有表 `studio_` 前綴、落在 BLOG schema（見 packages/studio/__init__.py 的說明）。
外鍵：
  - studio_documents.content_id → core contents（部落格文件 1:1 綁定既有文章）
  - studio_inbox_items.file_id / studio_sources.file_id → media_lib.files
  - *.created_by / owner_id → USER_FK_TARGET（依站台身分模式）
模組依賴 core 與 media_lib，反向不成立：core 完全不知道 Studio 的存在。
"""
from datetime import datetime
from uuid import uuid4
from typing import Any, Dict, Optional

from sqlalchemy.dialects.postgresql import JSONB

from core.backend_engine.factory import db
from core.backend_engine.models import (
    BLOG_SCHEMA as _BLOG_SCHEMA,
    USER_FK_TARGET as _USER_FK_TARGET,
    USER_ID_TYPE as _USER_ID_TYPE,
    qualify as _q,
)
from packages.media_lib.config import SCHEMA_NAME as _MEDIA_SCHEMA

STUDIO_SCHEMA = _BLOG_SCHEMA
_TABLE_ARGS = {'schema': STUDIO_SCHEMA}
_MEDIA_FILE_FK = f'{_MEDIA_SCHEMA}.files.id'


def _s(rest: str) -> str:
    """studio 表的 FK 目標，例如 _s('projects.id') → 'blog.studio_projects.id'。"""
    return _q(f'studio_{rest}', STUDIO_SCHEMA)


def _trgm(table: str, column: str):
    """pg_trgm GIN 索引（供 ILIKE 全域搜尋）。實體由 0002 migration 建立；這裡宣告是為了讓
    alembic compare_metadata 認得它，漂移偵測才不會把它回報成「DB 有、models 沒有」。"""
    return db.Index(
        f'ix_trgm_{table}_{column}', column,
        postgresql_using='gin', postgresql_ops={column: 'gin_trgm_ops'},
    )


def _iso(value: Optional[datetime]) -> Optional[str]:
    return value.isoformat() if value else None


# =============================================================================
# Project 內容專案
# =============================================================================

class StudioProject(db.Model):
    __tablename__ = 'studio_projects'
    __table_args__ = (
        _trgm('studio_projects', 'title'),
        _trgm('studio_projects', 'thesis'),
        _TABLE_ARGS,
    )

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    slug = db.Column(db.String(200), unique=True, nullable=False, index=True)
    stage = db.Column(db.String(20), default='collect', nullable=False, index=True)
    thesis = db.Column(db.Text)        # 核心觀點
    description = db.Column(db.Text)
    cover_image = db.Column(db.String(500))
    owner_id = db.Column(_USER_ID_TYPE, db.ForeignKey(_USER_FK_TARGET), index=True)
    attributes = db.Column(JSONB, default={})
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    documents = db.relationship('StudioDocument', backref='project', lazy='dynamic',
                                cascade='all, delete-orphan')
    sources = db.relationship('StudioSource', backref='project', lazy='dynamic',
                              cascade='all, delete-orphan')

    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'title': self.title,
            'slug': self.slug,
            'stage': self.stage,
            'thesis': self.thesis,
            'description': self.description,
            'cover_image': self.cover_image,
            'owner_id': self.owner_id,
            'attributes': self.attributes or {},
            'created_at': _iso(self.created_at),
            'updated_at': _iso(self.updated_at),
        }

    def __repr__(self):
        return f'<StudioProject {self.title}>'


# =============================================================================
# Document 各平台版本
# =============================================================================

class StudioDocument(db.Model):
    __tablename__ = 'studio_documents'
    __table_args__ = (
        db.UniqueConstraint('work_id', 'language', name='uq_studio_document_work_language'),
        _trgm('studio_documents', 'title'),
        _trgm('studio_documents', 'body'),
        _TABLE_ARGS,
    )

    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey(_s('projects.id'), ondelete='CASCADE'),
                           nullable=False, index=True)
    platform = db.Column(db.String(20), nullable=False, index=True)
    work_id = db.Column(db.String(36), nullable=False, default=lambda: str(uuid4()))
    language = db.Column(db.String(10), nullable=False, default='zh-TW')
    translation_source_id = db.Column(db.Integer, db.ForeignKey(_s('documents.id'), ondelete='SET NULL'))
    source_fingerprint = db.Column(db.String(64))
    title = db.Column(db.String(200))
    body = db.Column(db.Text)          # 工作草稿；blog 的正式版在 contents
    stage = db.Column(db.String(20), default='write', nullable=False, index=True)
    # blog 平台 1:1 綁定既有文章；文章刪除時解除綁定而不是刪文件
    content_id = db.Column(db.Integer, db.ForeignKey(_q('contents.id', _BLOG_SCHEMA), ondelete='SET NULL'),
                           unique=True)
    scheduled_at = db.Column(db.DateTime, index=True)
    published_at = db.Column(db.DateTime)
    published_url = db.Column(db.String(500))
    current_revision_id = db.Column(db.Integer)   # 最近一次命名／正式版；不設 FK 避免環狀依賴
    attributes = db.Column(JSONB, default={})
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    revisions = db.relationship('StudioRevision', backref='document', lazy='dynamic',
                                cascade='all, delete-orphan')
    content = db.relationship('Content', foreign_keys=[content_id])

    def to_dict(self, include_body: bool = True) -> Dict[str, Any]:
        stage = self.stage
        if self.content_id and stage == 'scheduled' and self.scheduled_at and self.scheduled_at <= datetime.utcnow():
            stage = 'published'
        data = {
            'id': self.id,
            'project_id': self.project_id,
            'platform': self.platform,
            'work_id': self.work_id,
            'language': self.language,
            'translation_source_id': self.translation_source_id,
            'title': self.title,
            'stage': stage,
            'content_id': self.content_id,
            'scheduled_at': _iso(self.scheduled_at),
            'published_at': _iso(self.published_at),
            'published_url': self.published_url,
            'current_revision_id': self.current_revision_id,
            'attributes': self.attributes or {},
            'created_at': _iso(self.created_at),
            'updated_at': _iso(self.updated_at),
        }
        if include_body:
            data['body'] = self.body
        return data

    def __repr__(self):
        return f'<StudioDocument {self.platform}:{self.title}>'


# =============================================================================
# Revision 版本快照
# =============================================================================

class StudioRevision(db.Model):
    __tablename__ = 'studio_revisions'
    __table_args__ = (
        _trgm('studio_revisions', 'body'),
        _TABLE_ARGS,
    )

    id = db.Column(db.Integer, primary_key=True)
    document_id = db.Column(db.Integer, db.ForeignKey(_s('documents.id'), ondelete='CASCADE'),
                            nullable=False, index=True)
    kind = db.Column(db.String(20), nullable=False, index=True)   # autosave / named / published
    label = db.Column(db.String(200))
    title = db.Column(db.String(200))
    body = db.Column(db.Text)
    created_by = db.Column(_USER_ID_TYPE, db.ForeignKey(_USER_FK_TARGET))
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)

    def to_dict(self, include_body: bool = False) -> Dict[str, Any]:
        data = {
            'id': self.id,
            'document_id': self.document_id,
            'kind': self.kind,
            'label': self.label,
            'title': self.title,
            'created_by': self.created_by,
            'created_at': _iso(self.created_at),
            'body_length': len(self.body or ''),
        }
        if include_body:
            data['body'] = self.body
        return data


# =============================================================================
# Card 知識卡片
# =============================================================================

class StudioCard(db.Model):
    __tablename__ = 'studio_cards'
    __table_args__ = (
        _trgm('studio_cards', 'title'),
        _trgm('studio_cards', 'body'),
        _TABLE_ARGS,
    )

    id = db.Column(db.Integer, primary_key=True)
    kind = db.Column(db.String(20), nullable=False, index=True)
    title = db.Column(db.String(200), nullable=False)
    body = db.Column(db.Text)
    source_url = db.Column(db.String(500))
    source_note = db.Column(db.Text)
    status = db.Column(db.String(20), default='active', nullable=False, index=True)
    created_by = db.Column(_USER_ID_TYPE, db.ForeignKey(_USER_FK_TARGET))
    attributes = db.Column(JSONB, default={})
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    refs = db.relationship('StudioCardRef', backref='card', lazy='dynamic',
                           cascade='all, delete-orphan')

    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'kind': self.kind,
            'title': self.title,
            'body': self.body,
            'source_url': self.source_url,
            'source_note': self.source_note,
            'status': self.status,
            'created_by': self.created_by,
            'attributes': self.attributes or {},
            'created_at': _iso(self.created_at),
            'updated_at': _iso(self.updated_at),
        }


class StudioCardRef(db.Model):
    """卡片被哪個專案／文件引用。"""
    __tablename__ = 'studio_card_refs'
    __table_args__ = (
        db.UniqueConstraint('card_id', 'target_type', 'target_id', name='uq_studio_card_refs_target'),
        db.Index('ix_studio_card_refs_target', 'target_type', 'target_id'),
        _TABLE_ARGS,
    )

    id = db.Column(db.Integer, primary_key=True)
    card_id = db.Column(db.Integer, db.ForeignKey(_s('cards.id'), ondelete='CASCADE'),
                        nullable=False, index=True)
    target_type = db.Column(db.String(20), nullable=False)   # project / document
    target_id = db.Column(db.Integer, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'card_id': self.card_id,
            'target_type': self.target_type,
            'target_id': self.target_id,
            'created_at': _iso(self.created_at),
        }


studio_card_links = db.Table(
    'studio_card_links',
    db.Column('card_id', db.Integer, db.ForeignKey(_s('cards.id'), ondelete='CASCADE'), primary_key=True),
    db.Column('related_card_id', db.Integer, db.ForeignKey(_s('cards.id'), ondelete='CASCADE'), primary_key=True),
    schema=STUDIO_SCHEMA,
)


# =============================================================================
# Inbox 收集箱
# =============================================================================

class StudioInboxItem(db.Model):
    __tablename__ = 'studio_inbox_items'
    __table_args__ = (
        _trgm('studio_inbox_items', 'body'),
        _TABLE_ARGS,
    )

    id = db.Column(db.Integer, primary_key=True)
    kind = db.Column(db.String(20), nullable=False)          # text / link / image
    title = db.Column(db.String(200))
    body = db.Column(db.Text)
    url = db.Column(db.String(1000))
    file_id = db.Column(db.Integer, db.ForeignKey(_MEDIA_FILE_FK, ondelete='SET NULL'))
    status = db.Column(db.String(20), default='new', nullable=False, index=True)
    # 整理後記錄去向
    project_id = db.Column(db.Integer, db.ForeignKey(_s('projects.id'), ondelete='SET NULL'))
    card_id = db.Column(db.Integer, db.ForeignKey(_s('cards.id'), ondelete='SET NULL'))
    created_by = db.Column(_USER_ID_TYPE, db.ForeignKey(_USER_FK_TARGET))
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)

    file = db.relationship('MLFile', foreign_keys=[file_id])

    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'kind': self.kind,
            'title': self.title,
            'body': self.body,
            'url': self.url,
            'file_id': self.file_id,
            'file_url': self.file.public_url if self.file else None,
            'status': self.status,
            'project_id': self.project_id,
            'card_id': self.card_id,
            'created_by': self.created_by,
            'created_at': _iso(self.created_at),
        }


# =============================================================================
# Source 專案參考資料
# =============================================================================

class StudioSource(db.Model):
    __tablename__ = 'studio_sources'
    __table_args__ = (
        _trgm('studio_sources', 'note'),
        _TABLE_ARGS,
    )

    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey(_s('projects.id'), ondelete='CASCADE'),
                           nullable=False, index=True)
    title = db.Column(db.String(200))
    url = db.Column(db.String(1000))
    note = db.Column(db.Text)
    file_id = db.Column(db.Integer, db.ForeignKey(_MEDIA_FILE_FK, ondelete='SET NULL'))
    inbox_item_id = db.Column(db.Integer, db.ForeignKey(_s('inbox_items.id'), ondelete='SET NULL'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    file = db.relationship('MLFile', foreign_keys=[file_id])

    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'project_id': self.project_id,
            'title': self.title,
            'url': self.url,
            'note': self.note,
            'file_id': self.file_id,
            'file_url': self.file.public_url if self.file else None,
            'inbox_item_id': self.inbox_item_id,
            'created_at': _iso(self.created_at),
        }


# =============================================================================
# Tag 扁平標籤（Studio 私有，與公開站的 blog.tags 分離）
# =============================================================================

class StudioTag(db.Model):
    __tablename__ = 'studio_tags'
    __table_args__ = _TABLE_ARGS

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    taggings = db.relationship('StudioTagging', backref='tag', lazy='dynamic',
                               cascade='all, delete-orphan')

    def to_dict(self) -> Dict[str, Any]:
        return {'id': self.id, 'name': self.name, 'created_at': _iso(self.created_at)}


class StudioTagging(db.Model):
    __tablename__ = 'studio_taggings'
    __table_args__ = (
        db.Index('ix_studio_taggings_target', 'target_type', 'target_id'),
        _TABLE_ARGS,
    )

    tag_id = db.Column(db.Integer, db.ForeignKey(_s('tags.id'), ondelete='CASCADE'), primary_key=True)
    target_type = db.Column(db.String(20), primary_key=True)   # project / document / card / inbox_item
    target_id = db.Column(db.Integer, primary_key=True)


__all__ = [
    'STUDIO_SCHEMA',
    'StudioProject', 'StudioDocument', 'StudioRevision',
    'StudioCard', 'StudioCardRef', 'studio_card_links',
    'StudioInboxItem', 'StudioSource',
    'StudioTag', 'StudioTagging',
]
