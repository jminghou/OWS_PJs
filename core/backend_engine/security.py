"""
請求來源與防機器人：真實使用者 IP、Cloudflare Turnstile 驗證。

真實 IP（client_ip）——限流的 key：
  正式站前面有代理，request.remote_addr 是代理的位址（Railway 內網 100.64.x），所有人共用一個限流桶。
  2026-10-16 實測正式站的路徑與 header（/api/v1/settings/request-origin）：
    直連 api.polaris-parent.com：瀏覽器 → Cloudflare → Railway。X-Forwarded-For 被改寫成
      「Cloudflare IP, Railway 邊緣 IP」，看不到使用者；Railway 設的 X-Real-IP 才是使用者 IP，
      而且帶偽造的 X-Real-IP／CF-Connecting-IP 進來會被 Cloudflare 擋（403）或被 Railway 覆寫。
    官網 www 的 /api/v1/*：瀏覽器 → Vercel rewrite → Cloudflare → Railway。使用者 IP 在 Vercel 那層就
      丟了，X-Real-IP 變成 Vercel 的出口 IP（所有訪客同一個）。所以 Vercel middleware 把它收到的使用者 IP
      放進 X-OWS-Client-IP，連同 X-OWS-Edge-Secret（＝EDGE_PROXY_SECRET）一起送；密鑰正確才採信。
  CLIENT_IP_HEADER：信任哪個由自家邊緣設定的 header（Railway＝X-Real-IP）；沒設＝沿用 remote_addr
  （本機、測試、其他站台行為不變）。

Turnstile（require_turnstile）：
  會寄信給任意 Email 的公開端點（取驗證碼、訂閱電子報）要先通過 Cloudflare Turnstile。
  token 由前端放在 X-Turnstile-Token header 或 JSON 的 turnstile_token。
  沒設 TURNSTILE_SECRET_KEY 就略過（本機、測試、尚未申請的站台）。
"""

import hmac
import json
import urllib.error
import urllib.parse
import urllib.request
from functools import wraps

from flask import current_app, jsonify, request

TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
EDGE_SECRET_HEADER = 'X-OWS-Edge-Secret'
TURNSTILE_HEADER = 'X-Turnstile-Token'


CLIENT_IP_FORWARD_HEADER = 'X-OWS-Client-IP'


def edge_secret_valid() -> bool:
    secret = current_app.config.get('EDGE_PROXY_SECRET') or ''
    sent = request.headers.get(EDGE_SECRET_HEADER, '')
    return bool(secret) and hmac.compare_digest(sent.encode(), secret.encode())


def client_ip() -> str:
    """限流與記錄用的使用者 IP；判斷規則見模組說明。"""
    if edge_secret_valid():
        forwarded = request.headers.get(CLIENT_IP_FORWARD_HEADER, '').strip()
        if forwarded:
            return forwarded
    header = current_app.config.get('CLIENT_IP_HEADER')
    if header:
        value = request.headers.get(header, '').split(',')[0].strip()
        if value:
            return value
    return request.remote_addr or '127.0.0.1'


def request_origin_info() -> dict:
    """診斷用：後端實際收到的來源資訊（管理員端點 /api/v1/settings/request-origin 回傳）。"""
    return {
        'client_ip': client_ip(),
        'remote_addr': request.remote_addr,
        'x_forwarded_for': request.headers.get('X-Forwarded-For'),
        'x_real_ip': request.headers.get('X-Real-IP'),
        'cf_connecting_ip': request.headers.get('CF-Connecting-IP'),
        'x_ows_client_ip': request.headers.get(CLIENT_IP_FORWARD_HEADER),
        'edge_secret_valid': edge_secret_valid(),
        'client_ip_header': current_app.config.get('CLIENT_IP_HEADER'),
    }


def verify_turnstile(token: str) -> tuple[bool, str]:
    """回 (通過與否, 給使用者看的錯誤訊息)。沒設密鑰一律通過。"""
    secret = current_app.config.get('TURNSTILE_SECRET_KEY')
    if not secret:
        return True, ''
    if not token:
        return False, '請先完成「我不是機器人」驗證'
    body = urllib.parse.urlencode({'secret': secret, 'response': token, 'remoteip': client_ip()}).encode()
    try:
        with urllib.request.urlopen(urllib.request.Request(TURNSTILE_VERIFY_URL, data=body), timeout=5) as resp:
            result = json.loads(resp.read() or b'{}')
    except (urllib.error.URLError, ValueError) as exc:
        # 驗證服務連不上時不放行：寧可暫時擋住註冊，也不讓這段時間變成濫用破口
        current_app.logger.error(f'Turnstile 驗證服務無法連線：{exc}')
        return False, '驗證服務暫時無法使用，請稍後再試'
    if result.get('success'):
        return True, ''
    current_app.logger.info(f"Turnstile 驗證未通過：{result.get('error-codes')}")
    return False, '「我不是機器人」驗證未通過或已過期，請重新驗證'


def require_turnstile(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        data = request.get_json(silent=True) or {}
        token = request.headers.get(TURNSTILE_HEADER) or data.get('turnstile_token') or ''
        ok, message = verify_turnstile(token)
        if not ok:
            return jsonify({'success': False, 'error': message, 'code': 'turnstile_failed',
                            'errors': {'turnstile': 'failed'}}), 400
        return fn(*args, **kwargs)
    return wrapper
