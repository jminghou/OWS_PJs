"""電商模組管理的資料表清單（對應 packages/commerce/migrations）。"""
COMMERCE_TABLES = frozenset({
    'products', 'product_prices', 'product_tags', 'orders', 'payment_methods',
    # 0002_orders_v2
    'order_checkouts', 'order_items', 'payment_attempts', 'payment_notifications',
    'order_invoices', 'order_notifications',
})
