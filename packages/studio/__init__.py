"""
Studio 模組（選用）—— 個人內容與知識管理：內容專案、收集箱、知識卡片、版本、發布中心、標籤、搜尋。

掛載由 core factory 的 OPTIONAL_MODULES 依 STUDIO_ENABLED 決定，預設**關閉**
（與電商不同：電商為了維持既有站台現狀預設掛載；Studio 是新功能，沒有現狀要維持，
所以每個站台都要明確打開）。Polaris 的 config 明確開啟。

掛載時做三件事：把 model 匯入 metadata、登記 RBAC 權限、註冊 blueprint。
不掛載時三件都不發生 —— 站台不會有 Studio 的表、路由與權限。

資料表由 packages/studio/migrations 管（版本表 alembic_version_studio），
表名一律 `studio_` 前綴、落在 BLOG schema —— 與 core 的 tags / contents 同 schema
也不會撞名，站台不需要為它多設一個 schema 環境變數。
部署順序：core 鏈 → commerce 鏈 → **studio 鏈** → 站台鏈
（studio_documents.content_id 指向 core 的 contents，studio_inbox_items.file_id 指向 media_lib.files）。
"""
from packages.studio.blueprint import studio_bp

# (code, module, action, name_zh, name_en) —— 與 core rbac_seed.PERMISSIONS 同格式
STUDIO_PERMISSIONS = [
    ('studio.read',  'studio', 'read',  '閱讀 Studio', 'Read Studio'),
    ('studio.write', 'studio', 'write', '編輯 Studio', 'Write Studio'),
]


def register_studio(app, db):
    """將 Studio 模組註冊到 Flask app（由 core factory 依 STUDIO_ENABLED 自動呼叫）。"""
    import packages.studio.models  # noqa: F401  進 metadata
    import packages.studio.api  # noqa: F401  註冊路由
    from core.backend_engine.services.rbac_seed import register_permissions

    register_permissions(STUDIO_PERMISSIONS)
    app.register_blueprint(studio_bp, url_prefix='/api/v1/studio')
    app.logger.info('Registered studio blueprint at /api/v1/studio')


__all__ = ['register_studio', 'studio_bp', 'STUDIO_PERMISSIONS']
