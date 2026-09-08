"""電商模組的 Blueprint。獨立於 core 的 api blueprint，但掛在同一個 /api/v1 前綴，路徑不變。"""
from flask import Blueprint

commerce_bp = Blueprint('commerce', __name__)
