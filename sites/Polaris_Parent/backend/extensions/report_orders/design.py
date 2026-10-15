"""
實體書「設計你的書」（docs/report-physical-addon-plan.md 階段 2）。

會員用報告的完整 PDF 做整本翻頁預覽，在預覽上：填封面名字與款式（或上傳客製封面）、寫扉頁贈言、
自選指定跨頁的位置並放照片與文字、在任何一頁標註修改（改寫文字／換成指定圖片／回報錯誤）。

兩種時機用同一份資料：
- 付款前（報告已完成時加購）：在加購頁設計，存成草稿（draft，沒有訂單）；送出加購時帶 design_id 連到新的實體書。
- 付款後（報告未完成就加購、或首購選實體書版）：報告完成後在訂單頁設計，直接連到該本實體書（submitted）。
付款後按「確認內容，開始製作打樣」→ confirmed，實體書進入「打樣製作中」。
"""

import uuid
from datetime import datetime, timedelta

from core.backend_engine.factory import db
from packages.commerce.models import OrderItem
from sites.Polaris_Parent.backend.models import ReportBookDesign, ReportDesignAsset, ReportPrintJob

from . import delivery, private_storage
from .service import OrderError

MAX_ASSET_BYTES = 20 * 1024 * 1024
ASSET_TYPES = {'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heif'}
MAX_ASSETS = 60
COVER_NAME_MAX = 20
DEDICATION_MAX = 200
TEXT_MAX = 1000
MAX_ANNOTATIONS = 100
ANNOTATION_TYPES = {'text': 'text_unlock', 'image': 'image_insert', 'fix': None}  # 類型 → 需要的特殊客製
DRAFT_RETENTION_DAYS = 30


# ── 取得或建立 ───────────────────────────────────────────────────────────────
def _require_report_ready(report_item):
    doc = delivery.current_document(report_item)
    if doc is None:
        raise OrderError('報告完成後才能設計實體書，完成時會寄信通知你', 409, 'report_not_ready')
    return doc


def _initial_data(report_item, job=None):
    audience = (report_item.customization or {}).get('audience') or {}
    opts = (job.options or {}) if job is not None else {}
    return {'cover_name': opts.get('cover_name') or audience.get('call_name') or '', 'cover_style': '',
            'cover_asset_id': None, 'dedication': audience.get('dedication') or '', 'annotations': [], 'spreads': []}


def draft_for_addon(user, report_order):
    """付款前：在已付款的報告訂單上加購實體書時用的設計草稿（沿用最近一份未使用的草稿）。"""
    item = next((i for i in report_order.order_items if i.kind == 'purchase'), None)
    if item is None or report_order.user_id != user.id or report_order.status != 'paid':
        raise OrderError('找不到這筆訂單', 404, 'not_found')
    _require_report_ready(item)
    design = (ReportBookDesign.query.filter_by(user_id=user.id, report_item_id=item.id, status='draft',
                                               print_job_id=None)
              .order_by(ReportBookDesign.updated_at.desc()).first())
    if design is None:
        design = ReportBookDesign(user_id=user.id, report_item_id=item.id, status='draft', data=_initial_data(item))
        db.session.add(design)
        db.session.commit()
    return design


def report_item_of_job(job):
    """實體書對應的報告項目：加購的實體書 → 原報告；下單選實體書版 → 自己。"""
    item = db.session.get(OrderItem, job.order_item_id)
    return (db.session.get(OrderItem, item.parent_item_id) if item.kind == 'addon' else item), item


def design_for_job(user, order):
    """付款後：訂單裡那本實體書的設計（第一次進來時建立）。"""
    from . import physical

    from . import commerce
    commerce.lock_order(order)

    p_item = physical.physical_item(order)
    job = physical.print_job_for(p_item)
    if job is None or order.user_id != user.id:
        raise OrderError('這筆訂單沒有實體書', 404, 'not_found')
    if commerce.tracked(order) and order.status == 'paid':
        commerce.require(p_item, 'book', user.id)
    design = ReportBookDesign.query.filter_by(print_job_id=job.id).first()
    if design is not None:
        return design
    if job.status == 'cancelled':
        raise OrderError('這本實體書已取消', 409, 'cancelled')
    report_item, _ = report_item_of_job(job)
    _require_report_ready(report_item)
    design = ReportBookDesign(user_id=user.id, report_item_id=report_item.id, print_job_id=job.id,
                              status='submitted', data=_initial_data(report_item, job))
    db.session.add(design)
    db.session.commit()
    return design


def attach_draft(design_id, user, report_item, job):
    """送出加購時：把付款前的草稿連到新的實體書（不 commit）。"""
    design = db.session.get(ReportBookDesign, design_id) if design_id else None
    if design is None:
        return None
    if design.user_id != user.id or design.report_item_id != report_item.id or design.status != 'draft':
        raise OrderError('設計內容不正確，請重新整理後再試', 400, 'invalid_design')
    design.print_job_id, design.status = job.id, 'submitted'
    return design


# ── 權限與可用選項 ───────────────────────────────────────────────────────────
def get_owned(design_id, user_id):
    design = db.session.get(ReportBookDesign, design_id)
    if design is None or design.user_id != user_id:
        raise OrderError('找不到這份設計', 404, 'not_found')
    job = job_of(design)
    if job is not None:
        from . import commerce
        item = db.session.get(OrderItem, job.order_item_id)
        if item.order.status == 'paid':
            commerce.require(item, 'book', user_id)
    return design


def job_of(design):
    return db.session.get(ReportPrintJob, design.print_job_id) if design.print_job_id else None


def purchased(design):
    """已購買（或付款前在加購頁選了）的特殊客製與跨頁數。付款前的草稿由前端提供選擇，這裡回 None。"""
    job = job_of(design)
    if job is None:
        return None
    from . import commerce
    item = db.session.get(OrderItem, job.order_item_id)
    if commerce.tracked(item.order) and item.order.status == 'paid':
        # Reading the purchased snapshot must remain possible for admin audit when
        # activation is pending/revoked. Mutation entry points enforce require().
        from sites.Polaris_Parent.backend.commerce_models import CommerceEntitlement
        entitlement = CommerceEntitlement.query.filter_by(order_item_id=item.id, kind='book').one()
        rights = entitlement.rights
        return {'custom': list(rights.get('custom') or []), 'spreads': int(rights.get('spreads') or 0)}
    custom = job.custom or {}
    return {'custom': list(custom.get('options') or []), 'spreads': int(custom.get('spreads') or 0)}


def editable(design):
    job = job_of(design)
    if design.status == 'confirmed':
        return False
    return job is None or job.status in ('awaiting_payment', 'awaiting_customization')


# ── 儲存內容 ─────────────────────────────────────────────────────────────────
def _text(v, limit):
    return str(v or '').strip()[:limit]


def _ids(v, valid):
    return [int(x) for x in (v if isinstance(v, list) else []) if isinstance(x, int) and x in valid][:10]


def clean_data(design, raw, page_count=None):
    """整理會員送來的設計內容（只留合法欄位與自己上傳的照片）。不檢查是否完成，那是確認時的事。"""
    raw = raw if isinstance(raw, dict) else {}
    asset_ids = {a.id for a in ReportDesignAsset.query.filter_by(design_id=design.id).all()}
    cover_asset = raw.get('cover_asset_id')
    out = {
        'cover_name': _text(raw.get('cover_name'), COVER_NAME_MAX),
        'cover_style': _text(raw.get('cover_style'), 40),
        'cover_asset_id': cover_asset if isinstance(cover_asset, int) and cover_asset in asset_ids else None,
        'dedication': _text(raw.get('dedication'), DEDICATION_MAX),
        'annotations': [],
        'spreads': [],
    }
    for a in (raw.get('annotations') if isinstance(raw.get('annotations'), list) else [])[:MAX_ANNOTATIONS]:
        if not isinstance(a, dict) or a.get('type') not in ANNOTATION_TYPES:
            continue
        page = a.get('page')
        if not isinstance(page, int) or page < 1 or (page_count and page > page_count):
            continue
        text = _text(a.get('text'), TEXT_MAX)
        ids = _ids(a.get('asset_ids'), asset_ids)
        if not text and not ids:
            continue
        out['annotations'].append({'id': _text(a.get('id'), 40) or uuid.uuid4().hex[:12], 'page': page,
                                   'type': a['type'], 'text': text, 'asset_ids': ids})
    for i, sp in enumerate((raw.get('spreads') if isinstance(raw.get('spreads'), list) else [])[:50]):
        if not isinstance(sp, dict):
            continue
        after = sp.get('after_page')
        after = after if isinstance(after, int) and after >= 1 and (not page_count or after <= page_count) else None
        out['spreads'].append({'index': i, 'after_page': after, 'text': _text(sp.get('text'), TEXT_MAX),
                               'asset_ids': _ids(sp.get('asset_ids'), asset_ids)})
    return out


def save(design, raw, page_count=None):
    if not editable(design):
        raise OrderError('內容已確認，想修改請在打樣時提出', 409, 'locked')
    design.data = clean_data(design, raw, page_count)
    db.session.commit()
    return design


# ── 照片 ─────────────────────────────────────────────────────────────────────
def add_asset(design, filename, content_type, data: bytes):
    if not editable(design):
        raise OrderError('內容已確認，想修改請在打樣時提出', 409, 'locked')
    ext = ASSET_TYPES.get((content_type or '').lower())
    if ext is None:
        raise OrderError('請上傳 JPG、PNG、WebP 或 HEIC 圖片', 400, 'invalid_file')
    if len(data) > MAX_ASSET_BYTES:
        raise OrderError('單張圖片不能超過 20 MB', 400, 'file_too_large')
    if ReportDesignAsset.query.filter_by(design_id=design.id).count() >= MAX_ASSETS:
        raise OrderError(f'每本書最多上傳 {MAX_ASSETS} 張圖片', 400, 'too_many')
    key = f'designs/{design.id}/{uuid.uuid4().hex}.{ext}'
    size, _ = private_storage.save(key, data, content_type)
    asset = ReportDesignAsset(design_id=design.id, file_key=key, filename=_text(filename, 200) or f'image.{ext}',
                              content_type=content_type.lower(), bytes=size)
    db.session.add(asset)
    db.session.commit()
    return asset


def remove_asset(design, asset_id):
    if not editable(design):
        raise OrderError('內容已確認，想修改請在打樣時提出', 409, 'locked')
    asset = ReportDesignAsset.query.filter_by(id=asset_id, design_id=design.id).first()
    if asset is None:
        raise OrderError('找不到這張圖片', 404, 'not_found')
    private_storage.delete(asset.file_key)
    db.session.delete(asset)
    # 從內容裡拿掉對這張圖的引用
    data = dict(design.data or {})
    if data.get('cover_asset_id') == asset_id:
        data['cover_asset_id'] = None
    for group in ('annotations', 'spreads'):
        data[group] = [{**x, 'asset_ids': [i for i in x.get('asset_ids') or [] if i != asset_id]}
                       for x in data.get(group) or []]
    design.data = data
    db.session.commit()


def asset_for_download(asset_id, user_id, is_admin):
    asset = db.session.get(ReportDesignAsset, asset_id)
    if asset is None:
        raise OrderError('找不到這張圖片', 404, 'not_found')
    design = db.session.get(ReportBookDesign, asset.design_id)
    if not is_admin and design.user_id != user_id:
        raise OrderError('找不到這張圖片', 404, 'not_found')
    return asset, private_storage.read(asset.file_key)


# ── 確認 ─────────────────────────────────────────────────────────────────────
def problems(design, bought):
    """確認前的檢查清單：回傳尚未完成的項目（文字），空清單表示可以確認。"""
    data = design.data or {}
    out = []
    if not data.get('cover_name'):
        out.append('請填寫封面上的名字')
    if 'custom_cover' in bought['custom'] and not data.get('cover_asset_id'):
        out.append('請上傳客製封面的圖片')
    spreads = data.get('spreads') or []
    for i in range(bought['spreads']):
        sp = spreads[i] if i < len(spreads) else {}
        if not sp.get('after_page'):
            out.append(f'請為「你的跨頁 {i + 1}」選擇位置')
        elif not sp.get('asset_ids') and not sp.get('text'):
            out.append(f'請放上「你的跨頁 {i + 1}」的照片或文字')
    for a in data.get('annotations') or []:
        need = ANNOTATION_TYPES.get(a.get('type'))
        if need and need not in bought['custom']:
            label = '改寫文字' if a['type'] == 'text' else '換成指定圖片'
            out.append(f'第 {a["page"]} 頁的「{label}」需要另外加購，請刪除這則或改成回報錯誤')
    return out


def confirm(design):
    from . import physical
    from . import commerce

    job = job_of(design)
    if job is None:
        raise OrderError('這份設計還沒有連到訂單', 409, 'no_order')
    item = db.session.get(OrderItem, job.order_item_id)
    commerce.require(item, 'book', design.user_id)
    db.session.refresh(job)
    db.session.refresh(design)
    if item.order.status != 'paid' or job.status != 'awaiting_customization':
        raise OrderError('付款後才能確認內容' if item.order.status != 'paid' else '這本實體書目前不能確認內容',
                         409, 'invalid_status')
    issues = problems(design, purchased(design))
    if issues:
        err = OrderError('還有內容沒有完成', 400, 'incomplete')
        err.errors = {'design': '；'.join(issues)}
        raise err
    now = datetime.utcnow()
    design.status, design.confirmed_at = 'confirmed', now
    data = design.data or {}
    job.options = {'cover_name': data.get('cover_name'), 'cover_style': data.get('cover_style'),
                   'cover_asset_id': data.get('cover_asset_id'), 'dedication': data.get('dedication')}
    job.pages = {'annotations': data.get('annotations') or [], 'spreads': data.get('spreads') or []}
    job.customized_at = now
    job.status = 'awaiting_proof'
    commerce.start(item, 'book', 'print_job', job.id, design.user_id)
    db.session.commit()
    return job


# ── 顯示 ─────────────────────────────────────────────────────────────────────
def asset_view(asset, user_id):
    return {'id': asset.id, 'filename': asset.filename, 'bytes': asset.bytes, 'content_type': asset.content_type,
            'token': private_storage.issue_file_token('asset', asset.id, user_id)}


def design_view(design, user_id):
    job = job_of(design)
    bought = purchased(design)
    report_item = db.session.get(OrderItem, design.report_item_id)
    doc = delivery.current_document(report_item)
    order_no = None
    if job is not None:
        order_no = db.session.get(OrderItem, job.order_item_id).order.order_no
    return {
        'id': design.id,
        'status': design.status,
        'editable': editable(design),
        'data': design.data or {},
        'assets': [asset_view(a, user_id) for a in
                   ReportDesignAsset.query.filter_by(design_id=design.id).order_by(ReportDesignAsset.id).all()],
        'purchased': bought,
        'problems': problems(design, bought) if bought is not None else [],
        'confirmable': (job is not None and job.status == 'awaiting_customization' and design.status != 'confirmed'
                        and db.session.get(OrderItem, job.order_item_id).order.status == 'paid'),
        'order_no': order_no,
        'report_order_no': report_item.order.order_no,
        'report_token': private_storage.issue_file_token('doc', doc.id, user_id) if doc else None,
        'confirmed_at': design.confirmed_at.isoformat() if design.confirmed_at else None,
    }


# ── 清除 ─────────────────────────────────────────────────────────────────────
def cleanup(now=None, days=DRAFT_RETENTION_DAYS):
    """刪除放棄的草稿、以及已取消實體書的設計（含照片），超過 days 天沒更新的。回傳刪除筆數。"""
    now = now or datetime.utcnow()
    cutoff = now - timedelta(days=days)
    stale = ReportBookDesign.query.filter(ReportBookDesign.updated_at < cutoff).all()
    removed = 0
    for design in stale:
        job = job_of(design)
        abandoned = design.status == 'draft' and design.print_job_id is None
        if not abandoned and not (job is not None and job.status == 'cancelled'):
            continue
        for asset in ReportDesignAsset.query.filter_by(design_id=design.id).all():
            private_storage.delete(asset.file_key)
            db.session.delete(asset)
        db.session.delete(design)
        removed += 1
    if removed:
        db.session.commit()
    return removed
