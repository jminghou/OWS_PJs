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

import os

import click

from core.backend_engine.factory import db
from core.backend_engine.models import User
from core.backend_engine.services.member_auth import normalise_email
from core.backend_engine.services.rbac import require_permission
from core.backend_engine.services.rbac_seed import register_permissions
from packages.commerce.models import Order, OrderItem
from sites.Polaris_Parent.backend.models import ReportConsultation, ReportPrintJob, Shipment
from sites.Polaris_Parent.backend.extensions.member_account.service import is_email_verified

from . import notify, payment, physical, service
from .validation import validate_order, validate_shipping

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
        else:
            return _error('不支援的操作', 404)
    except service.OrderError as exc:
        db.session.rollback()
        return _error(exc.message, exc.status, code=exc.code)
    current_app.logger.info(f'print job {job.id} {action} by admin {admin_id}')
    return jsonify({'success': True, 'job': _print_job_row(job)})


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


@bp.cli.command('expire-overdue')
def expire_overdue_command():
    """取消逾期未回報轉帳的人工收款訂單（建議每小時排程一次）。"""
    click.echo(f'cancelled {_expire_overdue()} overdue order(s)')
