"""
Polaris Parent Site - Configuration

This module defines site-specific configuration classes.
Configurations can be extended or overridden from base settings.

Usage:
    from sites.Polaris_Parent.backend.config import config

    config_class = config.get('development')
"""

import os
from datetime import timedelta
from dotenv import load_dotenv

# =============================================================================
# Environment Setup
# =============================================================================

# Load .env from site directory
SITE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(SITE_DIR, '.env'))


def _require_env(key: str, fallback=None):
    """
    Get required environment variable.

    In production, raises error if key is not set and no fallback provided.
    """
    value = os.environ.get(key)
    if value:
        return value
    if fallback is not None:
        return fallback
    raise RuntimeError(f"Required environment variable '{key}' is not set")


def _bool_env(key: str, default: bool = False) -> bool:
    """Parse boolean environment variable."""
    value = os.environ.get(key, str(default)).lower()
    return value in ['true', 'on', '1', 'yes']


# =============================================================================
# Base Configuration
# =============================================================================

class Config:
    """Base configuration shared by all environments."""

    # -------------------------------------------------------------------------
    # Flask Core
    # -------------------------------------------------------------------------
    SECRET_KEY = os.environ.get('SECRET_KEY')

    # -------------------------------------------------------------------------
    # Database (Primary)
    # -------------------------------------------------------------------------
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL')
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Connection pool settings
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_size': int(os.environ.get('DB_POOL_SIZE', 10)),
        'pool_recycle': int(os.environ.get('DB_POOL_RECYCLE', 3600)),
        'pool_pre_ping': True,
        'max_overflow': int(os.environ.get('DB_MAX_OVERFLOW', 20)),
    }

    # Additional database bindings (site-specific)
    SQLALCHEMY_BINDS = {}
    _astrology_url = os.environ.get('ASTROLOGY_DATABASE_URL')
    if _astrology_url:
        SQLALCHEMY_BINDS['astrology'] = _astrology_url

    # -------------------------------------------------------------------------
    # JWT Authentication
    # -------------------------------------------------------------------------
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY')
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(
        hours=int(os.environ.get('JWT_ACCESS_TOKEN_EXPIRES_HOURS', 1))
    )
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=30)

    # JWT Cookie settings (for frontend integration)
    JWT_TOKEN_LOCATION = ['cookies']
    JWT_COOKIE_SECURE = _bool_env('JWT_COOKIE_SECURE', True)
    JWT_COOKIE_HTTPONLY = True
    JWT_COOKIE_SAMESITE = 'Lax'
    JWT_COOKIE_CSRF_PROTECT = True
    JWT_ACCESS_CSRF_HEADER_NAME = 'X-CSRF-TOKEN'

    # -------------------------------------------------------------------------
    # Mail
    # -------------------------------------------------------------------------
    MAIL_SERVER = os.environ.get('MAIL_SERVER', 'localhost')
    MAIL_PORT = int(os.environ.get('MAIL_PORT', 25))
    MAIL_USE_TLS = _bool_env('MAIL_USE_TLS', False)
    MAIL_USE_SSL = _bool_env('MAIL_USE_SSL', False)
    MAIL_USERNAME = os.environ.get('MAIL_USERNAME')
    MAIL_PASSWORD = os.environ.get('MAIL_PASSWORD')
    MAIL_DEFAULT_SENDER = os.environ.get('MAIL_DEFAULT_SENDER')

    # -------------------------------------------------------------------------
    # File Uploads
    # -------------------------------------------------------------------------
    UPLOAD_FOLDER = os.environ.get('UPLOAD_FOLDER', 'uploads')
    MAX_CONTENT_LENGTH = int(os.environ.get('MAX_CONTENT_LENGTH', 16 * 1024 * 1024))
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp', 'pdf', 'txt', 'doc', 'docx'}

    # -------------------------------------------------------------------------
    # Storage (GCS)
    # -------------------------------------------------------------------------
    GCS_BUCKET_NAME = os.environ.get('GCS_BUCKET_NAME')
    GCS_CREDENTIALS_JSON = os.environ.get('GCS_CREDENTIALS_JSON')
    USE_GCS = GCS_BUCKET_NAME is not None

    # -------------------------------------------------------------------------
    # Redis & Caching
    # -------------------------------------------------------------------------
    REDIS_URL = os.environ.get('REDIS_URL', 'redis://localhost:6379/0')

    # -------------------------------------------------------------------------
    # CORS
    # -------------------------------------------------------------------------
    CORS_ORIGINS = os.environ.get('CORS_ORIGINS', '*').split(',')

    # -------------------------------------------------------------------------
    # Pagination
    # -------------------------------------------------------------------------
    POSTS_PER_PAGE = int(os.environ.get('POSTS_PER_PAGE', 10))
    COMMENTS_PER_PAGE = int(os.environ.get('COMMENTS_PER_PAGE', 20))

    # -------------------------------------------------------------------------
    # Session Security
    # -------------------------------------------------------------------------
    SESSION_COOKIE_SECURE = _bool_env('SESSION_COOKIE_SECURE', True)
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'

    # -------------------------------------------------------------------------
    # Site-Specific Settings
    # -------------------------------------------------------------------------
    SITE_NAME = os.environ.get('SITE_NAME', 'Polaris Parent')
    DEFAULT_LANGUAGE = os.environ.get('DEFAULT_LANGUAGE', 'zh-TW')
    SUPPORTED_LANGUAGES = os.environ.get('SUPPORTED_LANGUAGES', 'zh-TW,en').split(',')

    # Development mode flag (for mock payments, etc.)
    IS_DEV_MODE = _bool_env('IS_DEV_MODE', False)


# =============================================================================
# Development Configuration
# =============================================================================

class DevelopmentConfig(Config):
    """Development environment configuration."""

    DEBUG = True
    IS_DEV_MODE = True

    # Relax security for local development
    SESSION_COOKIE_SECURE = False
    JWT_COOKIE_SECURE = False

    # CORS for local frontend
    CORS_ORIGINS = os.environ.get('CORS_ORIGINS', 'http://localhost:3000').split(',')

    # Allow fallback values in development
    SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'dev-jwt-secret-key')

    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL',
        'postgresql://postgres:postgres@localhost:5432/ows_polaris_dev')

    SQLALCHEMY_BINDS = {
        'astrology': os.environ.get('ASTROLOGY_DATABASE_URL',
            'postgresql://postgres:postgres@localhost:5432/db_pcount_v2')
    }


# =============================================================================
# Production Configuration
# =============================================================================

class ProductionConfig(Config):
    """Production environment configuration."""

    DEBUG = False
    IS_DEV_MODE = False

    # Required in production - no fallbacks
    SECRET_KEY = _require_env('SECRET_KEY')
    JWT_SECRET_KEY = _require_env('JWT_SECRET_KEY')
    SQLALCHEMY_DATABASE_URI = _require_env('DATABASE_URL')

    SQLALCHEMY_BINDS = {}
    _astrology_url = os.environ.get('ASTROLOGY_DATABASE_URL')
    if _astrology_url:
        SQLALCHEMY_BINDS['astrology'] = _astrology_url

    # Production-specific settings
    SESSION_COOKIE_SECURE = True
    JWT_COOKIE_SECURE = True


# =============================================================================
# Testing Configuration
# =============================================================================

class TestingConfig(Config):
    """Testing environment configuration."""

    TESTING = True
    DEBUG = True

    # Use in-memory SQLite for tests
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
    SQLALCHEMY_ENGINE_OPTIONS = {}
    SQLALCHEMY_BINDS = {}

    # Disable CSRF for easier testing
    WTF_CSRF_ENABLED = False
    JWT_COOKIE_CSRF_PROTECT = False

    # Test credentials
    SECRET_KEY = 'testing-secret-key'
    JWT_SECRET_KEY = 'testing-jwt-secret-key'


# =============================================================================
# Configuration Registry
# =============================================================================

config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig
}


# =============================================================================
# Exports
# =============================================================================

__all__ = [
    'Config',
    'DevelopmentConfig',
    'ProductionConfig',
    'TestingConfig',
    'config',
]
