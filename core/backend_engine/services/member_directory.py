"""
OWS Core Engine - 會員名冊的擴充點

後台「會員管理」（/api/v1/members）列的是 role 為 member／user 的帳號。core 只知道帳號本身
（信箱、註冊時間、最近登入、狀態）；其他欄位由選用模組或站台登記：

    from core.backend_engine.services import member_directory as md

    md.register_column('order_count', '訂單', kind='number', fetch=lambda users: {...})
    md.register_filter('has_orders', '訂單', options=[('yes', '有訂單'), ('no', '沒有訂單')],
                       apply=lambda query, value: query.filter(...))

- fetch(users) 一次拿到「這一頁」的會員（最多 100 位），回傳 {user_id: 值}；請用一個查詢批次取，
  不要逐筆查。
- apply(query, value) 回傳加上條件的 query；value 已確認是 options 之一。
- kind 決定前端怎麼畫：number、boolean、badges（字串清單）、text。

例如 social_auth 登記「登入方式」，commerce 登記「訂單數」，Polaris 登記「信箱已驗證」。
模組沒掛載就不登記，欄位與篩選自然不出現。
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable, Dict, List, Optional, Sequence, Tuple

# 會員＝讀者端帳號；其餘（admin、editor…）是後台人員，列在「作者管理」
MEMBER_ROLES: Tuple[str, ...] = ('member', 'user')

KINDS = ('number', 'boolean', 'badges', 'text')


@dataclass
class MemberColumn:
    key: str
    label: str
    kind: str
    fetch: Callable[[Sequence], Dict[int, object]]
    order: int = 100


@dataclass
class MemberFilter:
    key: str
    label: str
    options: List[Tuple[str, str]]
    apply: Callable
    order: int = 100


_columns: Dict[str, MemberColumn] = {}
_filters: Dict[str, MemberFilter] = {}

# core 自己用到的查詢參數名，模組不能拿來當篩選鍵
RESERVED_KEYS = frozenset({'q', 'status', 'joined', 'sort', 'order', 'page', 'per_page'})


def register_column(key: str, label: str, *, kind: str, fetch, order: int = 100) -> None:
    if kind not in KINDS:
        raise ValueError(f'kind 必須是 {KINDS} 之一')
    _columns[key] = MemberColumn(key, label, kind, fetch, order)  # 同鍵重登記＝覆蓋（測試重建 app 時冪等）


def register_filter(key: str, label: str, *, options, apply, order: int = 100) -> None:
    if key in RESERVED_KEYS:
        raise ValueError(f'篩選鍵 {key} 與 core 參數衝突')
    _filters[key] = MemberFilter(key, label, [(str(v), str(l)) for v, l in options], apply, order)


def columns() -> List[MemberColumn]:
    return sorted(_columns.values(), key=lambda c: (c.order, c.key))


def filters() -> List[MemberFilter]:
    return sorted(_filters.values(), key=lambda f: (f.order, f.key))


def get_filter(key: str) -> Optional[MemberFilter]:
    return _filters.get(key)


def describe() -> dict:
    """給前端的欄位與篩選定義。"""
    return {
        'columns': [{'key': c.key, 'label': c.label, 'kind': c.kind} for c in columns()],
        'filters': [{'key': f.key, 'label': f.label,
                     'options': [{'value': v, 'label': l} for v, l in f.options]} for f in filters()],
    }
