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

import os
from flask import send_from_directory, abort

from packages.media_lib.blueprint import media_lib_bp


def register_media_lib(app, db):
    """
    將媒體庫註冊到 Flask app。

    Args:
        app: Flask application instance
        db: SQLAlchemy instance
    """
    # 建立 media_lib schema（如果不存在）
    with app.app_context():
        from sqlalchemy import text
        with db.engine.connect() as conn:
            conn.execute(text('CREATE SCHEMA IF NOT EXISTS media_lib'))
            conn.commit()

        # 匯入 models 讓 SQLAlchemy 認識，然後建表
        import packages.media_lib.models  # noqa: F401
        db.create_all()

    # 註冊 Blueprint
    app.register_blueprint(media_lib_bp, url_prefix='/api/v1/media-lib')
    app.logger.info('Registered media-lib blueprint at /api/v1/media-lib')

    # 註冊本地檔案 serve 路由（僅 Local 模式需要）
    _register_uploads_route(app)


def _register_uploads_route(app):
    """
    註冊 /uploads/<path> 路由，讓 Local 模式下的媒體檔案可被前端存取。
    GCS 模式下此路由仍存在但不會被使用（圖片 URL 指向 GCS）。
    """
    uploads_folder = app.config.get('UPLOAD_FOLDER', 'uploads')
    if os.path.isabs(uploads_folder):
        base_path = uploads_folder
    else:
        base_path = os.path.abspath(
            os.path.join(app.root_path, '..', uploads_folder)
        )

    @app.route('/uploads/<path:filepath>')
    def serve_uploads(filepath):
        """Serve uploaded files from local storage."""
        # Security: prevent path traversal
        safe_path = os.path.abspath(os.path.join(base_path, filepath))
        if not safe_path.startswith(os.path.abspath(base_path)):
            abort(403)

        directory = os.path.dirname(safe_path)
        filename = os.path.basename(safe_path)

        if not os.path.exists(safe_path):
            abort(404)

        return send_from_directory(directory, filename)


__all__ = ['register_media_lib', 'media_lib_bp']
