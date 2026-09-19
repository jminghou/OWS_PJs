"""
Newsletter 模組（選用）—— 電子報訂閱名單：公開訂閱、double opt-in 確認、退訂、後台列表與 CSV 匯出。

掛載由 core factory 的 OPTIONAL_MODULES 依 NEWSLETTER_ENABLED 決定，預設**關閉**
（與 Studio 相同：新功能沒有現狀要維持，站台要用就明確打開）。Polaris 的 config 明確開啟。

範圍刻意只到「收名單」：這裡不發電子報，實際發報用後台匯出的 CSV 到外部工具寄。
CSV 每列帶該訂閱者的退訂連結，所以 token 存在資料表裡、永久有效（見 models.py）。

資料表由 packages/newsletter/migrations 管（版本表 alembic_version_newsletter），
表名 `newsletter_` 前綴、落在 BLOG schema。沒有任何外鍵，與其他鏈的先後只是慣例：
core 鏈 → commerce 鏈 → studio 鏈 → **newsletter 鏈** → 站台鏈。
"""
from packages.newsletter.blueprint import newsletter_bp

# (code, module, action, name_zh, name_en) —— 與 core rbac_seed.PERMISSIONS 同格式
NEWSLETTER_PERMISSIONS = [
    ('newsletter.read',   'newsletter', 'read',   '檢視與匯出電子報訂閱者', 'Read and export newsletter subscribers'),
    ('newsletter.manage', 'newsletter', 'manage', '刪除電子報訂閱者',       'Delete newsletter subscribers'),
]


def register_newsletter(app, db):
    """將 Newsletter 模組註冊到 Flask app（由 core factory 依 NEWSLETTER_ENABLED 自動呼叫）。"""
    import packages.newsletter.models  # noqa: F401  進 metadata
    import packages.newsletter.api  # noqa: F401  註冊路由
    from core.backend_engine.services.rbac_seed import register_permissions

    register_permissions(NEWSLETTER_PERMISSIONS)
    app.register_blueprint(newsletter_bp, url_prefix='/api/v1/newsletter')
    app.logger.info('Registered newsletter blueprint at /api/v1/newsletter')


__all__ = ['register_newsletter', 'newsletter_bp', 'NEWSLETTER_PERMISSIONS']
