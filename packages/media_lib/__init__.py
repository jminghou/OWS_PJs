"""
Media Library Package

輕量化媒體庫，使用 GCS 儲存圖片，支援自動產生多尺寸變體。
可作為 Flask Blueprint 掛載到任何子專案。

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


__all__ = ['register_media_lib', 'media_lib_bp']
