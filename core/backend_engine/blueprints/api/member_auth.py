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

# 同一信箱冷卻：同一個（正規化後）email 在這段時間內只會真的寄出一封。
# 可由 config['RESEND_SET_PASSWORD_COOLDOWN_SECONDS'] 覆寫。
RESEND_SET_PASSWORD_COOLDOWN = 600
_RESEND_COOLDOWN_KEY_PREFIX = 'resend_set_pw:'


def _acquire_resend_cooldown(email):
    """
    嘗試取得此 email 的重寄冷卻鎖；回傳 True 代表可以寄信。

    用 factory 的 throttle_cache.add（鍵不存在才寫入；Redis 為 SET NX 原子操作）當鎖：
    搶到才寄。鍵是 email 的 sha256，不把原始 email 放進快取或 log。

    為什麼不用 factory.cache：api blueprint 每次寫入成功（含本端點自己的 200）都會
    cache.clear() 清回應快取，冷卻鍵放那裡會立刻被清掉。throttle_cache 與 cache
    同後端但 KEY_PREFIX 獨立，不受該 clear 影響。

    SimpleCache（無 Redis 時）的 add 不檢查過期：鍵過期但尚未被 prune 時仍回 False。
    所以 add 失敗後再以 has() 確認鍵是否真的還有效，已過期就覆寫並放行。

    快取未初始化或後端出錯時 fail-open（照寄），只記 warning ——
    此時仍有 IP 層級的 3/min 限流兜底，不讓快取故障變成忘記密碼功能故障。
    """
    import hashlib

    key = _RESEND_COOLDOWN_KEY_PREFIX + hashlib.sha256(email.encode('utf-8')).hexdigest()
    timeout = int(current_app.config.get(
        'RESEND_SET_PASSWORD_COOLDOWN_SECONDS', RESEND_SET_PASSWORD_COOLDOWN))
    try:
        from core.backend_engine.factory import throttle_cache
        if throttle_cache.add(key, 1, timeout=timeout):
            return True
        if not throttle_cache.has(key):  # 過期殘留（SimpleCache）
            throttle_cache.set(key, 1, timeout=timeout)
            return True
        return False
    except Exception as exc:  # noqa: BLE001 - 快取故障不擋功能
        current_app.logger.warning(
            f"member_resend_set_password: 冷卻鎖不可用，略過冷卻（{type(exc).__name__}）")
        return True


@bp.route('/auth/member/resend-set-password', methods=['POST'])
@_limit("3 per minute")
@_requires_member_auth
def member_resend_set_password():
    """
    重寄設定密碼信（兼忘記密碼）。無論 email 是否存在一律回成功，避免帳號枚舉。

    此端點免登入，任何人都能對任一 email 觸發寄信，所以除了 IP 限流（3/min）之外，
    再加「同一信箱冷卻」：同一 email 在 RESEND_SET_PASSWORD_COOLDOWN 秒內只寄一封，
    避免換 IP 對同一個信箱轟炸。

    不洩漏是否註冊的設計：
    - 冷卻對所有格式有效的 email 一視同仁，先搶冷卻鎖、才查會員；
      未註冊的 email 也會佔用冷卻，行為與已註冊者一致。
    - 被冷卻擋下時不寄信，但回應與正常情形完全相同（200、同一份 JSON），
      不回 429、不加任何可區分的欄位或文案。

    冷卻鍵存在 throttle_cache（不是 cache），理由見 _acquire_resend_cooldown。

    不加 Turnstile：目前沒有前端呼叫此端點，且冷卻 + IP 限流已足以擋濫寄。
    """
    from core.backend_engine.models import User

    data = request.get_json(silent=True) or {}
    email = normalise_email(data.get("email"))
    if not is_valid_email(email):
        return jsonify({"success": False, "error": "請提供有效的 email"}), 400

    if _acquire_resend_cooldown(email):
        user = User.query.filter_by(username=email).first()
        if user is not None and user.is_active:
            send_set_password_email(user.id, email)

    return jsonify({
        "success": True,
        "message": "若該 email 為會員，設定密碼信已寄出，請於 24 小時內完成設定。",
    })
