"""
Polaris Parent Site - Application Entry Point

樣板（路徑設定、config 選擇、model 匯入、媒體庫掛載、CLI、開發伺服器）
全部收斂在 core.backend_engine.site_scaffold。這裡只寫本站真正獨有的事。

Usage:
    python app.py
    gunicorn -w 4 -b 0.0.0.0:5000 "sites.Polaris_Parent.backend.app:app"
"""

import os
import sys

# core 與 packages 的匯入需要專案根目錄在 sys.path 上
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from core.backend_engine.factory import BlueprintConfig  # noqa: E402
from core.backend_engine.site_scaffold import create_site_app, run_dev_server  # noqa: E402
from sites.Polaris_Parent.backend.config import config  # noqa: E402

SITE_NAME = 'Polaris Parent'

# 本站專屬擴充
SITE_EXTENSIONS = [
    # 紫微斗數排盤（領域）
    BlueprintConfig(
        module_path='sites.Polaris_Parent.backend.extensions.astrology',
        url_prefix='/api/v1/astrology',
        enabled=True,
    ),
    # 會員商業循環（訂單登錄 → 審核 → 發券 / 收藏文章）。
    # 路由內部分 /membership/* 與 /admin/*，故掛在 /api/v1 而非子路徑。
    BlueprintConfig(
        module_path='sites.Polaris_Parent.backend.extensions.membership',
        url_prefix='/api/v1',
        enabled=True,
    ),
]

app = create_site_app(
    site_package='sites.Polaris_Parent.backend',
    site_name=SITE_NAME,
    config_registry=config,
    extensions=SITE_EXTENSIONS,
    default_language='zh-TW',
    supported_languages=('zh-TW', 'en'),
)


if __name__ == '__main__':
    run_dev_server(app, SITE_NAME)
