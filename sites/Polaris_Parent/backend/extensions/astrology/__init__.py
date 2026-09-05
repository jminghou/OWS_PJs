"""
Astrology Extension for Polaris Parent Site
紫微斗數排盤 — 公開 API（供首頁訪客輸入生辰即時排盤）

Endpoints:
    POST /api/v1/astrology/calculate    - 排盤（回 命盤 JSON + 十二宮方圖 SVG）
    GET  /api/v1/astrology/geo-options   - 洲/國/城市 級聯選項（真太陽時用）
    GET  /api/v1/astrology/health        - 健康檢查

排盤核心 vendored 於 ./engine（同步用 scripts/publish_ziwei_engine.ps1）。
"""

import os
import json
import urllib.request
import urllib.error

from flask import Blueprint, jsonify, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity

from core.backend_engine.services.member_auth import (
    SignupHookResult,
    on_member_signup,
    send_set_password_email,
)

try:
    from core.backend_engine.factory import limiter
except Exception:  # pragma: no cover - 限流器不可用時不擋功能
    limiter = None

bp = Blueprint('astrology', __name__)

# 第三期：排盤一鍵建檔 — 呼叫紫微 public API（server-to-server，服務密鑰）
_ZIWEI_API_URL = os.environ.get('ZIWEI_API_URL', 'http://127.0.0.1:8000').rstrip('/')
_PUBLIC_SERVICE_TOKEN = os.environ.get('PUBLIC_SERVICE_TOKEN', '')


def _ziwei_save_and_register(payload: dict):
    """呼叫紫微 POST /public/charts/save-and-register。回 (data, error)。"""
    req = urllib.request.Request(
        f"{_ZIWEI_API_URL}/public/charts/save-and-register",
        data=json.dumps(payload).encode('utf-8'),
        method='POST',
        headers={'Content-Type': 'application/json',
                 'X-Service-Token': _PUBLIC_SERVICE_TOKEN},
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read().decode('utf-8')), None
    except urllib.error.HTTPError as e:
        try:
            detail = json.loads(e.read().decode('utf-8')).get('detail')
        except Exception:
            detail = None
        return None, detail or f"命盤服務錯誤 ({e.code})"
    except Exception as e:  # noqa: BLE001
        return None, f"無法連線命盤服務：{e}"


def _ziwei_call(method: str, path: str, payload: dict = None):
    """通用呼叫紫微 public API（帶服務密鑰）。回 (data, error)。"""
    data = json.dumps(payload).encode('utf-8') if payload is not None else None
    req = urllib.request.Request(
        f"{_ZIWEI_API_URL}{path}", data=data, method=method,
        headers={'Content-Type': 'application/json', 'X-Service-Token': _PUBLIC_SERVICE_TOKEN})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            body = r.read().decode('utf-8')
            return (json.loads(body) if body else {}), None
    except urllib.error.HTTPError as e:
        try:
            detail = json.loads(e.read().decode('utf-8')).get('detail')
        except Exception:
            detail = None
        return None, detail or f"命盤服務錯誤 ({e.code})"
    except Exception as e:  # noqa: BLE001
        return None, f"無法連線命盤服務：{e}"


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


# ── 星場引擎（p_d_graph_v3）延遲載入：與排盤引擎同一套容錯 ──
_sf_engine = None
_sf_error = None


def _get_star_field():
    """回傳星場引擎（載入失敗回 None，不擋排盤）。"""
    global _sf_engine, _sf_error
    if _sf_error is not None:
        return None
    if _sf_engine is None:
        try:
            # engine/ 目錄需在 sys.path 上（與 .engine 包裝層同一套 bootstrap）
            from . import engine as _eng  # noqa: F401  觸發 sys.path 設定
            from p_d_graph_v3 import StarFieldEngine
            _sf_engine = StarFieldEngine()
        except Exception as exc:  # noqa: BLE001
            _sf_error = str(exc)
            return None
    return _sf_engine


def _natal_encoded_array(chart):
    """從排盤產物取本命編碼陣列（include_encoding=True 時必有）。"""
    enc = (chart or {}).get("快速條件編碼") or {}
    natal = enc.get("natal_chart_encoding") or []
    if not natal:
        raise ValueError("命盤缺少本命編碼（natal_chart_encoding）")
    arr = natal[0].get("encoded_array")
    if not arr:
        raise ValueError("本命編碼陣列為空")
    return arr


def _build_v3_views(chart, star_energy=False, readings=False, kinds=None):
    """
    星場視圖：星曜能量卡 ／ 十二宮讀數。

    **兩者共用同一次 analyze()**——兩張圖各跑一次引擎會白花一倍成本，
    而 analyze() 本來就把兩者需要的東西都算了（實測 0.41 ms/張）。
    回傳 (star_energy_payload | None, readings_payload | None)。
    """
    sf = _get_star_field()
    if sf is None:
        raise RuntimeError(f"星場引擎載入失敗：{_sf_error}")
    if not (star_energy or readings):
        return None, None

    from p_d_graph_v3.star_energy import build_from_result as _star_view
    from p_d_graph_v3.palace_readings import build_from_result as _palace_view

    result = sf.analyze(_natal_encoded_array(chart))
    return (
        _star_view(result, sf, kinds=kinds) if star_energy else None,
        _palace_view(result, sf) if readings else None,
    )


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
        include_star_energy               (選填, bool, 預設 False → 附星曜能量卡）
        star_energy_kinds                 (選填, list[str], 預設全部；["major"]＝只主星）
        include_readings                  (選填, bool, 預設 False → 附十二宮讀數）
        theme                             (選填, str, 預設 "default")

    Response JSON:
        { success, chart_id, solar_time, time_type, data, svg, chart_json,
          star_energy, readings }

    chart_json 為 p_e_artist 期待的正規化形狀（placements/stars/sihua_summary），
    供前端互動命盤引擎（@ows/ziwei-chart）使用；與靜態 SVG 同一份資料來源。

    star_energy 為每顆星的 E 及其可回溯分解（供前端瀑布圖）：
        E = 亮度倍率 × (1 + 影響加成 M) × 空劫衰減
    每顆星附 steps（瀑布圖直接可畫）與 counterfactual（空劫／四化豁免的反事實）。
    四化**不乘進 E**，它在這條鏈上的唯一作用是豁免空劫——所以會顯示在「空劫」那一步，
    不是多加一步。實測 <1 ms，與排盤同一次請求算完，前端點星曜即純查表。

    readings 為十二宮讀數（S總／S力／S化／S輔、四化通道、輔星流量矩陣、
    逐筆取樣分解、四化場源），供熱力圖／弦圖／桑基等結構圖表。
    與 star_energy **共用同一次 analyze()**，兩個都開不會多花一倍成本。
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
    include_star_energy = bool(data.get("include_star_energy", False))
    star_energy_kinds = data.get("star_energy_kinds") or None
    if star_energy_kinds is not None and not isinstance(star_energy_kinds, list):
        return jsonify({"success": False,
                        "error": "star_energy_kinds 必須為字串陣列"}), 400
    include_readings = bool(data.get("include_readings", False))
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
    flow = None
    if include_chart_json:
        try:
            chart_json = eng.chart_to_artist_dict(chart)
        except Exception as exc:  # noqa: BLE001
            # 轉換失敗不擋其餘資料回傳
            chart.setdefault("_chart_json_error", str(exc))

        # 流盤層（大限 + 流年 + 小限）。需 include_flow 才有流盤編碼可轉。
        if include_flow:
            try:
                from .engine.convert import ChartParser, serialize_chart
                from .flow_contract import build_flow_layers
                flow = build_flow_layers(chart, ChartParser(), serialize_chart)
            except Exception as exc:  # noqa: BLE001
                chart.setdefault("_flow_error", str(exc))

    # 星場視圖（星曜能量卡／十二宮讀數）。純查表算術，兩者共用同一次 analyze()，
    # 實測 <1 ms；失敗不擋其餘資料回傳，與 svg / chart_json 同一套容錯策略。
    star_energy = readings = None
    if include_star_energy or include_readings:
        try:
            star_energy, readings = _build_v3_views(
                chart,
                star_energy=include_star_energy,
                readings=include_readings,
                kinds=star_energy_kinds,
            )
        except Exception as exc:  # noqa: BLE001
            chart.setdefault("_star_field_error", str(exc))

    return jsonify({
        "success": True,
        "chart_id": chart_id,
        "time_type": time_type,
        "solar_time": solar_time_str,
        "data": chart,
        "svg": svg,
        "chart_json": chart_json,
        "flow": flow,
        "star_energy": star_energy,
        "readings": readings,
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


# ── 一鍵建檔（第三期，§12）：排盤 + 建會員 + 歸戶 ──────────────────────
# 註：純粹的會員身分機制（註冊 / 設定密碼 / 重寄設定信）已於 P1 搬到
#     core.backend_engine.blueprints.api.member_auth —— 那是平台能力，不是排盤領域。
#     這裡只留「需要呼叫紫微服務」的部分。
@bp.route('/save-and-register', methods=['POST'])
@_limit("5 per minute")
def save_and_register():
    """排盤一鍵建檔 + 註冊：紫微存命盤 + 建免密碼會員 + 歸戶；本站補 member_profiles(email) + 寄設定密碼信。"""
    if not _PUBLIC_SERVICE_TOKEN:
        return jsonify({"success": False, "error": "服務未設定（PUBLIC_SERVICE_TOKEN 缺）"}), 503
    data = request.get_json(silent=True) or {}

    parts = {}
    for key in ("year", "month", "day", "hour"):
        val, err = _as_int(data, key)
        if err:
            return jsonify({"success": False, "error": err}), 400
        parts[key] = val
    minute = 0
    if data.get("minute") not in ("", None):
        minute, err = _as_int(data, "minute")
        if err:
            return jsonify({"success": False, "error": err}), 400

    gender = _norm_gender(data.get("gender"))
    if gender not in ("男", "女"):
        return jsonify({"success": False, "error": "gender 必須為 男/女（或 M/F）"}), 400
    email = (data.get("email") or "").strip().lower()
    if "@" not in email or "." not in email.split("@")[-1]:
        return jsonify({"success": False, "error": "請提供有效的 email"}), 400

    # 1. 呼叫紫微：存命盤 + 建免密碼會員 + 歸戶
    zres, zerr = _ziwei_save_and_register({
        "year": parts["year"], "month": parts["month"], "day": parts["day"],
        "hour": parts["hour"], "minute": minute,
        "gender": gender, "name": (data.get("name") or "").strip(),
        "place": (data.get("place") or "").strip(), "email": email,
        "relation": (data.get("relation") or "self"),
        "rating": (data.get("rating") or "").strip(),
    })
    if zerr:
        return jsonify({"success": False, "error": zerr}), 502
    member_id = int(zres["member_id"])
    chart_id = zres["chart_id"]
    is_new = bool(zres.get("is_new_member"))

    # 2. 本站補 member_profiles(email)（blog 擁有）
    from core.backend_engine.factory import db
    from sqlalchemy import text
    try:
        db.session.execute(text(
            "INSERT INTO blog.member_profiles(app_user_id, email) VALUES (:m, :e) "
            "ON CONFLICT (app_user_id) DO UPDATE SET email = EXCLUDED.email, updated_at = now()"
        ), {"m": member_id, "e": email})
        db.session.commit()
    except Exception as exc:  # noqa: BLE001
        db.session.rollback()
        current_app.logger.error(f"member_profiles upsert failed: {exc}")

    # 3. 新會員 → 寄設定密碼信
    if is_new:
        send_set_password_email(member_id, email)

    return jsonify({
        "success": True,
        "chart_id": chart_id,
        "member_id": str(member_id),
        "is_new_member": is_new,
        "email": email,
    })


# ── 會員端：我的命盤 / 收藏（需登入；member_id 取自 JWT）─────────────────────
@bp.route('/my/charts', methods=['POST'])
@jwt_required()
@_limit("10 per minute")
def save_my_chart():
    """
    會員中心排盤儲存：以登入會員身分存一張命盤並歸檔到自己帳號。

    Request JSON:
        year, month, day, hour      (必填, int)
        minute                      (選填, int, 預設 0)
        gender                      (必填, 男/女 或 M/F)
        name, place                 (選填, str)
        relation                    (選填, self/father/mother/...，預設 self)
        rating                      (選填, 資料評級 Rodden rating：AA/A/B/C/DD/X/XX)

    email 取自登入會員本人（不信任 client 傳入），其餘走既有紫微 save-and-register。
    """
    if not _PUBLIC_SERVICE_TOKEN:
        return jsonify({"success": False, "error": "服務未設定（PUBLIC_SERVICE_TOKEN 缺）"}), 503
    data = request.get_json(silent=True) or {}

    parts = {}
    for key in ("year", "month", "day", "hour"):
        val, err = _as_int(data, key)
        if err:
            return jsonify({"success": False, "error": err}), 400
        parts[key] = val
    minute = 0
    if data.get("minute") not in ("", None):
        minute, err = _as_int(data, "minute")
        if err:
            return jsonify({"success": False, "error": err}), 400
    gender = _norm_gender(data.get("gender"))
    if gender not in ("男", "女"):
        return jsonify({"success": False, "error": "gender 必須為 男/女（或 M/F）"}), 400

    from core.backend_engine.models import User
    user = User.query.get(int(get_jwt_identity()))
    if user is None or not user.is_active:
        return jsonify({"success": False, "error": "會員不存在或已停用"}), 404
    email = (user.email or user.username or "").strip().lower()
    if "@" not in email:
        return jsonify({"success": False, "error": "會員帳號缺少 email，無法歸檔"}), 400

    zres, zerr = _ziwei_save_and_register({
        "year": parts["year"], "month": parts["month"], "day": parts["day"],
        "hour": parts["hour"], "minute": minute,
        "gender": gender, "name": (data.get("name") or "").strip(),
        "place": (data.get("place") or "").strip(), "email": email,
        "relation": (data.get("relation") or "self"),
        "rating": (data.get("rating") or "").strip(),
    })
    if zerr:
        return jsonify({"success": False, "error": zerr}), 502
    return jsonify({
        "success": True,
        "chart_id": zres.get("chart_id"),
        "is_existing": bool(zres.get("is_existing")),
        "has_fortune": bool(zres.get("has_fortune")),
    })


# ── 命盤升級（補流運 252 筆）/ 降級（刪流運）────────────────────────────
def _member_can_upgrade(user) -> bool:
    """付費資格檢查（金流接上前的暫行版）：role 為 admin 或 paid 才可升級。
    之後接金流時改查訂閱/訂單狀態，閘門位置維持在 blog 側。"""
    return getattr(user, 'role', None) in ('admin', 'paid')


@bp.route('/my/charts/<chart_id>/fortune', methods=['PUT'])
@jwt_required()
@_limit("5 per minute")
def upgrade_my_chart(chart_id):
    """升級自己的命盤為完整版（含大限/流年/小限流運編碼）。需付費資格。"""
    from core.backend_engine.models import User
    user = User.query.get(int(get_jwt_identity()))
    if user is None or not user.is_active:
        return jsonify({"success": False, "error": "會員不存在或已停用"}), 404
    if not _member_can_upgrade(user):
        return jsonify({"success": False, "error": "此功能需要付費會員資格"}), 403
    data, err = _ziwei_call('PUT', f'/public/members/{user.id}/charts/{chart_id}/fortune')
    if err:
        return jsonify({"success": False, "error": err}), 502
    return jsonify(data)


@bp.route('/my/charts/<chart_id>/fortune', methods=['DELETE'])
@jwt_required()
@_limit("5 per minute")
def downgrade_my_chart(chart_id):
    """降級自己的命盤為本命版（刪除流運編碼；可再升級，無資料損失）。"""
    data, err = _ziwei_call('DELETE', f'/public/members/{get_jwt_identity()}/charts/{chart_id}/fortune')
    if err:
        return jsonify({"success": False, "error": err}), 502
    return jsonify(data)


@bp.route('/my/charts', methods=['GET'])
@jwt_required()
def my_charts():
    """登入會員擁有的人（命主）+ 其命盤。"""
    data, err = _ziwei_call('GET', f'/public/members/{get_jwt_identity()}/charts')
    if err:
        return jsonify({"success": False, "error": err}), 502
    return jsonify({"success": True, **data})


@bp.route('/my/favorites', methods=['GET'])
@jwt_required()
def my_favorites():
    """登入會員收藏的命盤。"""
    data, err = _ziwei_call('GET', f'/public/members/{get_jwt_identity()}/favorites')
    if err:
        return jsonify({"success": False, "error": err}), 502
    return jsonify({"success": True, **data})


@bp.route('/my/favorites', methods=['POST'])
@jwt_required()
@_limit("30 per minute")
def add_my_favorite():
    """收藏一張公開命盤。body: {chart_id, note?}"""
    body = request.get_json(silent=True) or {}
    if not body.get("chart_id"):
        return jsonify({"success": False, "error": "缺少 chart_id"}), 400
    data, err = _ziwei_call('POST', f'/public/members/{get_jwt_identity()}/favorites',
                            {"chart_id": body.get("chart_id"), "note": body.get("note", "")})
    if err:
        return jsonify({"success": False, "error": err}), 502
    return jsonify(data)


@bp.route('/my/favorites/<chart_id>', methods=['DELETE'])
@jwt_required()
def remove_my_favorite(chart_id):
    """取消收藏。"""
    data, err = _ziwei_call('DELETE', f'/public/members/{get_jwt_identity()}/favorites/{chart_id}')
    if err:
        return jsonify({"success": False, "error": err}), 502
    return jsonify(data)


@bp.route('/my/charts/<chart_id>', methods=['PATCH'])
@jwt_required()
def update_my_chart(chart_id):
    """編輯自己命盤的名稱 / 關係標籤。body: {name?, relation_label?}"""
    body = request.get_json(silent=True) or {}
    payload = {k: body[k] for k in ('name', 'relation_label') if k in body}
    data, err = _ziwei_call('PATCH', f'/public/members/{get_jwt_identity()}/charts/{chart_id}', payload)
    if err:
        return jsonify({"success": False, "error": err}), 502
    return jsonify(data)


@bp.route('/my/charts/<chart_id>', methods=['DELETE'])
@jwt_required()
def delete_my_chart(chart_id):
    """刪除自己的命盤。"""
    data, err = _ziwei_call('DELETE', f'/public/members/{get_jwt_identity()}/charts/{chart_id}')
    if err:
        return jsonify({"success": False, "error": err}), 502
    return jsonify(data)


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


# =============================================================================
# 平台擴充點：註冊時順便歸戶命盤
# =============================================================================
# 通用的會員註冊流程住在 core（api/member_auth.py）。它不知道紫微斗數的存在，
# 只在「email 查重之後、建立 User 之前」呼叫這裡登記的 hook。
#
# 為什麼是 pre-signup 而不是 post-signup：紫微服務的 save-and-register 會先在
# 共用的 account.app_users 建好身分，core 隨後必須「先查再建」才不會撞 unique。

@on_member_signup
def _attach_pending_chart(email, data):
    """
    註冊附帶命盤時，呼叫紫微服務建會員 + 存盤 + 歸戶。

    降級策略沿用原本行為：命盤服務不可用或存盤失敗時**不擋註冊**，
    改回傳 warning 讓前端提示「請登入後重新排盤儲存」。
    """
    chart = data.get("chart") or None
    if not chart:
        return None

    if not _PUBLIC_SERVICE_TOKEN:
        return SignupHookResult(warning="命盤服務未設定，命盤未儲存")

    parts = {}
    for key in ("year", "month", "day", "hour"):
        val, err = _as_int(chart, key)
        if err:
            return SignupHookResult(warning=f"命盤資料不完整（{key}），命盤未儲存")
        parts[key] = val

    minute = 0
    if chart.get("minute") not in ("", None):
        minute, err = _as_int(chart, "minute")
        if err:
            minute = 0

    gender = _norm_gender(chart.get("gender"))
    if gender not in ("男", "女"):
        return SignupHookResult(warning="命盤資料不完整（gender），命盤未儲存")

    zres, zerr = _ziwei_save_and_register({
        "year": parts["year"], "month": parts["month"], "day": parts["day"],
        "hour": parts["hour"], "minute": minute,
        "gender": gender, "name": (chart.get("name") or "").strip(),
        "place": (chart.get("place") or "").strip(), "email": email,
        "relation": (chart.get("relation") or "self"),
        "rating": (chart.get("rating") or "").strip(),
    })
    if zerr:
        current_app.logger.warning(f"register: 命盤歸戶失敗，降級為純註冊：{zerr}")
        return SignupHookResult(warning="註冊已完成，但命盤儲存失敗，請登入後重新排盤儲存")

    return SignupHookResult(extra={"chart_id": zres.get("chart_id")})


# =============================================================================
# 舊路由別名（過渡期，P2 移除）
# =============================================================================
# 會員身分端點的正規路徑已是 /api/v1/auth/member/*，但 Polaris 前端目前仍打
# /api/v1/astrology/*。這裡把舊路徑指到 core 的同一個 view function，
# 讓 P1 是純結構重構、零行為變更，可以獨立部署。
#
# 移除條件：前端 lib/api/auth.ts 與 lib/api/astrology.ts 改用 /auth/member/*
# （P2 抽 packages/platform-api 時一併處理）。

def _register_legacy_aliases():
    from core.backend_engine.blueprints.api import member_auth as _ma

    for rule, view in (
        ('/register', _ma.member_register),
        ('/set-password', _ma.member_set_password),
        ('/resend-set-password', _ma.member_resend_set_password),
    ):
        bp.add_url_rule(
            rule,
            endpoint=f'legacy{rule.replace("-", "_").replace("/", "_")}',
            view_func=view,
            methods=['POST'],
        )


_register_legacy_aliases()
