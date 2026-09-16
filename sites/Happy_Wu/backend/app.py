"""
Happy_Wu — Application Entry Point

樣板全部在 core.backend_engine.site_scaffold；這裡只寫本站真正獨有的事。

Usage:
    python app.py
    gunicorn -w 4 -b 0.0.0.0:5010 "sites.Happy_Wu.backend.app:app"
"""

import os
import sys

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from core.backend_engine.site_scaffold import create_site_app, run_dev_server  # noqa: E402
from sites.Happy_Wu.backend.config import config  # noqa: E402

SITE_NAME = 'Happy_Wu'

# 站台專屬擴充。範例：
#     BlueprintConfig(
#         module_path='sites.Happy_Wu.backend.extensions.my_feature',
#         url_prefix='/api/v1/my-feature',
#     )
SITE_EXTENSIONS = []

app = create_site_app(
    site_package='sites.Happy_Wu.backend',
    site_name=SITE_NAME,
    config_registry=config,
    extensions=SITE_EXTENSIONS,
)


if __name__ == '__main__':
    run_dev_server(app, SITE_NAME)
