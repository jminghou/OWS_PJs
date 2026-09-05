"""
Core API - 會員身分端點（註冊 / 設定密碼 / 重寄設定信）

平台級功能，與領域無關。原本埋在 Polaris 的 astrology 擴充裡（795 行中約 430 行
與排盤無關），P1 階段搬到 core —— 第三個站台會要會員系統，但不會要紫微斗數。

領域行為（例如註冊時順便歸戶命盤）透過
`core.backend_engine.services.member_auth.on_member_signup` 掛載，見該模組說明。

Endpoints:
    POST /api/v1/auth/member/register              email + 密碼註冊，成功即發 JWT
    POST /api/v1/auth/member/set-password          以設定密碼信的 token 設定密碼
    POST /api/v1/auth/member/resend-set-password   重寄設定密碼信（兼忘記密碼）

相容性：Polaris 前端目前仍呼叫 /api/v1/astrology/{register,set-password,
resend-set-password}。astrology 擴充會把那三條舊路由指到這裡的同一個 view，
等前端於 P2 改用正規路徑後即可移除，見 astrology/__init__.py 的 legacy alias 區段。
"""

from datetime import datetime

from flask import jsonify, request, current_app
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    set_access_cookies,
    set_refresh_cookies,
)

from core.backend_engine.blueprints.api import bp
from core.backend_engine.services.member_auth import (
    is_valid_email,
    normalise_email,
    read_set_password_token,
    run_signup_hooks,
    send_set_password_email,
)

try:
    from core.backend_engine.factory import limiter
except Exception:  # pragma: no cover - 限流器不可用時不擋功能
    limiter = None


def _limit(rule):
    """有 limiter 才套用限流，否則 no-op（本機/測試不依賴 Redis）。"""
    def deco(fn):
        return limiter.limit(rule)(fn) if limiter is not None else fn
    return deco


def _requires_member_auth(fn):
    """
    站台未啟用會員系統時，這些端點視同不存在（404）。

    為什麼需要這道開關：core blueprint 是所有站台共用的，如果無條件註冊，
    Claire 這種沒有會員功能的站台會憑空多出一個公開註冊端點 —— 那是對線上
    站台的行為變更，不是純結構重構。預設關閉，站台在 config 明確開啟。
    """
    from functools import wraps

    @wraps(fn)
    def wrapper(*args, **kwargs):
        if not current_app.config.get('MEMBER_AUTH_ENABLED', False):
            return jsonify({"success": False, "error": "本站未啟用會員功能"}), 404
        return fn(*args, **kwargs)

    return wrapper


# =============================================================================
# 註冊（email + 密碼，成功即登入）
# =============================================================================

@bp.route('/auth/member/register', methods=['POST'])
@_limit("5 per minute")
@_requires_member_auth
def member_register():
    """
    會員註冊（email + 密碼），成功後直接發 JWT cookies（免再登入）。

    Request JSON:
        email, password   (必填)
        其餘欄位原樣傳給 signup hook，供站台領域擴充使用
        （例如 Polaris 傳 chart，註冊後自動歸戶命盤）。

    Response 200:
        {success, user, warning?, ...hook 回傳的 extra}
    """
    from core.backend_engine.factory import db
    from core.backend_engine.models import User, validate_password
    from core.backend_engine.schemas.user import UserSchema

    data = request.get_json(silent=True) or {}
    email = normalise_email(data.get("email"))
    if not is_valid_email(email):
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

    # 領域擴充點：hook 可能已在外部系統（如共用的 account.app_users）建好身分，
    # 所以底下一律「先查再建」，避免撞 unique 約束。
    hook_result = run_signup_hooks(email, data)

    user = User.query.filter_by(username=email).first()
    if user is not None:
        user.email = email  # view trigger upsert member_profiles
        user.set_password(password)
    else:
        if hook_result.extra:
            # 不應發生：hook 回報建檔成功，但本站查不到會員
            current_app.logger.error(
                f"member_register: signup hook 回報成功但查無會員 {email}")
            return jsonify({"success": False, "error": "會員建立失敗，請稍後再試"}), 500
        user = User(username=email, email=email, role='member', is_active=True)
        user.set_password(password)
        db.session.add(user)

    user.last_login = datetime.utcnow()
    try:
        db.session.commit()
    except Exception as exc:  # noqa: BLE001
        db.session.rollback()
        current_app.logger.error(f"member_register commit failed: {exc}")
        return jsonify({"success": False, "error": "註冊失敗，請稍後再試"}), 500

    # 與 /auth/login 相同：JWT 進 httpOnly cookies，回傳 user
    body = {
        "success": True,
        "user": UserSchema().dump(user),
        "warning": hook_result.warning,
    }
    body.update(hook_result.extra)

    response = jsonify(body)
    set_access_cookies(response, create_access_token(identity=str(user.id)))
    set_refresh_cookies(response, create_refresh_token(identity=str(user.id)))
    return response, 200


# =============================================================================
# 設定密碼
# =============================================================================

@bp.route('/auth/member/set-password', methods=['POST'])
@_limit("5 per minute")
@_requires_member_auth
def member_set_password():
    """以設定密碼信的 token 設定會員密碼。"""
    from core.backend_engine.factory import db
    from core.backend_engine.models import User

    data = request.get_json(silent=True) or {}
    payload, error = read_set_password_token(data.get("token") or "")
    if error:
        return jsonify({"success": False, "error": error}), 400

    user = User.query.get(payload.get("member_id"))
    if not user:
        return jsonify({"success": False, "error": "會員不存在"}), 404

    try:
        user.set_password(data.get("password") or "")  # 複雜度驗證 + bcrypt
        db.session.commit()
    except ValueError as ve:
        db.session.rollback()
        return jsonify({"success": False, "error": str(ve)}), 400

    return jsonify({"success": True, "message": "密碼已設定，請登入"})


# =============================================================================
# 重寄設定密碼信
# =============================================================================

@bp.route('/auth/member/resend-set-password', methods=['POST'])
@_limit("3 per minute")
@_requires_member_auth
def member_resend_set_password():
    """重寄設定密碼信（兼忘記密碼）。無論 email 是否存在一律回成功，避免帳號枚舉。"""
    from core.backend_engine.models import User

    data = request.get_json(silent=True) or {}
    email = normalise_email(data.get("email"))
    if not is_valid_email(email):
        return jsonify({"success": False, "error": "請提供有效的 email"}), 400

    user = User.query.filter_by(username=email).first()
    if user is not None and user.is_active:
        send_set_password_email(user.id, email)

    return jsonify({
        "success": True,
        "message": "若該 email 為會員，設定密碼信已寄出，請於 24 小時內完成設定。",
    })
