"""
知識卡片類型：可在後台設定，存在 core 的 settings 表（key = studio_card_kinds，JSON 陣列）。

沒有設定時回傳預設五種（constants.CARD_KINDS），所以既有資料與未設定的站台行為不變。
卡片的 kind 欄位存的是類型的 key 字串；停用或刪除類型不會改動既有卡片。
"""
import json
import re
from typing import Dict, List, Optional

from core.backend_engine.factory import db
from core.backend_engine.models import Setting
from packages.studio.constants import CARD_KINDS

SETTING_KEY = 'studio_card_kinds'

# 顏色只能是預設調色盤的名稱（前端對應成 Tailwind 類別，不能任意字串）
COLORS = ('blue', 'emerald', 'amber', 'violet', 'rose', 'orange', 'sky', 'pink', 'lime', 'gray')

DEFAULT_KINDS: List[Dict] = [
    {'key': 'viewpoint',       'label': '觀點',     'color': 'blue',    'active': True},
    {'key': 'case',            'label': '案例',     'color': 'emerald', 'active': True},
    {'key': 'research',        'label': '研究資料', 'color': 'amber',   'active': True},
    {'key': 'ziwei',           'label': '紫微概念', 'color': 'violet',  'active': True},
    {'key': 'brand_principle', 'label': '品牌原則', 'color': 'rose',    'active': True},
]
assert [k['key'] for k in DEFAULT_KINDS] == list(CARD_KINDS)

_KEY_RE = re.compile(r'^[a-z][a-z0-9_]{0,39}$')


def load_kinds() -> List[Dict]:
    row = Setting.query.filter_by(key=SETTING_KEY).first()
    if not row or not row.value:
        return [dict(k) for k in DEFAULT_KINDS]
    try:
        data = json.loads(row.value)
    except ValueError:
        return [dict(k) for k in DEFAULT_KINDS]
    return [_normalize(k) for k in data if isinstance(k, dict) and k.get('key')]


def _normalize(k: Dict) -> Dict:
    return {
        'key': str(k.get('key', '')).strip(),
        'label': str(k.get('label', '')).strip(),
        'color': k.get('color') if k.get('color') in COLORS else 'gray',
        'active': bool(k.get('active', True)),
    }


def active_kind_keys() -> List[str]:
    return [k['key'] for k in load_kinds() if k['active']]


def all_kind_keys() -> List[str]:
    return [k['key'] for k in load_kinds()]


def validate_kinds(raw: List[Dict]) -> Optional[str]:
    """回傳錯誤訊息；None 表示合法。"""
    if not isinstance(raw, list) or not raw:
        return '至少要有一個類型'
    seen = set()
    for k in raw:
        n = _normalize(k)
        if not _KEY_RE.match(n['key']):
            return f"類型代碼「{n['key']}」不合法：小寫英文開頭，只能用英數與底線，最長 40 字"
        if n['key'] in seen:
            return f"類型代碼「{n['key']}」重複"
        seen.add(n['key'])
        if not n['label']:
            return f"類型「{n['key']}」缺少名稱"
        if len(n['label']) > 30:
            return f"類型「{n['key']}」名稱太長（最多 30 字）"
    if not any(_normalize(k)['active'] for k in raw):
        return '至少要有一個啟用中的類型'
    return None


def save_kinds(raw: List[Dict]) -> List[Dict]:
    kinds = [_normalize(k) for k in raw]
    row = Setting.query.filter_by(key=SETTING_KEY).first()
    value = json.dumps(kinds, ensure_ascii=False)
    if row:
        row.value = value
    else:
        db.session.add(Setting(key=SETTING_KEY, value=value, data_type='json',
                               description='Studio 知識卡片類型（後台「卡片類型」頁管理）'))
    return kinds
