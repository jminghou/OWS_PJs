"""
請求來源與防機器人：真實使用者 IP、Cloudflare Turnstile 驗證。

真實 IP（client_ip）——限流的 key：
  正式站前面有代理，request.remote_addr 是代理的位址（Railway 內網 100.64.x），所有人共用一個限流桶。
  CLIENT_IP_PROXY_HOPS＝N：信任 X-Forwarded-For 最右邊 N 段是我們自己的代理加的，取倒數第 N 段。
    Railway 的邊緣代理會把連線來源附加在最右邊，所以直連後端時設 1 就是使用者 IP。
  官網的 /api/v1/* 先經 Vercel rewrite 才到後端，最右邊會是 Vercel 的出口 IP（所有訪客同一個）。
    Vercel 的 middleware 帶上 X-OWS-Edge-Secret（與 EDGE_PROXY_SECRET 相同）時，多信任一段，
    取 Vercel 填的使用者 IP；沒帶或不符就不多信任，偽造 X-Forwarded-For 無效。
  預設 0＝沿用 remote_addr（本機、測試、其他站台行為不變）。

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


def _forwarded_chain():
    return [p.strip() for p in request.headers.get('X-Forwarded-For', '').split(',') if p.strip()]


def edge_secret_valid() -> bool:
    secret = current_app.config.get('EDGE_PROXY_SECRET') or ''
    sent = request.headers.get(EDGE_SECRET_HEADER, '')
    return bool(secret) and hmac.compare_digest(sent.encode(), secret.encode())


def client_ip() -> str:
    """限流與記錄用的使用者 IP；判斷規則見模組說明。"""
    hops = int(current_app.config.get('CLIENT_IP_PROXY_HOPS') or 0)
    remote = request.remote_addr or '127.0.0.1'
    if hops <= 0:
        return remote
    if edge_secret_valid():
        hops += 1
    chain = _forwarded_chain()
    if len(chain) >= hops:
        return chain[-hops]
    return chain[0] if chain else remote


def request_origin_info() -> dict:
    """診斷用：後端實際收到的來源資訊（管理員端點 /api/v1/admin/request-origin 回傳）。"""
    return {
        'client_ip': client_ip(),
        'remote_addr': request.remote_addr,
        'x_forwarded_for': request.headers.get('X-Forwarded-For'),
        'x_real_ip': request.headers.get('X-Real-IP'),
        'cf_connecting_ip': request.headers.get('CF-Connecting-IP'),
        'edge_secret_valid': edge_secret_valid(),
        'proxy_hops': int(current_app.config.get('CLIENT_IP_PROXY_HOPS') or 0),
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
