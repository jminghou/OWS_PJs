"""粉專發文的環境設定。每次呼叫才讀環境變數，不放進 Flask config，也不寫 log。

正式站預設 mode=off。這個模組不提供任何會把 token 或 secret 印出來的函式。
"""
import os

MODES = ('off', 'dry_run', 'fake', 'live')

MODE_ENV = 'STUDIO_FB_PUBLISH_MODE'
PAGE_ID_ENV = 'FB_PAGE_ID'
TOKEN_ENV = 'FB_PAGE_ACCESS_TOKEN'
APP_SECRET_ENV = 'FB_APP_SECRET'
VERSION_ENV = 'FB_GRAPH_API_VERSION'
BASE_URL_ENV = 'FB_GRAPH_BASE_URL'
TIMEOUT_ENV = 'STUDIO_FB_HTTP_TIMEOUT_SECONDS'

DEFAULT_VERSION = 'v27.0'
DEFAULT_BASE_URL = 'https://graph.facebook.com'
DEFAULT_TIMEOUT = 20.0


def _raw(name: str) -> str:
    return (os.environ.get(name) or '').strip()


def publish_mode() -> str:
    mode = _raw(MODE_ENV).lower() or 'off'
    return mode if mode in MODES else 'off'


def page_id():
    return _raw(PAGE_ID_ENV) or None


def access_token():
    return _raw(TOKEN_ENV) or None


def app_secret():
    return _raw(APP_SECRET_ENV) or None


def graph_version() -> str:
    return _raw(VERSION_ENV) or DEFAULT_VERSION


def graph_base_url() -> str:
    return (_raw(BASE_URL_ENV) or DEFAULT_BASE_URL).rstrip('/')


def http_timeout() -> float:
    raw = _raw(TIMEOUT_ENV)
    if not raw:
        return DEFAULT_TIMEOUT
    try:
        value = float(raw)
    except ValueError:
        return DEFAULT_TIMEOUT
    return value if value > 0 else DEFAULT_TIMEOUT
