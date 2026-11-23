"""
LINE Login v2.1（OpenID Connect）：轉址流程＋PKCE。

    1. /line/start 產生 state、nonce、PKCE verifier，轉到 LINE 授權頁
    2. LINE 轉回 /line/callback?code&state
    3. 用 code＋verifier＋channel secret 換 token，再把 ID token 交給 LINE 的 verify 端點驗證
       （它會檢查簽章、aud＝channel id、過期與 nonce）

Email 要另外向 LINE 申請權限，而且使用者可以在同意畫面取消勾選，所以 email 可能沒有。
LINE 只回已驗證過的信箱，但信箱不是 LINE 掌管的 → email_authoritative 一律 False（不自動連結既有會員）。

設定：LINE_CHANNEL_ID、LINE_CHANNEL_SECRET（機密）；LINE_REDIRECT_URI 沒設時用本端點的完整網址。
"""
import base64
import hashlib
import secrets
from urllib.parse import urlencode

from flask import current_app

from core.backend_engine.services.member_auth import normalise_email
from packages.social_auth.providers.base import ProviderError, ProviderProfile

NAME = 'line'
AUTHORIZE_URL = 'https://access.line.me/oauth2/v2.1/authorize'
TOKEN_URL = 'https://api.line.me/oauth2/v2.1/token'
VERIFY_URL = 'https://api.line.me/oauth2/v2.1/verify'
SCOPE = 'profile openid email'


def channel_id():
    return (current_app.config.get('LINE_CHANNEL_ID') or '').strip()


def channel_secret():
    return (current_app.config.get('LINE_CHANNEL_SECRET') or '').strip()


def is_configured():
    return bool(channel_id() and channel_secret())


def public_config():
    return {}  # 前端只需要知道有開；按鈕直接連到 /line/start


def new_pkce():
    """回傳 (verifier, challenge)。"""
    verifier = secrets.token_urlsafe(48)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode('ascii')).digest()).rstrip(b'=').decode('ascii')
    return verifier, challenge


def authorize_url(*, state, nonce, code_challenge, redirect_uri, locale='zh-TW'):
    return AUTHORIZE_URL + '?' + urlencode({
        'response_type': 'code',
        'client_id': channel_id(),
        'redirect_uri': redirect_uri,
        'state': state,
        'scope': SCOPE,
        'nonce': nonce,
        'code_challenge': code_challenge,
        'code_challenge_method': 'S256',
        'ui_locales': locale,
    })


def _post(url, data):
    """呼叫 LINE API，回傳 (status, json)。測試會替換這個函式。"""
    import requests

    resp = requests.post(url, data=data, timeout=10)
    try:
        body = resp.json()
    except ValueError:
        body = {}
    return resp.status_code, body


def exchange(code, *, verifier, redirect_uri, nonce):
    """用授權碼換 token 並驗證 ID token，回傳 ProviderProfile。"""
    if not code:
        raise ProviderError('LINE 登入沒有完成，請再試一次')
    status, token = _post(TOKEN_URL, {
        'grant_type': 'authorization_code',
        'code': code,
        'redirect_uri': redirect_uri,
        'client_id': channel_id(),
        'client_secret': channel_secret(),
        'code_verifier': verifier,
    })
    id_token = token.get('id_token') if status == 200 else None
    if not id_token:
        current_app.logger.info(f'LINE token 交換失敗 status={status} error={token.get("error")}')
        raise ProviderError('LINE 登入已失效，請再試一次')

    status, claims = _post(VERIFY_URL, {'id_token': id_token, 'client_id': channel_id(), 'nonce': nonce})
    if status != 200 or not claims.get('sub'):
        current_app.logger.info(f'LINE ID token 驗證失敗 status={status} error={claims.get("error")}')
        raise ProviderError('LINE 登入已失效，請再試一次')
    if claims.get('aud') not in (None, channel_id()) or claims.get('iss') not in (None, 'https://access.line.me'):
        raise ProviderError('LINE 登入已失效，請再試一次')

    email = normalise_email(claims.get('email')) or None
    return ProviderProfile(
        provider=NAME,
        subject=str(claims['sub']),
        email=email,
        email_verified=bool(email),
        email_authoritative=False,
        name=(claims.get('name') or '').strip() or None,
        picture=(claims.get('picture') or '').strip() or None,
    )
