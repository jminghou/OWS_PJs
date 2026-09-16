"""
Happy_Wu — 站台設定

共用設定在 core.backend_engine.site_config.BaseSiteConfig，這裡只寫本站不同的部分。
"""

import os

from dotenv import load_dotenv

SITE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# .env 必須在 import 基底設定**之前**載入：BaseSiteConfig 的欄位在類別定義時就讀
# os.environ，先 import 再 load_dotenv 會讓 .env 裡除了 DATABASE_URL 以外的值全部失效
#（COMMERCE_ENABLED / REDIS_URL / CORS_ORIGINS …）。
# 不加 override=True：平台（Railway / Vercel 等）設定的環境變數應該優先於檔案，
# 否則映像檔裡帶著的 .env 會蓋掉正式環境的設定。
load_dotenv(os.path.join(SITE_DIR, '.env'))

from core.backend_engine.site_config import BaseSiteConfig, make_config_registry  # noqa: E402


class Config(BaseSiteConfig):
    SITE_NAME = os.environ.get('SITE_NAME', 'Happy_Wu')
    SITE_DIR = SITE_DIR


config = make_config_registry(Config, dev_database='ows_happy_wu_dev')
