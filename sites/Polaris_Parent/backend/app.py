"""
Polaris Parent Site - Application Entry Point

This module creates the Flask application instance for the Polaris Parent site.
It loads the core engine and registers site-specific extensions.

Usage:
    # Development
    python app.py

    # Production with gunicorn
    gunicorn -w 4 -b 0.0.0.0:5000 "sites.Polaris_Parent.backend.app:app"
"""

import os
import sys

# =============================================================================
# Path Configuration
# =============================================================================

# Get absolute paths
SITE_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
SITE_DIR = os.path.dirname(SITE_BACKEND_DIR)
SITES_DIR = os.path.dirname(SITE_DIR)
PROJECT_ROOT = os.path.dirname(SITES_DIR)

# Add project root and core to Python path for imports
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

# DEBUG: Check if core exists in deployment
print(f"DEBUG: Current directory content: {os.listdir('.')}")
if os.path.exists('core'):
    print(f"DEBUG: core/ content: {os.listdir('core')}")
else:
    print("DEBUG: core/ directory NOT FOUND!")

# =============================================================================
# Imports (after path setup)
# =============================================================================

from core.backend_engine.factory import create_app, BlueprintConfig
from sites.Polaris_Parent.backend.config import config


# =============================================================================
# Configuration
# =============================================================================

def get_config_class():
    """Get configuration class based on environment."""
    config_name = os.environ.get('FLASK_CONFIG', 'development')
    return config.get(config_name, config['default'])


# =============================================================================
# Site-Specific Extensions
# =============================================================================

# Define site-specific blueprints that extend the core functionality
SITE_EXTENSIONS = [
    BlueprintConfig(
        module_path='sites.Polaris_Parent.backend.extensions.astrology',
        url_prefix='/api/v1/astrology',
        enabled=False
    ),
    # Add more site-specific extensions here as needed
    # BlueprintConfig(
    #     module_path='sites.Polaris_Parent.backend.extensions.custom_feature',
    #     url_prefix='/api/v1/custom',
    #     enabled=True
    # ),
]


# =============================================================================
# Initialization Hooks
# =============================================================================

def before_init(app):
    """
    Hook to run before Flask extension initialization.

    Use this to set site-specific config defaults or perform
    pre-initialization setup.
    """
    # Set site-specific defaults
    app.config.setdefault('SITE_NAME', 'Polaris Parent')
    app.config.setdefault('DEFAULT_LANGUAGE', 'zh-TW')
    app.config.setdefault('SUPPORTED_LANGUAGES', ['zh-TW', 'en'])


def after_init(app):
    """
    Hook to run after full Flask initialization.

    Use this to register CLI commands, import site-specific models,
    or perform post-initialization setup.
    """
    # Register site-specific CLI commands
    _register_cli_commands(app)

    # Import site-specific models to register with SQLAlchemy
    # (if you have site-specific models)
    try:
        from sites.Polaris_Parent.backend import models  # noqa: F401
    except ImportError:
        pass  # No site-specific models yet

    # Log successful initialization
    app.logger.info(f"Site '{app.config.get('SITE_NAME')}' initialized successfully")


def _register_cli_commands(app):
    """Register site-specific CLI commands."""
    import click

    @app.cli.command('init-site')
    def init_site():
        """Initialize site-specific data."""
        click.echo('Initializing Polaris Parent site data...')
        # Add site initialization logic here
        click.echo('Done!')

    @app.cli.command('create-admin')
    @click.option('--username', prompt=True, help='Admin username')
    @click.option('--email', prompt=True, help='Admin email')
    @click.option('--password', prompt=True, hide_input=True, confirmation_prompt=True)
    def create_admin(username, email, password):
        """Create an admin user."""
        from core.backend_engine.factory import db
        from core.backend_engine.models import User

        with app.app_context():
            if User.query.filter_by(username=username).first():
                click.echo(f'User {username} already exists!')
                return

            user = User(
                username=username,
                email=email,
                role='admin',
                is_active=True
            )
            user.set_password(password)
            db.session.add(user)
            db.session.commit()
            click.echo(f'Admin user {username} created successfully!')


# =============================================================================
# Application Creation
# =============================================================================

# Create the Flask application instance
app = create_app(
    config_class=get_config_class(),
    site_extensions=SITE_EXTENSIONS,
    skip_blueprints=[],  # Skip none of the core blueprints
    before_init_hooks=[before_init],
    after_init_hooks=[after_init],
)


# =============================================================================
# Development Server
# =============================================================================

if __name__ == '__main__':
    # Get configuration from environment
    host = os.environ.get('FLASK_HOST', '0.0.0.0')
    port = int(os.environ.get('FLASK_PORT', 5000))
    debug = app.config.get('DEBUG', False)

    print(f"""
    ╔══════════════════════════════════════════════════════════════╗
    ║                    Polaris Parent Backend                     ║
    ╠══════════════════════════════════════════════════════════════╣
    ║  Running at: http://{host}:{port}
    ║  Debug mode: {debug}
    ║  Config: {os.environ.get('FLASK_CONFIG', 'development')}
    ╚══════════════════════════════════════════════════════════════╝
    """)

    app.run(
        host=host,
        port=port,
        debug=debug
    )
