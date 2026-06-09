"""
Membership Extension for Polaris Parent Site
親紫之間 會員商業循環 — 驗證消費 → 審核 → 發券（需求規格 §6）

註冊於 /api/v1（路由內部再分 /membership/* 會員端、/admin/* 管理端）。

會員端（@jwt_required，member_id = JWT identity = account.app_users.id）：
    GET    /api/v1/membership/products              - 列 active 外部商品（供「為這張盤下單」）
    POST   /api/v1/membership/order-submissions      - 登錄外部訂單號（status=待審核）
    GET    /api/v1/membership/order-submissions       - 列自己的提交（含已發折扣碼）
    GET    /api/v1/membership/rewards                 - 列自己的折扣券
    GET    /api/v1/membership/saved-articles          - 列收藏文章
    POST   /api/v1/membership/saved-articles          - 收藏文章
    DELETE /api/v1/membership/saved-articles/<cid>    - 取消收藏

管理端（@require_permission）：
    GET    /api/v1/admin/order-submissions            - 審核佇列
    POST   /api/v1/admin/order-submissions/<id>/approve - 通過 + 發券
    POST   /api/v1/admin/order-submissions/<id>/reject  - 退回（附原因）
    GET/POST/PATCH/DELETE /api/v1/admin/product-types   - 外部商品維護
    GET/POST/PATCH        /api/v1/admin/coupon-configs   - 折扣碼設定
"""

import os
import json
import urllib.request
import urllib.error
from datetime import datetime, timezone

from flask import Blueprint, jsonify, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from core.backend_engine.factory import db
from core.backend_engine.services.rbac import require_permission

try:
    from core.backend_engine.factory import limiter
except Exception:  # pragma: no cover
    limiter = None

bp = Blueprint('membership', __name__)

_ZIWEI_API_URL = os.environ.get('ZIWEI_API_URL', 'http://127.0.0.1:8000').rstrip('/')
_PUBLIC_SERVICE_TOKEN = os.environ.get('PUBLIC_SERVICE_TOKEN', '')


def _limit(rule):
    """有 limiter 才套用限流，否則 no-op（本機/測試不依賴 Redis）。"""
    def deco(fn):
        return limiter.limit(rule)(fn) if limiter is not None else fn
    return deco


def _models():
    """延遲載入站專屬模型（避免 import 順序問題）。"""
    from sites.Polaris_Parent.backend.models import (
        ProductType, CouponConfig, OrderSubmission, RewardGrant, SavedArticle,
    )
    return ProductType, CouponConfig, OrderSubmission, RewardGrant, SavedArticle


def _member_id():
    """JWT identity → int（= account.app_users.id）。"""
    return int(get_jwt_identity())


def _now():
    return datetime.now(timezone.utc)


def _ziwei_member_chart_ids(member_id):
    """呼叫紫微取會員擁有的 chart_id 集合（驗證命盤歸屬）。回 (set|None, error)。"""
    req = urllib.request.Request(
        f"{_ZIWEI_API_URL}/public/members/{member_id}/charts",
        method='GET',
        headers={'Content-Type': 'application/json',
                 'X-Service-Token': _PUBLIC_SERVICE_TOKEN})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            data = json.loads(r.read().decode('utf-8') or '{}')
    except urllib.error.HTTPError as e:
        return None, f"命盤服務錯誤 ({e.code})"
    except Exception as e:  # noqa: BLE001
        return None, f"無法連線命盤服務：{e}"
    ids = set()
    for person in (data.get('people') or []):
        for c in (person.get('charts') or []):
            if c.get('chart_id') is not None:
                ids.add(str(c['chart_id']))
    return ids, None


# ============================================================================
# 會員端
# ============================================================================

@bp.route('/membership/products', methods=['GET'])
@jwt_required()
def list_products():
    """列出可下單的外部商品（active）。"""
    ProductType, *_ = _models()
    rows = ProductType.query.filter_by(active=True).order_by(ProductType.id).all()
    return jsonify({'success': True, 'products': [p.to_dict() for p in rows]})


@bp.route('/membership/order-submissions', methods=['POST'])
@jwt_required()
@_limit("20 per minute")
def create_order_submission():
    """登錄外部訂單號。body: {product_type_id, platform, external_order_no, chart_id?, note?}"""
    ProductType, _Coupon, OrderSubmission, _Reward, _Saved = _models()
    member_id = _member_id()
    data = request.get_json(silent=True) or {}

    try:
        product_type_id = int(data.get('product_type_id'))
    except (TypeError, ValueError):
        return jsonify({'success': False, 'error': '缺少或無效的 product_type_id'}), 400
    platform = (data.get('platform') or '').strip()
    external_order_no = (data.get('external_order_no') or '').strip()
    note = (data.get('note') or '').strip() or None
    chart_id = data.get('chart_id')

    if not platform:
        return jsonify({'success': False, 'error': '缺少平台 platform'}), 400
    if not external_order_no:
        return jsonify({'success': False, 'error': '缺少訂單號 external_order_no'}), 400

    product = ProductType.query.filter_by(id=product_type_id, active=True).first()
    if not product:
        return jsonify({'success': False, 'error': '商品不存在或已下架'}), 400

    # 命盤歸屬驗證（提供 chart_id 才驗；紫微服務不可用則拒絕，避免錯掛）
    chart_id_val = None
    if chart_id not in (None, '', 0, '0'):
        ids, err = _ziwei_member_chart_ids(member_id)
        if err:
            return jsonify({'success': False, 'error': err}), 502
        if str(chart_id) not in ids:
            return jsonify({'success': False, 'error': '此命盤不屬於你的帳號'}), 403
        chart_id_val = int(chart_id)

    sub = OrderSubmission(
        member_id=member_id, chart_id=chart_id_val, product_type_id=product_type_id,
        platform=platform, external_order_no=external_order_no, status='待審核', note=note,
    )
    try:
        db.session.add(sub)
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({'success': False, 'error': '此訂單號已登錄過（同平台不可重複）'}), 409
    return jsonify({'success': True, 'id': sub.id, 'status': sub.status}), 201


@bp.route('/membership/order-submissions', methods=['GET'])
@jwt_required()
def list_my_order_submissions():
    """列出自己的訂單提交（含商品名與已發折扣碼）。"""
    member_id = _member_id()
    rows = db.session.execute(text("""
        SELECT os.id, os.platform, os.external_order_no, os.status, os.note,
               os.chart_id, os.created_at, os.reviewed_at,
               pt.name AS product_name,
               rg.coupon_code_snapshot AS coupon_code
        FROM shop.order_submissions os
        JOIN shop.product_types pt ON pt.id = os.product_type_id
        LEFT JOIN shop.reward_grants rg ON rg.order_submission_id = os.id
        WHERE os.member_id = :mid
        ORDER BY os.created_at DESC
    """), {'mid': member_id}).mappings().all()
    return jsonify({'success': True, 'submissions': [dict(r) for r in rows]})


@bp.route('/membership/rewards', methods=['GET'])
@jwt_required()
def list_my_rewards():
    """列出自己的折扣券（可複製/轉送）。"""
    member_id = _member_id()
    rows = db.session.execute(text("""
        SELECT rg.id, rg.coupon_code_snapshot, rg.granted_at,
               os.platform, pt.name AS product_name
        FROM shop.reward_grants rg
        JOIN shop.order_submissions os ON os.id = rg.order_submission_id
        JOIN shop.product_types pt ON pt.id = os.product_type_id
        WHERE rg.member_id = :mid
        ORDER BY rg.granted_at DESC
    """), {'mid': member_id}).mappings().all()
    return jsonify({'success': True, 'rewards': [dict(r) for r in rows]})


# ── 收藏文章 ────────────────────────────────────────────────
@bp.route('/membership/saved-articles', methods=['GET'])
@jwt_required()
def list_saved_articles():
    member_id = _member_id()
    rows = db.session.execute(text("""
        SELECT sa.id, sa.content_id, sa.related_chart_id, sa.saved_at,
               c.title, c.slug, c.language
        FROM blog.saved_articles sa
        JOIN blog.contents c ON c.id = sa.content_id
        WHERE sa.member_id = :mid
        ORDER BY sa.saved_at DESC
    """), {'mid': member_id}).mappings().all()
    return jsonify({'success': True, 'articles': [dict(r) for r in rows]})


@bp.route('/membership/saved-articles', methods=['POST'])
@jwt_required()
@_limit("60 per minute")
def add_saved_article():
    """收藏文章。body: {content_id, related_chart_id?}"""
    *_, SavedArticle = _models()
    member_id = _member_id()
    data = request.get_json(silent=True) or {}
    try:
        content_id = int(data.get('content_id'))
    except (TypeError, ValueError):
        return jsonify({'success': False, 'error': '缺少或無效的 content_id'}), 400
    related_chart_id = data.get('related_chart_id')
    related_chart_id = int(related_chart_id) if related_chart_id not in (None, '', 0, '0') else None

    exists = db.session.execute(text(
        "SELECT 1 FROM blog.contents WHERE id = :cid"), {'cid': content_id}).first()
    if not exists:
        return jsonify({'success': False, 'error': '文章不存在'}), 404

    sa = SavedArticle(member_id=member_id, content_id=content_id, related_chart_id=related_chart_id)
    try:
        db.session.add(sa)
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({'success': True, 'already': True}), 200  # 已收藏，視為冪等
    return jsonify({'success': True, 'id': sa.id}), 201


@bp.route('/membership/saved-articles/<int:content_id>', methods=['DELETE'])
@jwt_required()
def remove_saved_article(content_id):
    *_, SavedArticle = _models()
    member_id = _member_id()
    SavedArticle.query.filter_by(member_id=member_id, content_id=content_id).delete()
    db.session.commit()
    return jsonify({'success': True})


# ============================================================================
# 管理端
# ============================================================================

@bp.route('/admin/order-submissions', methods=['GET'])
@jwt_required()
@require_permission('order_submissions.review')
def admin_list_order_submissions():
    """審核佇列。query: status（預設 待審核）。"""
    status = request.args.get('status', '待審核')
    where = "WHERE os.status = :status" if status else ""
    rows = db.session.execute(text(f"""
        SELECT os.id, os.member_id, os.chart_id, os.platform, os.external_order_no,
               os.status, os.note, os.created_at, os.reviewed_at,
               pt.name AS product_name,
               mp.email AS member_email,
               rg.coupon_code_snapshot AS coupon_code
        FROM shop.order_submissions os
        JOIN shop.product_types pt ON pt.id = os.product_type_id
        LEFT JOIN blog.member_profiles mp ON mp.app_user_id = os.member_id
        LEFT JOIN shop.reward_grants rg ON rg.order_submission_id = os.id
        {where}
        ORDER BY os.created_at ASC
    """), ({'status': status} if status else {})).mappings().all()
    return jsonify({'success': True, 'submissions': [dict(r) for r in rows]})


@bp.route('/admin/order-submissions/<int:sub_id>/approve', methods=['POST'])
@jwt_required()
@require_permission('order_submissions.review')
def admin_approve_order_submission(sub_id):
    """通過訂單並發券（冪等：已發券不重發）。發的碼 = 該平台目前 active 折扣碼快照。"""
    _Pt, CouponConfig, OrderSubmission, RewardGrant, _Sa = _models()
    sub = OrderSubmission.query.get(sub_id)
    if not sub:
        return jsonify({'success': False, 'error': '提交不存在'}), 404

    existing = RewardGrant.query.filter_by(order_submission_id=sub.id).first()
    if existing:
        sub.status = '通過'
        sub.reviewed_at = sub.reviewed_at or _now()
        db.session.commit()
        return jsonify({'success': True, 'coupon_code': existing.coupon_code_snapshot,
                        'already_granted': True})

    coupon = (CouponConfig.query
              .filter_by(platform=sub.platform, active=True)
              .order_by(CouponConfig.id.desc()).first())
    if not coupon:
        return jsonify({'success': False,
                        'error': f'平台「{sub.platform}」目前無有效折扣碼，請先設定 coupon'}), 400

    sub.status = '通過'
    sub.reviewed_at = _now()
    grant = RewardGrant(member_id=sub.member_id, order_submission_id=sub.id,
                        coupon_code_snapshot=coupon.code)
    try:
        db.session.add(grant)
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({'success': False, 'error': '發券衝突，請重試'}), 409
    return jsonify({'success': True, 'coupon_code': coupon.code})


@bp.route('/admin/order-submissions/<int:sub_id>/reject', methods=['POST'])
@jwt_required()
@require_permission('order_submissions.review')
def admin_reject_order_submission(sub_id):
    """退回訂單（附原因）。會員可修正 note 後重送。"""
    _Pt, _Coupon, OrderSubmission, _Reward, _Sa = _models()
    sub = OrderSubmission.query.get(sub_id)
    if not sub:
        return jsonify({'success': False, 'error': '提交不存在'}), 404
    data = request.get_json(silent=True) or {}
    note = (data.get('note') or '').strip()
    if not note:
        return jsonify({'success': False, 'error': '退回需附原因 note'}), 400
    sub.status = '退回'
    sub.note = note
    sub.reviewed_at = _now()
    db.session.commit()
    return jsonify({'success': True})


# ── 外部商品維護 ────────────────────────────────────────────
@bp.route('/admin/product-types', methods=['GET'])
@jwt_required()
@require_permission('product_types.manage')
def admin_list_product_types():
    ProductType, *_ = _models()
    rows = ProductType.query.order_by(ProductType.id).all()
    return jsonify({'success': True, 'products': [p.to_dict() for p in rows]})


@bp.route('/admin/product-types', methods=['POST'])
@jwt_required()
@require_permission('product_types.manage')
def admin_create_product_type():
    ProductType, *_ = _models()
    data = request.get_json(silent=True) or {}
    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({'success': False, 'error': '缺少商品名稱 name'}), 400
    p = ProductType(
        name=name, platform=(data.get('platform') or '').strip() or None,
        external_url=(data.get('external_url') or '').strip() or None,
        active=bool(data.get('active', True)))
    db.session.add(p)
    db.session.commit()
    return jsonify({'success': True, 'product': p.to_dict()}), 201


@bp.route('/admin/product-types/<int:pid>', methods=['PATCH'])
@jwt_required()
@require_permission('product_types.manage')
def admin_update_product_type(pid):
    ProductType, *_ = _models()
    p = ProductType.query.get(pid)
    if not p:
        return jsonify({'success': False, 'error': '商品不存在'}), 404
    data = request.get_json(silent=True) or {}
    if 'name' in data:
        p.name = (data.get('name') or '').strip() or p.name
    if 'platform' in data:
        p.platform = (data.get('platform') or '').strip() or None
    if 'external_url' in data:
        p.external_url = (data.get('external_url') or '').strip() or None
    if 'active' in data:
        p.active = bool(data.get('active'))
    p.updated_at = _now()
    db.session.commit()
    return jsonify({'success': True, 'product': p.to_dict()})


@bp.route('/admin/product-types/<int:pid>', methods=['DELETE'])
@jwt_required()
@require_permission('product_types.manage')
def admin_delete_product_type(pid):
    ProductType, *_ = _models()
    p = ProductType.query.get(pid)
    if not p:
        return jsonify({'success': False, 'error': '商品不存在'}), 404
    # 已有訂單引用時改為下架而非刪除，避免破壞歷史紀錄
    referenced = db.session.execute(text(
        "SELECT 1 FROM shop.order_submissions WHERE product_type_id = :pid LIMIT 1"),
        {'pid': pid}).first()
    if referenced:
        p.active = False
        p.updated_at = _now()
        db.session.commit()
        return jsonify({'success': True, 'deactivated': True,
                        'message': '已有訂單引用此商品，改為下架'})
    db.session.delete(p)
    db.session.commit()
    return jsonify({'success': True})


# ── 折扣碼設定 ──────────────────────────────────────────────
@bp.route('/admin/coupon-configs', methods=['GET'])
@jwt_required()
@require_permission('coupons.manage')
def admin_list_coupon_configs():
    _Pt, CouponConfig, *_ = _models()
    rows = CouponConfig.query.order_by(CouponConfig.id.desc()).all()
    return jsonify({'success': True, 'coupons': [c.to_dict() for c in rows]})


@bp.route('/admin/coupon-configs', methods=['POST'])
@jwt_required()
@require_permission('coupons.manage')
def admin_create_coupon_config():
    """新增折扣碼設定。同平台設為 active 時，自動停用該平台其他 active（保持單一有效碼）。"""
    _Pt, CouponConfig, *_ = _models()
    data = request.get_json(silent=True) or {}
    code = (data.get('code') or '').strip()
    platform = (data.get('platform') or '').strip()
    if not code or not platform:
        return jsonify({'success': False, 'error': '缺少 code 或 platform'}), 400
    active = bool(data.get('active', True))
    if active:
        CouponConfig.query.filter_by(platform=platform, active=True).update({'active': False})
    c = CouponConfig(
        code=code, platform=platform,
        discount_desc=(data.get('discount_desc') or '').strip() or None,
        valid_from=_parse_dt(data.get('valid_from')),
        valid_to=_parse_dt(data.get('valid_to')),
        active=active)
    db.session.add(c)
    db.session.commit()
    return jsonify({'success': True, 'coupon': c.to_dict()}), 201


@bp.route('/admin/coupon-configs/<int:cid>', methods=['PATCH'])
@jwt_required()
@require_permission('coupons.manage')
def admin_update_coupon_config(cid):
    _Pt, CouponConfig, *_ = _models()
    c = CouponConfig.query.get(cid)
    if not c:
        return jsonify({'success': False, 'error': '折扣碼不存在'}), 404
    data = request.get_json(silent=True) or {}
    if 'code' in data:
        c.code = (data.get('code') or '').strip() or c.code
    if 'platform' in data:
        c.platform = (data.get('platform') or '').strip() or c.platform
    if 'discount_desc' in data:
        c.discount_desc = (data.get('discount_desc') or '').strip() or None
    if 'valid_from' in data:
        c.valid_from = _parse_dt(data.get('valid_from'))
    if 'valid_to' in data:
        c.valid_to = _parse_dt(data.get('valid_to'))
    if 'active' in data:
        active = bool(data.get('active'))
        if active:
            (CouponConfig.query
             .filter(CouponConfig.platform == c.platform, CouponConfig.active.is_(True),
                     CouponConfig.id != c.id)
             .update({'active': False}))
        c.active = active
    c.updated_at = _now()
    db.session.commit()
    return jsonify({'success': True, 'coupon': c.to_dict()})


def _parse_dt(value):
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace('Z', '+00:00'))
    except (TypeError, ValueError):
        return None
