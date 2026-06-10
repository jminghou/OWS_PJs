"""
Frontend ISR On-demand Revalidation

後台寫入設定成功後，通知前端（Next.js）立即清除 ISR 頁面快取，
不必等 revalidate 週期到期。

設定（環境變數或 Flask config）：
- FRONTEND_REVALIDATE_URL: 前端 revalidate 端點完整網址
  例如 https://www.clairelab.tw/api/revalidate
- REVALIDATE_SECRET: 與前端 REVALIDATE_SECRET 相同的共享密鑰

兩者任一缺少時靜默跳過（向後相容：未設定的站點行為不變）。
請求在背景執行緒發送且吞掉所有錯誤——快取清除失敗只會讓前端
晚一點更新（回到原本的 ISR 週期），不應影響儲存本身。
"""

import json
import logging
import os
import threading
import urllib.error
import urllib.request

from flask import current_app

logger = logging.getLogger(__name__)

REQUEST_TIMEOUT_SECONDS = 5
DEFAULT_PATHS = ['/', '/[locale]']


def trigger_frontend_revalidate(paths=None):
    """Best-effort 通知前端清除指定路徑的 ISR 快取。

    Args:
        paths: 要清除的路徑列表，預設為首頁（含多語言版）。
    """
    config = current_app.config
    url = config.get('FRONTEND_REVALIDATE_URL') or os.environ.get('FRONTEND_REVALIDATE_URL')
    secret = config.get('REVALIDATE_SECRET') or os.environ.get('REVALIDATE_SECRET')

    if not url or not secret:
        logger.debug(
            'Frontend revalidation skipped: '
            'FRONTEND_REVALIDATE_URL / REVALIDATE_SECRET not configured'
        )
        return

    payload = json.dumps({'paths': paths or DEFAULT_PATHS}).encode('utf-8')

    def _send():
        req = urllib.request.Request(
            url,
            data=payload,
            method='POST',
            headers={
                'Content-Type': 'application/json',
                'X-Revalidate-Secret': secret,
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT_SECONDS) as resp:
                logger.info('Frontend revalidation triggered: HTTP %s (%s)', resp.status, url)
        except (urllib.error.URLError, OSError) as exc:
            logger.warning('Frontend revalidation failed (%s): %s', url, exc)

    threading.Thread(target=_send, daemon=True, name='frontend-revalidate').start()
