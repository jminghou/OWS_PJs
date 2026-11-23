"""Social Auth 模組的 Blueprint。獨立於 core 的 api blueprint，掛在 /api/v1/social-auth。"""
from flask import Blueprint

social_auth_bp = Blueprint('social_auth', __name__)
