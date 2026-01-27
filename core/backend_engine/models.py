"""
OWS Core Engine - Database Models

This module defines all SQLAlchemy ORM models for the OWS platform.
Models are designed to be shared across all sites.

Key Features:
- RBAC (Role-Based Access Control) support
- JSONB attributes for extensibility
- i18n (internationalization) support
- Multi-currency pricing
"""

from datetime import datetime
from typing import Optional, Dict, Any, List

from flask_login import UserMixin
from sqlalchemy.dialects.postgresql import JSONB
import bcrypt
import re

from core.backend_engine.factory import db


# =============================================================================
# Utility Functions
# =============================================================================

def validate_password(password: str) -> bool:
    """
    Validate password complexity.

    Requirements:
    - Minimum 8 characters
    - At least one uppercase letter
    - At least one lowercase letter
    - At least one digit
    """
    errors = []
    if len(password) < 8:
        errors.append('密碼長度至少 8 個字元')
    if not re.search(r'[A-Z]', password):
        errors.append('密碼必須包含至少一個大寫字母')
    if not re.search(r'[a-z]', password):
        errors.append('密碼必須包含至少一個小寫字母')
    if not re.search(r'[0-9]', password):
        errors.append('密碼必須包含至少一個數字')
    if errors:
        raise ValueError('; '.join(errors))
    return True


# =============================================================================
# RBAC Models (New)
# =============================================================================

class Role(db.Model):
    """Role model for RBAC."""
    __tablename__ = 'roles'

    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(50), unique=True, nullable=False, index=True)
    name = db.Column(JSONB, default={})  # {"zh-TW": "管理員", "en": "Administrator"}
    description = db.Column(JSONB, default={})
    is_system = db.Column(db.Boolean, default=False)  # System roles cannot be deleted
    is_active = db.Column(db.Boolean, default=True, index=True)
    permissions_snapshot = db.Column(JSONB, default=[])  # Denormalized for fast lookup
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    role_permissions = db.relationship('RolePermission', backref='role', lazy='dynamic', cascade='all, delete-orphan')
    user_roles = db.relationship('UserRole', backref='role', lazy='dynamic', cascade='all, delete-orphan')

    def get_name(self, language: str = 'zh-TW') -> str:
        """Get localized role name."""
        if isinstance(self.name, dict):
            return self.name.get(language, self.name.get('zh-TW', self.code))
        return self.code

    def __repr__(self):
        return f'<Role {self.code}>'


class Permission(db.Model):
    """Permission model for RBAC."""
    __tablename__ = 'permissions'

    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(100), unique=True, nullable=False, index=True)  # e.g., 'contents.create'
    name = db.Column(JSONB, default={})
    description = db.Column(JSONB, default={})
    module = db.Column(db.String(50), nullable=False, index=True)  # e.g., 'contents', 'products'
    action = db.Column(db.String(50), nullable=False)  # e.g., 'create', 'read', 'update', 'delete'
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    role_permissions = db.relationship('RolePermission', backref='permission', lazy='dynamic', cascade='all, delete-orphan')

    def __repr__(self):
        return f'<Permission {self.code}>'


class RolePermission(db.Model):
    """Association table for Role-Permission relationship."""
    __tablename__ = 'role_permissions'

    role_id = db.Column(db.Integer, db.ForeignKey('roles.id', ondelete='CASCADE'), primary_key=True)
    permission_id = db.Column(db.Integer, db.ForeignKey('permissions.id', ondelete='CASCADE'), primary_key=True)
    granted_at = db.Column(db.DateTime, default=datetime.utcnow)
    granted_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)

    def __repr__(self):
        return f'<RolePermission role={self.role_id} permission={self.permission_id}>'


class UserRole(db.Model):
    """Association table for User-Role relationship."""
    __tablename__ = 'user_roles'

    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), primary_key=True)
    role_id = db.Column(db.Integer, db.ForeignKey('roles.id', ondelete='CASCADE'), primary_key=True)
    assigned_at = db.Column(db.DateTime, default=datetime.utcnow)
    assigned_by = db.Column(db.Integer, nullable=True)
    expires_at = db.Column(db.DateTime, nullable=True)  # Optional expiration for temporary roles

    def __repr__(self):
        return f'<UserRole user={self.user_id} role={self.role_id}>'


# =============================================================================
# User Model (Enhanced)
# =============================================================================

class User(UserMixin, db.Model):
    """User model with RBAC support."""
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False, index=True)
    email = db.Column(db.String(100), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), default='user')  # Legacy field for backward compatibility
    is_active = db.Column(db.Boolean, default=True, index=True)
    avatar = db.Column(db.String(500))  # Profile image path (supports GCS long URLs)

    # NEW: JSONB extension fields
    attributes = db.Column(JSONB, default={})  # Extensible attributes
    meta_data = db.Column(JSONB, default={})  # Site-specific metadata

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_login = db.Column(db.DateTime)

    # Relationships
    contents = db.relationship('Content', backref='author', lazy='dynamic')
    comments = db.relationship('Comment', backref='user', lazy='dynamic')
    media_uploads = db.relationship('Media', backref='uploader', lazy='dynamic')
    activity_logs = db.relationship('ActivityLog', backref='user', lazy='dynamic')
    user_roles = db.relationship('UserRole', backref='user', lazy='dynamic', cascade='all, delete-orphan')

    def set_password(self, password: str) -> None:
        """Hash and set password after validation."""
        validate_password(password)
        salt = bcrypt.gensalt()
        self.password_hash = bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

    def check_password(self, password: str) -> bool:
        """Verify password against hash."""
        if not self.password_hash:
            return False
        return bcrypt.checkpw(password.encode('utf-8'), self.password_hash.encode('utf-8'))

    def is_admin(self) -> bool:
        """Check if user has admin role (legacy support)."""
        return self.role == 'admin'

    def is_editor(self) -> bool:
        """Check if user has editor or admin role (legacy support)."""
        return self.role in ['admin', 'editor']

    def get_attribute(self, key: str, default: Any = None) -> Any:
        """Get a value from attributes JSONB field."""
        if self.attributes and isinstance(self.attributes, dict):
            return self.attributes.get(key, default)
        return default

    def set_attribute(self, key: str, value: Any) -> None:
        """Set a value in attributes JSONB field."""
        if self.attributes is None:
            self.attributes = {}
        self.attributes[key] = value

    def __repr__(self):
        return f'<User {self.username}>'


# =============================================================================
# Category Model (Enhanced)
# =============================================================================

class Category(db.Model):
    """Category model with i18n support."""
    __tablename__ = 'categories'

    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(100), unique=True, nullable=False, index=True)
    slugs = db.Column(JSONB, default={})  # {"zh-TW": "政治", "en-US": "politics"}
    parent_id = db.Column(db.Integer, db.ForeignKey('categories.id'))
    sort_order = db.Column(db.Integer, default=0)
    is_active = db.Column(db.Boolean, default=True, index=True)

    # NEW: JSONB extension field
    attributes = db.Column(JSONB, default={})

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    contents = db.relationship('Content', backref='category', lazy='dynamic')
    parent = db.relationship('Category', remote_side=[id], backref='children', foreign_keys=[parent_id])
    products = db.relationship('Product', backref='category', lazy='dynamic')

    def get_slug(self, language: str = 'zh-TW') -> str:
        """Get localized slug."""
        if isinstance(self.slugs, dict):
            return self.slugs.get(language, self.slugs.get('zh-TW', self.code))
        return self.code

    def __repr__(self):
        return f'<Category {self.code}>'


# =============================================================================
# Content Model (Enhanced)
# =============================================================================

class Content(db.Model):
    """Content model for articles, pages, etc."""
    __tablename__ = 'contents'

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    content = db.Column(db.Text)
    summary = db.Column(db.Text)
    slug = db.Column(db.String(200), unique=True, nullable=False, index=True)
    status = db.Column(db.String(20), default='draft', index=True)
    content_type = db.Column(db.String(50), default='article', index=True)
    category_id = db.Column(db.Integer, db.ForeignKey('categories.id'), index=True)
    author_id = db.Column(db.Integer, db.ForeignKey('users.id'), index=True)
    featured_image = db.Column(db.String(500))  # 16:9, supports GCS long URLs
    cover_image = db.Column(db.String(500))  # 1:1
    meta_title = db.Column(db.String(200))
    meta_description = db.Column(db.Text)
    views_count = db.Column(db.Integer, default=0)
    likes_count = db.Column(db.Integer, default=0)
    published_at = db.Column(db.DateTime, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # i18n fields
    language = db.Column(db.String(10), default='zh-TW', nullable=False, index=True)
    original_id = db.Column(db.Integer, db.ForeignKey('contents.id'), nullable=True)

    # NEW: JSONB extension fields
    attributes = db.Column(JSONB, default={})  # Custom fields per site
    meta_data = db.Column(JSONB, default={})  # SEO, schema.org data, etc.

    # Relationships
    comments = db.relationship('Comment', backref='content', lazy='dynamic', cascade='all, delete-orphan')
    tags = db.relationship('Tag', secondary='content_tags', back_populates='contents')
    media = db.relationship('Media', secondary='content_media', back_populates='contents')
    translations = db.relationship('Content', backref=db.backref('original', remote_side=[id]), lazy='dynamic')

    def is_published(self) -> bool:
        """Check if content is published and publication date has passed."""
        return self.status == 'published' and self.published_at and self.published_at <= datetime.utcnow()

    def increment_views(self) -> None:
        """Increment view count."""
        self.views_count += 1
        db.session.commit()

    def __repr__(self):
        return f'<Content {self.title}>'


# =============================================================================
# Tag Model (Enhanced)
# =============================================================================

class Tag(db.Model):
    """Tag model with i18n support."""
    __tablename__ = 'tags'

    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(50), unique=True, nullable=False, index=True)
    slugs = db.Column(JSONB, default={})  # {"zh-TW": "熱門", "en-US": "hot"}

    # NEW: JSONB extension field
    attributes = db.Column(JSONB, default={})

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    contents = db.relationship('Content', secondary='content_tags', back_populates='tags')
    products = db.relationship('Product', secondary='product_tags', back_populates='tags')

    def get_slug(self, language: str = 'zh-TW') -> str:
        """Get localized slug."""
        if isinstance(self.slugs, dict):
            return self.slugs.get(language, self.slugs.get('zh-TW', self.code))
        return self.code

    def __repr__(self):
        return f'<Tag {self.code}>'


# Content-Tag association table
content_tags = db.Table('content_tags',
    db.Column('content_id', db.Integer, db.ForeignKey('contents.id', ondelete='CASCADE'), primary_key=True),
    db.Column('tag_id', db.Integer, db.ForeignKey('tags.id', ondelete='CASCADE'), primary_key=True)
)


# =============================================================================
# Comment Model
# =============================================================================

class Comment(db.Model):
    """Comment model with nested replies support."""
    __tablename__ = 'comments'

    id = db.Column(db.Integer, primary_key=True)
    content_id = db.Column(db.Integer, db.ForeignKey('contents.id', ondelete='CASCADE'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    author_name = db.Column(db.String(100))
    author_email = db.Column(db.String(100))
    comment_text = db.Column(db.Text, nullable=False)
    parent_id = db.Column(db.Integer, db.ForeignKey('comments.id'))
    status = db.Column(db.String(20), default='pending', index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    parent = db.relationship('Comment', remote_side=[id], backref='replies')

    def __repr__(self):
        return f'<Comment {self.id}>'


# =============================================================================
# Media Models
# =============================================================================

class MediaFolder(db.Model):
    """Media folder model for organizing uploads."""
    __tablename__ = 'media_folders'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    parent_id = db.Column(db.Integer, db.ForeignKey('media_folders.id'), nullable=True)
    path = db.Column(db.String(500), nullable=False)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    parent = db.relationship('MediaFolder', remote_side=[id], backref='subfolders')
    media_items = db.relationship('Media', backref='folder', lazy='dynamic')

    def __repr__(self):
        return f'<MediaFolder {self.name}>'


class Media(db.Model):
    """Media file model."""
    __tablename__ = 'media'

    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(255), nullable=False)
    original_filename = db.Column(db.String(255), nullable=False)
    file_path = db.Column(db.String(500), nullable=False)  # Supports GCS long URLs
    file_size = db.Column(db.Integer)
    mime_type = db.Column(db.String(100))
    alt_text = db.Column(db.String(255))
    caption = db.Column(db.Text)
    folder_id = db.Column(db.Integer, db.ForeignKey('media_folders.id'), nullable=True)
    uploaded_by = db.Column(db.Integer, db.ForeignKey('users.id'))

    # NEW: JSONB extension field
    attributes = db.Column(JSONB, default={})  # metadata like dimensions, etc.

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    contents = db.relationship('Content', secondary='content_media', back_populates='media')

    def __repr__(self):
        return f'<Media {self.filename}>'


# Content-Media association table
content_media = db.Table('content_media',
    db.Column('content_id', db.Integer, db.ForeignKey('contents.id', ondelete='CASCADE'), primary_key=True),
    db.Column('media_id', db.Integer, db.ForeignKey('media.id', ondelete='CASCADE'), primary_key=True),
    db.Column('display_order', db.Integer, default=0)
)


# =============================================================================
# Menu Models
# =============================================================================

class Menu(db.Model):
    """Menu model for navigation."""
    __tablename__ = 'menus'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    location = db.Column(db.String(50), nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    items = db.relationship('MenuItem', backref='menu', lazy='dynamic', cascade='all, delete-orphan')

    def __repr__(self):
        return f'<Menu {self.name}>'


class MenuItem(db.Model):
    """Menu item model with hierarchy support."""
    __tablename__ = 'menu_items'

    id = db.Column(db.Integer, primary_key=True)
    menu_id = db.Column(db.Integer, db.ForeignKey('menus.id', ondelete='CASCADE'), nullable=False)
    title = db.Column(db.String(100), nullable=False)
    url = db.Column(db.String(500))
    content_id = db.Column(db.Integer, db.ForeignKey('contents.id'))
    parent_id = db.Column(db.Integer, db.ForeignKey('menu_items.id'))
    sort_order = db.Column(db.Integer, default=0)
    css_class = db.Column(db.String(100))
    target = db.Column(db.String(20), default='_self')
    is_active = db.Column(db.Boolean, default=True)

    # Relationships
    content = db.relationship('Content', backref='menu_items')
    parent = db.relationship('MenuItem', remote_side=[id], backref='children')

    def __repr__(self):
        return f'<MenuItem {self.title}>'


# =============================================================================
# Settings Models
# =============================================================================

class Setting(db.Model):
    """Key-value settings model."""
    __tablename__ = 'settings'

    id = db.Column(db.Integer, primary_key=True)
    key = db.Column(db.String(100), unique=True, nullable=False, index=True)
    value = db.Column(db.Text)
    description = db.Column(db.Text)
    data_type = db.Column(db.String(20), default='string')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f'<Setting {self.key}>'


class HomepageSlide(db.Model):
    """Homepage carousel slide model."""
    __tablename__ = 'homepage_slides'

    id = db.Column(db.Integer, primary_key=True)
    slide_id = db.Column(db.String(100), unique=True, nullable=False)
    image_url = db.Column(db.String(500), nullable=False)
    alt_text = db.Column(db.String(200))
    sort_order = db.Column(db.Integer, default=0, nullable=False)
    subtitles = db.Column(JSONB, default={})  # {"zh-TW": "文字A", "en": "Text A"}
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to frontend format."""
        return {
            'id': self.slide_id,
            'image_url': self.image_url,
            'alt_text': self.alt_text or '',
            'sort_order': self.sort_order,
            'subtitles': self.subtitles or {}
        }

    def __repr__(self):
        return f'<HomepageSlide {self.slide_id}>'


class HomepageSettings(db.Model):
    """Homepage global settings model."""
    __tablename__ = 'homepage_settings'

    id = db.Column(db.Integer, primary_key=True)
    button_text = db.Column(JSONB, default={})  # {"zh-TW": "關於我們", "en": "About Us"}
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to frontend format."""
        return {
            'button_text': self.button_text or {},
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

    def __repr__(self):
        return f'<HomepageSettings {self.id}>'


# =============================================================================
# Activity Log Model
# =============================================================================

class ActivityLog(db.Model):
    """Activity log for audit trail."""
    __tablename__ = 'activity_logs'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    action = db.Column(db.String(100), nullable=False)
    table_name = db.Column(db.String(50))
    record_id = db.Column(db.Integer)
    old_values = db.Column(JSONB)
    new_values = db.Column(JSONB)
    ip_address = db.Column(db.String(45))
    user_agent = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)

    def __repr__(self):
        return f'<ActivityLog {self.action}>'


# =============================================================================
# Submission Model (Enhanced)
# =============================================================================

class Submission(db.Model):
    """User submission model (e.g., astrology questions)."""
    __tablename__ = 'submissions'

    id = db.Column(db.Integer, primary_key=True)
    submission_type = db.Column(db.String(50), default='general', index=True)  # for multi-purpose
    character_name = db.Column(db.String(100))
    birth_year = db.Column(db.String(4))
    birth_month = db.Column(db.String(2))
    birth_day = db.Column(db.String(2))
    birth_time = db.Column(db.String(50))
    birth_place = db.Column(db.String(100))
    question = db.Column(db.Text)
    status = db.Column(db.String(20), default='pending', index=True)
    admin_notes = db.Column(db.Text)
    ip_address = db.Column(db.String(45))

    # NEW: JSONB extension field
    attributes = db.Column(JSONB, default={})

    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f'<Submission {self.id}: {self.character_name}>'


# =============================================================================
# E-commerce Models
# =============================================================================

class Product(db.Model):
    """Product model with multi-language and multi-currency support."""
    __tablename__ = 'products'

    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.String(100), nullable=False, index=True)

    # Multi-language support (JSON)
    names = db.Column(JSONB, default={})  # {'zh-TW': '...', 'en': '...'}
    descriptions = db.Column(JSONB, default={})
    short_descriptions = db.Column(JSONB, default={})

    # Pricing
    price = db.Column(db.Integer, nullable=False)
    original_price = db.Column(db.Integer)
    stock_quantity = db.Column(db.Integer, default=-1)  # -1 = unlimited
    stock_status = db.Column(db.String(20), default='in_stock')

    # Media
    featured_image_id = db.Column(db.Integer, db.ForeignKey('media.id'))
    gallery_images = db.Column(JSONB, default=[])

    # Classification
    category_id = db.Column(db.Integer, db.ForeignKey('categories.id'), index=True)

    # Status
    is_active = db.Column(db.Boolean, default=True, index=True)
    is_featured = db.Column(db.Boolean, default=False)
    sort_order = db.Column(db.Integer, default=0)

    # SEO
    meta_title = db.Column(db.String(200))
    meta_description = db.Column(db.Text)

    # Statistics
    views_count = db.Column(db.Integer, default=0)
    sales_count = db.Column(db.Integer, default=0)

    # Content relation
    detail_content_id = db.Column(db.Integer, db.ForeignKey('contents.id', ondelete='SET NULL'), nullable=True)

    # i18n fields
    language = db.Column(db.String(10), nullable=False, default='zh-TW', index=True)
    original_id = db.Column(db.Integer, db.ForeignKey('products.id', ondelete='CASCADE'), nullable=True)

    # NEW: JSONB extension fields
    attributes = db.Column(JSONB, default={})
    meta_data = db.Column(JSONB, default={})

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint('product_id', 'language', name='uq_product_id_language'),
    )

    # Relationships
    featured_image = db.relationship('Media', foreign_keys=[featured_image_id])
    tags = db.relationship('Tag', secondary='product_tags', back_populates='products')
    detail_content = db.relationship('Content', foreign_keys=[detail_content_id], backref='product_detail')
    original = db.relationship('Product', remote_side=[id], foreign_keys=[original_id], backref='translations')
    prices = db.relationship('ProductPrice', backref='product', lazy='dynamic', cascade='all, delete-orphan')

    def to_dict(self, language: str = 'zh-TW') -> Dict[str, Any]:
        """Convert to public API format with localization."""
        return {
            'id': self.id,
            'product_id': self.product_id,
            'name': self.names.get(language, self.names.get('zh-TW', '')) if self.names else '',
            'description': self.descriptions.get(language, self.descriptions.get('zh-TW', '')) if self.descriptions else '',
            'short_description': self.short_descriptions.get(language, self.short_descriptions.get('zh-TW', '')) if self.short_descriptions else '',
            'price': self.price,
            'original_price': self.original_price,
            'stock_quantity': self.stock_quantity,
            'stock_status': self.stock_status,
            'image': self.featured_image.file_path if self.featured_image else None,
            'category': {
                'id': self.category.id,
                'code': self.category.code,
                'slug': self.category.get_slug(language)
            } if self.category else None,
            'tags': [{
                'id': tag.id,
                'code': tag.code,
                'slug': tag.get_slug(language)
            } for tag in self.tags],
            'is_featured': self.is_featured,
            'sort_order': self.sort_order,
            'views_count': self.views_count,
            'sales_count': self.sales_count,
            'detail_content_id': self.detail_content_id,
            'has_detail': self.detail_content_id is not None
        }

    def to_admin_dict(self) -> Dict[str, Any]:
        """Convert to admin format (full data)."""
        return {
            'id': self.id,
            'product_id': self.product_id,
            'names': self.names,
            'descriptions': self.descriptions,
            'short_descriptions': self.short_descriptions,
            'price': self.price,
            'original_price': self.original_price,
            'stock_quantity': self.stock_quantity,
            'stock_status': self.stock_status,
            'featured_image_id': self.featured_image_id,
            'featured_image': {
                'id': self.featured_image.id,
                'file_path': self.featured_image.file_path
            } if self.featured_image else None,
            'gallery_images': self.gallery_images,
            'category_id': self.category.id if self.category else None,
            'tag_ids': [tag.id for tag in self.tags],
            'is_active': self.is_active,
            'is_featured': self.is_featured,
            'sort_order': self.sort_order,
            'meta_title': self.meta_title,
            'meta_description': self.meta_description,
            'views_count': self.views_count,
            'sales_count': self.sales_count,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'detail_content_id': self.detail_content_id,
            'detail_content': {
                'id': self.detail_content.id,
                'title': self.detail_content.title,
                'slug': self.detail_content.slug,
                'status': self.detail_content.status,
                'language': self.detail_content.language
            } if self.detail_content else None,
            'attributes': self.attributes,
            'meta_data': self.meta_data
        }

    def get_price(self, currency: str = 'TWD') -> Dict[str, Any]:
        """Get price for specified currency."""
        CURRENCY_SYMBOLS = {
            'TWD': 'NT$',
            'USD': '$',
            'EUR': '€',
            'JPY': '¥',
            'GBP': '£'
        }

        # Check eager-loaded prices first
        price_entry = None
        if hasattr(self, '_prices_cache'):
            for p in self._prices_cache:
                if p.currency == currency and p.is_active:
                    price_entry = p
                    break

        # Query if not found
        if not price_entry:
            price_entry = ProductPrice.query.filter_by(
                product_id=self.id,
                currency=currency,
                is_active=True
            ).first()

        if price_entry:
            return {
                'price': price_entry.price,
                'original_price': price_entry.original_price,
                'currency': price_entry.currency,
                'currency_symbol': CURRENCY_SYMBOLS.get(currency, currency)
            }

        # Fallback to default (TWD)
        return {
            'price': self.price,
            'original_price': self.original_price,
            'currency': 'TWD',
            'currency_symbol': 'NT$'
        }

    def __repr__(self):
        return f'<Product {self.product_id}>'


# Product-Tag association table
product_tags = db.Table('product_tags',
    db.Column('product_id', db.Integer, db.ForeignKey('products.id', ondelete='CASCADE'), primary_key=True),
    db.Column('tag_id', db.Integer, db.ForeignKey('tags.id', ondelete='CASCADE'), primary_key=True)
)


class ProductPrice(db.Model):
    """Multi-currency product pricing model."""
    __tablename__ = 'product_prices'

    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id', ondelete='CASCADE'), nullable=False)
    currency = db.Column(db.String(10), nullable=False, index=True)
    price = db.Column(db.Integer, nullable=False)
    original_price = db.Column(db.Integer, nullable=True)
    is_active = db.Column(db.Boolean, default=True, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint('product_id', 'currency', name='uq_product_currency'),
    )

    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'product_id': self.product_id,
            'currency': self.currency,
            'price': self.price,
            'original_price': self.original_price,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

    def __repr__(self):
        return f'<ProductPrice {self.product_id} {self.currency}>'


class Order(db.Model):
    """Order model with multi-currency support."""
    __tablename__ = 'orders'

    id = db.Column(db.Integer, primary_key=True)
    order_no = db.Column(db.String(50), unique=True, nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    amount = db.Column(db.Integer, nullable=False)
    status = db.Column(db.String(20), default='pending', index=True)
    items = db.Column(JSONB, default=[])  # Snapshot of items

    # i18n and currency
    language = db.Column(db.String(10), nullable=False, default='zh-TW')
    currency = db.Column(db.String(10), nullable=False, default='TWD', index=True)
    payment_method = db.Column(db.String(50), nullable=True, index=True)

    # NEW: JSONB extension field
    attributes = db.Column(JSONB, default={})

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    paid_at = db.Column(db.DateTime, nullable=True)

    # Relationships
    user = db.relationship('User', backref='orders')

    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'order_no': self.order_no,
            'user_id': self.user_id,
            'amount': self.amount,
            'status': self.status,
            'items': self.items,
            'language': self.language,
            'currency': self.currency,
            'payment_method': self.payment_method,
            'attributes': self.attributes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'paid_at': self.paid_at.isoformat() if self.paid_at else None
        }

    def __repr__(self):
        return f'<Order {self.order_no}>'


class PaymentMethod(db.Model):
    """Payment method configuration model."""
    __tablename__ = 'payment_methods'

    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(50), unique=True, nullable=False, index=True)
    name = db.Column(JSONB, nullable=False)  # {'zh-TW': '綠界金流', 'en': 'ECPay'}
    description = db.Column(JSONB, nullable=True)
    supported_currencies = db.Column(JSONB, nullable=False, default=[])
    is_active = db.Column(db.Boolean, default=True, index=True)
    config = db.Column(JSONB, nullable=True, default={})  # Sensitive config (not exposed)
    sort_order = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self, language: str = 'zh-TW') -> Dict[str, Any]:
        """Return public info (excluding sensitive config)."""
        return {
            'id': self.id,
            'code': self.code,
            'name': self.name.get(language, self.name.get('zh-TW', self.code)) if self.name else self.code,
            'description': self.description.get(language, '') if self.description else '',
            'supported_currencies': self.supported_currencies,
            'is_active': self.is_active,
            'sort_order': self.sort_order
        }

    def to_admin_dict(self) -> Dict[str, Any]:
        """Return full info for admin (including config)."""
        return {
            'id': self.id,
            'code': self.code,
            'name': self.name,
            'description': self.description,
            'supported_currencies': self.supported_currencies,
            'is_active': self.is_active,
            'config': self.config,
            'sort_order': self.sort_order,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

    def __repr__(self):
        return f'<PaymentMethod {self.code}>'


# =============================================================================
# Exports
# =============================================================================

__all__ = [
    # Utility
    'validate_password',
    # RBAC
    'Role',
    'Permission',
    'RolePermission',
    'UserRole',
    # Core
    'User',
    'Category',
    'Content',
    'Tag',
    'content_tags',
    'Comment',
    # Media
    'MediaFolder',
    'Media',
    'content_media',
    # Menu
    'Menu',
    'MenuItem',
    # Settings
    'Setting',
    'HomepageSlide',
    'HomepageSettings',
    # Activity
    'ActivityLog',
    # Submission
    'Submission',
    # E-commerce
    'Product',
    'product_tags',
    'ProductPrice',
    'Order',
    'PaymentMethod',
]
