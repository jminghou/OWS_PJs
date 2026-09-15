"""Studio 模組的 Blueprint。獨立於 core 的 api blueprint，掛在 /api/v1/studio。"""
from flask import Blueprint

studio_bp = Blueprint('studio', __name__)
