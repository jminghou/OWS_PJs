"""
Core API Blueprint

This blueprint provides RESTful API endpoints for:
- Authentication (JWT)
- Contents (CRUD)
- Categories
- Tags
- Users
- Media
- Products
- Orders
- Settings
- E-commerce
"""

from flask import Blueprint

bp = Blueprint('api', __name__)

# Import route modules to register them with the blueprint
from core.backend_engine.blueprints.api import (
    auth,
    contents,
    media,
    settings,
    submissions,
    users,
    ecommerce,
    orders,
    products,
)
