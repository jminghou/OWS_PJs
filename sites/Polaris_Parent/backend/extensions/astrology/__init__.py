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

    return jsonify({
        "success": True,
        "chart_id": chart_id,
        "time_type": time_type,
        "solar_time": solar_time_str,
        "data": chart,
        "svg": svg,
        "chart_json": chart_json,
        "flow": flow,
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


# ── 一鍵建檔 + 註冊（第三期，§12）──────────────────────────
def _send_set_password_email(member_id, email):
    """寄設定密碼信（best-effort；無 SMTP 則記 log 含連結）。簽章 token，無需新表。"""
    try:
        from itsdangerous import URLSafeTimedSerializer
        from core.backend_engine.factory import mail
        from flask_mail import Message
        s = URLSafeTimedSerializer(current_app.config['SECRET_KEY'], salt='set-password')
        token = s.dumps({"member_id": member_id, "email": email})
        frontend = os.environ.get('FRONTEND_URL', 'http://localhost:3000').rstrip('/')
        link = f"{frontend}/set-password?token={token}"
        try:
            mail.send(Message(
                subject="設定您的會員密碼",
                recipients=[email],
                sender=current_app.config.get('MAIL_DEFAULT_SENDER'),
                body=f"歡迎成為會員！請於 24 小時內點擊連結設定密碼：\n{link}",
            ))
            current_app.logger.info(f"set-password email sent to {email}")
        except Exception as send_err:  # noqa: BLE001
            current_app.logger.warning(
                f"set-password 信無法寄出（本機可能無 SMTP）：{send_err}；連結：{link}")
    except Exception as exc:  # noqa: BLE001
        current_app.logger.error(f"set-password token 產生失敗：{exc}")


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
        _send_set_password_email(member_id, email)

    return jsonify({
        "success": True,
        "chart_id": chart_id,
        "member_id": str(member_id),
        "is_new_member": is_new,
        "email": email,
    })


@bp.route('/set-password', methods=['POST'])
@_limit("5 per minute")
def set_password():
    """以設定密碼信的 token 設定會員密碼（經 blog.users view → app_users.password_hash）。"""
    data = request.get_json(silent=True) or {}
    token = data.get("token") or ""
    password = data.get("password") or ""
    from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
    s = URLSafeTimedSerializer(current_app.config['SECRET_KEY'], salt='set-password')
    try:
        payload = s.loads(token, max_age=24 * 3600)
    except SignatureExpired:
        return jsonify({"success": False, "error": "連結已過期，請重新申請"}), 400
    except BadSignature:
        return jsonify({"success": False, "error": "連結無效"}), 400

    from core.backend_engine.models import User
    from core.backend_engine.factory import db
    user = User.query.get(payload.get("member_id"))
    if not user:
        return jsonify({"success": False, "error": "會員不存在"}), 404
    try:
        user.set_password(password)  # 複雜度驗證 + bcrypt（經 view trigger 寫 app_users）
        db.session.commit()
    except ValueError as ve:
        db.session.rollback()
        return jsonify({"success": False, "error": str(ve)}), 400
    return jsonify({"success": True, "message": "密碼已設定，請登入"})


# ── 登入／註冊合一頁：email + 密碼註冊，成功即登入 ──────────────────────────
@bp.route('/register', methods=['POST'])
@_limit("5 per minute")
def register():
    """
    會員註冊（email + 密碼），成功後直接發 JWT cookies（免再登入）。

    Request JSON:
        email, password                  (必填)
        chart                            (選填) 剛排的命盤，註冊後自動歸戶：
            {year, month, day, hour, minute?, gender, name?, place?, relation?}

    有 chart → 走既有紫微 save-and-register（建會員 + 存盤 + 歸戶）後補設密碼；
    無 chart → 直接經 blog.users view 建會員（INSTEAD OF trigger 寫
    account.app_users + blog.member_profiles）。
    """
    from datetime import datetime
    from flask_jwt_extended import (create_access_token, create_refresh_token,
                                    set_access_cookies, set_refresh_cookies)
    from core.backend_engine.factory import db
    from core.backend_engine.models import User, validate_password
    from core.backend_engine.schemas.user import UserSchema

    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    if "@" not in email or "." not in email.split("@")[-1]:
        return jsonify({"success": False, "error": "請提供有效的 email"}), 400
    password = data.get("password") or ""
    try:
        validate_password(password)
    except ValueError as ve:
        return jsonify({"success": False, "error": str(ve)}), 400

    if User.query.filter_by(username=email).first():
        return jsonify({
            "success": False,
            "error": "此 email 已是會員，請直接登入；若尚未設定密碼，請在登入頁重寄設定密碼信。",
        }), 409

    chart = data.get("chart") or None
    chart_id = None
    if chart:
        # 有剛排的命盤 → 既有 save-and-register 一次完成建會員 + 存盤 + 歸戶
        if not _PUBLIC_SERVICE_TOKEN:
            return jsonify({"success": False, "error": "服務未設定（PUBLIC_SERVICE_TOKEN 缺）"}), 503
        parts = {}
        for key in ("year", "month", "day", "hour"):
            val, err = _as_int(chart, key)
            if err:
                return jsonify({"success": False, "error": f"chart.{key} 無效"}), 400
            parts[key] = val
        minute = 0
        if chart.get("minute") not in ("", None):
            minute, err = _as_int(chart, "minute")
            if err:
                return jsonify({"success": False, "error": "chart.minute 無效"}), 400
        gender = _norm_gender(chart.get("gender"))
        if gender not in ("男", "女"):
            return jsonify({"success": False, "error": "chart.gender 必須為 男/女（或 M/F）"}), 400

        zres, zerr = _ziwei_save_and_register({
            "year": parts["year"], "month": parts["month"], "day": parts["day"],
            "hour": parts["hour"], "minute": minute,
            "gender": gender, "name": (chart.get("name") or "").strip(),
            "place": (chart.get("place") or "").strip(), "email": email,
            "relation": (chart.get("relation") or "self"),
        })
        if zerr:
            return jsonify({"success": False, "error": zerr}), 502
        chart_id = zres.get("chart_id")

        user = User.query.filter_by(username=email).first()
        if user is None:
            return jsonify({"success": False, "error": "會員建立失敗，請稍後再試"}), 500
        user.email = email  # view trigger upsert member_profiles
        user.set_password(password)
    else:
        user = User(username=email, email=email, role='member', is_active=True)
        user.set_password(password)
        db.session.add(user)

    user.last_login = datetime.utcnow()
    try:
        db.session.commit()
    except Exception as exc:  # noqa: BLE001
        db.session.rollback()
        current_app.logger.error(f"register commit failed: {exc}")
        return jsonify({"success": False, "error": "註冊失敗，請稍後再試"}), 500

    # 與 /auth/login 相同：JWT 進 httpOnly cookies，回傳 user
    response = jsonify({
        "success": True,
        "user": UserSchema().dump(user),
        "chart_id": chart_id,
    })
    set_access_cookies(response, create_access_token(identity=str(user.id)))
    set_refresh_cookies(response, create_refresh_token(identity=str(user.id)))
    return response, 200


@bp.route('/resend-set-password', methods=['POST'])
@_limit("3 per minute")
def resend_set_password():
    """重寄設定密碼信（兼忘記密碼）。無論 email 是否存在一律回成功，避免帳號枚舉。"""
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    if "@" not in email or "." not in email.split("@")[-1]:
        return jsonify({"success": False, "error": "請提供有效的 email"}), 400

    from core.backend_engine.models import User
    user = User.query.filter_by(username=email).first()
    if user is not None and user.is_active:
        _send_set_password_email(user.id, email)
    return jsonify({"success": True, "message": "若該 email 為會員，設定密碼信已寄出，請於 24 小時內完成設定。"})


# ── 會員端：我的命盤 / 收藏（需登入；member_id 取自 JWT）─────────────────────
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
