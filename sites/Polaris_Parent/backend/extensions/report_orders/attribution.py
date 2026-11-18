"""官網訂單來源歸因（shop.order_attributions，0020）。

前端（src/lib/attribution.ts）把 localStorage 裡的首次／最近一次來源放進建單 payload 的
`attribution: {first, last}`；結帳頁來源問卷（選填，單選）放 `survey: {choice, other}`。
這裡只做兩件事：

- sanitize()：白名單清洗。未知 key 丟棄、型別不對丟棄、超長截斷；整包 JSON 超過 2KB 直接整包丟棄。
  一律不回 400——歸因是行銷資料，不能讓它擋住客人下單。
- first_touch_at()：由 attribution.first.at（epoch ms 數字或 ISO 字串）推得首次接觸時間（UTC）。
  解析不了、晚於伺服器現在＋5 分鐘（時鐘誤差）、早於現在－30 天（前端 TTL）再多 1 小時寬限，一律 NULL。
- record()：訂單首次建立、已 commit 之後才寫；自己 commit，失敗就 rollback＋記 log，不影響下單。
  同一 submission_key 重送（created=False）不會走到這裡，所以不會覆寫。

只給後台看（overview.detail），不進 service.order_summary（客人看得到），也不寫進 orders.attributes。
"""
import json
import re
from datetime import datetime, timedelta, timezone
from urllib.parse import urlsplit

from flask import current_app

from core.backend_engine.factory import db

MAX_PAYLOAD_BYTES = 2048
UTM_FIELDS = ('source', 'medium', 'campaign', 'content', 'term')
UTM_MAX = 100
PATH_MAX = 200
HOST_MAX = 253
FIRST_TOUCH_FUTURE_SKEW = timedelta(minutes=5)
# 前端 first 的 TTL 是 30 天；多給 1 小時寬限吸收時鐘誤差與到期邊界
FIRST_TOUCH_MAX_AGE = timedelta(days=30, hours=1)
# 和前端 src/lib/report/survey.ts 同順序（Lemon 2026-11-16 定稿）；欄位是 String(20)，加值不需 migration
SURVEY_CHOICES = ('facebook', 'instagram', 'threads', 'line', 'podcast', 'youtube', 'friend', 'search', 'other')
SURVEY_OTHER_MAX = 100
_HOST_RE = re.compile(r'^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$')


def _text(value, limit):
    if not isinstance(value, str):
        return None
    value = value.strip()
    return value[:limit] or None


def _host(value):
    """只留 host：可能收到完整網址，拆掉 scheme、帳密、port、路徑與 query。"""
    if not isinstance(value, str) or not value.strip():
        return None
    value = value.strip().lower()
    if len(value) > 2000:
        return None
    try:
        host = urlsplit(value if '//' in value else f'//{value}').hostname
    except ValueError:
        return None
    if not host or len(host) > HOST_MAX or not _HOST_RE.match(host):
        return None
    return host


def _path(value):
    """只留 pathname：必須以 / 開頭，去掉 query 與 hash，截 200 字。"""
    if not isinstance(value, str) or not value.startswith('/'):
        return None
    path = value.split('?', 1)[0].split('#', 1)[0]
    return path[:PATH_MAX] or None


def _at(value):
    if not isinstance(value, str) or len(value) > 40:
        return None
    try:
        datetime.fromisoformat(value.replace('Z', '+00:00'))
    except ValueError:
        return None
    return value


def _parse_at(value):
    """epoch ms（int/float，非 bool）或 ISO 8601 字串 → UTC-aware datetime；解析不了回 None。"""
    try:
        if isinstance(value, bool):
            return None
        if isinstance(value, (int, float)):
            return datetime.fromtimestamp(value / 1000, tz=timezone.utc)
        if isinstance(value, str) and len(value) <= 40:
            dt = datetime.fromisoformat(value.strip().replace('Z', '+00:00'))
            return (dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)).astimezone(timezone.utc)
    except (ValueError, OverflowError, OSError):
        return None
    return None


def first_touch_at(raw, now=None):
    """由原始 payload 的 first.at 推得首次接觸時間；不在 [now-30天-1小時, now+5分鐘] 內回 None。"""
    if not isinstance(raw, dict) or not isinstance(raw.get('first'), dict):
        return None
    at = _parse_at(raw['first'].get('at'))
    if at is None:
        return None
    now = now or datetime.now(timezone.utc)
    if at > now + FIRST_TOUCH_FUTURE_SKEW or at < now - FIRST_TOUCH_MAX_AGE:
        return None
    return at


def _touch(raw):
    if not isinstance(raw, dict):
        return None
    out = {k: _text(raw.get(k), UTM_MAX) for k in UTM_FIELDS}
    out['referrer_host'] = _host(raw.get('referrer_host'))
    out['landing_path'] = _path(raw.get('landing_path'))
    out['at'] = _at(raw.get('at'))
    out = {k: v for k, v in out.items() if v is not None}
    # 只有時間戳沒有任何來源資訊，等於沒資料
    return out if set(out) - {'at'} else None


def sanitize(raw):
    """回傳 {'first': dict|None, 'last': dict|None}；無效或超過 2KB 回 None。"""
    if not isinstance(raw, dict):
        return None
    try:
        size = len(json.dumps(raw, ensure_ascii=False).encode('utf-8'))
    except (TypeError, ValueError):
        return None
    if size > MAX_PAYLOAD_BYTES:
        return None
    first, last = _touch(raw.get('first')), _touch(raw.get('last'))
    if first is None and last is None:
        return None
    return {'first': first, 'last': last}


def sanitize_survey(raw):
    """回傳 (choice, other)；choice 不在 enum 內整筆丟棄（不回 400），other 只在 choice='other' 時保留。"""
    if not isinstance(raw, dict):
        return None, None
    choice = raw.get('choice')
    if not isinstance(choice, str) or choice not in SURVEY_CHOICES:
        return None, None
    other = _text(raw.get('other'), SURVEY_OTHER_MAX) if choice == 'other' else None
    return choice, other


def record(order, data):
    """訂單首次建立後呼叫。任何錯誤都吞掉（rollback＋log），回傳是否寫入。"""
    from sites.Polaris_Parent.backend.commerce_models import OrderAttribution

    try:
        clean = sanitize(data.get('attribution')) or {'first': None, 'last': None}
        choice, other = sanitize_survey(data.get('survey'))
        if clean['first'] is None and clean['last'] is None and choice is None:
            return False
        if db.session.get(OrderAttribution, order.id) is not None:
            return False  # 已有就不覆寫
        # first 被清洗掉（沒有來源資訊）就不記首次接觸時間
        touched_at = first_touch_at(data.get('attribution')) if clean['first'] is not None else None
        db.session.add(OrderAttribution(order_id=order.id, first_touch=clean['first'], last_touch=clean['last'],
                                        first_touch_at=touched_at, survey_choice=choice, survey_other=other))
        db.session.commit()
        return True
    except Exception:  # noqa: BLE001 — 歸因失敗不能擋單
        db.session.rollback()
        current_app.logger.exception('order attribution write failed (order_id=%s)', getattr(order, 'id', None))
        return False


def view(order):
    """後台訂單詳細用；沒有資料回 None。"""
    from sites.Polaris_Parent.backend.commerce_models import OrderAttribution

    try:
        row = db.session.get(OrderAttribution, order.id)
    except Exception:  # noqa: BLE001 — 表還沒建（migration 未上）時後台詳細頁不能壞
        db.session.rollback()
        current_app.logger.exception('order attribution read failed (order_id=%s)', order.id)
        return None
    if row is None:
        return None
    touched_at = row.first_touch_at
    if touched_at is not None and touched_at.tzinfo is None:  # SQLite 讀回來是 naive，存的就是 UTC
        touched_at = touched_at.replace(tzinfo=timezone.utc)
    return {'first': row.first_touch, 'last': row.last_touch,
            'first_touch_at': touched_at.isoformat() if touched_at else None,
            'survey_choice': row.survey_choice, 'survey_other': row.survey_other,
            'created_at': row.created_at.isoformat() if row.created_at else None}
