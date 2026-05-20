"""
Media Library Package

輕量化媒體庫，支援 Local 本地儲存和 GCS 雲端儲存。
自動產生多尺寸圖片變體（thumbnail, small, medium, large, hero）。
可作為 Flask Blueprint 掛載到任何子專案。

Storage backend 透過 Flask config 自動選擇：
- 有 GCS_BUCKET_NAME → GCS 模式
- 無 GCS_BUCKET_NAME → Local 模式（UPLOAD_FOLDER）

Usage:
    from packages.media_lib import register_media_lib
    register_media_lib(app, db)
"""

from packages.media_lib.blueprint import media_lib_bp


def register_media_lib(app, db):
    """
    將媒體庫註冊到 Flask app。

    Args:
        app: Flask application instance
        db: SQLAlchemy instance
    """
    # 匯入 models 讓 SQLAlchemy 在 db.metadata 註冊媒體庫資料表
    # （schema 與資料表由 migration 建立，啟動時不再 CREATE SCHEMA / create_all）。
    import packages.media_lib.models  # noqa: F401

    # 註冊 Blueprint
    app.register_blueprint(media_lib_bp, url_prefix='/api/v1/media-lib')
    app.logger.info('Registered media-lib blueprint at /api/v1/media-lib')

    # 註：Local 模式的 /uploads/<path> serve 路由由 core factory 的
    # _configure_static_serving() 統一註冊，這裡不再重複註冊以免路由衝突。


__all__ = ['register_media_lib', 'media_lib_bp']
