"""
Google：Google Identity Services 按鈕在前端拿到 ID token（JWT），後端驗證。

不需要 client secret、不需要 callback 網址。驗證項目：
簽章（Google 公鑰，套件會快取）、aud == GOOGLE_CLIENT_ID、iss、exp（以上由 google-auth 處理）、
email_verified。
"""
from flask import current_app

from core.backend_engine.services.member_auth import normalise_email
from packages.social_auth.providers.base import ProviderError, ProviderProfile

NAME = 'google'
_ISSUERS = ('accounts.google.com', 'https://accounts.google.com')
_request = None  # google.auth.transport.requests.Request；重複使用才能沿用公鑰快取


def client_id():
    return (current_app.config.get('GOOGLE_CLIENT_ID') or '').strip()


def is_configured():
    return bool(client_id())


def public_config():
    return {'client_id': client_id()}


def _verify_token(credential, audience):
    """呼叫 google-auth 驗 ID token，回傳 claims。測試會替換這個函式。"""
    global _request
    from google.auth.transport import requests as google_requests
    from google.oauth2 import id_token

    if _request is None:
        _request = google_requests.Request()
    return id_token.verify_oauth2_token(credential, _request, audience)


def verify(credential):
    """驗證前端送來的 ID token，回傳 ProviderProfile；無效時拋 ProviderError。"""
    if not credential or not isinstance(credential, str):
        raise ProviderError('缺少 Google 登入資訊')
    try:
        claims = _verify_token(credential, client_id())
    except ValueError as exc:  # 簽章、aud、過期等都會拋 ValueError
        current_app.logger.info(f'Google ID token 驗證失敗：{exc}')
        raise ProviderError('Google 登入已失效，請再試一次') from exc

    if claims.get('iss') not in _ISSUERS:
        raise ProviderError('Google 登入已失效，請再試一次')
    subject = claims.get('sub')
    if not subject:
        raise ProviderError('Google 登入已失效，請再試一次')

    email = normalise_email(claims.get('email')) or None
    email_verified = claims.get('email_verified') in (True, 'true')
    if not email or not email_verified:
        raise ProviderError('這個 Google 帳號的 Email 尚未驗證，請改用其他方式註冊')

    hosted_domain = claims.get('hd')
    authoritative = email.endswith('@gmail.com') or bool(hosted_domain and email.endswith('@' + hosted_domain.lower()))
    return ProviderProfile(
        provider=NAME,
        subject=str(subject),
        email=email,
        email_verified=True,
        email_authoritative=authoritative,
        name=(claims.get('name') or '').strip() or None,
        picture=(claims.get('picture') or '').strip() or None,
    )
