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

from urllib.parse import quote

from flask import Blueprint, Response, current_app, jsonify, request, url_for
from flask_jwt_extended import get_jwt_identity, jwt_required

from datetime import datetime, timedelta

import os

import click

from core.backend_engine.factory import db
from core.backend_engine.models import User
from core.backend_engine.services.member_auth import normalise_email
from core.backend_engine.services.rbac import RBACService, require_permission
from core.backend_engine.services.rbac_seed import register_permissions
from packages.commerce.models import Order, OrderItem
from sites.Polaris_Parent.backend.models import ReportConsultation, ReportFulfillment, ReportPrintJob, Shipment
from sites.Polaris_Parent.backend.extensions.member_account.service import is_email_verified

from . import delivery, design, handoff, jobs, notify, payment, physical, private_storage, proofs, service
from .validation import validate_order, validate_shipping

try:
    from core.backend_engine.factory import limiter
except Exception:  # pragma: no cover
    limiter = None

bp = Blueprint('report_orders', __name__)


@bp.before_app_request
def _start_background_jobs():
    # 背景排程由第一個請求啟動（CLI 不會收到請求，所以 flask db upgrade 等指令不會啟動排程）
    jobs.start_background(current_app._get_current_object())

SUPPORTED_PAYMENT_MODES = ('placeholder', 'manual')
ORDER_LIST_PAYMENT_MODES = (*SUPPORTED_PAYMENT_MODES, 'external_verified')

# (code, module, action, name_zh, name_en)；admin 角色自動擁有，其他角色需另行指派
REPORT_ORDER_PERMISSIONS = [
    ('report_orders.contracts', 'report_orders', 'contracts', '對應外部成交與發放資格', 'Bind External Contracts'),
    ('report_orders.channels', 'report_orders', 'channels', '審查渠道設定', 'Review Commerce Channels'),
    ('report_orders.intake', 'report_orders', 'intake', '匯入與審查外部訂單', 'Review External Orders'),
    ('report_orders.backfill', 'report_orders', 'backfill', '審查與回填歷史交易資格', 'Review Historical Commerce'),
    ('report_orders.activation', 'report_orders', 'activation', '管理資格啟用碼', 'Manage Activation Codes'),
    ('report_orders.read', 'report_orders', 'read', '檢視報告訂單', 'Read Report Orders'),
    ('report_orders.confirm_payment', 'report_orders', 'confirm_payment', '確認人工收款',
     'Confirm Manual Payments'),
    ('report_orders.fulfill', 'report_orders', 'fulfill', '管理實體書出貨與退款',
     'Manage Physical Book Fulfilment'),
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


def _intake_response(operation):
    """Keep receipt mutations and their audit trail in one transaction."""
    from sqlalchemy.exc import IntegrityError
    user = _current_user()
    if user is None:
        return _error('會員不存在或已停用', 401)
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return _error('請提供 JSON 物件', 400)
    try:
        result = operation(data, user.id)
        db.session.commit()
        response = jsonify({'success': True, **result})
        response.headers['Cache-Control'] = 'no-store'
        return response
    except service.OrderError as exc:
        db.session.rollback()
        return _error(exc.message, exc.status, code=exc.code)
    except IntegrityError:
        db.session.rollback()
        return _error('資料已存在或關聯已變更，請重新載入後核對', 409, code='intake_conflict')


@bp.route('/admin/commerce-channels', methods=['GET', 'POST'])
@_limit('30 per minute')
@jwt_required()
@require_permission('report_orders.channels')
def admin_commerce_channels():
    from . import intake
    from sites.Polaris_Parent.backend.commerce_models import CommerceChannel
    if request.method == 'POST':
        return _intake_response(lambda data, actor: dict(channel=intake.channel_view(intake.save_channel(data, actor))))
    if _current_user() is None:
        return _error('會員不存在或已停用', 401)
    return jsonify(success=True, enabled=bool(current_app.config.get('COMMERCE_INTAKE_ENABLED')),
                   channels=[intake.channel_view(row) for row in CommerceChannel.query.order_by(CommerceChannel.id).all()])


@bp.route('/admin/commerce-channels/<int:channel_id>', methods=['PUT'])
@_limit('30 per minute')
@jwt_required()
@require_permission('report_orders.channels')
def admin_update_commerce_channel(channel_id):
    from . import intake
    return _intake_response(lambda data, actor: dict(channel=intake.channel_view(intake.save_channel(data, actor, channel_id))))


@bp.route('/admin/commerce-intake-channels', methods=['GET'])
@jwt_required()
@require_permission('report_orders.intake')
def admin_intake_channels():
    from . import intake
    from sites.Polaris_Parent.backend.commerce_models import CommerceChannel
    if _current_user() is None:
        return _error('會員不存在或已停用', 401)
    return jsonify(success=True, enabled=bool(current_app.config.get('COMMERCE_INTAKE_ENABLED')),
                   channels=[intake.channel_view(row) for row in CommerceChannel.query.order_by(CommerceChannel.id).all()])


@bp.route('/admin/commerce-product-mappings', methods=['GET', 'POST'])
@_limit('30 per minute')
@jwt_required()
@require_permission('report_orders.channels')
def admin_product_mappings():
    from . import binding
    from sites.Polaris_Parent.backend.commerce_models import CommerceProductMapping
    if request.method == 'POST':
        return _intake_response(lambda data, actor: dict(mapping=binding.mapping_view(binding.save_mapping(data, actor))))
    if _current_user() is None:
        return _error('會員不存在或已停用', 401)
    return jsonify(success=True, enabled=binding.enabled(), mappings=[binding.mapping_view(row)
                   for row in CommerceProductMapping.query.order_by(CommerceProductMapping.id).all()])


@bp.route('/admin/commerce-receipts/<int:receipt_id>/contract-preview', methods=['POST'])
@_limit('30 per minute')
@jwt_required()
@require_permission('report_orders.contracts')
def admin_external_contract_preview(receipt_id):
    from . import binding, intake
    return _intake_response(lambda data, actor: dict(review=binding.preview(receipt_id, intake.text(data, 'order_no', 100), actor)))


@bp.route('/admin/commerce-receipts/<int:receipt_id>/contract', methods=['POST'])
@_limit('10 per minute')
@jwt_required()
@require_permission('report_orders.contracts')
def admin_external_contract_apply(receipt_id):
    from . import binding
    def perform(data, actor):
        order, changed = binding.apply(receipt_id, data, actor)
        return dict(order=service.order_summary(order), changed=changed)
    return _intake_response(perform)


@bp.route('/admin/commerce-receipts', methods=['GET', 'POST'])
@_limit('30 per minute')
@jwt_required()
@require_permission('report_orders.intake')
def admin_commerce_receipts():
    from . import intake
    from sites.Polaris_Parent.backend.commerce_models import CommerceExternalReceipt
    if request.method == 'POST':
        def perform(data, actor):
            row, created = intake.import_receipt(data, actor)
            return dict(receipt=intake.receipt_view(row), created=created)
        return _intake_response(perform)
    if _current_user() is None:
        return _error('會員不存在或已停用', 401)
    before = request.args.get('before', type=int)
    query = CommerceExternalReceipt.query
    if before is not None:
        query = query.filter(CommerceExternalReceipt.id < before)
    rows = query.order_by(CommerceExternalReceipt.id.desc()).limit(51).all()
    response = jsonify(success=True, receipts=[intake.receipt_view(row) for row in rows[:50]],
                       next_before=rows[49].id if len(rows) > 50 else None)
    response.headers['Cache-Control'] = 'no-store'
    return response


@bp.route('/admin/commerce-receipts/<int:receipt_id>/review', methods=['POST'])
@_limit('30 per minute')
@jwt_required()
@require_permission('report_orders.intake')
def admin_review_commerce_receipt(receipt_id):
    from . import intake
    def perform(data, actor):
        row, changed = intake.review(receipt_id, data, actor)
        return dict(receipt=intake.receipt_view(row), changed=changed)
    return _intake_response(perform)


@bp.route('/admin/commerce-receipts/<int:receipt_id>/events', methods=['GET'])
@jwt_required()
@require_permission('report_orders.intake')
def admin_commerce_receipt_events(receipt_id):
    from . import intake
    from sites.Polaris_Parent.backend.commerce_models import CommerceIntakeEvent
    if _current_user() is None:
        return _error('會員不存在或已停用', 401)
    rows = CommerceIntakeEvent.query.filter_by(receipt_id=receipt_id).order_by(CommerceIntakeEvent.id).all()
    response = jsonify(success=True, events=[dict(id=row.id, actor_id=row.actor_id,
        event_type=row.event_type, detail=row.detail, created_at=intake.utc(row.created_at).isoformat()) for row in rows])
    response.headers['Cache-Control'] = 'no-store'
    return response


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
        return _error(exc.message, exc.status, code=exc.code, errors=getattr(exc, 'errors', None))

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


@bp.route('/admin/report-notifications', methods=['GET'])
@jwt_required()
@require_permission('report_orders.read')
def admin_list_notifications():
    """寄信紀錄：status＝failed（含重試中）／pending／sent／all；q＝訂單編號或收件者。"""
    from packages.commerce.models import OrderNotification
    from sites.Polaris_Parent.backend.models import ReportMailOutbox

    status = request.args.get('status', 'failed')
    q = (db.session.query(OrderNotification, ReportMailOutbox, Order.order_no)
         .outerjoin(ReportMailOutbox, ReportMailOutbox.notification_id == OrderNotification.id)
         .join(Order, Order.id == OrderNotification.order_id))
    if status in ('failed', 'pending', 'sent'):
        q = q.filter(OrderNotification.status == status)
    keyword = (request.args.get('q') or '').strip()
    if keyword:
        like = f'%{keyword}%'
        q = q.filter(db.or_(Order.order_no.ilike(like), OrderNotification.recipient.ilike(like)))
    rows = q.order_by(OrderNotification.id.desc()).limit(200).all()
    counts = dict(db.session.query(OrderNotification.status, db.func.count(OrderNotification.id))
                  .group_by(OrderNotification.status).all())
    return jsonify({'success': True, 'counts': counts, 'jobs': jobs.status(),
                    'notifications': [notify.notification_view(n, box, order_no) for n, box, order_no in rows]})


@bp.route('/admin/report-notifications/<int:note_id>', methods=['GET'])
@jwt_required()
@require_permission('report_orders.read')
def admin_get_notification(note_id):
    from packages.commerce.models import OrderNotification

    note = db.session.get(OrderNotification, note_id)
    if note is None:
        return _error('找不到這封信', 404)
    order = db.session.get(Order, note.order_id)
    return jsonify({'success': True, 'notification': notify.notification_view(
        note, order_no=order.order_no if order else None, with_body=True)})


@bp.route('/admin/report-notifications/<int:note_id>/resend', methods=['POST'])
@_limit('30 per minute')
@jwt_required()
@require_permission('report_orders.fulfill')
def admin_resend_notification(note_id):
    from packages.commerce.models import OrderNotification

    try:
        sent = notify.resend(note_id)
    except LookupError as exc:
        return _error(str(exc), 404)
    except ValueError as exc:
        return _error(str(exc), 409, code='not_resendable')
    note = db.session.get(OrderNotification, note_id)
    order = db.session.get(Order, note.order_id)
    view = notify.notification_view(note, order_no=order.order_no if order else None)
    if not sent:
        return _error(f'重寄失敗：{note.error or "未知錯誤"}', 502, code='send_failed', notification=view)
    return jsonify({'success': True, 'notification': view})


@bp.route('/admin/report-orders', methods=['GET'])
@jwt_required()
@require_permission('report_orders.read')
def admin_list_orders():
    _expire_overdue()
    status = request.args.get('status', 'pending')
    q = Order.query.filter(Order.payment_method.in_(ORDER_LIST_PAYMENT_MODES))
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


@bp.route('/admin/report-orders/<order_no>/commerce-review', methods=['GET', 'POST'])
@jwt_required()
@require_permission('report_orders.backfill')
def admin_commerce_review(order_no):
    from . import backfill
    user = _current_user()
    if user is None:
        return _error('帳號不存在或已停用', 401)
    order = Order.query.filter_by(order_no=order_no).first()
    if order is None:
        return _error('找不到這筆訂單', 404)
    if request.method == 'GET':
        response = jsonify({'success': True, 'review': backfill.review(order, user.id)})
    else:
        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            return _error('請提供審查確認資料', 400, code='invalid')
        try:
            changed = backfill.apply(order, user.id, data.get('review_token'), data.get('note'), data.get('confirmed'))
            db.session.commit()
        except service.OrderError as exc:
            db.session.rollback()
            return _error(exc.message, exc.status, code=exc.code)
        response = jsonify({'success': True, 'changed': changed, 'order': _admin_row(order)})
    response.headers['Cache-Control'] = 'no-store'
    return response


@bp.route('/admin/report-entitlements/<int:entitlement_id>/activation', methods=['POST'])
@jwt_required()
@require_permission('report_orders.activation')
@_limit('10 per minute')
def admin_issue_activation(entitlement_id):
    from . import activation
    user = _current_user()
    if user is None:
        return _error('帳號不存在或已停用', 401)
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return _error('請提供發碼資料', 400, code='invalid')
    try:
        row, code = activation.issue(entitlement_id, user.id, data.get('days', 14))
        db.session.commit()
    except service.OrderError as exc:
        db.session.rollback()
        return _error(exc.message, exc.status, code=exc.code)
    response = jsonify({'success': True, 'activation_id': row.id, 'code': code,
                        'recipient_id': row.recipient_id, 'expires_at': row.expires_at.isoformat()})
    response.headers['Cache-Control'] = 'no-store'
    return response, 201


@bp.route('/admin/report-activations/<int:activation_id>/revoke', methods=['POST'])
@jwt_required()
@require_permission('report_orders.activation')
def admin_revoke_activation(activation_id):
    from . import activation
    user = _current_user()
    if user is None:
        return _error('帳號不存在或已停用', 401)
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return _error('請提供撤銷原因', 400, code='invalid')
    try:
        activation.revoke(activation_id, user.id, data.get('reason'))
        db.session.commit()
    except service.OrderError as exc:
        db.session.rollback()
        return _error(exc.message, exc.status, code=exc.code)
    return jsonify({'success': True})


@bp.route('/report-activations/redeem', methods=['POST'])
@jwt_required()
@_limit('5 per minute')
def redeem_activation():
    from . import activation
    user = _current_user()
    if user is None:
        return _error('會員不存在或已停用', 401)
    if not is_email_verified(user.id, normalise_email(user.email or user.username)):
        return _error('請先完成 Email 驗證', 403, code='email_unverified')
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return _error('請填寫啟用碼', 400, code='invalid_activation')
    try:
        order, redeemed = activation.redeem(data.get('code'), user.id, data.get('order_no'))
        db.session.commit()
    except service.OrderError as exc:
        db.session.rollback()
        return _error(exc.message, exc.status, code=exc.code)
    response = jsonify({'success': True, 'redeemed': redeemed, 'order': service.order_summary(order)})
    response.headers['Cache-Control'] = 'no-store'
    return response


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


# ── 實體書：設定、事後加購、取消 ─────────────────────────────────────────────
@bp.route('/report-physical-config', methods=['GET'])
def physical_config():
    """前台顯示用：是否開放實體書、加購價、規格、封面款式、加購頁價格。"""
    return jsonify({'success': True, 'config': physical.public_config()})


@bp.route('/report-orders/<order_no>/addons', methods=['POST'])
@_limit('10 per minute')
@jwt_required()
def create_addon(order_no):
    """事後加購：body 的 physical（實體書選項，可省略）與 consult_sessions（專人解讀次數，可為 0）至少一項。"""
    user = _current_user()
    if user is None:
        return _error('會員不存在或已停用', 401)
    email = normalise_email(user.email or user.username)
    if not is_email_verified(user.id, email):
        return _error('請先完成 Email 驗證再送出訂單', 403, code='email_unverified')
    mode = _payment_mode()
    if mode not in SUPPORTED_PAYMENT_MODES:
        return _error('目前無法建立訂單，請稍後再試', 503)

    parent = Order.query.filter_by(order_no=order_no, user_id=user.id).first()
    if parent is None or not parent.order_items:
        return _error('找不到這筆訂單', 404)

    data = request.get_json(silent=True) or {}
    submission_key = data.get('submission_key')
    if not isinstance(submission_key, str) or not 8 <= len(submission_key) <= 64:
        return _error('缺少送出編號，請重新整理頁面後再試')
    existing = service.find_by_submission_key(submission_key)
    if existing is not None and existing.user_id == user.id:
        return jsonify({'success': True, 'created': False, 'order': service.order_summary(existing)})
    if data.get('policy_consented') is not True or data.get('policy_version') != service.POLICY_VERSION:
        return _error('請先閱讀並同意交易政策', 400, code='policy_required', policy_version=service.POLICY_VERSION)

    shipping = None
    if isinstance(data.get('physical'), dict):
        shipping, ship_errors = validate_shipping(data.get('shipping') or {})
        if ship_errors:
            return _error('資料有誤，請檢查後再送出', 400, code='invalid', errors=ship_errors)

    bank, expires_at = None, None
    if mode == 'manual':
        bank = payment.manual_bank_info()
        if bank is None:
            return _error('目前無法建立訂單，請稍後再試', 503)
        expires_at = datetime.utcnow() + timedelta(days=payment.deadline_days())

    try:
        order, created = physical.create_addon_order(user, parent, data, shipping, submission_key, mode,
                                                     expires_at=expires_at)
    except service.OrderError as exc:
        db.session.rollback()
        return _error(exc.message, exc.status, code=exc.code, errors=getattr(exc, 'errors', None))
    if created:
        notify.send_order_created(order, email, mode, bank)
    return jsonify({'success': True, 'created': created, 'order': service.order_summary(order)}), 201 if created else 200


@bp.route('/report-orders/<order_no>/physical-cancel', methods=['POST'])
@_limit('10 per minute')
@jwt_required()
def cancel_physical(order_no):
    user = _current_user()
    if user is None:
        return _error('會員不存在或已停用', 401)
    order = Order.query.filter_by(order_no=order_no, user_id=user.id).first()
    if order is None or not order.order_items:
        return _error('找不到這筆訂單', 404)
    try:
        job = physical.cancel_physical(order, 'member', (request.get_json(silent=True) or {}).get('reason'))
    except service.OrderError as exc:
        db.session.rollback()
        return _error(exc.message, exc.status, code=exc.code)
    notify.send_physical_cancelled(order, job, normalise_email(user.email or user.username), by_member=True)
    return jsonify({'success': True, 'order': service.order_summary(order)})


@bp.route('/report-orders/<order_no>/consult-preferences', methods=['POST'])
@_limit('10 per minute')
@jwt_required()
def consult_preferences(order_no):
    """會員填專人解讀方便的時段（付款後、約好時間前）。"""
    user = _current_user()
    if user is None:
        return _error('會員不存在或已停用', 401)
    order = Order.query.filter_by(order_no=order_no, user_id=user.id).first()
    item = next((i for i in (order.order_items if order else []) if i.variant == 'consult'), None)
    consult = ReportConsultation.query.filter_by(order_item_id=item.id).first() if item else None
    if consult is None:
        return _error('找不到這筆專人解讀', 404)
    try:
        physical.set_consult_preferences(consult, request.get_json(silent=True) or {})
    except service.OrderError as exc:
        db.session.rollback()
        return _error(exc.message, exc.status, code=exc.code)
    notify.send_consult_preferences(order, consult, normalise_email(user.email or user.username))
    return jsonify({'success': True, 'order': service.order_summary(order)})


# ── 實體書出貨管理（後台） ───────────────────────────────────────────────────
def _print_job_row(job):
    item = db.session.get(OrderItem, job.order_item_id)
    order = item.order
    s = Shipment.query.filter_by(order_item_id=item.id).first()
    c = item.customization or {}
    audience = c.get('audience') or {}
    row = physical.job_view(job, item)
    row.update({
        'order_no': order.order_no,
        'order_status': order.status,
        'amount': order.amount,
        'paid_at': order.paid_at.isoformat() if order.paid_at else None,
        'created_at': order.created_at.isoformat() if order.created_at else None,
        'buyer_email': _buyer_email(order),
        'item_no': item.item_no,
        'item_name': item.name,
        'kind': item.kind,
        'parent_order_no': c.get('parent_order_no'),
        'subject_name': c.get('subject_name'),
        'call_name': audience.get('call_name'),
        'dedication': audience.get('dedication') or '',
        'options': job.options or {},
        'pages': job.pages or [],
        'design': _admin_design(job),
        'cancel_reason': job.cancel_reason,
        'cancelled_by': job.cancelled_by,
        'refund_note': job.refund_note,
        'shipping': s and {
            'recipient_name': s.recipient_name, 'recipient_phone': s.recipient_phone,
            'postal_code': s.postal_code, 'address': s.address, 'status': s.status,
            'carrier': s.carrier, 'tracking_no': s.tracking_no,
            'print_sent_at': s.print_sent_at.isoformat() if s.print_sent_at else None,
            'shipped_at': s.shipped_at.isoformat() if s.shipped_at else None,
        },
    })
    return row


def _admin_design(job):
    from sites.Polaris_Parent.backend.models import ReportBookDesign

    d = ReportBookDesign.query.filter_by(print_job_id=job.id).first()
    return design.design_view(d, int(get_jwt_identity())) if d is not None else None


@bp.route('/admin/report-print-jobs', methods=['GET'])
@jwt_required()
@require_permission('report_orders.fulfill')
def admin_list_print_jobs():
    _expire_overdue()
    status = request.args.get('status', 'all')
    q = ReportPrintJob.query
    if status == 'refund_pending':
        q = q.filter(ReportPrintJob.status == 'cancelled', ReportPrintJob.refund_due.isnot(None),
                     ReportPrintJob.refunded_at.is_(None))
    elif status != 'all':
        q = q.filter(ReportPrintJob.status == status)
    jobs = q.order_by(ReportPrintJob.id.desc()).limit(300).all()
    counts = dict(db.session.query(ReportPrintJob.status, db.func.count(ReportPrintJob.id))
                  .group_by(ReportPrintJob.status).all())
    counts['refund_pending'] = (ReportPrintJob.query
                                .filter(ReportPrintJob.status == 'cancelled', ReportPrintJob.refund_due.isnot(None),
                                        ReportPrintJob.refunded_at.is_(None)).count())
    return jsonify({'success': True, 'jobs': [_print_job_row(j) for j in jobs], 'counts': counts})


@bp.route('/admin/report-print-jobs/<int:job_id>/<action>', methods=['POST'])
@jwt_required()
@require_permission('report_orders.fulfill')
def admin_print_job_action(job_id, action):
    job = db.session.get(ReportPrintJob, job_id)
    if job is None:
        return _error('找不到這本實體書', 404)
    item = db.session.get(OrderItem, job.order_item_id)
    order = item.order
    data = request.get_json(silent=True) or {}
    admin_id = int(get_jwt_identity())
    email = _buyer_email(order)
    try:
        if action == 'printing':
            physical.mark_printing(job, admin_id)
        elif action == 'shipped':
            physical.mark_shipped(job, admin_id, data.get('carrier'), data.get('tracking_no'), data.get('note'))
            s = Shipment.query.filter_by(order_item_id=item.id).first()
            if email and s is not None:
                notify.send_physical_shipped(order, s, email)
        elif action == 'delivered':
            physical.mark_delivered(job, admin_id)
        elif action == 'cancel':
            reason = (data.get('reason') or '').strip()
            if not reason:
                return _error('請填寫取消原因（會寄給會員）')
            physical.cancel_physical(order, 'admin', reason)
            if email:
                notify.send_physical_cancelled(order, job, email, by_member=False)
        elif action == 'refund':
            physical.record_refund(job, admin_id, data.get('amount'), data.get('note'))
            if email:
                notify.send_refund_recorded(order, job, email)
        elif action == 'grant_revision':
            proofs.grant_revision(job, admin_id)
        elif action == 'approve_proof':
            proof = proofs.admin_approve(job, admin_id, data.get('note'))
            notify.send_proof_approved_admin(order, job, proof, email or '-')
        else:
            return _error('不支援的操作', 404)
    except service.OrderError as exc:
        db.session.rollback()
        return _error(exc.message, exc.status, code=exc.code)
    current_app.logger.info(f'print job {job.id} {action} by admin {admin_id}')
    return jsonify({'success': True, 'job': _print_job_row(job)})


@bp.route('/admin/report-print-jobs/<int:job_id>/proofs', methods=['POST'])
@_limit('30 per minute')
@jwt_required()
@require_permission('report_orders.fulfill')
def admin_upload_proof(job_id):
    """上傳打樣 PDF（multipart：file、note＝給會員看的這版說明）。寄「打樣請確認」給會員。"""
    job = db.session.get(ReportPrintJob, job_id)
    if job is None:
        return _error('找不到這本實體書', 404)
    upload = request.files.get('file')
    if upload is None:
        return _error('請選擇打樣 PDF', 400)
    admin_id = int(get_jwt_identity())
    try:
        proof = proofs.upload(job, admin_id, upload.filename, upload.read(), request.form.get('note'))
    except service.OrderError as exc:
        db.session.rollback()
        return _error(exc.message, exc.status, code=exc.code)
    except private_storage.StorageError as exc:
        db.session.rollback()
        current_app.logger.error(f'proof upload failed for job {job_id}: {exc}')
        return _error('檔案儲存失敗，請稍後再試', 503)
    item = db.session.get(OrderItem, job.order_item_id)
    email = _buyer_email(item.order)
    if email:
        notify.send_proof_ready(item.order, job, proof, email, proofs.revisions_left(job))
    return jsonify({'success': True, 'job': _print_job_row(job)})


@bp.route('/admin/report-print-jobs/<int:job_id>/proofs/<int:proof_id>/link', methods=['POST'])
@jwt_required()
@require_permission('report_orders.fulfill')
def admin_proof_link(job_id, proof_id):
    from sites.Polaris_Parent.backend.models import ReportPrintProof
    proof = db.session.get(ReportPrintProof, proof_id)
    if proof is None or proof.print_job_id != job_id:
        return _error('找不到這份打樣', 404)
    token = private_storage.issue_file_token('proof', proof.id, int(get_jwt_identity()))
    return jsonify({'success': True, 'url': url_for('report_orders.report_file', token=token, _external=True)})


# ── 打樣（會員） ─────────────────────────────────────────────────────────────
def _member_print_job(order_no, user):
    order = Order.query.filter_by(order_no=order_no, user_id=user.id).first()
    item = physical.physical_item(order) if order is not None else None
    job = physical.print_job_for(item) if item is not None else None
    return order, job


@bp.route('/report-orders/<order_no>/proofs/<int:proof_id>/link', methods=['POST'])
@_limit('30 per minute')
@jwt_required()
def member_proof_link(order_no, proof_id):
    """會員取得打樣 PDF 的短效網址。"""
    from sites.Polaris_Parent.backend.models import ReportPrintProof
    user = _current_user()
    if user is None:
        return _error('會員不存在或已停用', 401)
    order, job = _member_print_job(order_no, user)
    proof = db.session.get(ReportPrintProof, proof_id)
    if job is None or proof is None or proof.print_job_id != job.id:
        return _error('找不到這份打樣', 404)
    token = private_storage.issue_file_token('proof', proof.id, user.id)
    return jsonify({'success': True, 'url': url_for('report_orders.report_file', token=token, _external=True)})


@bp.route('/report-orders/<order_no>/proof-decision', methods=['POST'])
@_limit('20 per minute')
@jwt_required()
def member_proof_decision(order_no):
    """會員確認送印（decision=approve）或提出修改（decision=changes，comment 必填）。"""
    user = _current_user()
    if user is None:
        return _error('會員不存在或已停用', 401)
    order, job = _member_print_job(order_no, user)
    if job is None:
        return _error('這筆訂單沒有實體書', 404)
    data = request.get_json(silent=True) or {}
    try:
        proof = proofs.member_decide(job, user.id, data.get('proof_id'), data.get('decision'), data.get('comment'))
    except service.OrderError as exc:
        db.session.rollback()
        return _error(exc.message, exc.status, code=exc.code)
    email = normalise_email(user.email or user.username)
    if proof.decision == 'changes_requested':
        notify.send_proof_changes_admin(order, job, proof, email)
    else:
        notify.send_proof_approved_admin(order, job, proof, email)
    return jsonify({'success': True, 'order': service.order_summary(order)})


# ── 專人解讀（後台；取消規則不對外公開，由管理者代為取消） ───────────────────
def _consult_row(consult):
    item = db.session.get(OrderItem, consult.order_item_id)
    order = item.order
    report = db.session.get(OrderItem, consult.report_item_id) if consult.report_item_id else None
    rc = (report.customization or {}) if report else {}
    row = physical.consult_view(consult, item)
    row.update({
        'order_no': order.order_no,
        'order_status': order.status,
        'paid_at': order.paid_at.isoformat() if order.paid_at else None,
        'created_at': order.created_at.isoformat() if order.created_at else None,
        'buyer_email': _buyer_email(order),
        'report_order_no': report.order.order_no if report else None,
        'subject_name': rc.get('subject_name'),
        'call_name': (rc.get('audience') or {}).get('call_name'),
        'admin_note': consult.admin_note,
        'cancel_reason': consult.cancel_reason,
        'refund_amount': consult.refund_amount,
        'refund_note': consult.refund_note,
    })
    return row


@bp.route('/admin/report-consultations', methods=['GET'])
@jwt_required()
@require_permission('report_orders.fulfill')
def admin_list_consultations():
    _expire_overdue()
    status = request.args.get('status', 'all')
    q = ReportConsultation.query
    refund_pending = (ReportConsultation.status == 'cancelled', ReportConsultation.refund_due.isnot(None),
                      ReportConsultation.refunded_at.is_(None))
    if status == 'refund_pending':
        q = q.filter(*refund_pending)
    elif status != 'all':
        q = q.filter(ReportConsultation.status == status)
    rows = q.order_by(ReportConsultation.id.desc()).limit(300).all()
    counts = dict(db.session.query(ReportConsultation.status, db.func.count(ReportConsultation.id))
                  .group_by(ReportConsultation.status).all())
    counts['refund_pending'] = ReportConsultation.query.filter(*refund_pending).count()
    return jsonify({'success': True, 'consultations': [_consult_row(c) for c in rows], 'counts': counts})


@bp.route('/admin/report-consultations/<int:consult_id>/<action>', methods=['POST'])
@jwt_required()
@require_permission('report_orders.fulfill')
def admin_consultation_action(consult_id, action):
    consult = db.session.get(ReportConsultation, consult_id)
    if consult is None:
        return _error('找不到這筆專人解讀', 404)
    item = db.session.get(OrderItem, consult.order_item_id)
    order = item.order
    data = request.get_json(silent=True) or {}
    admin_id = int(get_jwt_identity())
    email = _buyer_email(order)
    try:
        if action == 'schedule':
            physical.schedule_consult(consult, admin_id, data.get('scheduled_at'), data.get('note'))
            if email:
                notify.send_consult_scheduled(order, consult, email)
        elif action == 'complete':
            physical.complete_consult(consult, admin_id)
        elif action == 'cancel':
            physical.cancel_consult(consult, admin_id, data.get('reason'))
            if email:
                notify.send_consult_cancelled(order, consult, email)
        elif action == 'refund':
            physical.record_consult_refund(consult, admin_id, data.get('amount'), data.get('note'))
            if email:
                notify.send_consult_refunded(order, consult, email)
        else:
            return _error('不支援的操作', 404)
    except service.OrderError as exc:
        db.session.rollback()
        return _error(exc.message, exc.status, code=exc.code)
    current_app.logger.info(f'consultation {consult.id} {action} by admin {admin_id}')
    return jsonify({'success': True, 'consultation': _consult_row(consult)})


@bp.cli.command('dev-mark-paid')
@click.argument('order_no')
def dev_mark_paid_command(order_no):
    """【只限本機】把待付款的報告訂單直接標成已付款，用來測試付款後的流程。

    走與「確認收款」相同的 mark_paid()：實體書進入待填內容、報告交接改為待送出。
    資料庫不是 localhost 時拒絕執行，避免誤動正式庫。
    """
    from packages.commerce.models import PaymentAttempt

    host = (db.engine.url.host or '').lower()
    if host not in ('localhost', '127.0.0.1', '::1'):
        raise click.ClickException(f'只能在本機資料庫使用（目前連到 {host or "未知主機"}）')
    order = Order.query.filter_by(order_no=order_no).first()
    if order is None or not order.order_items:
        raise click.ClickException(f'找不到報告訂單 {order_no}')
    if order.status != 'pending':
        raise click.ClickException(f'{order_no} 目前是 {order.status}，只有待付款的訂單能標成已付款')
    attempt = PaymentAttempt(attempt_no=payment.new_attempt_no(), order_id=order.id, provider='manual',
                             environment='test', currency=order.currency, status='created', amount=order.amount,
                             review_note='本機測試：dev-mark-paid')
    db.session.add(attempt)
    payment.mark_paid(order, attempt)
    db.session.commit()
    click.echo(f'{order_no} 已標成已付款（NT${order.amount:,}）')


# ── 報告交付：上傳報告 PDF、會員下載 ─────────────────────────────────────────
def _report_item_of(order):
    return next((i for i in order.order_items if i.kind == 'purchase'), None)


def _file_link(doc, user_id):
    token = private_storage.issue_file_token('doc', doc.id, user_id)
    return url_for('report_orders.report_file', token=token, _external=True)


@bp.route('/report-orders/<order_no>/report-pdf/link', methods=['POST'])
@_limit('30 per minute')
@jwt_required()
def report_pdf_link(order_no):
    """會員取得報告 PDF 的短效網址（10 分鐘），給下載與整本預覽用。"""
    user = _current_user()
    if user is None:
        return _error('會員不存在或已停用', 401)
    order = Order.query.filter_by(order_no=order_no, user_id=user.id).first()
    item = _report_item_of(order) if order is not None else None
    if item is None or order.status != 'paid':
        return _error('找不到這筆訂單', 404)
    doc = delivery.current_document(item)
    if doc is None:
        return _error('報告還在製作中，完成後會寄信通知你', 404, code='not_ready')
    return jsonify({'success': True, 'url': _file_link(doc, user.id), 'document': delivery.document_view(doc)})


@bp.route('/report-files/<token>', methods=['GET'])
@_limit('60 per minute')
def report_file(token):
    """以短效憑證串流私有檔案：報告 PDF（doc）、會員上傳的照片（asset）或實體書打樣（proof）。
    不必帶登入標頭，<a>、<img> 與 pdf.js 都能直接用。?download=1 下載，否則在瀏覽器開啟。"""
    parsed = private_storage.read_file_token(token, max_age=7200)
    if parsed is None:
        return _error('連結已過期，請重新整理頁面', 410)
    kind, file_id, user_id = parsed
    is_admin = 'report_orders.fulfill' in (RBACService.get_user_permissions(user_id) or set())
    try:
        if kind == 'doc':
            row, data = delivery.document_for_download(file_id, user_id, is_admin)
            mimetype = 'application/pdf'
        elif kind == 'asset':
            row, data = design.asset_for_download(file_id, user_id, is_admin)
            mimetype = row.content_type
        elif kind == 'proof':
            row, data = proofs.proof_for_download(file_id, user_id, is_admin)
            mimetype = 'application/pdf'
        else:
            return _error('連結不正確', 404)
    except service.OrderError as exc:
        return _error(exc.message, exc.status, code=exc.code)
    except private_storage.StorageError as exc:
        current_app.logger.error(f'private file {kind}:{file_id} read failed: {exc}')
        return _error('檔案暫時無法讀取，請稍後再試', 503)
    disposition = 'attachment' if request.args.get('download') == '1' else 'inline'
    resp = Response(data, mimetype=mimetype)
    resp.headers['Content-Disposition'] = f"{disposition}; filename*=UTF-8''{quote(row.filename)}"
    resp.headers['Cache-Control'] = 'private, max-age=300'
    resp.headers['X-Content-Type-Options'] = 'nosniff'
    return resp


def _delivery_chart_view(customization, fulfillment):
    """報告交付頁的命盤資訊：客人原始填寫的出生資料、實際排盤時間、紫微命盤編號與工作台連結。

    存進紫微的是換算後的時間（真太陽時／扣夏令時），PolarisUI 顯示的「Clock time」會是 used，
    不是客人填的 birth.time，兩個都列出來才對得起來。
    """
    birth = customization.get('birth') or {}
    place = customization.get('place') or {}
    chart_time = customization.get('chart_time') or {}
    chart_id = str(fulfillment.chart_id) if fulfillment and fulfillment.chart_id else None
    base = (current_app.config.get('ZIWEI_WORKBENCH_URL') or '').rstrip('/')
    return {
        'chart_id': chart_id,
        'gender': customization.get('gender'),
        'birth_date': birth.get('date'), 'birth_time': birth.get('time'), 'time_type': birth.get('time_type'),
        'place': ', '.join(x for x in (place.get('city'), place.get('country')) if x) or None,
        'used_time': chart_time.get('used'), 'dst_minutes': chart_time.get('dst_minutes') or 0,
        'workbench_url': f'{base}/progress?chart_id={quote(chart_id)}' if base and chart_id else None,
    }


@bp.route('/admin/report-deliveries', methods=['GET'])
@jwt_required()
@require_permission('report_orders.fulfill')
def admin_list_deliveries():
    """已付款的報告訂單與報告檔狀態。status=pending（待上傳）／delivered（已上傳）／all。"""
    status = request.args.get('status', 'pending')
    orders = (Order.query.filter(Order.status == 'paid', Order.payment_method.in_(ORDER_LIST_PAYMENT_MODES))
              .order_by(Order.paid_at.desc().nullslast(), Order.id.desc()).limit(300).all())
    rows, counts = [], {'pending': 0, 'delivered': 0}
    for o in orders:
        item = _report_item_of(o)
        if item is None:
            continue
        doc = delivery.current_document(item)
        key = 'delivered' if doc else 'pending'
        counts[key] += 1
        if status != 'all' and status != key:
            continue
        c = item.customization or {}
        fulfillment = ReportFulfillment.query.filter_by(order_item_id=item.id).first()
        rows.append({
            'order_no': o.order_no, 'item_no': item.item_no, 'name': item.name, 'variant': item.variant,
            'subject_name': c.get('subject_name'), 'call_name': (c.get('audience') or {}).get('call_name'),
            'buyer_email': _buyer_email(o), 'paid_at': o.paid_at.isoformat() if o.paid_at else None,
            'document': delivery.document_view(doc),
            # 製作報告用：到紫微系統（PolarisUI）找這張盤的依據
            'chart': _delivery_chart_view(c, fulfillment),
            'handoff': handoff.view(fulfillment),
        })
    return jsonify({'success': True, 'deliveries': rows, 'counts': counts})


@bp.route('/admin/report-orders/<order_no>/handoff', methods=['POST'])
@_limit('20 per minute')
@jwt_required()
@require_permission('report_orders.fulfill')
def admin_send_handoff(order_no):
    """立即把這筆訂單的報告送到紫微建立工作單（不等排程、不看重試間隔）。"""
    order = _admin_order(order_no)
    if order is None:
        return _error('找不到這筆報告訂單', 404)
    results = handoff.send_now(order)
    if not results:
        return _error('這筆訂單沒有待送出的工作單（已送出或尚未付款）', 409, code='nothing_to_send')
    item = _report_item_of(order)
    f = ReportFulfillment.query.filter_by(order_item_id=item.id).first() if item is not None else None
    failed = [err for _no, ok, err in results if not ok]
    if failed:
        return _error(f'送出失敗：{failed[0] or "未知錯誤"}', 502, code='handoff_failed', handoff=handoff.view(f))
    return jsonify({'success': True, 'handoff': handoff.view(f)})


@bp.route('/admin/report-orders/<order_no>/report-pdf', methods=['POST'])
@jwt_required()
@require_permission('report_orders.fulfill')
def admin_upload_report_pdf(order_no):
    order = _admin_order(order_no)
    item = _report_item_of(order) if order is not None else None
    if item is None:
        return _error('找不到這筆報告訂單', 404)
    upload = request.files.get('file')
    if upload is None:
        return _error('請選擇要上傳的 PDF')
    admin_id = int(get_jwt_identity())
    try:
        doc, first_time = delivery.upload_report_pdf(item, admin_id, upload.filename, upload.read())
    except service.OrderError as exc:
        db.session.rollback()
        return _error(exc.message, exc.status, code=exc.code)
    except private_storage.StorageError as exc:
        db.session.rollback()
        return _error(str(exc), 503)
    email = _buyer_email(order)
    if first_time and email:
        notify.send_report_ready(order, email, physical.pending_design_jobs(item))
    current_app.logger.info(f'report pdf uploaded {order.order_no} doc {doc.id} by admin {admin_id}')
    return jsonify({'success': True, 'document': delivery.document_view(doc), 'first_time': first_time})


@bp.route('/admin/report-orders/<order_no>/report-pdf/link', methods=['POST'])
@jwt_required()
@require_permission('report_orders.fulfill')
def admin_report_pdf_link(order_no):
    order = _admin_order(order_no)
    item = _report_item_of(order) if order is not None else None
    doc = delivery.current_document(item)
    if doc is None:
        return _error('這筆訂單還沒有上傳報告', 404)
    return jsonify({'success': True, 'url': _file_link(doc, int(get_jwt_identity()))})


# ── 設計你的書 ───────────────────────────────────────────────────────────────
def _design_response(d, user_id, status=200):
    return jsonify({'success': True, 'design': design.design_view(d, user_id)}), status


@bp.route('/report-orders/<order_no>/design-draft', methods=['POST'])
@_limit('30 per minute')
@jwt_required()
def design_draft(order_no):
    """付款前：在已付款的報告訂單上加購實體書時的設計草稿。"""
    user = _current_user()
    if user is None:
        return _error('會員不存在或已停用', 401)
    order = Order.query.filter_by(order_no=order_no, user_id=user.id).first()
    if order is None:
        return _error('找不到這筆訂單', 404)
    try:
        d = design.draft_for_addon(user, order)
    except service.OrderError as exc:
        db.session.rollback()
        return _error(exc.message, exc.status, code=exc.code)
    return _design_response(d, user.id)


@bp.route('/report-orders/<order_no>/design', methods=['GET'])
@jwt_required()
def order_design(order_no):
    """付款後：這張訂單裡那本實體書的設計（第一次進來時建立）。"""
    user = _current_user()
    if user is None:
        return _error('會員不存在或已停用', 401)
    order = Order.query.filter_by(order_no=order_no, user_id=user.id).first()
    if order is None:
        return _error('找不到這筆訂單', 404)
    try:
        d = design.design_for_job(user, order)
    except service.OrderError as exc:
        db.session.rollback()
        return _error(exc.message, exc.status, code=exc.code)
    return _design_response(d, user.id)


def _owned_design(design_id):
    user = _current_user()
    if user is None:
        return None, None, _error('會員不存在或已停用', 401)
    try:
        return user, design.get_owned(design_id, user.id), None
    except service.OrderError as exc:
        return None, None, _error(exc.message, exc.status, code=exc.code)


@bp.route('/report-designs/<int:design_id>', methods=['GET', 'PUT'])
@_limit('120 per minute')
@jwt_required()
def report_design(design_id):
    user, d, err = _owned_design(design_id)
    if err:
        return err
    if request.method == 'PUT':
        body = request.get_json(silent=True) or {}
        page_count = body.get('page_count') if isinstance(body.get('page_count'), int) else None
        try:
            design.save(d, body.get('data'), page_count)
        except service.OrderError as exc:
            db.session.rollback()
            return _error(exc.message, exc.status, code=exc.code)
    return _design_response(d, user.id)


@bp.route('/report-designs/<int:design_id>/assets', methods=['POST'])
@_limit('60 per minute')
@jwt_required()
def report_design_upload(design_id):
    user, d, err = _owned_design(design_id)
    if err:
        return err
    upload = request.files.get('file')
    if upload is None:
        return _error('請選擇圖片')
    try:
        asset = design.add_asset(d, upload.filename, upload.mimetype, upload.read())
    except service.OrderError as exc:
        db.session.rollback()
        return _error(exc.message, exc.status, code=exc.code)
    except private_storage.StorageError as exc:
        db.session.rollback()
        return _error(str(exc), 503)
    return jsonify({'success': True, 'asset': design.asset_view(asset, user.id)}), 201


@bp.route('/report-designs/<int:design_id>/assets/<int:asset_id>', methods=['DELETE'])
@jwt_required()
def report_design_delete_asset(design_id, asset_id):
    user, d, err = _owned_design(design_id)
    if err:
        return err
    try:
        design.remove_asset(d, asset_id)
    except service.OrderError as exc:
        db.session.rollback()
        return _error(exc.message, exc.status, code=exc.code)
    return _design_response(d, user.id)


@bp.route('/report-designs/<int:design_id>/confirm', methods=['POST'])
@_limit('10 per minute')
@jwt_required()
def report_design_confirm(design_id):
    user, d, err = _owned_design(design_id)
    if err:
        return err
    try:
        job = design.confirm(d)
    except service.OrderError as exc:
        db.session.rollback()
        return _error(exc.message, exc.status, code=exc.code, errors=getattr(exc, 'errors', None))
    item = db.session.get(OrderItem, job.order_item_id)
    notify.send_design_confirmed(item.order, normalise_email(user.email or user.username))
    return _design_response(d, user.id)


DEMO_EMAIL = 'demo-member@polaris.local'
DEMO_PASSWORD = 'Demo12345'


@bp.cli.command('dev-seed-demo')
def dev_seed_demo_command():
    """【只限本機】建立示範資料：已驗證 Email 的測試會員＋一筆已付款的數位版訂單，並帶入實體書定案設定。

    可重複執行：會員已存在就沿用，每次多建一筆已付款訂單；實體書設定只在還沒存過新版設定時寫入。
    資料庫不是 localhost 時拒絕執行。
    """
    import secrets as _secrets

    from packages.commerce.models import OrderCheckout, OrderInvoice, OrderItem as _Item, PaymentAttempt, Product
    from sites.Polaris_Parent.backend.extensions.member_account import service as account_service
    from sites.Polaris_Parent.backend.models import ReportFulfillment

    host = (db.engine.url.host or '').lower()
    if host not in ('localhost', '127.0.0.1', '::1'):
        raise click.ClickException(f'只能在本機資料庫使用（目前連到 {host or "未知主機"}）')

    digital = Product.query.filter_by(product_id=service.PRODUCT_IDS['digital'], language=service.LANGUAGE).first()
    if digital is None or not digital.is_active:
        raise click.ClickException('本機沒有啟用中的數位版商品（natal-report-digital），請先到後台建立')
    price = digital.get_price(service.CURRENCY).get('price')

    # 1. 實體書與專人解讀設定（定案版，docs/report-physical-addon-plan.md 第 10 節）
    attrs = dict(digital.attributes or {})
    if 'first_copy_price' not in (attrs.get(physical.ADDON_KEY) or {}):
        attrs[physical.ADDON_KEY] = {
            'physical_enabled': True, 'first_copy_price': 1200, 'extra_copy_price': 600,
            'specs': [{'key': 'softcover', 'label': '平裝', 'price_delta': -300},
                      {'key': 'hardcover-coated', 'label': '精裝（銅西卡紙質）', 'price_delta': 0},
                      {'key': 'hardcover-thin', 'label': '精裝（薄紙版）', 'price_delta': 0}],
            'cover_styles': physical.DEFAULT_COVER_STYLES,
            'custom_options': {k: {**v, 'enabled': True} for k, v in physical.DEFAULT_CUSTOM.items()},
            'spreads': {**physical.DEFAULT_SPREADS, 'enabled': True},
            'consult': {**physical.DEFAULT_CONSULT, 'enabled': True},
        }
        digital.attributes = attrs
        click.echo('已寫入實體書與專人解讀的定案設定（可到後台「實體書設定」修改）')
    phys = Product.query.filter_by(product_id=service.PRODUCT_IDS['physical'], language=service.LANGUAGE).first()
    if phys is not None and not phys.is_active:
        phys.is_active = True

    # 2. 測試會員（已驗證 Email）
    user = User.query.filter_by(username=DEMO_EMAIL).first()
    if user is None:
        user = User(username=DEMO_EMAIL, email=DEMO_EMAIL, role='member', is_active=True)
        user.set_password(DEMO_PASSWORD)
        db.session.add(user)
        db.session.flush()
        account_service.mark_verified(user.id, DEMO_EMAIL)
        click.echo(f'已建立測試會員 {DEMO_EMAIL}')

    # 3. 已付款的數位版訂單（不呼叫紫微，命盤欄位留空）
    item_no = service._new_item_no()
    name = f"{(digital.names or {}).get(service.LANGUAGE) or digital.product_id}（{service.VARIANT_LABELS['digital']}）"
    order = Order(order_no=service._new_order_no(), user_id=user.id, amount=price, status='pending', items=[],
                  language=service.LANGUAGE, currency=service.CURRENCY, payment_method='manual')
    db.session.add(order)
    db.session.flush()
    db.session.add(OrderCheckout(order_id=order.id, submission_key=f'demo-{_secrets.token_hex(8)}',
                                 policy_version=service.POLICY_VERSION, policy_consented_at=datetime.utcnow()))
    item = _Item(order_id=order.id, item_no=item_no, product_id=digital.id, product_code=digital.product_id, name=name,
                 variant='digital', kind='purchase', unit_price=price, currency=service.CURRENCY, quantity=1,
                 customization={'subject_name': '王小明', 'gender': '男',
                                'birth': {'date': '2020-05-01', 'time': '08:00', 'time_type': 'clock_time'},
                                'place': {'continent': '', 'country': '', 'city': ''}, 'relation_label': 'son',
                                'audience': {'reader': '父母', 'call_name': '小明', 'dedication': '給最勇敢的小明'}})
    db.session.add(item)
    db.session.flush()
    order.items = [physical.item_snapshot(item)]
    db.session.add(ReportFulfillment(order_item_id=item.id, request_no=item_no, member_id=user.id,
                                     handoff_status='not_ready'))
    db.session.add(OrderInvoice(order_id=order.id, status='not_applicable'))
    attempt = PaymentAttempt(attempt_no=payment.new_attempt_no(), order_id=order.id, provider='manual',
                             environment='test', currency=order.currency, status='created', amount=price,
                             review_note='本機示範資料：dev-seed-demo')
    db.session.add(attempt)
    payment.mark_paid(order, attempt)
    db.session.commit()

    front = os.environ.get('FRONTEND_URL', 'http://localhost:3000').rstrip('/')
    click.echo('')
    click.echo(f'測試會員：{DEMO_EMAIL}　密碼：{DEMO_PASSWORD}')
    click.echo(f'已付款的數位版訂單：{order.order_no}（NT${price:,}）')
    click.echo(f'會員訂單頁：{front}/report/orders/{order.order_no}')
    click.echo(f'會員中心：{front}/account?tab=reports')


@bp.cli.command('cleanup-designs')
def cleanup_designs_command():
    """刪除放棄的設計草稿與已取消實體書的設計（含照片），超過 30 天沒更新的（建議每天排程一次）。"""
    click.echo(f'removed {design.cleanup()} design(s)')


@bp.cli.command('expire-overdue')
def expire_overdue_command():
    """取消逾期未回報轉帳的人工收款訂單（建議每小時排程一次）。"""
    click.echo(f'cancelled {_expire_overdue()} overdue order(s)')


@bp.cli.command('run-jobs')
@click.option('--force', is_flag=True, help='忽略週期，全部立刻執行一次。')
@click.option('--job', 'only', multiple=True, help='只執行指定工作（可重複）。')
def run_jobs_command(force, only):
    """執行到期的背景工作（逾期取消、匯款提醒、寄信重試、清理）。可給 Railway Cron 或手動使用。"""
    import json
    results = jobs.run_locked(force=force, only=set(only) or None)
    if results is None:
        click.echo('另一個程序正在執行排程，這次略過')
        return
    click.echo(json.dumps(results, ensure_ascii=False))


@bp.cli.command('commerce-preview')
@click.option('--order-no', default=None, help='只盤點指定訂單；不提供則逐筆盤點全部報告訂單。')
def commerce_preview_command(order_no):
    """唯讀歷史訂單盤點（不建單、不補發資格、不寄信）。輸出不包含出生資料。"""
    import json
    from . import commerce

    query = Order.query.filter(Order.payment_method.in_(SUPPORTED_PAYMENT_MODES)).order_by(Order.id)
    if order_no:
        query = query.filter_by(order_no=order_no)
    for order in query.yield_per(100):
        click.echo(json.dumps(commerce.historical_preview(order), ensure_ascii=False))


@bp.cli.command('commerce-backfill-preview')
@click.option('--order-no', default=None, help='只預覽指定訂單；不提供則盤點全部報告訂單。')
def commerce_backfill_preview_command(order_no):
    """輸出詳細唯讀回填計畫；套用須由有權限的管理者在後台逐筆審查。"""
    import json
    from . import backfill
    query = Order.query.filter(Order.payment_method.in_(SUPPORTED_PAYMENT_MODES)).order_by(Order.id)
    if order_no:
        query = query.filter_by(order_no=order_no)
    for order in query.yield_per(100):
        click.echo(json.dumps(backfill.preview(order), ensure_ascii=False))
