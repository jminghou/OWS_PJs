"""
Core API Blueprint

This blueprint provides RESTful API endpoints for:
- Authentication (JWT)
- Contents (CRUD)
- Categories
- Tags
- Users
- Products
- Orders
- Settings
- E-commerce

Note: Media API has been moved to Strapi (see packages/strapi-media)
"""

from flask import Blueprint

bp = Blueprint('api', __name__)

# Import route modules to register them with the blueprint
from core.backend_engine.blueprints.api import (
    auth,
    contents,
    # media,  # Removed: Now handled by Strapi Media Hub
    settings,
    submissions,
    users,
    ecommerce,
    orders,
    products,
)
