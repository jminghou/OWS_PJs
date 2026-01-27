"""
Polaris Parent Site - Extensions Package

This package contains site-specific extensions (Blueprints)
that extend the core functionality.

Each extension should:
1. Define a Flask Blueprint named 'bp'
2. Be registered in the site's app.py SITE_EXTENSIONS list

Example extension structure:
    extensions/
    ├── __init__.py
    ├── astrology/
    │   ├── __init__.py
    │   ├── routes.py
    │   └── models.py
    └── custom_feature/
        ├── __init__.py
        └── routes.py
"""
