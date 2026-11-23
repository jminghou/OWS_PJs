"""自動核查。純函式；網路檢查由呼叫端注入，測試不得連外。"""
import re
import urllib.error
import urllib.request
from typing import Callable, NamedTuple, Optional
from urllib.parse import urljoin, urlparse

from packages.studio.social.hashing import normalize_message
from packages.studio.social.rules import (
    ALLOWED_IMAGE_MIMES,
    ANXIETY_MARKETING_TERMS,
    BRAND_NAME,
    BRAND_TYPOS,
    HTTP_MAX_REDIRECTS,
    HTTP_TIMEOUT_SECONDS,
    IMAGE_MAX_BYTES,
    IMAGE_MAX_COUNT,
    IMAGE_MAX_RATIO,
    IMAGE_MIN_RATIO,
    IMAGE_MIN_WIDTH,
    MESSAGE_MAX_CHARS,
    PNG_WARN_BYTES,
    POLARIS_DOMAIN,
    RULES,
)

_TW_ID = re.compile(r'(?<![A-Za-z0-9])[A-Z][12]\d{8}(?!\d)')
_PHONE = re.compile(r'(?<!\d)09\d{8}(?!\d)')
_EMAIL = re.compile(r'[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}')
_ORDER = re.compile(r'ORD-\d{8}-')
_BIRTH = re.compile(
    r'民國\d{2,3}年\d{1,2}月\d{1,2}日'
    r'|(?<!\d)\d{4}年\d{1,2}月\d{1,2}日'
    r'|(?<!\d)\d{4}[-/]\d{1,2}[-/]\d{1,2}(?!\d)'
)
_PAGE_MENTION = re.compile(r'@\[[^\]]+\]')
_REDIRECTS = {301, 302, 303, 307, 308}


class FetchResult(NamedTuple):
    status: int
    content_type: Optional[str]
    final_url: str
    redirects: int
    error: Optional[str]


def _finding(rule: str, level: str, message: str, location: Optional[str]) -> dict:
    return {'rule': rule, 'level': level, 'message': message, 'location': location}


def _mime(value) -> str:
    return (value or '').split(';', 1)[0].strip().lower()


def _message(payload: dict) -> str:
    return normalize_message(payload.get('message'))


def _media(payload: dict) -> list:
    media = payload.get('media') or []
    return media if isinstance(media, list) else []


def _host(url: str) -> str:
    return (urlparse(url).hostname or '').lower().rstrip('.')


def _is_polaris(host: str) -> bool:
    return host == POLARIS_DOMAIN or host.endswith('.' + POLARIS_DOMAIN)


def _opener():
    opener = urllib.request.OpenerDirector()
    opener.add_handler(urllib.request.HTTPHandler())
    opener.add_handler(urllib.request.HTTPSHandler())
    return opener


def default_fetch(url: str, *, method: str = 'HEAD', timeout: float = HTTP_TIMEOUT_SECONDS,
                  max_redirects: int = HTTP_MAX_REDIRECTS, opener=None) -> FetchResult:
    """HEAD/GET，最多 3 次轉址，timeout 5 秒。不讀 body。"""
    opener = opener or _opener()
    current = url
    redirects = 0
    seen = set()
    while True:
        if current in seen:
            return FetchResult(0, None, current, redirects, 'redirect_loop')
        seen.add(current)
        request = urllib.request.Request(
            current, method=method, headers={'User-Agent': 'PolarisStudioCheck/1.0'},
        )
        try:
            response = opener.open(request, timeout=timeout)
        except TimeoutError:
            return FetchResult(0, None, current, redirects, 'timeout')
        except urllib.error.URLError:
            return FetchResult(0, None, current, redirects, 'unreachable')
        except Exception:
            return FetchResult(0, None, current, redirects, 'unreachable')
        try:
            status = getattr(response, 'status', None) or response.getcode()
            headers = response.headers
            content_type = headers.get('Content-Type') if headers is not None else None
            location = headers.get('Location') if headers is not None else None
            final_url = response.geturl() if hasattr(response, 'geturl') else current
        finally:
            close = getattr(response, 'close', None)
            if close:
                close()
        if status in _REDIRECTS and location and redirects < max_redirects:
            nxt = urljoin(current, location)
            scheme = urlparse(nxt).scheme
            if scheme not in ('https', 'http'):
                return FetchResult(status, content_type, current, redirects, 'bad_redirect')
            current = nxt
            redirects += 1
            continue
        return FetchResult(status or 0, content_type, final_url or current, redirects, None)


def _ok(result: FetchResult, url: str) -> bool:
    if result.error or not (200 <= (result.status or 0) < 400):
        return False
    return urlparse(result.final_url or url).scheme == 'https'


def _fetch_link(url: str, fetch: Callable) -> FetchResult:
    head = fetch(url, method='HEAD', timeout=HTTP_TIMEOUT_SECONDS)
    if _ok(head, url):
        return head
    return fetch(url, method='GET', timeout=HTTP_TIMEOUT_SECONDS)


def check_message_length(payload: dict) -> list:
    message = _message(payload)
    if len(message) > MESSAGE_MAX_CHARS:
        return [_finding('message_length', 'block', f'字數 {len(message)}，超過 {MESSAGE_MAX_CHARS}', 'message')]
    return [_finding('message_length', 'pass', f'字數 {len(message)}', 'message')]


def check_message_or_link(payload: dict) -> list:
    message = _message(payload).strip()
    link = (payload.get('link') or '').strip()
    if not message and not link:
        return [_finding('message_or_link', 'block', '內文與連結至少要有一項', 'message')]
    return [_finding('message_or_link', 'pass', '內文或連結有內容', 'message')]


def check_image_format(payload: dict) -> list:
    media = _media(payload)
    if not media:
        return [_finding('image_format', 'pass', '沒有附圖', 'media')]
    findings = []
    for index, item in enumerate(media):
        mime = _mime(item.get('mime'))
        location = f'media[{index}]'
        if mime in ALLOWED_IMAGE_MIMES:
            findings.append(_finding('image_format', 'pass', mime, location))
        else:
            findings.append(_finding('image_format', 'block', f'不接受的圖片格式 {mime or "未知"}', location))
    return findings


def check_image_size(payload: dict) -> list:
    media = _media(payload)
    if not media:
        return [_finding('image_size', 'pass', '沒有附圖', 'media')]
    findings = []
    for index, item in enumerate(media):
        size = item.get('size')
        location = f'media[{index}]'
        if not isinstance(size, int) or size < 0:
            findings.append(_finding('image_size', 'block', '缺少檔案大小', location))
        elif size > IMAGE_MAX_BYTES:
            findings.append(_finding('image_size', 'block', f'圖片 {size} bytes，超過 10MB', location))
        else:
            findings.append(_finding('image_size', 'pass', f'{size} bytes', location))
    return findings


def check_png_size(payload: dict) -> list:
    media = _media(payload)
    if not media:
        return [_finding('png_size', 'pass', '沒有附圖', 'media')]
    findings = []
    for index, item in enumerate(media):
        location = f'media[{index}]'
        mime = _mime(item.get('mime'))
        size = item.get('size')
        if mime == 'image/png' and isinstance(size, int) and size > PNG_WARN_BYTES:
            findings.append(_finding('png_size', 'warn', f'PNG {size} bytes，超過 1MB', location))
        else:
            findings.append(_finding('png_size', 'pass', 'PNG 未超過 1MB', location))
    return findings


def check_image_dimensions(payload: dict) -> list:
    media = _media(payload)
    if not media:
        return [_finding('image_dimensions', 'pass', '沒有附圖', 'media')]
    findings = []
    for index, item in enumerate(media):
        location = f'media[{index}]'
        width, height = item.get('w'), item.get('h')
        if not isinstance(width, int) or not isinstance(height, int) or width <= 0 or height <= 0:
            findings.append(_finding('image_dimensions', 'warn', '缺少寬高，無法判斷裁切', location))
            continue
        problems = []
        if width < IMAGE_MIN_WIDTH:
            problems.append(f'寬度 {width}px 小於 {IMAGE_MIN_WIDTH}px')
        ratio = width / height
        if ratio > IMAGE_MAX_RATIO:
            problems.append(f'比例 {ratio:.2f} 寬於 1.91:1')
        if ratio < IMAGE_MIN_RATIO:
            problems.append(f'比例 {ratio:.2f} 窄於 4:5')
        if problems:
            findings.append(_finding('image_dimensions', 'warn', '；'.join(problems), location))
        else:
            findings.append(_finding('image_dimensions', 'pass', f'{width}x{height}', location))
    return findings


def check_image_count(payload: dict) -> list:
    count = len(_media(payload))
    if count > IMAGE_MAX_COUNT:
        return [_finding('image_count', 'block', f'附圖 {count} 張，超過 {IMAGE_MAX_COUNT}', 'media')]
    return [_finding('image_count', 'pass', f'附圖 {count} 張', 'media')]


def check_image_reachable(payload: dict, fetch: Callable) -> list:
    media = _media(payload)
    if not media:
        return [_finding('image_reachable', 'pass', '沒有附圖', 'media')]
    findings = []
    for index, item in enumerate(media):
        location = f'media[{index}]'
        url = (item.get('public_url') or '').strip()
        if not url.lower().startswith('https://'):
            findings.append(_finding('image_reachable', 'block', '圖片網址必須是可公開的 https', location))
            continue
        result = fetch(url, method='HEAD', timeout=HTTP_TIMEOUT_SECONDS)
        content_type = _mime(result.content_type)
        if result.error or result.status != 200 or not content_type.startswith('image/'):
            findings.append(_finding(
                'image_reachable', 'block', '圖片無法以 HEAD 取得，或 Content-Type 不是圖片', location,
            ))
        else:
            findings.append(_finding('image_reachable', 'pass', content_type, location))
    return findings


def check_link_reachable(payload: dict, result: Optional[FetchResult]) -> list:
    link = (payload.get('link') or '').strip()
    if not link:
        return [_finding('link_reachable', 'pass', '沒有連結', 'link')]
    if result is None or not _ok(result, link):
        return [_finding('link_reachable', 'block', '連結必須是 https，且最終回應為 2xx/3xx', 'link')]
    return [_finding('link_reachable', 'pass', f'HTTP {result.status}', 'link')]


def check_link_domain(payload: dict, result: Optional[FetchResult]) -> list:
    link = (payload.get('link') or '').strip()
    if not link:
        return [_finding('link_domain', 'pass', '沒有連結', 'link')]
    host = _host(result.final_url if result is not None and result.final_url else link)
    if host and not _is_polaris(host):
        return [_finding('link_domain', 'warn', f'網域 {host} 不是 {POLARIS_DOMAIN}', 'link')]
    if not host:
        return [_finding('link_domain', 'pass', '沒有可判斷的網域', 'link')]
    return [_finding('link_domain', 'pass', host, 'link')]


def check_brand_name(payload: dict) -> list:
    message = _message(payload)
    if BRAND_NAME in message:
        return [_finding('brand_name', 'pass', '有品牌名', 'message')]
    return [_finding('brand_name', 'warn', f'內文沒有「{BRAND_NAME}」', 'message')]


def check_brand_typo(payload: dict) -> list:
    message = _message(payload)
    found = [term for term in BRAND_TYPOS if term in message]
    if found:
        return [_finding('brand_typo', 'block', f'品牌名誤植：{found[0]}', 'message')]
    return [_finding('brand_typo', 'pass', '沒有已知誤植', 'message')]


def check_anxiety(payload: dict) -> list:
    message = _message(payload)
    found = [term for term in ANXIETY_MARKETING_TERMS if term in message]
    if found:
        return [_finding('anxiety_marketing', 'block', f'焦慮行銷詞：{found[0]}', 'message')]
    return [_finding('anxiety_marketing', 'pass', '沒有焦慮行銷詞', 'message')]


def _pii(rule: str, pattern: re.Pattern, message: str, label: str) -> list:
    if pattern.search(message):
        return [_finding(rule, 'block', label, 'message')]
    return [_finding(rule, 'pass', f'沒有{label}', 'message')]


def check_pii(payload: dict) -> list:
    message = _message(payload)
    findings = []
    findings.extend(_pii('pii_tw_id', _TW_ID, message, '台灣身分證字號'))
    findings.extend(_pii('pii_phone', _PHONE, message, '手機號碼'))
    findings.extend(_pii('pii_email', _EMAIL, message, 'Email'))
    findings.extend(_pii('pii_order', _ORDER, message, '訂單號'))
    findings.extend(_pii('pii_birthdate', _BIRTH, message, '完整出生年月日'))
    return findings


def check_page_mention(payload: dict) -> list:
    message = _message(payload)
    if _PAGE_MENTION.search(message):
        return [_finding('page_mention', 'warn', '有 @[page-id] 標註', 'message')]
    return [_finding('page_mention', 'pass', '沒有粉專標註', 'message')]


def run_checks(payload: dict, *, fetch: Optional[Callable] = None) -> list:
    """回每條規則一筆以上的 {rule, level, message, location}。level 為 block / warn / pass。"""
    fetcher = fetch or default_fetch
    report = []
    report.extend(check_message_length(payload))
    report.extend(check_message_or_link(payload))
    report.extend(check_image_format(payload))
    report.extend(check_image_size(payload))
    report.extend(check_png_size(payload))
    report.extend(check_image_dimensions(payload))
    report.extend(check_image_count(payload))
    report.extend(check_image_reachable(payload, fetcher))
    link = (payload.get('link') or '').strip()
    link_result = _fetch_link(link, fetcher) if link.lower().startswith('https://') else None
    report.extend(check_link_reachable(payload, link_result))
    report.extend(check_link_domain(payload, link_result))
    report.extend(check_brand_name(payload))
    report.extend(check_brand_typo(payload))
    report.extend(check_anxiety(payload))
    report.extend(check_pii(payload))
    report.extend(check_page_mention(payload))
    missing = [rule for rule in RULES if rule not in {item['rule'] for item in report}]
    if missing:
        raise RuntimeError(f'check report missing rules: {missing}')
    return report


def has_block(report: list) -> bool:
    return any(item.get('level') == 'block' for item in report)
