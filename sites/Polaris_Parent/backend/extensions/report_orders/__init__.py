"""
Report Orders Extension — 客製命理報告的建單與查詢（會員 v2，Polaris 專屬）

註冊於 /api/v1，全部需要登入（JWT）。

    POST /api/v1/report-orders              建立待付款訂單（需已驗證 Email、同意交易政策）
    GET  /api/v1/report-orders              我的報告訂單
    GET  /api/v1/report-orders/<order_no>   單筆訂單（只能看自己的）

付款模式由 REPORT_PAYMENT_MODE 決定，目前只支援 placeholder：訂單停在待付款，
不建付款嘗試、不交接紫微生產（docs/membership-v2-architecture.md §3）。
"""

from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from core.backend_engine.factory import db
from core.backend_engine.models import User
from core.backend_engine.services.member_auth import normalise_email
from packages.commerce.models import Order
from sites.Polaris_Parent.backend.extensions.member_account.service import is_email_verified

from . import notify, service
from .validation import validate_order

try:
    from core.backend_engine.factory import limiter
except Exception:  # pragma: no cover
    limiter = None

bp = Blueprint('report_orders', __name__)

SUPPORTED_PAYMENT_MODES = ('placeholder',)


def _limit(rule):
    def deco(fn):
        return limiter.limit(rule)(fn) if limiter is not None else fn
    return deco


def _error(message, status=400, **extra):
    return jsonify({'success': False, 'error': message, **extra}), status


def _payment_mode():
    return current_app.config.get('REPORT_PAYMENT_MODE', 'placeholder')


def _current_user():
    user = db.session.get(User, int(get_jwt_identity()))
    return user if user is not None and user.is_active else None


def _engine():
    from sites.Polaris_Parent.backend.extensions.astrology import _get_engine

    return _get_engine()


def _save_chart(payload):
    from sites.Polaris_Parent.backend.extensions.astrology import _ziwei_save_and_register

    return _ziwei_save_and_register(payload)


@bp.route('/report-orders', methods=['POST'])
@_limit('10 per minute')
@jwt_required()
def create_order():
    user = _current_user()
    if user is None:
        return _error('會員不存在或已停用', 401)
    email = normalise_email(user.email or user.username)
    if not is_email_verified(user.id, email):
        return _error('請先完成 Email 驗證再送出訂單', 403, code='email_unverified')

    mode = _payment_mode()
    if mode not in SUPPORTED_PAYMENT_MODES:
        current_app.logger.error(f'REPORT_PAYMENT_MODE={mode} 尚未實作')
        return _error('目前無法建立訂單，請稍後再試', 503)

    data = request.get_json(silent=True) or {}
    submission_key = data.get('submission_key')
    if not isinstance(submission_key, str) or not 8 <= len(submission_key) <= 64:
        return _error('缺少送出編號，請重新整理頁面後再試')

    # 重送同一份草稿：直接回原訂單（不重驗、不再呼叫紫微）
    existing = service.find_by_submission_key(submission_key)
    if existing is not None and existing.user_id == user.id:
        return jsonify({'success': True, 'created': False, 'order': service.order_summary(existing)})

    if data.get('policy_consented') is not True or data.get('policy_version') != service.POLICY_VERSION:
        return _error('請先閱讀並同意交易政策', 400, code='policy_required', policy_version=service.POLICY_VERSION)

    clean, errors = validate_order(data)
    if errors:
        # 欄位錯誤放在 errors：前端 request() 會把它帶進 RequestError.errors
        return _error('資料有誤，請檢查後再送出', 400, code='invalid', errors=errors)

    eng = _engine()
    if eng is None:
        return _error('排盤引擎暫時無法使用，請稍後再試', 503)

    try:
        order, created = service.create_report_order(user, email, clean, submission_key, eng, _save_chart, mode)
    except service.OrderError as exc:
        db.session.rollback()
        return _error(exc.message, exc.status, code=exc.code)

    if created:
        notify.send_order_created(order, email, mode)
    return jsonify({'success': True, 'created': created, 'order': service.order_summary(order)}), 201 if created else 200


@bp.route('/report-orders', methods=['GET'])
@jwt_required()
def list_orders():
    user = _current_user()
    if user is None:
        return _error('會員不存在或已停用', 401)
    orders = (Order.query.filter_by(user_id=user.id)
              .filter(Order.items.isnot(None))
              .order_by(Order.created_at.desc()).limit(100).all())
    report_orders = [o for o in orders if o.order_items]
    return jsonify({'success': True, 'orders': [service.order_summary(o) for o in report_orders]})


@bp.route('/report-orders/<order_no>', methods=['GET'])
@jwt_required()
def get_order(order_no):
    user = _current_user()
    if user is None:
        return _error('會員不存在或已停用', 401)
    order = Order.query.filter_by(order_no=order_no, user_id=user.id).first()
    if order is None or not order.order_items:
        return _error('找不到這筆訂單', 404)
    return jsonify({'success': True, 'order': service.order_summary(order)})
