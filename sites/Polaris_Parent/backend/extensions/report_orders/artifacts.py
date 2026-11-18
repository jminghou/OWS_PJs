"""Explicit admin import of a versioned final PDF, never an automatic status side effect."""
import hashlib
import re
import urllib.request
from urllib.parse import quote

from core.backend_engine.factory import db
from packages.commerce.models import OrderItem
from sites.Polaris_Parent.backend.models import ReportFulfillment
from . import commerce, delivery, handoff
from .service import OrderError


def reject(message='成品資訊或版本不符，請重新查詢', status=409):
    raise OrderError(message, status, 'artifact_conflict')


def identity(item, f):
    return dict(request_no=f.request_no, order_no=item.order.order_no, member_id=str(f.member_id),
                chart_id=str(f.chart_id) if f.chart_id is not None else None,
                language=item.order.language or 'zh-TW', env=f.environment,
                product_code=item.product_code or '', variant=item.variant)


def manifest(item, f):
    if f is None or f.handoff_status != 'sent':
        reject('尚無已送出的製作工作單')
    expected = identity(item, f)
    data, err = handoff._ziwei_call('GET', f'/public/report-requests/{quote(f.request_no, safe="")}/artifact')
    if err:
        reject('目前無法取得可交付成品，請確認製作端已登錄最終 PDF', 502)
    m = data.get('artifact') if isinstance(data, dict) else None
    if not isinstance(m, dict) or any(m.get(k) != v for k, v in expected.items()):
        reject()
    if (m.get('kind') != 'book_pdf' or type(m.get('version')) is not int or m['version'] < 1
            or type(m.get('bytes')) is not int or not 5 <= m['bytes'] <= delivery.MAX_PDF_BYTES
            or not isinstance(m.get('sha256'), str) or not re.fullmatch('[0-9a-f]{64}', m['sha256'])
            or not isinstance(m.get('filename'), str) or not m['filename'].lower().endswith('.pdf')
            or len(m['filename']) > 200 or any(c in m['filename'] for c in ('/', '\\', '\r', '\n'))):
        reject()
    return {k: m[k] for k in (*expected, 'kind', 'version', 'bytes', 'sha256', 'filename')}


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None  # Never forward the service credential to a redirect destination.


def fetch_file(request_no, version):
    from sites.Polaris_Parent.backend.extensions.astrology import _ZIWEI_API_URL, _PUBLIC_SERVICE_TOKEN
    path = f'/public/report-requests/{quote(request_no, safe="")}/artifacts/{version}/file'
    req = urllib.request.Request(_ZIWEI_API_URL + path, headers={'X-Service-Token': _PUBLIC_SERVICE_TOKEN})
    try:
        with urllib.request.build_opener(NoRedirect()).open(req, timeout=60) as response:
            data = response.read(delivery.MAX_PDF_BYTES + 1)
    except Exception:
        reject('成品檔案暫時無法取得，尚未變更交付內容', 502)
    return data


def receive(item, actor, version, digest, expected_document_id):
    if type(version) is not int or not isinstance(digest, str) or (
            expected_document_id is not None and type(expected_document_id) is not int):
        reject('請先查詢成品版本', 400)
    commerce.lock_order(item.order)
    commerce.require(item, 'report')
    f = ReportFulfillment.query.filter_by(order_item_id=item.id).populate_existing().first()
    if f is None:
        reject()
    original = identity(item, f)
    fid, item_id = f.id, item.id
    db.session.commit()  # HTTP and hashing outside the order lock.
    m = manifest(item, f)
    if m['version'] != version or m['sha256'] != digest:
        reject()
    data = fetch_file(f.request_no, version)
    if len(data) != m['bytes'] or hashlib.sha256(data).hexdigest() != digest or not data.startswith(b'%PDF-'):
        reject('成品檔案完整性檢查失敗，尚未變更交付內容', 502)
    if manifest(item, f) != m:
        reject('下載期間成品版本已變更，請重新查詢')
    order = commerce.lock_order(item.order)
    item = OrderItem.query.filter_by(id=item_id).populate_existing().one()
    f = ReportFulfillment.query.filter_by(id=fid).populate_existing().with_for_update().one()
    if identity(item, f) != original or f.handoff_status != 'sent':
        reject('工作單歸屬已改變，請重新查詢')
    commerce.require(item, 'report')
    previous = delivery.current_document(item)
    imported = (order.attributes or {}).get('report_artifact_import') or {}
    if imported.get('request_no') == f.request_no and imported.get('version') == version:
        if imported.get('sha256') != digest or previous is None or previous.id != imported.get('document_id'):
            reject('此版本曾匯入，但目前交付已變更；請使用新的成品版本')
        db.session.commit()
        return previous, False, True
    if imported.get('request_no') == f.request_no and imported.get('version', 0) > version:
        reject('不可匯入較舊的成品版本')
    if (previous.id if previous else None) != expected_document_id:
        reject('官網交付內容已由其他操作更新，請重新查詢')
    doc, first = delivery.upload_report_pdf(item, actor, m['filename'], data, source_manifest=m)
    return doc, first, False
