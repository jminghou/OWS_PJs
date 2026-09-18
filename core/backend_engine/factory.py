"""
OWS Core Engine - Flask Application Factory

This module provides the create_app factory function that supports:
1. Dynamic configuration loading from site-specific config classes
2. Core blueprint registration
3. Site-specific extension mounting
4. Shared Flask extension initialization
"""

import os
import logging
from logging.handlers import RotatingFileHandler
from typing import Type, List, Optional, Callable
from importlib import import_module
from dataclasses import dataclass

from flask import Flask, send_from_directory, abort, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_login import LoginManager
from flask_mail import Mail
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from flask_caching import Cache
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

# =============================================================================
# Shared Extension Instances (Singleton Pattern)
# =============================================================================

db = SQLAlchemy()
migrate = Migrate()
login_manager = LoginManager()
mail = Mail()
jwt = JWTManager()
cache = Cache()
limiter = Limiter(key_func=get_remote_address)


# =============================================================================
# Blueprint Configuration
# =============================================================================

@dataclass
class BlueprintConfig:
    """Configuration for blueprint registration."""
    module_path: str
    url_prefix: Optional[str] = None
    enabled: bool = True


# Core blueprints registry
CORE_BLUEPRINTS: List[BlueprintConfig] = [
    BlueprintConfig('core.backend_engine.blueprints.main', url_prefix=None),
    BlueprintConfig('core.backend_engine.blueprints.auth', url_prefix='/auth'),
    BlueprintConfig('core.backend_engine.blueprints.api', url_prefix='/api/v1'),
    BlueprintConfig('core.backend_engine.blueprints.admin', url_prefix='/admin'),
    BlueprintConfig('core.backend_engine.blueprints.errors', url_prefix=None),
]


# =============================================================================
# Optional Modules
# =============================================================================
# (設定鍵, 預設值, 模組路徑, 註冊函式)。
#
# 預設值的意義：既有站台（Polaris / Claire）的 config 沒有這些鍵，沿用預設 → 維持
# 現狀；新站台由 BaseSiteConfig 明確關閉，要用再打開。這樣 Claire 一行不改也不會
# 失去 /api/v1/products（docs/FROZEN_CONTRACT.md C-1）。
OPTIONAL_MODULES = [
    ('COMMERCE_ENABLED', True, 'packages.commerce', 'register_commerce'),
    # Studio（內容與知識管理）是新功能，沒有「現狀」要維持 → 預設不掛，站台明確打開才有。
    ('STUDIO_ENABLED', False, 'packages.studio', 'register_studio'),
]


def _register_optional_modules(app: Flask) -> None:
    for key, default, module_path, func_name in OPTIONAL_MODULES:
        if not app.config.get(key, default):
            continue
        module = import_module(module_path)
        getattr(module, func_name)(app, db)
        app.logger.info(f'Registered optional module: {module_path} ({key})')



# =============================================================================
# Application Factory
# =============================================================================

def create_app(
    config_class: Type = None,
    site_extensions: List[BlueprintConfig] = None,
    skip_blueprints: List[str] = None,
    before_init_hooks: List[Callable] = None,
    after_init_hooks: List[Callable] = None,
) -> Flask:
    """
    Flask application factory.

    Args:
        config_class: Configuration class to use (required)
        site_extensions: List of site-specific blueprint configurations
        skip_blueprints: List of core blueprint module paths to skip
        before_init_hooks: Callables to run before extension init
        after_init_hooks: Callables to run after full initialization

    Returns:
        Configured Flask application instance

    Example:
        from sites.Polaris_Parent.backend.config import ProductionConfig

        app = create_app(
            config_class=ProductionConfig,
            site_extensions=[
                BlueprintConfig('sites.Polaris_Parent.backend.extensions.astrology', '/api/v1/astrology'),
            ]
        )
    """
    if config_class is None:
        raise ValueError("config_class is required. Pass your site's configuration class.")

    app = Flask(__name__)

    # Load configuration
    app.config.from_object(config_class)

    # Run before-init hooks
    if before_init_hooks:
        for hook in before_init_hooks:
            hook(app)

    # Initialize extensions
    _init_extensions(app)

    # Configure CORS
    _configure_cors(app)

    # Configure caching
    _configure_cache(app)

    # Configure rate limiting
    _configure_rate_limiter(app)

    # Configure login manager
    _configure_login_manager(app)

    # Configure JWT handlers
    _configure_jwt_handlers(app)

    # Register core blueprints
    _register_core_blueprints(app, skip_blueprints or [])

    # 選用模組：core 不靜態 import 它們，靠字串載入 —— 站台不啟用就完全不會被載入
    # （沒有 model 進 metadata、沒有路由、沒有權限）。
    _register_optional_modules(app)

    # Register site extensions
    if site_extensions:
        _register_site_extensions(app, site_extensions)

    # Configure logging
    _configure_logging(app)

    # Configure error handlers
    _configure_error_handlers(app)

    # Configure static file serving
    _configure_static_serving(app)

    # Register shared core CLI commands (seed-rbac, assign-role, ...)
    _register_core_cli(app)

    # Run after-init hooks
    if after_init_hooks:
        for hook in after_init_hooks:
            hook(app)

    return app


# =============================================================================
# Extension Initialization
# =============================================================================

def _init_extensions(app: Flask) -> None:
    """Initialize Flask extensions with the app."""

    db.init_app(app)

    # Import route modules so SQLAlchemy registers all models on db.metadata
    # (model 定義在 models.py，這些 route module 會連帶 import 它們)。
    # 注意：schema 由 migration 管理 (flask db upgrade)，啟動時不再 db.create_all()，
    # 以避免與 migration 產生 schema drift。
    from core.backend_engine.blueprints.api import auth, users, settings, contents  # noqa: F401

    migrate.init_app(app, db)
    jwt.init_app(app)
    login_manager.init_app(app)
    mail.init_app(app)


def _configure_cors(app: Flask) -> None:
    """Configure CORS based on app config."""
    cors_origins = app.config.get('CORS_ORIGINS', ['*'])
    CORS(
        app,
        resources={r"/api/*": {"origins": cors_origins}},
        supports_credentials=True,
        allow_headers=["Content-Type", "X-CSRF-TOKEN", "Authorization"],
        methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    )


def _probe_redis(redis_url: str, timeout: float = 0.5):
    """用短逾時實際 ping 一次 Redis；連得上回傳 client，連不上回 None。

    為什麼要先 ping：flask-caching 的 RedisCache 初始化時不會連線，設了 REDIS_URL 但
    Redis 沒開的話不會有任何錯誤，而是「每個請求」在 get/set 時各等一次連線逾時
    （Windows 上實測約 4 秒一次），整站看起來像卡住。這裡在啟動時就決定好用哪個後端。
    回傳的 client 也帶了逾時，Redis 中途掛掉時最多只拖 timeout 秒，不會拖 4 秒。
    """
    try:
        import redis
        client = redis.from_url(
            redis_url,
            socket_connect_timeout=timeout,
            socket_timeout=timeout,
        )
        client.ping()
        return client
    except Exception as e:  # 連線失敗、套件缺失、URL 格式錯都退回 SimpleCache
        logging.getLogger(__name__).warning(f"Redis unavailable ({e.__class__.__name__}: {e}); falling back")
        return None


def _configure_cache(app: Flask) -> None:
    """Configure caching (Redis if reachable, else SimpleCache)."""
    redis_url = app.config.get('REDIS_URL')
    # KEY_PREFIX 讓 cache.clear() 只刪我們的回應快取，不會誤清同一個 Redis 上的
    # rate-limiter / 其他資料（否則 RedisCache.clear() 會 flushdb 整顆 DB）。
    client = _probe_redis(redis_url) if redis_url else None
    app.config['REDIS_AVAILABLE'] = client is not None
    if client is not None:
        # 直接交 client 物件給 cachelib（CACHE_REDIS_HOST 可接 client），才能帶上逾時設定
        cache.init_app(app, config={
            'CACHE_TYPE': 'RedisCache',
            'CACHE_REDIS_HOST': client,
            'CACHE_DEFAULT_TIMEOUT': 300,
            'CACHE_KEY_PREFIX': 'ows_cache:',
        })
        app.logger.info("Cache initialized with Redis backend")
    else:
        cache.init_app(app, config={'CACHE_TYPE': 'SimpleCache', 'CACHE_KEY_PREFIX': 'ows_cache:'})
        if redis_url:
            app.logger.warning("REDIS_URL is set but Redis is unreachable; using in-memory SimpleCache")
        else:
            app.logger.info("Cache initialized with SimpleCache backend")


def _configure_rate_limiter(app: Flask) -> None:
    """Configure rate limiter with Redis backend if reachable (else in-memory)."""
    redis_url = app.config.get('REDIS_URL')
    limiter.init_app(app)
    if redis_url and app.config.get('REDIS_AVAILABLE'):
        limiter._storage_uri = redis_url


def _configure_login_manager(app: Flask) -> None:
    """Configure Flask-Login."""
    login_manager.login_view = 'auth.login'
    login_manager.login_message = app.config.get('LOGIN_MESSAGE', '請登錄以訪問此頁面。')
    login_manager.login_message_category = 'info'

    @login_manager.user_loader
    def load_user(user_id):
        from core.backend_engine.models import User
        return User.query.get(int(user_id))


def _configure_jwt_handlers(app: Flask) -> None:
    """Configure JWT error handlers."""

    @jwt.expired_token_loader
    def expired_token_callback(jwt_header, jwt_payload):
        return jsonify({
            'message': 'Token has expired',
            'error': 'token_expired'
        }), 401

    @jwt.invalid_token_loader
    def invalid_token_callback(error):
        return jsonify({
            'message': 'Invalid token',
            'error': 'invalid_token'
        }), 401

    @jwt.unauthorized_loader
    def missing_token_callback(error):
        return jsonify({
            'message': 'Request does not contain an access token',
            'error': 'authorization_required'
        }), 401


# =============================================================================
# Blueprint Registration
# =============================================================================

def _register_core_blueprints(app: Flask, skip_blueprints: List[str]) -> None:
    """Register core blueprints, skipping any in skip_blueprints list."""
    for bp_config in CORE_BLUEPRINTS:
        if not bp_config.enabled or bp_config.module_path in skip_blueprints:
            app.logger.info(f"Skipping blueprint: {bp_config.module_path}")
            continue

        try:
            module = import_module(bp_config.module_path)
            bp = getattr(module, 'bp', None)
            if bp is None:
                app.logger.warning(f"No 'bp' found in {bp_config.module_path}")
                continue

            app.register_blueprint(bp, url_prefix=bp_config.url_prefix)
            app.logger.info(f"Registered core blueprint: {bp_config.module_path} at {bp_config.url_prefix or '/'}")
        except ImportError as e:
            app.logger.error(f"Failed to import blueprint {bp_config.module_path}: {e}")


def _register_site_extensions(app: Flask, extensions: List[BlueprintConfig]) -> None:
    """Register site-specific extension blueprints."""
    for ext_config in extensions:
        if not ext_config.enabled:
            continue

        try:
            module = import_module(ext_config.module_path)
            bp = getattr(module, 'bp', None)
            if bp is None:
                app.logger.warning(f"No 'bp' found in {ext_config.module_path}")
                continue

            app.register_blueprint(bp, url_prefix=ext_config.url_prefix)
            app.logger.info(f"Registered site extension: {ext_config.module_path} at {ext_config.url_prefix or '/'}")
        except ImportError as e:
            app.logger.error(f"Failed to import extension {ext_config.module_path}: {e}")


# =============================================================================
# Logging Configuration
# =============================================================================

def _configure_logging(app: Flask) -> None:
    """Configure application logging."""
    log_level = os.environ.get('LOG_LEVEL', 'INFO').upper()
    log_file = os.environ.get('LOG_FILE')

    formatter = logging.Formatter(
        '[%(asctime)s] %(levelname)s in %(module)s: %(message)s'
    )

    app.logger.setLevel(getattr(logging, log_level, logging.INFO))

    if log_file:
        log_dir = os.path.dirname(log_file)
        if log_dir and not os.path.exists(log_dir):
            os.makedirs(log_dir, exist_ok=True)
        file_handler = RotatingFileHandler(
            log_file, maxBytes=10 * 1024 * 1024, backupCount=5
        )
        file_handler.setFormatter(formatter)
        file_handler.setLevel(getattr(logging, log_level, logging.INFO))
        app.logger.addHandler(file_handler)

    if not app.debug:
        stream_handler = logging.StreamHandler()
        stream_handler.setFormatter(formatter)
        stream_handler.setLevel(getattr(logging, log_level, logging.INFO))
        app.logger.addHandler(stream_handler)


# =============================================================================
# Error Handlers
# =============================================================================

def _configure_error_handlers(app: Flask) -> None:
    """Configure global error handlers."""

    @app.errorhandler(400)
    def bad_request(error):
        return jsonify({'error': 'Bad Request', 'message': str(error.description)}), 400

    @app.errorhandler(401)
    def unauthorized(error):
        return jsonify({'error': 'Unauthorized', 'message': str(error.description)}), 401

    @app.errorhandler(403)
    def forbidden(error):
        return jsonify({'error': 'Forbidden', 'message': str(error.description)}), 403

    @app.errorhandler(404)
    def not_found(error):
        return jsonify({'error': 'Not Found', 'message': str(error.description)}), 404

    @app.errorhandler(500)
    def internal_error(error):
        app.logger.error(f"Internal Server Error: {error}")
        return jsonify({'error': 'Internal Server Error', 'message': 'An unexpected error occurred'}), 500


# =============================================================================
# Core CLI Commands (shared by all sites)
# =============================================================================

def _register_core_cli(app: Flask) -> None:
    """Register RBAC-related CLI commands available to every site."""
    import click

    @app.cli.command('seed-rbac')
    def seed_rbac_command():
        """Seed / sync RBAC permissions, roles and role-permission mappings (idempotent)."""
        from core.backend_engine.services.rbac_seed import seed_rbac
        stats = seed_rbac(db)
        click.echo(
            f"RBAC seeded: +{stats['permissions_added']} permissions, "
            f"+{stats['roles_added']} roles, +{stats['role_perms_added']} role-perms, "
            f"+{stats['user_roles_added']} user-roles."
        )

    @app.cli.command('flush-views')
    def flush_views_command():
        """Flush pending view counts from Redis into the DB (cron 友善)。"""
        from core.backend_engine.services.view_counter import flush_views
        updated, total = flush_views(db)
        click.echo(f"Flushed views: {updated} contents, +{total} total views.")

    @app.cli.command('assign-role')
    @click.argument('username')
    @click.argument('role_code')
    def assign_role_command(username, role_code):
        """Assign a role to a user. Usage: flask assign-role <username> <role_code>"""
        from core.backend_engine.models import User
        from core.backend_engine.services.rbac import RBACService

        user = User.query.filter_by(username=username).first()
        if not user:
            click.echo(f"User '{username}' not found.")
            return
        try:
            RBACService.assign_role(user.id, role_code)
            click.echo(f"Assigned role '{role_code}' to user '{username}'.")
        except ValueError as e:
            click.echo(f"Error: {e}")


# =============================================================================
# Static File Serving
# =============================================================================

def _configure_static_serving(app: Flask) -> None:
    """Configure static file serving for uploads."""

    @app.route('/uploads/<path:filename>')
    def uploaded_file(filename):
        # Path traversal protection
        if '..' in filename or filename.startswith('/'):
            abort(403)

        # Get uploads directory from config or default
        uploads_folder = app.config.get('UPLOAD_FOLDER', 'uploads')
        if os.path.isabs(uploads_folder):
            uploads_dir = uploads_folder
        else:
            uploads_dir = os.path.abspath(os.path.join(app.root_path, '..', uploads_folder))

        # Ensure resolved path is within uploads directory
        full_path = os.path.abspath(os.path.join(uploads_dir, filename))
        if not full_path.startswith(uploads_dir):
            abort(403)

        return send_from_directory(uploads_dir, filename)


# =============================================================================
# Exports
# =============================================================================

__all__ = [
    'create_app',
    'BlueprintConfig',
    'db',
    'migrate',
    'login_manager',
    'mail',
    'jwt',
    'cache',
    'limiter',
]
