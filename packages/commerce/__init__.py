"""
電商模組（選用）—— 商品、價格、訂單、付款方式。

自 core 抽出（P-commerce）。掛載由 core factory 的 OPTIONAL_MODULES 依 COMMERCE_ENABLED
決定：既有站台沒設此鍵 → 預設掛載（維持現狀）；新站台由 BaseSiteConfig 預設關閉。

掛載時做三件事：把 model 匯入 metadata、登記 RBAC 權限、註冊 blueprint。
不掛載時三件都不發生 —— 站台不會有電商的表、路由與權限。

資料表由 packages/commerce/migrations 管（版本表 alembic_version_commerce），
部署順序：core 鏈 → commerce 鏈 → 站台鏈。
"""
from packages.commerce.blueprint import commerce_bp

# (code, module, action, name_zh, name_en) —— 與 core rbac_seed.PERMISSIONS 同格式
COMMERCE_PERMISSIONS = [
    ('products.create', 'products', 'create', '建立產品', 'Create Product'),
    ('products.read',   'products', 'read',   '閱讀產品', 'Read Product'),
    ('products.update', 'products', 'update', '更新產品', 'Update Product'),
    ('products.delete', 'products', 'delete', '刪除產品', 'Delete Product'),
    ('orders.read',     'orders',   'read',   '閱讀訂單', 'Read Orders'),
    ('orders.update',   'orders',   'update', '更新訂單', 'Update Orders'),
    ('payment_methods.read',   'payment_methods', 'read',   '閱讀付款方式', 'Read Payment Methods'),
    ('payment_methods.update', 'payment_methods', 'update', '管理付款方式', 'Manage Payment Methods'),
]


def register_commerce(app, db):
    """將電商模組註冊到 Flask app（由 core factory 依 COMMERCE_ENABLED 自動呼叫）。"""
    import packages.commerce.models  # noqa: F401  進 metadata
    from packages.commerce.api import products, orders, payment_methods  # noqa: F401  註冊路由
    from core.backend_engine.services.rbac_seed import register_permissions

    register_permissions(COMMERCE_PERMISSIONS)
    app.register_blueprint(commerce_bp, url_prefix='/api/v1')
    app.logger.info('Registered commerce blueprint at /api/v1')


__all__ = ['register_commerce', 'commerce_bp', 'COMMERCE_PERMISSIONS']
