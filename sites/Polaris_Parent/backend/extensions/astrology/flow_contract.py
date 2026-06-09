"""
流盤資料契約（site 端，非 vendored）
====================================

把 calculate_chart(include_flow=True, include_encoding=True) 的流盤，
轉成前端互動引擎（@ows/ziwei-chart）可直接吃的正規化形狀：

    { "decades":     [ {order, ageRange, yearRange, name, mingBranch, chart}, ...12 ],
      "years":       [ {age, year, name(干支), mingBranch, chart}, ...~120 ],
      "smallLimits": [ {age, year, name(干支), mingBranch, chart}, ...~120 ] }

要點（三層皆然）：
  - 每層星盤用「與本命相同的轉換器」(ChartParser + serialize_chart) 解該層 encoded_array，
    含十四主星 + 流曜，格式與本命一致。
  - encoded_array 內四化是「生年四化」，非該層四化；故清掉後改套該層四化：
      · 大限：取自 chart["大限四化"]（order→星）。
      · 流年/小限：依該層 lunar_year 的天干，查天干四化表（與引擎 four_trans.py 同表）。
  - 流年/小限的 palace code 已重排到該層命宮（code1=該層命宮）；前端一律用 mingBranch
    依地支重排宮名，故 re-root 與否皆正確。

本檔只讀 vendored engine（convert / star_codes.json），不修改 vendored 子目錄。
"""

from __future__ import annotations

import json
import os
from typing import Any, Dict, List, Optional

# 祿/權/科/忌（中文鍵）→ 標準四化碼
_SIHUA_ZH_TO_CODE = {"祿": "FO", "權": "PW", "科": "HO", "忌": "BI"}

# 地支中文 → 兩位碼
_BRANCH_ZH_TO_CODE = {
    "子": "01", "丑": "02", "寅": "03", "卯": "04",
    "辰": "05", "巳": "06", "午": "07", "未": "08",
    "申": "09", "酉": "10", "戌": "11", "亥": "12",
}

# 天干 → 四化（祿權科忌 星名）。與 vendored engine stars/four_trans.py 同表（複製，
# 因該套件目錄名以數字開頭不便 import；表為標準斗數四化，穩定）。
_FOUR_TRANS = {
    "甲": {"祿": "廉貞", "權": "破軍", "科": "文曲", "忌": "太陽"},
    "乙": {"祿": "天機", "權": "天梁", "科": "紫微", "忌": "太陰"},
    "丙": {"祿": "天同", "權": "天機", "科": "文昌", "忌": "廉貞"},
    "丁": {"祿": "太陰", "權": "天同", "科": "天機", "忌": "巨門"},
    "戊": {"祿": "貪狼", "權": "太陰", "科": "右弼", "忌": "天機"},
    "己": {"祿": "武曲", "權": "貪狼", "科": "天梁", "忌": "文曲"},
    "庚": {"祿": "太陽", "權": "武曲", "科": "天同", "忌": "天相"},
    "辛": {"祿": "巨門", "權": "太陽", "科": "武曲", "忌": "文昌"},
    "壬": {"祿": "天梁", "權": "紫微", "科": "天府", "忌": "武曲"},
    "癸": {"祿": "破軍", "權": "巨門", "科": "太陰", "忌": "貪狼"},
}

_ENGINE_DIR = os.path.join(os.path.dirname(__file__), "engine")
_STAR_CODES_PATH = os.path.join(
    _ENGINE_DIR, "p01_count", "01_basic_count", "config",
    "encoding_mappings", "star_codes.json",
)

_name2code_cache: Optional[Dict[str, str]] = None


def _star_name_to_code() -> Dict[str, str]:
    """中文星名 → 編碼（star_codes.json 本就是 {名: 碼}）。"""
    global _name2code_cache
    if _name2code_cache is None:
        try:
            with open(_STAR_CODES_PATH, "r", encoding="utf-8") as f:
                _name2code_cache = json.load(f)
        except (OSError, ValueError):
            _name2code_cache = {}
    return _name2code_cache


def _find_palace_of_star(placements: Dict[str, Any], star_code: str) -> Optional[str]:
    for pc, pdata in placements.items():
        if star_code in (pdata.get("stars") or {}):
            return pc
    return None


def _apply_sihua_by_names(normalized: Dict[str, Any], names_by_code: Dict[str, str]) -> None:
    """
    清掉 encoded_array 內的生年四化，改套指定四化。
    names_by_code: {四化碼: 中文星名}，例 {"FO": "破軍", ...}。就地修改 normalized。
    """
    placements = normalized.get("placements") or {}
    for pdata in placements.values():
        for sdata in (pdata.get("stars") or {}).values():
            sdata["sihua"] = None

    name2code = _star_name_to_code()
    summary: Dict[str, Dict[str, str]] = {}
    for code, star_zh in names_by_code.items():
        star_code = name2code.get((star_zh or "").strip())
        if not star_code:
            continue
        pc = _find_palace_of_star(placements, star_code)
        if pc is None:
            continue
        placements[pc]["stars"][star_code]["sihua"] = code
        summary[code] = {"star": star_code, "palace": pc}
    normalized["sihua_summary"] = summary


def _decade_sihua_names(dasian_sihua: Dict[str, Any], order: int) -> Dict[str, str]:
    """從 chart["大限四化"] 取第 order 個大限的 {四化碼: 星名}。"""
    out: Dict[str, str] = {}
    for zh, code in _SIHUA_ZH_TO_CODE.items():
        names = [s.strip() for s in (dasian_sihua.get(zh, {}).get("星曜") or "").split(",")]
        if 0 <= order - 1 < len(names):
            out[code] = names[order - 1]
    return out


def _stem_sihua_names(ganzhi: str) -> Dict[str, str]:
    """依干支字串的天干，回 {四化碼: 星名}（流年/小限用）。"""
    stem = (ganzhi or "").strip()[:1]
    table = _FOUR_TRANS.get(stem, {})
    return {code: table[zh] for zh, code in _SIHUA_ZH_TO_CODE.items() if zh in table}


def _normalize(parser, serialize_chart, encoded_array) -> Optional[Dict[str, Any]]:
    try:
        return serialize_chart(parser.parse(encoded_array))
    except Exception:  # noqa: BLE001
        return None


def _build_decades(chart, parser, serialize_chart) -> List[Dict[str, Any]]:
    enc = (chart.get("快速條件編碼") or {}).get("decade_chart_encoding") or []
    dasian = chart.get("大限四化") or {}
    out: List[Dict[str, Any]] = []
    for entry in enc:
        ch = _normalize(parser, serialize_chart, entry.get("encoded_array"))
        if ch is None:
            continue
        try:
            order = int(entry.get("decade_order"))
        except (TypeError, ValueError):
            order = len(out) + 1
        if dasian:
            _apply_sihua_by_names(ch, _decade_sihua_names(dasian, order))
        out.append({
            "order": order,
            "ageRange": entry.get("age_range"),
            "yearRange": entry.get("year_range"),
            "name": entry.get("decade_name"),
            "mingBranch": _BRANCH_ZH_TO_CODE.get((entry.get("palace_position") or "").strip(), ""),
            "chart": ch,
        })
    return out


def _build_age_layer(chart, parser, serialize_chart, enc_key: str) -> List[Dict[str, Any]]:
    """流年(year_flow_encoding) 與 小限(small_limit_encoding) 共用：依 lunar_year 天干套四化。"""
    enc = (chart.get("快速條件編碼") or {}).get(enc_key) or []
    out: List[Dict[str, Any]] = []
    for entry in enc:
        ch = _normalize(parser, serialize_chart, entry.get("encoded_array"))
        if ch is None:
            continue
        ganzhi = entry.get("lunar_year") or ""
        _apply_sihua_by_names(ch, _stem_sihua_names(ganzhi))
        try:
            age = int(entry.get("age"))
        except (TypeError, ValueError):
            age = None
        try:
            year = int(entry.get("western_year"))
        except (TypeError, ValueError):
            year = None
        out.append({
            "age": age,
            "year": year,
            "name": ganzhi,
            "mingBranch": _BRANCH_ZH_TO_CODE.get((entry.get("palace_position") or "").strip(), ""),
            "chart": ch,
        })
    return out


def build_flow_layers(chart: Dict[str, Any], parser, serialize_chart) -> Optional[Dict[str, Any]]:
    """
    組出流盤契約（大限 + 流年 + 小限）。
    parser / serialize_chart 由呼叫端從 vendored convert 傳入。缺資料時各層為空陣列；
    全空回 None。
    """
    decades = _build_decades(chart, parser, serialize_chart)
    years = _build_age_layer(chart, parser, serialize_chart, "year_flow_encoding")
    small = _build_age_layer(chart, parser, serialize_chart, "small_limit_encoding")
    if not decades and not years and not small:
        return None
    return {"decades": decades, "years": years, "smallLimits": small}


# 向後相容別名（v2 早期只有大限時的入口）
def build_flow_decades(chart: Dict[str, Any], parser, serialize_chart) -> Optional[Dict[str, Any]]:
    decades = _build_decades(chart, parser, serialize_chart)
    return {"decades": decades} if decades else None
