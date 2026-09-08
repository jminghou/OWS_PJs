"""
電商模組的資料模型：Product / ProductPrice / product_tags / Order / PaymentMethod。

自 core/backend_engine/models.py 移出（P-commerce）。這些表落在 SHOP schema，
外鍵指向 core 的 categories / contents / tags / users，所以模組依賴 core，反向不成立：
core 完全不知道電商的存在 —— 站台不掛電商就不會有這些表、路由與權限。

Category.products / Tag.products 兩個反向關聯改由這裡的 backref 提供，
否則 core 的 mapper 會在電商未載入時因找不到 'Product' 而失敗。
"""
from datetime import datetime

from sqlalchemy.dialects.postgresql import JSONB

from core.backend_engine.factory import db
from core.backend_engine.models import (
    BLOG_SCHEMA as _BLOG_SCHEMA,
    SHOP_SCHEMA as _SHOP_SCHEMA,
    USER_FK_TARGET as _USER_FK_TARGET,
    USER_ID_TYPE as _USER_ID_TYPE,
    qualify as _q,
)

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

    # Media — featured_image 直接存 MLFile public_url（與 Content.featured_image 一致）
    featured_image = db.Column(db.String(500))
    gallery_images = db.Column(JSONB, default=[])

    # Classification
    category_id = db.Column(db.Integer, db.ForeignKey(_q('categories.id', _BLOG_SCHEMA)), index=True)
    category = db.relationship('Category', backref=db.backref('products', lazy='dynamic'))

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
    detail_content_id = db.Column(db.Integer, db.ForeignKey(_q('contents.id', _BLOG_SCHEMA), ondelete='SET NULL'), nullable=True)

    # i18n fields
    language = db.Column(db.String(10), nullable=False, default='zh-TW', index=True)
    original_id = db.Column(db.Integer, db.ForeignKey(_q('products.id', _SHOP_SCHEMA), ondelete='CASCADE'), nullable=True)

    # NEW: JSONB extension fields
    attributes = db.Column(JSONB, default={})
    meta_data = db.Column(JSONB, default={})

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint('product_id', 'language', name='uq_product_id_language'),
        {'schema': _SHOP_SCHEMA},
    )

    # Relationships
    tags = db.relationship('Tag', secondary=_q('product_tags', _SHOP_SCHEMA),
                           backref=db.backref('products'))
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
            'image': self.featured_image,
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
            'featured_image': self.featured_image,
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
    db.Column('product_id', db.Integer, db.ForeignKey(_q('products.id', _SHOP_SCHEMA), ondelete='CASCADE'), primary_key=True),
    db.Column('tag_id', db.Integer, db.ForeignKey(_q('tags.id', _BLOG_SCHEMA), ondelete='CASCADE'), primary_key=True),
    schema=_SHOP_SCHEMA,
)


class ProductPrice(db.Model):
    """Multi-currency product pricing model."""
    __tablename__ = 'product_prices'

    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.Integer, db.ForeignKey(_q('products.id', _SHOP_SCHEMA), ondelete='CASCADE'), nullable=False)
    currency = db.Column(db.String(10), nullable=False, index=True)
    price = db.Column(db.Integer, nullable=False)
    original_price = db.Column(db.Integer, nullable=True)
    is_active = db.Column(db.Boolean, default=True, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint('product_id', 'currency', name='uq_product_currency'),
        {'schema': _SHOP_SCHEMA},
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
    __table_args__ = {'schema': _SHOP_SCHEMA}

    id = db.Column(db.Integer, primary_key=True)
    order_no = db.Column(db.String(50), unique=True, nullable=False, index=True)
    user_id = db.Column(_USER_ID_TYPE, db.ForeignKey(_USER_FK_TARGET), nullable=False)
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
    user = db.relationship('User', backref='orders',
                           foreign_keys='Order.user_id',
                           primaryjoin='User.id == Order.user_id')

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
    __table_args__ = {'schema': _SHOP_SCHEMA}

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
