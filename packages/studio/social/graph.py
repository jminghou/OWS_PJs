"""Graph API 客戶端。access_token 只放 POST body 或 Authorization header，不放 URL。"""
import hashlib
import hmac
import json
import logging
import urllib.error
import urllib.request
from typing import Optional
from urllib.parse import urlencode, urlsplit, urlunsplit

from packages.studio.social.config import (
    access_token,
    app_secret,
    graph_base_url,
    graph_version,
    http_timeout,
)

logger = logging.getLogger(__name__)

SECRET_KEYS = {'access_token', 'appsecret_proof', 'authorization', 'fb_page_access_token', 'fb_app_secret'}


class GraphCallError(Exception):
    """outcome 是 failed 或 unknown。message 不得包含 token。"""

    def __init__(self, outcome: str, *, status: Optional[int] = None, code=None, subcode=None,
                 message: str = '', fbtrace_id: Optional[str] = None):
        super().__init__(message or outcome)
        self.outcome = outcome
        self.status = status
        self.code = None if code is None else str(code)
        self.subcode = None if subcode is None else str(subcode)
        self.fbtrace_id = fbtrace_id
        self.safe_message = message or outcome


def appsecret_proof(token: Optional[str], secret: Optional[str]) -> Optional[str]:
    if not token or not secret:
        return None
    return hmac.new(secret.encode('utf-8'), token.encode('utf-8'), hashlib.sha256).hexdigest()


def active_secrets() -> list:
    return [value for value in (access_token(), app_secret()) if value]


def scrub(value, secrets=None):
    """把 token / secret 從要寫進 log 或 event 的結構裡換成 ***。"""
    secrets = [item for item in (secrets if secrets is not None else active_secrets()) if item]
    return _scrub(value, secrets)


def _scrub(value, secrets):
    if isinstance(value, dict):
        cleaned = {}
        for key, item in value.items():
            if str(key).lower() in SECRET_KEYS or 'token' in str(key).lower() or 'secret' in str(key).lower():
                cleaned[key] = '***' if item else item
            else:
                cleaned[key] = _scrub(item, secrets)
        return cleaned
    if isinstance(value, list):
        return [_scrub(item, secrets) for item in value]
    if isinstance(value, str):
        redacted = value
        for secret in secrets:
            if secret and secret in redacted:
                redacted = redacted.replace(secret, '***')
        return redacted
    return value


def _error_from_body(status: int, payload: dict) -> GraphCallError:
    if status >= 500:
        return GraphCallError('unknown', status=status, message='http_5xx')
    error = payload.get('error') if isinstance(payload, dict) else None
    if 400 <= status < 500 and isinstance(error, dict) and error.get('code') is not None:
        return GraphCallError(
            'failed', status=status, code=error.get('code'), subcode=error.get('error_subcode'),
            message=str(error.get('message') or 'graph_error'), fbtrace_id=error.get('fbtrace_id'),
        )
    return GraphCallError('unknown', status=status, message='graph_response')


class GraphClient:
    """HttpGraphClient 與 FakeGraphClient 都實作這兩個方法。"""

    def post(self, path: str, body: dict) -> dict:
        raise NotImplementedError

    def get(self, path: str, query: Optional[dict] = None) -> dict:
        raise NotImplementedError


class HttpGraphClient(GraphClient):
    def __init__(self, *, base_url: str, version: str, token: Optional[str], app_secret_value: Optional[str] = None,
                 timeout: float = 20, opener=None):
        self.base_url = base_url.rstrip('/')
        self.version = version.strip('/')
        self.token = token
        self.app_secret_value = app_secret_value
        self.timeout = timeout
        self.opener = opener or urllib.request.build_opener()

    def post(self, path: str, body: dict) -> dict:
        payload = dict(body)
        if self.token:
            payload['access_token'] = self.token
        proof = appsecret_proof(self.token, self.app_secret_value)
        if proof:
            payload['appsecret_proof'] = proof
        data = self._send('POST', path, payload, None)
        if not data.get('id') and not data.get('post_id'):
            raise GraphCallError('unknown', message='missing id')
        return data

    def get(self, path: str, query: Optional[dict] = None) -> dict:
        return self._send('GET', path, None, query or {})

    def _url(self, path: str, query: Optional[dict]) -> str:
        safe_query = {
            key: value for key, value in (query or {}).items()
            if str(key).lower() not in SECRET_KEYS
        }
        base = f'{self.base_url}/{self.version}/{path.lstrip("/")}'
        if not safe_query:
            return base
        parts = urlsplit(base)
        return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(safe_query), ''))

    def _send(self, method: str, path: str, body: Optional[dict], query: Optional[dict]) -> dict:
        url = self._url(path, query)
        if 'access_token=' in url or (self.token and self.token in url):
            raise GraphCallError('unknown', message='refusing token in url')
        headers = {'Accept': 'application/json'}
        data = None
        if method == 'GET' and self.token:
            headers['Authorization'] = f'Bearer {self.token}'
            proof = appsecret_proof(self.token, self.app_secret_value)
            if proof:
                headers['X-Appsecret-Proof'] = proof
        if body is not None:
            data = json.dumps(body).encode('utf-8')
            headers['Content-Type'] = 'application/json'
        logger.info('graph %s %s', method, scrub(url))
        request = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            response = self.opener.open(request, timeout=self.timeout)
        except TimeoutError:
            raise GraphCallError('unknown', message='timeout')
        except urllib.error.HTTPError as exc:
            payload = _read_json(exc)
            raise _error_from_body(exc.code, payload)
        except urllib.error.URLError:
            raise GraphCallError('unknown', message='connection')
        try:
            payload = _read_json(response)
            status = getattr(response, 'status', None) or response.getcode()
        finally:
            close = getattr(response, 'close', None)
            if close:
                close()
        if status >= 400:
            raise _error_from_body(status, payload)
        return payload if isinstance(payload, dict) else {}


def _read_json(response) -> dict:
    raw = response.read() if hasattr(response, 'read') else b''
    if not raw:
        return {}
    try:
        parsed = json.loads(raw.decode('utf-8'))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return {}
    return parsed if isinstance(parsed, dict) else {}


class FakeGraphClient(GraphClient):
    """測試用。responses 裡可以放 dict 或 GraphCallError。"""

    def __init__(self, responses=None):
        self.responses = list(responses or [])
        self.calls = []

    def post(self, path: str, body: dict) -> dict:
        self.calls.append(('POST', path, body))
        return self._next()

    def get(self, path: str, query: Optional[dict] = None) -> dict:
        self.calls.append(('GET', path, query or {}))
        return self._next()

    def _next(self) -> dict:
        if not self.responses:
            raise GraphCallError('unknown', message='fake client has no scripted response')
        item = self.responses.pop(0)
        if isinstance(item, Exception):
            raise item
        return item


def build_http_client() -> HttpGraphClient:
    return HttpGraphClient(
        base_url=graph_base_url(),
        version=graph_version(),
        token=access_token(),
        app_secret_value=app_secret(),
        timeout=http_timeout(),
    )
