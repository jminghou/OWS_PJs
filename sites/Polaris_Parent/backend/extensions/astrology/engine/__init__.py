"""
紫微斗數排盤引擎 — vendored 自 D:\\P_Polaris_Parent\\1_run\\P_Union
（同步請用 scripts/publish_ziwei_engine.ps1，勿手改 vendored 子目錄）

對外乾淨介面：
    from .engine import (
        calculate_chart,            # 純排盤（中文鍵 dict）
        build_clock_time_str,       # (y,m,d,h,mi) -> "17 November 1987 at 14:30"
        get_geo_info,               # (city, country) -> {coordinates, timezone, place_en}
        compute_solar_time,         # (clock_str, place, timezone) -> "Solar time" 字串
        parse_time_str,             # "D Month YYYY at HH:MM" -> (y,m,d,h,mi)
        geographic_hierarchy,       # 洲->國->城市 dict（給前端下拉）
        render_natal_svg,           # chart dict -> SVG 字串
        render_natal_html,          # chart dict -> HTML 字串
        chart_to_artist_dict,       # chart dict -> p_e_artist 輸入格式
    )

內部結構：
    p01_count/      P_Union 排盤核心（calculate_chart）
    p_e_artist/     SVG/HTML 命盤繪圖引擎
    solar/          真太陽時計算器（單檔）
    geo/            地理資料 / 經緯度（單檔）
    convert/        encoded_array -> p_e_artist 格式（vendored 轉換鏈）
"""

import importlib.util
import sys
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

_ENGINE_DIR = Path(__file__).resolve().parent

# p01_count / p_e_artist 是「頂層套件」名稱（內部用絕對/相對 import），
# 必須讓 engine 目錄本身在 sys.path 上才 import 得到。
if str(_ENGINE_DIR) not in sys.path:
    sys.path.insert(0, str(_ENGINE_DIR))


# ── 排盤核心 ────────────────────────────────────────────────
from p01_count import calculate_chart, calculate_batch_charts, generate_chart_id  # noqa: E402


# ── 單檔模組：用 importlib 以唯一名稱載入，避免 solar/geo 這種通用名污染 sys.path ──
def _load_file(mod_name: str, rel_path: str):
    spec = importlib.util.spec_from_file_location(mod_name, _ENGINE_DIR / rel_path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[mod_name] = module
    spec.loader.exec_module(module)
    return module


_solar_mod = _load_file("_ziwei_solar", "solar/s3_solar_time.py")
_geo_mod = _load_file("_ziwei_geo", "geo/geo_manager.py")

SolarTimeCalculator = _solar_mod.SolarTimeCalculator
GeographicDataManager = _geo_mod.GeographicDataManager

# 單例（無狀態、可重用）
_solar_calc = SolarTimeCalculator(verbose=False)
_geo_mgr = GeographicDataManager()


# ── 轉換鏈（encoded_array -> p_e_artist 格式）────────────────
from .convert import ChartParser, serialize_chart  # noqa: E402

_chart_parser = ChartParser()


# ── 時間工具 ────────────────────────────────────────────────
_MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
]
_MONTH_NUM = {name: i + 1 for i, name in enumerate(_MONTH_NAMES)}


def build_clock_time_str(year: int, month: int, day: int, hour: int, minute: int) -> str:
    """(y,m,d,h,mi) -> 'D Month YYYY at HH:MM'（SolarTimeCalculator 期待格式）。"""
    return f"{day} {_MONTH_NAMES[month - 1]} {year} at {hour:02d}:{minute:02d}"


def parse_time_str(time_str: str) -> Tuple[int, int, int, int, int]:
    """'D Month YYYY at HH:MM' -> (year, month, day, hour, minute)。"""
    import re
    m = re.search(r"(\d+)\s+(\w+)\s+(\d+)\s+at\s+(\d+):(\d+)", time_str)
    if not m:
        raise ValueError(f"無法解析時間格式: {time_str}")
    day, month_name, year, hour, minute = m.groups()
    return int(year), _MONTH_NUM.get(month_name, 1), int(day), int(hour), int(minute)


# ── 地理 / 太陽時 ───────────────────────────────────────────
def get_geo_info(city: str, country: str) -> Dict[str, Any]:
    """(城市, 國家) -> {place_en, coordinates: '25n02, 121e33', timezone: 'h8e'}。"""
    return _geo_mgr.get_geo_info(city, country)


def geographic_hierarchy() -> Dict[str, Any]:
    """洲 -> 國家 -> 城市 階層（給前端級聯下拉）。"""
    return _geo_mgr.get_geographic_hierarchy()


def compute_solar_time(clock_time_str: str, place_with_coords: str, timezone: str) -> Optional[str]:
    """
    依出生地經緯度 + 時區把鐘錶時間換算為真太陽時。
    place_with_coords 需含座標 token，例如 'Taipei, Taiwan, 25n02, 121e33'。
    回傳 'D Month YYYY at HH:MM'，失敗回 None。
    """
    try:
        result = _solar_calc.process_data({
            "born on": clock_time_str,
            "Place": place_with_coords,
            "Timezone": timezone,
        })
        return result.get("Solar time")
    except Exception:
        return None


# ── 繪圖 ────────────────────────────────────────────────────
def chart_to_artist_dict(chart: Dict[str, Any]) -> Dict[str, Any]:
    """把 calculate_chart 輸出轉成 p_e_artist 期待的格式（需 include_encoding=True）。"""
    enc = (chart.get("快速條件編碼") or {}).get("natal_chart_encoding") or []
    if not enc or "encoded_array" not in enc[0]:
        raise ValueError("命盤缺少 natal_chart_encoding；calculate_chart 需 include_encoding=True")
    state = _chart_parser.parse(enc[0]["encoded_array"])
    data = serialize_chart(state)
    data["chart_id"] = str(chart.get("chart_id", ""))
    return data


def _build_chart_obj(chart: Dict[str, Any], theme: str = "default"):
    from p_e_artist import Chart
    from p_e_artist.theme_manager import ThemeManager
    data = chart_to_artist_dict(chart)
    obj = Chart("natal", data)
    try:
        obj = obj.set_theme(ThemeManager.load_theme(theme))
    except Exception:
        pass  # 主題載入失敗 -> 用程式內建預設
    return obj.compute_layout()


def render_natal_svg(chart: Dict[str, Any], theme: str = "default") -> str:
    """calculate_chart 輸出 -> 十二宮方圖 SVG 字串。"""
    return _build_chart_obj(chart, theme).to_svg()


def render_natal_html(chart: Dict[str, Any], theme: str = "default") -> str:
    """calculate_chart 輸出 -> 十二宮方圖 HTML 字串。"""
    return _build_chart_obj(chart, theme).to_html()


__all__ = [
    "calculate_chart", "calculate_batch_charts", "generate_chart_id",
    "build_clock_time_str", "parse_time_str",
    "get_geo_info", "geographic_hierarchy", "compute_solar_time",
    "SolarTimeCalculator", "GeographicDataManager",
    "chart_to_artist_dict", "render_natal_svg", "render_natal_html",
]
