"""
Social Auth API（掛在 /api/v1/social-auth）

登入／註冊
    GET  /providers              公開：可用的 provider 與前端需要的公開設定
    POST /google                 {credential} → 200 登入／201 註冊（設 JWT cookies）
                                 409 {code:'needs_link'}：信箱已是會員 → 已設好待完成票，走 /ticket
    GET  /line/start             ?next=/路徑&mode=login|link → 302 到 LINE
    GET  /line/callback          LINE 轉回；處理完 302 到前端 {FRONTEND_URL}/login/social?status=…

待完成票（社群帳號已驗證，但要再證明一個信箱）：放在 httponly cookie，不放網址，避免信箱出現在網址列與紀錄裡
    GET  /ticket                 {provider, reason: needs_link|email_missing, email, name, picture}
    POST /ticket/email-code      {email} 寄驗證碼（needs_link 時只能寄到那個信箱）
    POST /ticket/complete        {email, code} → 連到該信箱的會員，或用它建新會員，並登入

會員中心（需登入）
    GET    /me/identities        {identities, password_set}
    POST   /me/link/google       {credential} 加連 Google
    （加連 LINE：/line/start?mode=link）
    DELETE /me/identities/<provider>   解除；最後一種登入方式不能解

前端回跳狀態（/login/social?status=）：ok（已登入）／pending（有待完成票）／error&reason=…
"""
import secrets
from urllib.parse import urlencode

from flask import current_app, jsonify, redirect, request, url_for
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    get_jwt_identity,
    jwt_required,
    set_access_cookies,
    set_refresh_cookies,
    verify_jwt_in_request,
)
from itsdangerous import BadSignature, URLSafeTimedSerializer

from core.backend_engine.factory import db, limiter
from core.backend_engine.models import User
from core.backend_engine.services.member_auth import is_valid_email, normalise_email
from packages.social_auth import hooks, service
from packages.social_auth.blueprint import social_auth_bp as bp
from packages.social_auth.providers import PROVIDERS, ProviderError, ProviderProfile, enabled_providers, google, line

FLOW_COOKIE = 'sa_line_flow'
TICKET_COOKIE = 'sa_ticket'
FLOW_MAX_AGE = 600       # LINE 授權頁停留上限
TICKET_MAX_AGE = 1800    # 收驗證碼、輸入的時間
COOKIE_PATH = '/api/v1/social-auth'
RETURN_PATH = '/login/social'


# ── 共用 ─────────────────────────────────────────────────────────────────────
def _error(message, status=400, **extra):
    return jsonify({'success': False, 'error': message, **extra}), status


def _serializer(salt):
    return URLSafeTimedSerializer(current_app.config['SECRET_KEY'], salt=f'social_auth.{salt}')


def _set_cookie(response, name, value, max_age):
    response.set_cookie(name, value, max_age=max_age, path=COOKIE_PATH, httponly=True,
                        secure=bool(current_app.config.get('JWT_COOKIE_SECURE', False)), samesite='Lax')


def _clear_cookie(response, name):
    response.delete_cookie(name, path=COOKIE_PATH)


def _set_login(response, user):
    set_access_cookies(response, create_access_token(identity=str(user.id)))
    set_refresh_cookies(response, create_refresh_token(identity=str(user.id)))


def _frontend(**params):
    import os
    base = (current_app.config.get('FRONTEND_URL') or os.environ.get('FRONTEND_URL') or 'http://localhost:3000').rstrip('/')
    query = urlencode({k: v for k, v in params.items() if v})
    return f'{base}{RETURN_PATH}' + (f'?{query}' if query else '')


def _safe_next(raw):
    """只接受站內相對路徑，避免被拿來做開放式轉址。"""
    if not raw or not isinstance(raw, str) or not raw.startswith('/') or raw.startswith('//') or raw.startswith('/\\'):
        return None
    return raw[:500]


def _current_user():
    try:
        verify_jwt_in_request(optional=True)
    except Exception:  # noqa: BLE001  token 過期等 → 當作沒登入
        return None
    uid = get_jwt_identity()
    user = db.session.get(User, int(uid)) if uid else None
    return user if user is not None and user.is_active else None


def _profile_to_dict(p: ProviderProfile):
    return {'provider': p.provider, 'subject': p.subject, 'email': p.email, 'email_verified': p.email_verified,
            'email_authoritative': p.email_authoritative, 'name': p.name, 'picture': p.picture}


def _issue_ticket(response, profile, reason):
    token = _serializer('ticket').dumps({'profile': _profile_to_dict(profile), 'reason': reason})
    _set_cookie(response, TICKET_COOKIE, token, TICKET_MAX_AGE)


def _read_ticket():
    raw = request.cookies.get(TICKET_COOKIE)
    if not raw:
        return None
    try:
        data = _serializer('ticket').loads(raw, max_age=TICKET_MAX_AGE)
    except BadSignature:
        return None
    return {'profile': ProviderProfile(**data['profile']), 'reason': data['reason']}


def _sign_in_json(profile):
    """登入／註冊並回 JSON；需要再證明信箱時設好待完成票、回 409。"""
    try:
        user, is_new = service.sign_in(profile)
        db.session.commit()
    except (service.NeedsLink, service.EmailMissing) as exc:
        db.session.rollback()
        needs_link = isinstance(exc, service.NeedsLink)
        response = jsonify({'success': False, 'code': 'needs_link' if needs_link else 'email_missing',
                            'error': '這個 Email 已經是會員，請收一組驗證碼來連結。' if needs_link
                            else '請提供 Email 完成註冊。',
                            'can_verify': hooks.email_codes() is not None})
        response.status_code = 409
        _issue_ticket(response, profile, 'needs_link' if needs_link else 'email_missing')
        return response
    except service.AccountDisabled:
        db.session.rollback()
        return _error('此帳號已停用，如有疑問請聯絡我們。', 403, code='account_disabled')
    except Exception as exc:  # noqa: BLE001
        db.session.rollback()
        current_app.logger.error(f'social_auth {profile.provider} 登入失敗：{exc}')
        return _error('登入失敗，請稍後再試', 500)

    current_app.logger.info(f'social_auth.{"register" if is_new else "login"} provider={profile.provider} user={user.id}')
    from core.backend_engine.schemas.user import UserSchema
    response = jsonify({'success': True, 'is_new': is_new, 'user': UserSchema().dump(user)})
    response.status_code = 201 if is_new else 200
    _set_login(response, user)
    _clear_cookie(response, TICKET_COOKIE)
    return response


# ── 公開資訊、Google ─────────────────────────────────────────────────────────
@bp.route('/providers', methods=['GET'])
def providers():
    return jsonify({'success': True, 'providers': enabled_providers()})


@bp.route('/google', methods=['POST'])
@limiter.limit('10 per minute')
def google_sign_in():
    if not google.is_configured():
        return _error('Google 登入尚未開放', 404)
    data = request.get_json(silent=True) or {}
    try:
        profile = google.verify(data.get('credential'))
    except ProviderError as exc:
        return _error(str(exc), 400, code='invalid_credential')
    return _sign_in_json(profile)


# ── LINE ─────────────────────────────────────────────────────────────────────
def _line_redirect_uri():
    return current_app.config.get('LINE_REDIRECT_URI') or url_for('social_auth.line_callback', _external=True)


@bp.route('/line/start', methods=['GET'])
@limiter.limit('20 per minute')
def line_start():
    if not line.is_configured():
        return redirect(_frontend(status='error', reason='line_unavailable'))
    mode = 'link' if request.args.get('mode') == 'link' else 'login'
    next_path = _safe_next(request.args.get('next'))
    uid = None
    if mode == 'link':
        user = _current_user()
        if user is None:
            return redirect(_frontend(status='error', reason='login_required', next=next_path))
        uid = user.id

    state, nonce = secrets.token_urlsafe(24), secrets.token_urlsafe(24)
    verifier, challenge = line.new_pkce()
    flow = _serializer('line_flow').dumps({'state': state, 'nonce': nonce, 'verifier': verifier,
                                           'next': next_path, 'mode': mode, 'uid': uid})
    response = redirect(line.authorize_url(state=state, nonce=nonce, code_challenge=challenge,
                                           redirect_uri=_line_redirect_uri()))
    _set_cookie(response, FLOW_COOKIE, flow, FLOW_MAX_AGE)
    return response


@bp.route('/line/callback', methods=['GET'])
@limiter.limit('20 per minute')
def line_callback():
    def done(**params):
        response = redirect(_frontend(**params))
        _clear_cookie(response, FLOW_COOKIE)
        return response

    raw = request.cookies.get(FLOW_COOKIE)
    try:
        flow = _serializer('line_flow').loads(raw, max_age=FLOW_MAX_AGE) if raw else None
    except BadSignature:
        flow = None
    if not flow or not secrets.compare_digest(str(flow['state']), request.args.get('state') or ''):
        return done(status='error', reason='expired')
    next_path = flow.get('next')
    if request.args.get('error'):  # 使用者在 LINE 按了取消
        return done(status='error', reason='cancelled', next=next_path)

    try:
        profile = line.exchange(request.args.get('code'), verifier=flow['verifier'],
                                redirect_uri=_line_redirect_uri(), nonce=flow['nonce'])
    except ProviderError:
        return done(status='error', reason='line_failed', next=next_path)

    # 會員中心加連 LINE
    if flow.get('mode') == 'link':
        user = db.session.get(User, int(flow['uid'])) if flow.get('uid') else None
        if user is None or not user.is_active:
            return done(status='error', reason='login_required', next=next_path)
        try:
            service.link_to_user(user, profile)
            db.session.commit()
        except service.LinkConflict:
            db.session.rollback()
            return done(status='error', reason='link_conflict', next=next_path)
        current_app.logger.info(f'social_auth.link provider=line user={user.id}')
        return done(status='linked', provider='line', next=next_path)

    # 登入／註冊
    try:
        user, is_new = service.sign_in(profile)
        db.session.commit()
    except (service.NeedsLink, service.EmailMissing) as exc:
        db.session.rollback()
        response = done(status='pending', next=next_path)
        _issue_ticket(response, profile, 'needs_link' if isinstance(exc, service.NeedsLink) else 'email_missing')
        return response
    except service.AccountDisabled:
        db.session.rollback()
        return done(status='error', reason='account_disabled', next=next_path)
    except Exception as exc:  # noqa: BLE001
        db.session.rollback()
        current_app.logger.error(f'social_auth line 登入失敗：{exc}')
        return done(status='error', reason='server', next=next_path)

    current_app.logger.info(f'social_auth.{"register" if is_new else "login"} provider=line user={user.id}')
    response = done(status='ok', new='1' if is_new else None, next=next_path)
    _set_login(response, user)
    _clear_cookie(response, TICKET_COOKIE)
    return response


# ── 待完成票：用 Email 驗證碼補完 ─────────────────────────────────────────────
@bp.route('/ticket', methods=['GET'])
def ticket_info():
    ticket = _read_ticket()
    if ticket is None:
        return _error('登入流程已逾時，請重新開始。', 404, code='no_ticket')
    p = ticket['profile']
    return jsonify({'success': True, 'provider': p.provider, 'reason': ticket['reason'],
                    'email': p.email if ticket['reason'] == 'needs_link' else None,
                    'name': p.name, 'picture': p.picture, 'can_verify': hooks.email_codes() is not None})


def _ticket_email(ticket, data):
    """needs_link 只能用社群帳號給的那個信箱；email_missing 由使用者填。"""
    if ticket['reason'] == 'needs_link':
        return ticket['profile'].email
    return normalise_email(data.get('email'))


@bp.route('/ticket/email-code', methods=['POST'])
@limiter.limit('10 per minute')
def ticket_email_code():
    ticket = _read_ticket()
    if ticket is None:
        return _error('登入流程已逾時，請重新開始。', 404, code='no_ticket')
    codes = hooks.email_codes()
    if codes is None:
        return _error('本站尚未開放這項功能，請先用原本的方式登入。', 501)
    email = _ticket_email(ticket, request.get_json(silent=True) or {})
    if not is_valid_email(email):
        return _error('請提供有效的 Email')
    try:
        codes[0](email)
    except hooks.CodeRateLimited as rl:
        return _error(f'請稍候 {rl.retry_after} 秒再重新取得驗證碼', 429, retry_after=rl.retry_after)
    return jsonify({'success': True, 'email': email, 'message': f'驗證碼已寄到 {email}，請於 10 分鐘內輸入。'})


@bp.route('/ticket/complete', methods=['POST'])
@limiter.limit('10 per minute')
def ticket_complete():
    ticket = _read_ticket()
    if ticket is None:
        return _error('登入流程已逾時，請重新開始。', 404, code='no_ticket')
    codes = hooks.email_codes()
    if codes is None:
        return _error('本站尚未開放這項功能，請先用原本的方式登入。', 501)
    data = request.get_json(silent=True) or {}
    email = _ticket_email(ticket, data)
    if not is_valid_email(email):
        return _error('請提供有效的 Email')
    try:
        codes[1](email, (data.get('code') or '').strip())
        user, is_new = service.complete_with_email(ticket['profile'], email)
        db.session.commit()
    except hooks.CodeInvalid as exc:
        db.session.commit()  # 錯誤次數要落庫
        return _error(str(exc) or '驗證碼錯誤', 400, code='invalid_code')
    except service.LinkConflict as exc:
        db.session.rollback()
        return _error(str(exc), 409, code='link_conflict')
    except service.AccountDisabled:
        db.session.rollback()
        return _error('此帳號已停用，如有疑問請聯絡我們。', 403, code='account_disabled')

    p = ticket['profile']
    current_app.logger.info(f'social_auth.{"register" if is_new else "link"} provider={p.provider} user={user.id} via=email_code')
    from core.backend_engine.schemas.user import UserSchema
    response = jsonify({'success': True, 'is_new': is_new, 'user': UserSchema().dump(user)})
    response.status_code = 201 if is_new else 200
    _set_login(response, user)
    _clear_cookie(response, TICKET_COOKIE)
    return response


# ── 會員中心 ─────────────────────────────────────────────────────────────────
def _me():
    user = db.session.get(User, int(get_jwt_identity()))
    return user if user is not None and user.is_active else None


def _identities_payload(user):
    return {'success': True, 'identities': service.identities_for(user), 'password_set': user.has_usable_password,
            'providers': list(enabled_providers().keys())}


@bp.route('/me/identities', methods=['GET'])
@jwt_required()
def my_identities():
    user = _me()
    if user is None:
        return _error('會員不存在或已停用', 401)
    return jsonify(_identities_payload(user))


@bp.route('/me/link/google', methods=['POST'])
@jwt_required()
@limiter.limit('10 per minute')
def link_google():
    user = _me()
    if user is None:
        return _error('會員不存在或已停用', 401)
    if not google.is_configured():
        return _error('Google 登入尚未開放', 404)
    try:
        profile = google.verify((request.get_json(silent=True) or {}).get('credential'))
        service.link_to_user(user, profile)
        db.session.commit()
    except ProviderError as exc:
        return _error(str(exc), 400, code='invalid_credential')
    except service.LinkConflict as exc:
        db.session.rollback()
        return _error(str(exc), 409, code='link_conflict')
    current_app.logger.info(f'social_auth.link provider=google user={user.id}')
    return jsonify(_identities_payload(user))


@bp.route('/me/identities/<provider>', methods=['DELETE'])
@jwt_required()
def unlink(provider):
    user = _me()
    if user is None:
        return _error('會員不存在或已停用', 401)
    if provider not in PROVIDERS:
        return _error('不支援的登入方式', 404)
    try:
        service.unlink(user, provider)
        db.session.commit()
    except service.LinkConflict as exc:
        db.session.rollback()
        return _error(str(exc), 409, code='last_method')
    current_app.logger.info(f'social_auth.unlink provider={provider} user={user.id}')
    return jsonify(_identities_payload(user))
