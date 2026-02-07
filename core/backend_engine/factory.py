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

    # Register site extensions
    if site_extensions:
        _register_site_extensions(app, site_extensions)

    # Configure logging
    _configure_logging(app)

    # Configure error handlers
    _configure_error_handlers(app)

    # Configure static file serving
    _configure_static_serving(app)

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

    
    # 這是最標準的寫法，它會自動讀取 Railway 的環境變數
    db.init_app(app)

    # 註冊 Blueprints
    from core.backend_engine.blueprints.api import auth, users, settings, contents, categories, media

    migrate.init_app(app, db)
    jwt.init_app(app)

    migrate.init_app(app, db)
    login_manager.init_app(app)
    mail.init_app(app)
    jwt.init_app(app)


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


def _configure_cache(app: Flask) -> None:
    """Configure caching (Redis if available, else SimpleCache)."""
    redis_url = app.config.get('REDIS_URL')
    if redis_url:
        try:
            cache.init_app(app, config={
                'CACHE_TYPE': 'RedisCache',
                'CACHE_REDIS_URL': redis_url,
                'CACHE_DEFAULT_TIMEOUT': 300
            })
            app.logger.info("Cache initialized with Redis backend")
        except Exception as e:
            app.logger.warning(f"Redis cache failed, falling back to SimpleCache: {e}")
            cache.init_app(app, config={'CACHE_TYPE': 'SimpleCache'})
    else:
        cache.init_app(app, config={'CACHE_TYPE': 'SimpleCache'})
        app.logger.info("Cache initialized with SimpleCache backend")


def _configure_rate_limiter(app: Flask) -> None:
    """Configure rate limiter with Redis backend if available."""
    redis_url = app.config.get('REDIS_URL')
    limiter.init_app(app)
    if redis_url:
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
