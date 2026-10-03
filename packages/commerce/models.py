"""
電商模組的資料模型：Product / ProductPrice / product_tags / Order / PaymentMethod。

自 core/backend_engine/models.py 移出（P-commerce）。這些表落在 SHOP schema，
外鍵指向 core 的 categories / contents / tags / users，所以模組依賴 core，反向不成立：
core 完全不知道電商的存在 —— 站台不掛電商就不會有這些表、路由與權限。

Category.products / Tag.products 兩個反向關聯改由這裡的 backref 提供，
否則 core 的 mapper 會在電商未載入時因找不到 'Product' 而失敗。
"""
from datetime import datetime
from typing import Any, Dict

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
# 訂單項目、付款嘗試、發票、通知（0002_orders_v2）
#
# 只放通用電商能力；站台專屬的履約資料（例如客製商品的生產交接）放站台自己的鏈，
# 以 order_items.id 關聯。orders.items JSONB 仍照舊寫入，未使用新流程的站台不受影響。
#
# 一律新增表、不在 orders 加欄位：Claire 的庫不跑 commerce 鏈，Order 多一個欄位
# 就會讓它查 orders 時直接失敗；新表只有用到時才會被查詢。
# =============================================================================

class OrderCheckout(db.Model):
    """訂單的結帳資訊（1:1）：送出冪等鍵、交易政策同意紀錄、待付款期限。"""
    __tablename__ = 'order_checkouts'
    __table_args__ = {'schema': _SHOP_SCHEMA}

    order_id = db.Column(db.Integer, db.ForeignKey(_q('orders.id', _SHOP_SCHEMA), ondelete='CASCADE'),
                         primary_key=True)
    submission_key = db.Column(db.String(64), unique=True, nullable=False)  # 前端產生，重送同一鍵回原單
    policy_version = db.Column(db.String(32), nullable=True)
    policy_consented_at = db.Column(db.DateTime, nullable=True)
    expires_at = db.Column(db.DateTime, nullable=True, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    order = db.relationship('Order', backref=db.backref('checkout', uselist=False))

    def __repr__(self):
        return f'<OrderCheckout {self.order_id}>'


class OrderItem(db.Model):
    """訂單項目：每項購買一列，提供穩定的對外編號，讓履約、加購能掛在項目上。"""
    __tablename__ = 'order_items'
    __table_args__ = {'schema': _SHOP_SCHEMA}

    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey(_q('orders.id', _SHOP_SCHEMA), ondelete='CASCADE'),
                         nullable=False, index=True)
    item_no = db.Column(db.String(32), unique=True, nullable=False, index=True)
    product_id = db.Column(db.Integer, db.ForeignKey(_q('products.id', _SHOP_SCHEMA), ondelete='SET NULL'),
                           nullable=True, index=True)
    product_code = db.Column(db.String(100), nullable=False)    # 快照：products.product_id
    name = db.Column(db.String(200), nullable=False)            # 快照：下單語系的商品名
    variant = db.Column(db.String(30), nullable=True)           # 站台自訂，例：digital / physical
    kind = db.Column(db.String(20), nullable=False, default='purchase')  # purchase / addon
    parent_item_id = db.Column(db.Integer, db.ForeignKey(_q('order_items.id', _SHOP_SCHEMA), ondelete='SET NULL'),
                               nullable=True, index=True)       # 加購時指向原項目
    unit_price = db.Column(db.Integer, nullable=False)
    currency = db.Column(db.String(10), nullable=False, default='TWD')
    quantity = db.Column(db.Integer, nullable=False, default=1)
    customization = db.Column(JSONB, nullable=False, default=dict)  # 購買者填寫的客製內容快照
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    order = db.relationship('Order', backref=db.backref('order_items', lazy='select', order_by='OrderItem.id'))
    parent_item = db.relationship('OrderItem', remote_side=[id])

    def to_dict(self) -> Dict[str, Any]:
        return {
            'item_no': self.item_no,
            'product_code': self.product_code,
            'name': self.name,
            'variant': self.variant,
            'kind': self.kind,
            'parent_item_no': self.parent_item.item_no if self.parent_item else None,
            'unit_price': self.unit_price,
            'currency': self.currency,
            'quantity': self.quantity,
            'customization': self.customization,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }

    def __repr__(self):
        return f'<OrderItem {self.item_no}>'


class PaymentAttempt(db.Model):
    """每次送往金流（或人工收款）的付款嘗試。

    attempt_no 是對金流的交易編號（綠界 MerchantTradeNo：≤20 字元英數），
    失敗重試就建新的一筆，不重用 order_no。同一訂單最多一筆 succeeded（部分唯一索引）。
    """
    __tablename__ = 'payment_attempts'
    __table_args__ = (
        db.UniqueConstraint('provider', 'provider_trade_no', name='uq_payment_attempts_provider_trade_no'),
        db.Index('uq_payment_attempts_one_success', 'order_id', unique=True,
                 postgresql_where=db.text("status = 'succeeded'")),
        {'schema': _SHOP_SCHEMA},
    )

    id = db.Column(db.Integer, primary_key=True)
    attempt_no = db.Column(db.String(20), unique=True, nullable=False, index=True)
    order_id = db.Column(db.Integer, db.ForeignKey(_q('orders.id', _SHOP_SCHEMA)), nullable=False, index=True)
    provider = db.Column(db.String(20), nullable=False)          # ecpay / manual
    environment = db.Column(db.String(10), nullable=False)       # test / live
    amount = db.Column(db.Integer, nullable=False)
    currency = db.Column(db.String(10), nullable=False, default='TWD')
    status = db.Column(db.String(20), nullable=False, default='created', index=True)
    # created / redirected / succeeded / failed / expired
    provider_trade_no = db.Column(db.String(64), nullable=True)  # 金流端交易編號（綠界 TradeNo）
    paid_at = db.Column(db.DateTime, nullable=True)
    confirmed_by = db.Column(_USER_ID_TYPE, db.ForeignKey(_USER_FK_TARGET), nullable=True)  # 人工收款確認者
    manual_reference = db.Column(db.String(64), nullable=True)   # 人工收款：轉帳末五碼等
    note = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    order = db.relationship('Order', backref=db.backref('payment_attempts', lazy='select'))

    def __repr__(self):
        return f'<PaymentAttempt {self.attempt_no} {self.status}>'


class PaymentNotification(db.Model):
    """金流通知原文與處理結果（每則收到的通知都留一列，含重送與驗證失敗）。"""
    __tablename__ = 'payment_notifications'
    __table_args__ = {'schema': _SHOP_SCHEMA}

    id = db.Column(db.Integer, primary_key=True)
    provider = db.Column(db.String(20), nullable=False)
    environment = db.Column(db.String(10), nullable=False)
    attempt_id = db.Column(db.Integer, db.ForeignKey(_q('payment_attempts.id', _SHOP_SCHEMA), ondelete='SET NULL'),
                           nullable=True, index=True)
    provider_trade_no = db.Column(db.String(64), nullable=True, index=True)
    payload = db.Column(JSONB, nullable=False, default=dict)
    signature_valid = db.Column(db.Boolean, nullable=True)
    result = db.Column(db.String(30), nullable=True)  # processed / duplicate / rejected / ignored
    error = db.Column(db.Text, nullable=True)
    received_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<PaymentNotification {self.provider} {self.result}>'


class OrderInvoice(db.Model):
    """訂單發票：結帳時的開立選項快照與開立結果（站台未開發票功能時 status=not_applicable）。"""
    __tablename__ = 'order_invoices'
    __table_args__ = {'schema': _SHOP_SCHEMA}

    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey(_q('orders.id', _SHOP_SCHEMA), ondelete='CASCADE'),
                         unique=True, nullable=False)
    status = db.Column(db.String(20), nullable=False, default='not_applicable')
    # not_applicable / pending / issued / failed / void
    carrier_type = db.Column(db.String(20), nullable=True)  # member / mobile / citizen / company / donation
    carrier_num = db.Column(db.String(64), nullable=True)
    buyer_tax_id = db.Column(db.String(8), nullable=True)
    buyer_name = db.Column(db.String(100), nullable=True)
    love_code = db.Column(db.String(7), nullable=True)
    notify_email = db.Column(db.String(255), nullable=True)
    invoice_no = db.Column(db.String(10), nullable=True)
    invoice_date = db.Column(db.DateTime, nullable=True)
    random_number = db.Column(db.String(4), nullable=True)
    issued_via = db.Column(db.String(10), nullable=True)    # api / manual
    error = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    order = db.relationship('Order', backref=db.backref('invoice', uselist=False))

    def __repr__(self):
        return f'<OrderInvoice {self.order_id} {self.status}>'


class OrderNotification(db.Model):
    """訂單通知信紀錄；dedupe_key 唯一（例：paid:{order_id}），重送或重試不重複寄信。"""
    __tablename__ = 'order_notifications'
    __table_args__ = {'schema': _SHOP_SCHEMA}

    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey(_q('orders.id', _SHOP_SCHEMA), ondelete='CASCADE'),
                         nullable=False, index=True)
    order_item_id = db.Column(db.Integer, db.ForeignKey(_q('order_items.id', _SHOP_SCHEMA), ondelete='CASCADE'),
                              nullable=True)
    event = db.Column(db.String(50), nullable=False)
    dedupe_key = db.Column(db.String(120), unique=True, nullable=False)
    recipient = db.Column(db.String(255), nullable=False)
    status = db.Column(db.String(20), nullable=False, default='pending')  # pending / sent / failed
    attempts = db.Column(db.Integer, nullable=False, default=0)
    error = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    sent_at = db.Column(db.DateTime, nullable=True)

    def __repr__(self):
        return f'<OrderNotification {self.dedupe_key} {self.status}>'


# =============================================================================
# Exports
# =============================================================================

__all__ = [
    'Product',
    'product_tags',
    'ProductPrice',
    'Order',
    'PaymentMethod',
    'OrderCheckout',
    'OrderItem',
    'PaymentAttempt',
    'PaymentNotification',
    'OrderInvoice',
    'OrderNotification',
]
