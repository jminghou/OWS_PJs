"""
Member Account Extension — 會員 v2 註冊、重設密碼與 Email 驗證（Polaris 專屬）

註冊於 /api/v1。Email＋密碼登入沿用 core 的 POST /api/v1/auth/login。

    POST /api/v1/member/email-code      寄驗證碼 {email, purpose: register|reset}；
                                        purpose=verify 需登入，email 取自本人
    POST /api/v1/member/register        {email, code, password} 驗證碼通過才建帳號，成功即登入
    POST /api/v1/member/password-reset  {email, code, password} 重設密碼，成功即登入
    POST /api/v1/member/verify-email    {code}（需登入）驗證本人目前的 Email
    GET  /api/v1/member/verification    （需登入）{email, email_verified}

防帳號枚舉：寄驗證碼的回應與 Email 是否為會員無關；已是會員者申請註冊會收到
「已是會員」提醒信，未註冊者申請重設密碼則不寄信。

與 v1 的差異：core 的 /auth/member/register 註冊不驗證 Email。v2 的結帳流程以
blog.member_email_verifications 判斷是否已驗證，所以舊入口建立的帳號在結帳前
仍須完成驗證（verify-email 或 password-reset 皆會寫入驗證紀錄）。
"""

from datetime import datetime

from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    get_jwt_identity,
    jwt_required,
    set_access_cookies,
    set_refresh_cookies,
)

from core.backend_engine.factory import db
from core.backend_engine.models import User, validate_password
from core.backend_engine.services.member_auth import is_valid_email, normalise_email

from . import service

try:
    from core.backend_engine.factory import limiter
except Exception:  # pragma: no cover
    limiter = None

bp = Blueprint('member_account', __name__)


def _limit(rule):
    def deco(fn):
        return limiter.limit(rule)(fn) if limiter is not None else fn
    return deco


def _error(message, status=400, **extra):
    return jsonify({'success': False, 'error': message, **extra}), status


def _password_error(password):
    try:
        validate_password(password or '')
    except ValueError as exc:
        return str(exc)
    return None


def _login_response(user, status=200):
    from core.backend_engine.schemas.user import UserSchema

    response = jsonify({'success': True, 'user': UserSchema().dump(user),
                        'email_verified': True})
    response.status_code = status
    set_access_cookies(response, create_access_token(identity=str(user.id)))
    set_refresh_cookies(response, create_refresh_token(identity=str(user.id)))
    return response


def _current_user():
    user = db.session.get(User, int(get_jwt_identity()))
    return user if user is not None and user.is_active else None


@bp.route('/member/email-code', methods=['POST'])
@_limit('10 per minute')
def send_email_code():
    data = request.get_json(silent=True) or {}
    purpose = data.get('purpose')
    if purpose not in service.PURPOSES:
        return _error('purpose 必須是 register、reset 或 verify')

    if purpose == 'verify':
        return _send_verify_code()

    email = normalise_email(data.get('email'))
    if not is_valid_email(email):
        return _error('請提供有效的 Email')

    try:
        code = service.issue_code(email, purpose)
    except service.RateLimited as rl:
        return _error(f'請稍候 {rl.retry_after} 秒再重新取得驗證碼', 429, retry_after=rl.retry_after)

    exists = User.query.filter_by(username=email).first() is not None
    if purpose == 'register':
        if exists:
            service.send_already_member_email(email)
        else:
            service.send_code_email(email, purpose, code)
    elif exists:  # reset：未註冊的 Email 不寄信，但回應相同
        service.send_code_email(email, purpose, code)

    return jsonify({'success': True, 'message': '若這個 Email 可以使用，驗證碼已寄出，請於 10 分鐘內輸入。'})


@jwt_required()
def _send_verify_code():
    user = _current_user()
    if user is None:
        return _error('會員不存在或已停用', 401)
    email = normalise_email(user.email or user.username)
    if service.is_email_verified(user.id, email):
        return jsonify({'success': True, 'already_verified': True})
    try:
        code = service.issue_code(email, 'verify')
    except service.RateLimited as rl:
        return _error(f'請稍候 {rl.retry_after} 秒再重新取得驗證碼', 429, retry_after=rl.retry_after)
    service.send_code_email(email, 'verify', code)
    return jsonify({'success': True, 'message': f'驗證碼已寄到 {email}，請於 10 分鐘內輸入。'})


@bp.route('/member/register', methods=['POST'])
@_limit('10 per minute')
def register():
    data = request.get_json(silent=True) or {}
    email = normalise_email(data.get('email'))
    password = data.get('password') or ''
    if not is_valid_email(email):
        return _error('請提供有效的 Email')
    pw_error = _password_error(password)
    if pw_error:
        return _error(pw_error)

    try:
        service.consume_code(email, 'register', data.get('code'))
    except service.CodeError as exc:
        return _error(str(exc))

    if User.query.filter_by(username=email).first() is not None:
        db.session.rollback()
        return _error('這個 Email 已經是會員，請直接登入或使用忘記密碼。', 409)

    user = User(username=email, email=email, role='member', is_active=True)
    user.set_password(password)
    user.last_login = datetime.utcnow()
    db.session.add(user)
    try:
        db.session.flush()  # 取得 id（Polaris 經 blog.users view 的 trigger 寫入 account.app_users）
        service.mark_verified(user.id, email)
        db.session.commit()
    except Exception as exc:  # noqa: BLE001
        db.session.rollback()
        current_app.logger.error(f'member register 失敗 {email}：{exc}')
        return _error('註冊失敗，請稍後再試', 500)
    return _login_response(user, 201)


@bp.route('/member/password-reset', methods=['POST'])
@_limit('10 per minute')
def password_reset():
    data = request.get_json(silent=True) or {}
    email = normalise_email(data.get('email'))
    password = data.get('password') or ''
    if not is_valid_email(email):
        return _error('請提供有效的 Email')
    pw_error = _password_error(password)
    if pw_error:
        return _error(pw_error)

    try:
        service.consume_code(email, 'reset', data.get('code'))
    except service.CodeError as exc:
        return _error(str(exc))

    user = User.query.filter_by(username=email).first()
    if user is None or not user.is_active:
        # 正常不會發生：未註冊的 Email 不會收到重設驗證碼
        db.session.rollback()
        return _error('驗證碼已失效，請重新取得')

    user.set_password(password)
    user.last_login = datetime.utcnow()
    service.mark_verified(user.id, email)  # 能收到驗證碼即證明擁有此 Email
    db.session.commit()
    return _login_response(user)


@bp.route('/member/verify-email', methods=['POST'])
@_limit('10 per minute')
@jwt_required()
def verify_email():
    user = _current_user()
    if user is None:
        return _error('會員不存在或已停用', 401)
    email = normalise_email(user.email or user.username)
    data = request.get_json(silent=True) or {}
    try:
        service.consume_code(email, 'verify', data.get('code'))
    except service.CodeError as exc:
        return _error(str(exc))
    service.mark_verified(user.id, email)
    db.session.commit()
    return jsonify({'success': True, 'email': email, 'email_verified': True})


@bp.route('/member/verification', methods=['GET'])
@jwt_required()
def verification_status():
    user = _current_user()
    if user is None:
        return _error('會員不存在或已停用', 401)
    email = normalise_email(user.email or user.username)
    return jsonify({'success': True, 'email': email,
                    'email_verified': service.is_email_verified(user.id, email)})
