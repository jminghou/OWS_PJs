"""Newsletter 模組的 Blueprint。獨立於 core 的 api blueprint，掛在 /api/v1/newsletter。"""
from flask import Blueprint

newsletter_bp = Blueprint('newsletter', __name__)
