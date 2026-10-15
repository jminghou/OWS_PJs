"""
報告交付：管理者上傳完成的報告 PDF → 會員下載、實體書「設計你的書」整本預覽
（docs/report-physical-addon-plan.md 階段 2；目前由管理者上傳，之後紫微交接自動化時改由紫微提供）。
"""

import uuid
from datetime import datetime

from core.backend_engine.factory import db
from packages.commerce.models import OrderItem
from sites.Polaris_Parent.backend.models import ReportDocument, ReportFulfillment

from . import private_storage
from .service import OrderError

MAX_PDF_BYTES = 100 * 1024 * 1024


def current_document(report_item):
    if report_item is None:
        return None
    return (ReportDocument.query.filter_by(order_item_id=report_item.id, kind='book_pdf', is_current=True)
            .order_by(ReportDocument.id.desc()).first())


def document_view(doc):
    if doc is None:
        return None
    return {'id': doc.id, 'filename': doc.filename, 'bytes': doc.bytes,
            'uploaded_at': doc.created_at.isoformat() if doc.created_at else None}


def upload_report_pdf(report_item, admin_id, filename, data: bytes):
    """上傳（或更正後重傳）報告 PDF。回傳 (document, first_time)。"""
    from . import commerce
    commerce.require(report_item, 'report')
    if report_item.order.status != 'paid':
        raise OrderError('訂單付款後才能上傳報告', 409, 'not_paid')
    name = (filename or '').strip() or 'report.pdf'
    if not name.lower().endswith('.pdf') or not data.startswith(b'%PDF-'):
        raise OrderError('請上傳 PDF 檔', 400, 'invalid_file')
    if len(data) > MAX_PDF_BYTES:
        raise OrderError('PDF 不能超過 100 MB', 400, 'file_too_large')

    previous = current_document(report_item)
    key = f'reports/{report_item.item_no}/{uuid.uuid4().hex}.pdf'
    size, digest = private_storage.save(key, data, 'application/pdf')
    if previous is not None:
        previous.is_current = False
    doc = ReportDocument(order_item_id=report_item.id, kind='book_pdf', file_key=key, filename=name[:200],
                         bytes=size, sha256=digest, is_current=True, uploaded_by=admin_id)
    db.session.add(doc)
    f = ReportFulfillment.query.filter_by(order_item_id=report_item.id).first()
    if f is not None and f.deliverable_ready_at is None:
        f.deliverable_ready_at = datetime.utcnow()
    if f is not None:
        commerce.complete(report_item, 'report', 'report_fulfillment', f.id, admin_id)
    db.session.commit()
    return doc, previous is None


def document_for_download(document_id, user_id, is_admin):
    """下載憑證驗證後取檔：會員只能下載自己已付款訂單的報告；管理者可以下載任何一份。"""
    doc = db.session.get(ReportDocument, document_id)
    if doc is None or not doc.is_current:
        raise OrderError('檔案已更新或不存在，請回到訂單頁重新下載', 404, 'not_found')
    item = db.session.get(OrderItem, doc.order_item_id)
    order = item.order
    if not is_admin and (order.user_id != user_id or order.status != 'paid'):
        raise OrderError('找不到這份報告', 404, 'not_found')
    return doc, private_storage.read(doc.file_key)
