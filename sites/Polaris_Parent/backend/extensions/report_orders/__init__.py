"""
Report Orders Extension — 客製命理報告的建單與查詢（會員 v2，Polaris 專屬）

註冊於 /api/v1，全部需要登入（JWT）。

公開：
    GET  /api/v1/report-payment-mode                 目前付款模式（結帳頁說明用，不含帳號）

會員端：
    POST /api/v1/report-orders                       建立待付款訂單（需已驗證 Email、同意交易政策）
    GET  /api/v1/report-orders                       我的報告訂單
    GET  /api/v1/report-orders/<order_no>            單筆訂單（只能看自己的）
    POST /api/v1/report-orders/<order_no>/transfer   人工收款：回報轉帳（末五碼、日期、金額）

管理端（@require_permission）：
    GET  /api/v1/admin/report-orders                             訂單列表（report_orders.read）
    POST /api/v1/admin/report-orders/<order_no>/confirm-payment  確認收款（report_orders.confirm_payment）
    POST /api/v1/admin/report-orders/<order_no>/reject-transfer  退回轉帳回報（report_orders.confirm_payment）

CLI：flask --app <site> report_orders expire-overdue   取消逾期未回報轉帳的訂單（可排程）

付款模式由 REPORT_PAYMENT_MODE 決定（docs/membership-v2-architecture.md §3）：
- placeholder：只建待付款訂單，不能付款、不交接生產
- manual：人工收款，需設定 MANUAL_PAYMENT_*；匯款資訊不齊時不接受下單
付款模式記在每筆訂單（orders.payment_method），切換模式不影響已成立的訂單。
"""

from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from datetime import datetime, timedelta

import click

from core.backend_engine.factory import db
from core.backend_engine.models import User
from core.backend_engine.services.member_auth import normalise_email
from core.backend_engine.services.rbac import require_permission
from core.backend_engine.services.rbac_seed import register_permissions
from packages.commerce.models import Order
from sites.Polaris_Parent.backend.extensions.member_account.service import is_email_verified

from . import notify, payment, service
from .validation import validate_order

try:
    from core.backend_engine.factory import limiter
except Exception:  # pragma: no cover
    limiter = None

bp = Blueprint('report_orders', __name__)

SUPPORTED_PAYMENT_MODES = ('placeholder', 'manual')

# (code, module, action, name_zh, name_en)；admin 角色自動擁有，其他角色需另行指派
REPORT_ORDER_PERMISSIONS = [
    ('report_orders.read', 'report_orders', 'read', '檢視報告訂單', 'Read Report Orders'),
    ('report_orders.confirm_payment', 'report_orders', 'confirm_payment', '確認人工收款',
     'Confirm Manual Payments'),
]
register_permissions(REPORT_ORDER_PERMISSIONS)


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


@bp.route('/report-payment-mode', methods=['GET'])
def payment_mode():
    """結帳頁顯示付款說明用：只回模式與匯款天數，不含匯款帳號（帳號在訂單成立後才顯示）。"""
    mode = _payment_mode()
    return jsonify({'success': True, 'mode': mode,
                    'available': mode in SUPPORTED_PAYMENT_MODES and (mode != 'manual' or payment.manual_bank_info() is not None),
                    'deadline_days': payment.deadline_days() if mode == 'manual' else None})


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

    bank, expires_at = None, None
    if mode == 'manual':
        bank = payment.manual_bank_info()
        if bank is None:
            current_app.logger.error('REPORT_PAYMENT_MODE=manual 但 MANUAL_PAYMENT_* 匯款資訊未設定完整')
            return _error('目前無法建立訂單，請稍後再試', 503)
        expires_at = datetime.utcnow() + timedelta(days=payment.deadline_days())

    eng = _engine()
    if eng is None:
        return _error('排盤引擎暫時無法使用，請稍後再試', 503)

    try:
        order, created = service.create_report_order(user, email, clean, submission_key, eng, _save_chart, mode,
                                                     expires_at=expires_at)
    except service.OrderError as exc:
        db.session.rollback()
        return _error(exc.message, exc.status, code=exc.code)

    if created:
        notify.send_order_created(order, email, mode, bank)
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
    _expire_overdue()
    order = Order.query.filter_by(order_no=order_no, user_id=user.id).first()
    if order is None or not order.order_items:
        return _error('找不到這筆訂單', 404)
    return jsonify({'success': True, 'order': service.order_summary(order)})


@bp.route('/report-orders/<order_no>/transfer', methods=['POST'])
@_limit('10 per minute')
@jwt_required()
def report_transfer(order_no):
    user = _current_user()
    if user is None:
        return _error('會員不存在或已停用', 401)
    order = Order.query.filter_by(order_no=order_no, user_id=user.id).first()
    if order is None or not order.order_items:
        return _error('找不到這筆訂單', 404)
    try:
        attempt = payment.report_transfer(order, request.get_json(silent=True) or {})
    except service.OrderError as exc:
        db.session.rollback()
        return _error(exc.message, exc.status, code=exc.code, errors=getattr(exc, 'errors', None))
    notify.send_transfer_reported(order, attempt, normalise_email(user.email or user.username))
    return jsonify({'success': True, 'order': service.order_summary(order)})


# ── 管理端 ─────────────────────────────────────────────────────────────────
def _buyer_email(order):
    buyer = db.session.get(User, order.user_id)
    return normalise_email(buyer.email or buyer.username) if buyer else None


def _expire_overdue():
    """取消逾期訂單並通知會員（查詢時順便執行；也可用 CLI 排程）。回傳取消筆數。"""
    expired = payment.expire_overdue()
    for order in expired:
        email = _buyer_email(order)
        if email:
            notify.send_order_expired(order, email)
    return len(expired)


def _admin_row(order):
    row = service.order_summary(order)
    row['buyer_email'] = _buyer_email(order)
    return row


@bp.route('/admin/report-orders', methods=['GET'])
@jwt_required()
@require_permission('report_orders.read')
def admin_list_orders():
    _expire_overdue()
    status = request.args.get('status', 'pending')
    q = Order.query.filter(Order.payment_method.in_(SUPPORTED_PAYMENT_MODES))
    if status != 'all':
        q = q.filter(Order.status == status)
    orders = [o for o in q.order_by(Order.created_at.desc()).limit(200).all() if o.order_items]
    rows = [_admin_row(o) for o in orders]
    if request.args.get('awaiting') == '1':  # 只看會員已回報、待確認的
        rows = [r for r in rows if ((r['payment'] or {}).get('transfer') or {}).get('status') == 'created']
    return jsonify({'success': True, 'orders': rows})


def _admin_order(order_no):
    order = Order.query.filter_by(order_no=order_no).first()
    return order if order is not None and order.order_items else None


@bp.route('/admin/report-orders/<order_no>/confirm-payment', methods=['POST'])
@jwt_required()
@require_permission('report_orders.confirm_payment')
def admin_confirm_payment(order_no):
    order = _admin_order(order_no)
    if order is None:
        return _error('找不到這筆訂單', 404)
    data = request.get_json(silent=True) or {}
    admin_id = int(get_jwt_identity())
    try:
        payment.confirm_manual_payment(order, admin_id, data.get('received_amount'),
                                       data.get('last5'), data.get('note'))
    except service.OrderError as exc:
        db.session.rollback()
        return _error(exc.message, exc.status, code=exc.code)
    current_app.logger.info(f'manual payment confirmed {order.order_no} by admin {admin_id}')
    email = _buyer_email(order)
    if email:
        notify.send_payment_confirmed(order, email)
    return jsonify({'success': True, 'order': _admin_row(order)})


@bp.route('/admin/report-orders/<order_no>/reject-transfer', methods=['POST'])
@jwt_required()
@require_permission('report_orders.confirm_payment')
def admin_reject_transfer(order_no):
    order = _admin_order(order_no)
    if order is None:
        return _error('找不到這筆訂單', 404)
    try:
        attempt = payment.reject_transfer(order, int(get_jwt_identity()),
                                          (request.get_json(silent=True) or {}).get('reason'))
    except service.OrderError as exc:
        db.session.rollback()
        return _error(exc.message, exc.status, code=exc.code)
    email = _buyer_email(order)
    if email:
        notify.send_transfer_rejected(order, attempt, email)
    return jsonify({'success': True, 'order': _admin_row(order)})


@bp.cli.command('expire-overdue')
def expire_overdue_command():
    """取消逾期未回報轉帳的人工收款訂單（建議每小時排程一次）。"""
    click.echo(f'cancelled {_expire_overdue()} overdue order(s)')
