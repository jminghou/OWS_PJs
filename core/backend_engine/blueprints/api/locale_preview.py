"""
語言預覽通行證（「手環」）：讓編輯中的語言只給被授權的人看。

- 員工通行證：登入後台、有內容／商品／設定編輯權限的人按「開啟語言預覽」領取，12 小時有效、可看全部語言。
- 邀請通行證：給沒有後台帳號的翻譯／審稿人，限定語言與天數（1–14 天）。
- 通行證是 SECRET_KEY 簽章的 token，內容竄改即失效；「停用所有通行證」把版本號加一，已發出的全部作廢。
- 前台 middleware 把 token 存在 httpOnly cookie，每次進入編輯中的語言時呼叫 verify 驗證（結果快取 60 秒）。

GET  /locale-preview/verify?token=   公開；有效回 200，否則 404
POST /locale-preview/pass            員工通行證
POST /locale-preview/invites         邀請通行證（settings.update）
POST /locale-preview/revoke-all      停用所有通行證（settings.update）
"""
import time

from flask import current_app, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from itsdangerous import BadSignature, URLSafeSerializer

from core.backend_engine.blueprints.api import bp
from core.backend_engine.blueprints.api.utils import get_i18n_setting, get_site_languages
from core.backend_engine.factory import db
from core.backend_engine.models import Setting
from core.backend_engine.services.rbac import RBACService, require_permission

SALT = 'locale-preview-v1'
VERSION_KEY = 'locale_preview_version'
STAFF_HOURS = 12
INVITE_MAX_DAYS = 14
STAFF_PERMISSIONS = ['contents.update', 'products.update', 'settings.update', 'studio.write']


def _serializer():
    return URLSafeSerializer(current_app.config['SECRET_KEY'], salt=SALT)


def _version() -> int:
    try:
        return int(get_i18n_setting(VERSION_KEY, '1'))
    except (TypeError, ValueError):
        return 1


def _issue(kind, languages, seconds, user_id=None, note=None):
    expires = int(time.time()) + seconds
    token = _serializer().dumps({'k': kind, 'u': user_id, 'l': languages, 'e': expires, 'v': _version(), 'n': note})
    return {'token': token, 'expires_at': expires, 'languages': languages}


def verify_pass(token):
    """回傳通行證內容（dict），無效／過期／已停用回 None。"""
    try:
        data = _serializer().loads(token or '')
    except BadSignature:
        return None
    if not isinstance(data, dict) or data.get('v') != _version() or int(data.get('e') or 0) <= time.time():
        return None
    return data


@bp.route('/locale-preview/verify', methods=['GET'])
def api_locale_preview_verify():
    data = verify_pass(request.args.get('token'))
    if not data:
        return jsonify({'ok': False}), 404
    return jsonify({'ok': True, 'kind': data['k'], 'languages': data.get('l'), 'expires_at': data['e']}), 200


@bp.route('/locale-preview/pass', methods=['POST'])
@jwt_required()
def api_locale_preview_pass():
    user_id = int(get_jwt_identity())
    if not RBACService.has_any_permission(user_id, STAFF_PERMISSIONS):
        return jsonify({'message': 'Permission denied'}), 403
    return jsonify(_issue('staff', None, STAFF_HOURS * 3600, user_id=user_id)), 200


@bp.route('/locale-preview/invites', methods=['POST'])
@jwt_required()
@require_permission('settings.update')
def api_locale_preview_invite():
    data = request.get_json(silent=True) or {}
    days = data.get('days', 3)
    if type(days) is not int or not 1 <= days <= INVITE_MAX_DAYS:
        return jsonify({'message': f'days must be 1-{INVITE_MAX_DAYS}'}), 400
    languages = data.get('languages')
    site = get_site_languages()
    if not isinstance(languages, list) or not languages or any(lang not in site for lang in languages):
        return jsonify({'message': 'Choose languages from the site languages'}), 400
    note = (data.get('note') or '').strip()[:80] or None
    return jsonify(_issue('invite', list(dict.fromkeys(languages)), days * 86400,
                          user_id=int(get_jwt_identity()), note=note)), 200


@bp.route('/locale-preview/revoke-all', methods=['POST'])
@jwt_required()
@require_permission('settings.update')
def api_locale_preview_revoke_all():
    setting = Setting.query.filter_by(key=VERSION_KEY).first()
    nxt = str(_version() + 1)
    if setting:
        setting.value = nxt
    else:
        db.session.add(Setting(key=VERSION_KEY, value=nxt))
    db.session.commit()
    return jsonify({'message': 'All locale preview passes revoked'}), 200
