"""
E-commerce Schemas

Provides serialization for e-commerce related models:
- ProductPrice
- Product
- Order
- PaymentMethod
"""

from marshmallow import Schema, fields

from core.backend_engine.schemas.media import MediaSchema


class ProductPriceSchema(Schema):
    """Schema for ProductPrice model serialization.

    Fields:
        id: Price ID (read-only)
        product_id: Associated product ID
        currency: Currency code (TWD, USD, etc.)
        price: Price amount
        original_price: Original price (for discounts)
        is_active: Price active status
    """
    id = fields.Int(dump_only=True)
    product_id = fields.Int()
    currency = fields.Str()
    price = fields.Int()
    original_price = fields.Int()
    is_active = fields.Bool()


class ProductSchema(Schema):
    """Schema for Product model serialization.

    Fields:
        id: Product ID (read-only)
        product_id: Product SKU/code
        names: Multi-language names (JSON)
        descriptions: Multi-language descriptions (JSON)
        short_descriptions: Multi-language short descriptions (JSON)
        price: Default price (TWD)
        original_price: Original price (for discounts)
        stock_quantity: Available stock (-1 for unlimited)
        stock_status: Stock status (in_stock/out_of_stock/preorder)
        featured_image_id: Featured image media ID
        gallery_images: Gallery image IDs (JSON array)
        category_id: Category ID
        is_active: Product active status
        is_featured: Featured product flag
        sort_order: Display order
        language: Product language
        original_id: Original product ID for translations
        views_count: View count
        sales_count: Sales count
        meta_title: SEO meta title
        meta_description: SEO meta description
        detail_content_id: Related content ID for product details
        created_at: Creation timestamp (read-only)
        updated_at: Last update timestamp (read-only)
        attributes: Custom attributes (JSONB)

    Nested:
        featured_image: Featured image info
        prices: Multi-currency prices
    """
    id = fields.Int(dump_only=True)
    product_id = fields.Str()
    names = fields.Dict()
    descriptions = fields.Dict()
    short_descriptions = fields.Dict()
    price = fields.Int()
    original_price = fields.Int()
    stock_quantity = fields.Int()
    stock_status = fields.Str()
    featured_image_id = fields.Int()
    gallery_images = fields.List(fields.Int())
    category_id = fields.Int()
    is_active = fields.Bool()
    is_featured = fields.Bool()
    sort_order = fields.Int()
    language = fields.Str()
    original_id = fields.Int()
    views_count = fields.Int()
    sales_count = fields.Int()
    meta_title = fields.Str()
    meta_description = fields.Str()
    detail_content_id = fields.Int()
    created_at = fields.DateTime(dump_only=True)
    updated_at = fields.DateTime(dump_only=True)
    attributes = fields.Dict()  # JSONB field

    # Nested relationships
    featured_image = fields.Nested(MediaSchema, only=("id", "file_path"))
    prices = fields.List(fields.Nested(ProductPriceSchema))


class OrderSchema(Schema):
    """Schema for Order model serialization.

    Fields:
        id: Order ID (read-only)
        order_no: Order number
        user_id: Customer user ID
        amount: Total amount
        status: Order status (pending/paid/shipped/completed/cancelled/failed)
        items: Order items (JSON array)
        language: Order language
        currency: Order currency
        payment_method: Payment method code
        shipping_info: Shipping information (JSON)
        notes: Order notes
        created_at: Creation timestamp (read-only)
        paid_at: Payment timestamp
        attributes: Custom attributes (JSONB)
    """
    id = fields.Int(dump_only=True)
    order_no = fields.Str()
    user_id = fields.Int()
    amount = fields.Int()
    status = fields.Str()
    items = fields.List(fields.Dict())
    language = fields.Str()
    currency = fields.Str()
    payment_method = fields.Str()
    shipping_info = fields.Dict()
    notes = fields.Str()
    created_at = fields.DateTime(dump_only=True)
    paid_at = fields.DateTime()
    attributes = fields.Dict()  # JSONB field


class PaymentMethodSchema(Schema):
    """Schema for PaymentMethod model serialization.

    Fields:
        id: Payment method ID (read-only)
        code: Payment method code
        name: Multi-language names (JSON)
        description: Multi-language descriptions (JSON)
        supported_currencies: Supported currency codes
        is_active: Active status
        sort_order: Display order
        config: Configuration (read-only, for security)
    """
    id = fields.Int(dump_only=True)
    code = fields.Str()
    name = fields.Dict()
    description = fields.Dict()
    supported_currencies = fields.List(fields.String())
    is_active = fields.Bool()
    sort_order = fields.Int()
    config = fields.Dict(dump_only=True)  # Only dump, never load for security
