"""
Astrology Extension for Polaris Parent Site
紫微斗數排盤 — 公開 API（供首頁訪客輸入生辰即時排盤）

Endpoints:
    POST /api/v1/astrology/calculate    - 排盤（回 命盤 JSON + 十二宮方圖 SVG）
    GET  /api/v1/astrology/geo-options   - 洲/國/城市 級聯選項（真太陽時用）
    GET  /api/v1/astrology/health        - 健康檢查

排盤核心 vendored 於 ./engine（同步用 scripts/publish_ziwei_engine.ps1）。
"""

from flask import Blueprint, jsonify, request

try:
    from core.backend_engine.factory import limiter
except Exception:  # pragma: no cover - 限流器不可用時不擋功能
    limiter = None

bp = Blueprint('astrology', __name__)


# ── 引擎延遲載入（import 失敗時回 500，不在 app 啟動期炸掉整個站）──
_engine = None
_engine_error = None


def _get_engine():
    global _engine, _engine_error
    if _engine is not None or _engine_error is not None:
        return _engine
    try:
        from . import engine as _eng
        _engine = _eng
    except Exception as exc:  # noqa: BLE001
        _engine_error = str(exc)
    return _engine


# ── 輸入正規化 ──────────────────────────────────────────────
_GENDER_MAP = {
    "男": "男", "女": "女",
    "m": "男", "f": "女", "male": "男", "female": "女",
}


def _norm_gender(value):
    if value is None:
        return None
    return _GENDER_MAP.get(str(value).strip().lower(), str(value).strip())


def _as_int(data, key):
    """取整數欄位；缺失或非整數回 (None, 錯誤訊息)。"""
    if key not in data or data[key] in ("", None):
        return None, f"缺少必填欄位：{key}"
    try:
        return int(data[key]), None
    except (TypeError, ValueError):
        return None, f"欄位 {key} 必須為整數"


def _limit(rule):
    """有 limiter 才套用限流，否則 no-op（本機/測試不依賴 Redis）。"""
    def deco(fn):
        return limiter.limit(rule)(fn) if limiter is not None else fn
    return deco


# ── 排盤 ────────────────────────────────────────────────────
@bp.route('/calculate', methods=['POST'])
@_limit("30 per minute")
def calculate():
    """
    依出生時辰排出紫微斗數命盤。

    Request JSON:
        year, month, day, hour            (必填, int)
        minute                            (選填, int, 預設 0)
        gender                            (必填, 男/女 或 M/F)
        name                              (選填, str)
        time_type   "clock_time"|"solar_time"  (選填, 預設 clock_time)
        place       {city, country}       (time_type=solar_time 時必填)
        include_flow                      (選填, bool, 預設 False)
        render                            (選填, bool, 預設 True → 附 SVG)
        include_chart_json                (選填, bool, 預設 False → 附正規化命盤 JSON）
        theme                             (選填, str, 預設 "default")

    Response JSON:
        { success, chart_id, solar_time, time_type, data, svg, chart_json }

    chart_json 為 p_e_artist 期待的正規化形狀（placements/stars/sihua_summary），
    供前端互動命盤引擎（@ows/ziwei-chart）使用；與靜態 SVG 同一份資料來源。
    """
    eng = _get_engine()
    if eng is None:
        return jsonify({"success": False, "error": f"排盤引擎載入失敗：{_engine_error}"}), 500

    data = request.get_json(silent=True) or {}

    # 必填整數欄位
    parts = {}
    for key in ("year", "month", "day", "hour"):
        val, err = _as_int(data, key)
        if err:
            return jsonify({"success": False, "error": err}), 400
        parts[key] = val
    minute, err = (_as_int(data, "minute") if data.get("minute") not in ("", None) else (0, None))
    if err:
        return jsonify({"success": False, "error": err}), 400

    gender = _norm_gender(data.get("gender"))
    if gender not in ("男", "女"):
        return jsonify({"success": False, "error": "gender 必須為 男/女（或 M/F）"}), 400

    name = (data.get("name") or "").strip()
    time_type = data.get("time_type", "clock_time")
    if time_type not in ("clock_time", "solar_time"):
        return jsonify({"success": False, "error": "time_type 必須為 clock_time 或 solar_time"}), 400
    include_flow = bool(data.get("include_flow", False))
    do_render = data.get("render", True)
    include_chart_json = bool(data.get("include_chart_json", False))
    theme = data.get("theme", "default")

    y, mo, d, h = parts["year"], parts["month"], parts["day"], parts["hour"]
    birthplace = ""
    solar_time_str = None

    # ── 真太陽時校正 ──
    if time_type == "solar_time":
        place = data.get("place") or {}
        city = (place.get("city") or "").strip()
        country = (place.get("country") or "").strip()
        if not city or not country:
            return jsonify({"success": False,
                            "error": "time_type=solar_time 需提供 place.city 與 place.country"}), 400
        try:
            geo = eng.get_geo_info(city, country)
            clock_str = eng.build_clock_time_str(y, mo, d, h, minute)
            place_with_coords = f"{geo['place_en']}, {geo['coordinates']}"
            solar_time_str = eng.compute_solar_time(clock_str, place_with_coords, geo["timezone"])
            if solar_time_str:
                y, mo, d, h, minute = eng.parse_time_str(solar_time_str)
            birthplace = f"{city}, {country}"
        except Exception as exc:  # noqa: BLE001
            return jsonify({"success": False, "error": f"太陽時換算失敗：{exc}"}), 400

    # ── 計算命盤 ──
    try:
        chart = eng.calculate_chart(
            birth_date=(y, mo, d, h, minute),
            gender=gender,
            name=name,
            birthplace=birthplace,
            time_type=time_type,
            include_flow=include_flow,
            include_encoding=True,  # 繪圖需要 encoded_array
        )
    except Exception as exc:  # noqa: BLE001
        return jsonify({"success": False, "error": f"命盤計算失敗：{exc}"}), 500

    # chart_id 以字串回傳，避免 JS Number 精度遺失（18 位 > 2^53）
    chart_id = str(chart.get("chart_id", ""))
    chart["chart_id"] = chart_id

    svg = None
    if do_render:
        try:
            svg = eng.render_natal_svg(chart, theme=theme)
        except Exception as exc:  # noqa: BLE001
            # 繪圖失敗不擋資料回傳
            svg = None
            chart.setdefault("_render_error", str(exc))

    # 正規化命盤 JSON（供前端互動引擎；與 SVG 同一份資料來源）
    chart_json = None
    if include_chart_json:
        try:
            chart_json = eng.chart_to_artist_dict(chart)
        except Exception as exc:  # noqa: BLE001
            # 轉換失敗不擋其餘資料回傳
            chart.setdefault("_chart_json_error", str(exc))

    return jsonify({
        "success": True,
        "chart_id": chart_id,
        "time_type": time_type,
        "solar_time": solar_time_str,
        "data": chart,
        "svg": svg,
        "chart_json": chart_json,
    })


# ── 地理選項（級聯下拉）──────────────────────────────────────
@bp.route('/geo-options', methods=['GET'])
@_limit("60 per minute")
def geo_options():
    """回傳 洲 → 國家 → 城市 階層，供前端真太陽時的地點級聯選擇。"""
    eng = _get_engine()
    if eng is None:
        return jsonify({"success": False, "error": f"排盤引擎載入失敗：{_engine_error}"}), 500
    return jsonify({"success": True, "hierarchy": eng.geographic_hierarchy()})


# ── 健康檢查 ────────────────────────────────────────────────
@bp.route('/health', methods=['GET'])
def health_check():
    """排盤擴充健康檢查（含引擎是否可載入）。"""
    eng = _get_engine()
    return jsonify({
        "status": "healthy" if eng is not None else "degraded",
        "extension": "astrology",
        "engine_loaded": eng is not None,
        "engine_error": _engine_error,
    })
