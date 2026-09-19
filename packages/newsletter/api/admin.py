"""後台端點：訂閱者列表、CSV 匯出、刪除。"""
import csv
import io
from datetime import datetime

from flask import Response, jsonify, request
from flask_jwt_extended import jwt_required
from sqlalchemy import func

from core.backend_engine.factory import db
from core.backend_engine.services.rbac import require_permission
from packages.newsletter.blueprint import newsletter_bp
from packages.newsletter.emails import unsubscribe_url
from packages.newsletter.models import STATUS_ACTIVE, STATUSES, NewsletterSubscriber

# 試算表會把這些字元開頭的儲存格當公式執行；訂閱者的 email / source 是外部輸入
_FORMULA_PREFIXES = ('=', '+', '-', '@', '\t', '\r')
_UTF8_BOM = chr(0xFEFF)
_EXPORT_COLUMNS = ('email', 'status', 'locale', 'source', 'consent_at', 'confirmed_at', 'unsubscribe_url')


def _csv_safe(value) -> str:
    text = '' if value is None else str(value)
    return f"'{text}" if text.startswith(_FORMULA_PREFIXES) else text


def _filtered_query():
    query = NewsletterSubscriber.query
    status = request.args.get('status')
    if status in STATUSES:
        query = query.filter(NewsletterSubscriber.status == status)
    keyword = (request.args.get('q') or '').strip().lower()
    if keyword:
        query = query.filter(NewsletterSubscriber.email.contains(keyword, autoescape=True))
    return query


@newsletter_bp.route('/admin/subscribers', methods=['GET'])
@jwt_required()
@require_permission('newsletter.read')
def list_subscribers():
    page = request.args.get('page', 1, type=int)
    per_page = min(request.args.get('per_page', 20, type=int), 200)
    result = _filtered_query().order_by(NewsletterSubscriber.created_at.desc(), NewsletterSubscriber.id.desc()) \
        .paginate(page=page, per_page=per_page, error_out=False)

    counts = {status: 0 for status in STATUSES}
    counts.update(dict(
        db.session.query(NewsletterSubscriber.status, func.count(NewsletterSubscriber.id))
        .group_by(NewsletterSubscriber.status).all()
    ))

    return jsonify({
        'subscribers': [s.to_dict() for s in result.items],
        'counts': counts,
        'pagination': {
            'page': result.page,
            'pages': result.pages,
            'per_page': result.per_page,
            'total': result.total,
            'has_next': result.has_next,
            'has_prev': result.has_prev,
        },
    }), 200


@newsletter_bp.route('/admin/subscribers/export', methods=['GET'])
@jwt_required()
@require_permission('newsletter.read')
def export_subscribers():
    """CSV 匯出。未指定 status 時只匯出 active —— 沒確認或已退訂的人不該收到電子報。"""
    query = NewsletterSubscriber.query
    status = request.args.get('status', STATUS_ACTIVE)
    if status in STATUSES:
        query = query.filter(NewsletterSubscriber.status == status)

    buffer = io.StringIO()
    writer = csv.writer(buffer, lineterminator='\r\n')
    writer.writerow(_EXPORT_COLUMNS)
    for s in query.order_by(NewsletterSubscriber.id).yield_per(500):
        writer.writerow([_csv_safe(v) for v in (
            s.email, s.status, s.locale, s.source,
            s.consent_at.isoformat() if s.consent_at else '',
            s.confirmed_at.isoformat() if s.confirmed_at else '',
            unsubscribe_url(s),
        )])

    filename = f"subscribers-{status if status in STATUSES else 'all'}-{datetime.utcnow():%Y%m%d}.csv"
    # BOM：沒有它 Excel 會用系統 ANSI 編碼開檔，中文變亂碼
    return Response(
        _UTF8_BOM + buffer.getvalue(),
        mimetype='text/csv; charset=utf-8',
        headers={'Content-Disposition': f'attachment; filename={filename}', 'Cache-Control': 'no-store'},
    )


@newsletter_bp.route('/admin/subscribers/<int:subscriber_id>', methods=['DELETE'])
@jwt_required()
@require_permission('newsletter.manage')
def delete_subscriber(subscriber_id):
    """硬刪除（個資刪除請求）。一般退訂走 unsubscribe，會保留紀錄以免日後誤寄。"""
    subscriber = db.session.get(NewsletterSubscriber, subscriber_id)
    if subscriber is None:
        return jsonify({'message': 'Subscriber not found'}), 404
    db.session.delete(subscriber)
    db.session.commit()
    return jsonify({'message': 'Subscriber deleted'}), 200
