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

Note: Media API has been moved to packages/media_lib (mounted at /api/v1/media-lib)
"""

from flask import Blueprint

bp = Blueprint('api', __name__)

# Import route modules to register them with the blueprint
from core.backend_engine.blueprints.api import (
    auth,
    member_auth,  # 會員註冊/設定密碼（P1 自 Polaris astrology 擴充搬入）
    contents,
    # media,  # Removed: Now handled by packages/media_lib
    settings,
    submissions,
    users,
    members,  # 後台「會員管理」：會員名冊（大量資料：伺服器端搜尋／篩選／分頁）
    authors,
    rbac_admin,
    locale_preview,  # 編輯中語言的預覽通行證
)
