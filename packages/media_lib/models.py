"""
Media Library - Database Models

所有資料表位於 PostgreSQL 的 media_lib schema 中。
"""

from datetime import datetime, timezone
from core.backend_engine.factory import db
from sqlalchemy.dialects.postgresql import JSONB
from packages.media_lib.config import SCHEMA_NAME

SCHEMA_ARGS = {'schema': SCHEMA_NAME}


# =============================================================================
# Association Table: file_tags
# =============================================================================

file_tags = db.Table(
    'file_tags',
    db.Column('file_id', db.Integer, db.ForeignKey(f'{SCHEMA_NAME}.files.id', ondelete='CASCADE'), primary_key=True),
    db.Column('tag_id', db.Integer, db.ForeignKey(f'{SCHEMA_NAME}.tags.id', ondelete='CASCADE'), primary_key=True),
    schema=SCHEMA_NAME,
)


# =============================================================================
# MLFolder - 資料夾階層
# =============================================================================

class MLFolder(db.Model):
    """媒體庫資料夾，支援巢狀階層。"""
    __tablename__ = 'folders'
    __table_args__ = (SCHEMA_ARGS,)

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    parent_id = db.Column(db.Integer, db.ForeignKey(f'{SCHEMA_NAME}.folders.id'))
    path = db.Column(db.String(500), nullable=False, index=True)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id', deferrable=True))
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc),
                           onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    parent = db.relationship('MLFolder', remote_side=[id], backref=db.backref('subfolders', lazy='dynamic'))
    files = db.relationship('MLFile', backref='folder', lazy='dynamic')

    def __repr__(self):
        return f'<MLFolder {self.name}>'


# =============================================================================
# MLFile - 媒體檔案
# =============================================================================

class MLFile(db.Model):
    """媒體檔案主表，每個檔案對應 GCS 上的一個物件。"""
    __tablename__ = 'files'
    __table_args__ = (SCHEMA_ARGS,)

    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(255), nullable=False)
    original_filename = db.Column(db.String(255), nullable=False)
    gcs_path = db.Column(db.String(500), nullable=False, index=True)
    public_url = db.Column(db.String(700), nullable=False)
    file_size = db.Column(db.Integer)
    mime_type = db.Column(db.String(100))
    width = db.Column(db.Integer)
    height = db.Column(db.Integer)
    alt_text = db.Column(db.String(500))
    caption = db.Column(db.Text)
    folder_id = db.Column(db.Integer, db.ForeignKey(f'{SCHEMA_NAME}.folders.id'))
    uploaded_by = db.Column(db.Integer, db.ForeignKey('users.id', deferrable=True))
    attributes = db.Column(JSONB, default=dict)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc),
                           onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    variants = db.relationship('MLFileVariant', backref='original', lazy='joined',
                               cascade='all, delete-orphan')
    tags = db.relationship('MLTag', secondary=file_tags, backref=db.backref('files', lazy='dynamic'))

    def to_dict(self):
        """轉為 dict，包含 variants 資訊。"""
        data = {
            'id': self.id,
            'filename': self.filename,
            'original_filename': self.original_filename,
            'gcs_path': self.gcs_path,
            'public_url': self.public_url,
            'file_size': self.file_size,
            'mime_type': self.mime_type,
            'width': self.width,
            'height': self.height,
            'alt_text': self.alt_text,
            'caption': self.caption,
            'folder_id': self.folder_id,
            'uploaded_by': self.uploaded_by,
            'attributes': self.attributes or {},
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'tags': [tag.to_dict() for tag in self.tags],
            'formats': {v.variant_type: v.to_dict() for v in self.variants},
        }
        return data

    def __repr__(self):
        return f'<MLFile {self.original_filename}>'


# =============================================================================
# MLFileVariant - 圖片變體（縮圖等）
# =============================================================================

class MLFileVariant(db.Model):
    """圖片的各尺寸變體（thumbnail, small, medium, large）。"""
    __tablename__ = 'file_variants'
    __table_args__ = (SCHEMA_ARGS,)

    id = db.Column(db.Integer, primary_key=True)
    file_id = db.Column(db.Integer, db.ForeignKey(f'{SCHEMA_NAME}.files.id', ondelete='CASCADE'),
                        nullable=False, index=True)
    variant_type = db.Column(db.String(20), nullable=False)  # thumbnail, small, medium, large
    gcs_path = db.Column(db.String(500), nullable=False)
    public_url = db.Column(db.String(700), nullable=False)
    width = db.Column(db.Integer)
    height = db.Column(db.Integer)
    file_size = db.Column(db.Integer)

    def to_dict(self):
        return {
            'url': self.public_url,
            'width': self.width,
            'height': self.height,
            'file_size': self.file_size,
        }

    def __repr__(self):
        return f'<MLFileVariant {self.variant_type} of file {self.file_id}>'


# =============================================================================
# MLTag - 標籤
# =============================================================================

class MLTag(db.Model):
    """媒體檔案的標籤分類。"""
    __tablename__ = 'tags'
    __table_args__ = (SCHEMA_ARGS,)

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)
    slug = db.Column(db.String(100), nullable=False, unique=True, index=True)
    color = db.Column(db.String(7), default='#6366f1')  # hex color
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'slug': self.slug,
            'color': self.color,
        }

    def __repr__(self):
        return f'<MLTag {self.name}>'


__all__ = ['MLFolder', 'MLFile', 'MLFileVariant', 'MLTag', 'file_tags']
