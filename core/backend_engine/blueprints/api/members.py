"""
會員名冊 API（後台「會員管理」）

    GET /members              列表：伺服器端搜尋、篩選、排序、分頁；附摘要數字與欄位／篩選定義
    GET /members/export.csv   依目前條件匯出 CSV（需 users.update：含個資，限能管理帳號的人）

會員＝role 為 member／user 的帳號（member_directory.MEMBER_ROLES）。後台人員在 /users?scope=staff。
選用模組可加欄位與篩選，見 core/backend_engine/services/member_directory.py。

查詢參數：
    q          搜尋帳號／Email（部分比對、不分大小寫）
    status     active | disabled
    joined     7d | 30d | 90d | 365d（註冊時間在這段期間內）
    sort       created_at（預設）| last_login | username
    order      desc（預設）| asc
    page, per_page（20／50／100，上限 100）
    <模組篩選鍵>=<值>
停用／啟用沿用 POST /users/<id>/toggle-status。
"""
import csv
import io
from datetime import datetime, timedelta

from flask import Response, jsonify, request
from flask_jwt_extended import jwt_required
from sqlalchemy import func

from core.backend_engine.blueprints.api import bp
from core.backend_engine.models import User
from core.backend_engine.services import member_directory as md
from core.backend_engine.services.rbac import require_permission

PER_PAGE_CHOICES = (20, 50, 100)
JOINED_DAYS = {'7d': 7, '30d': 30, '90d': 90, '365d': 365}
SORTS = {'created_at': User.created_at, 'last_login': User.last_login, 'username': User.username}
EXPORT_LIMIT = 50000


def _members_query():
    return User.query.filter(User.role.in_(md.MEMBER_ROLES))


def _filtered_query(args):
    query = _members_query()

    q = (args.get('q') or '').strip()
    if q:
        like = f'%{q.lower()}%'
        query = query.filter(func.lower(User.username).like(like) | func.lower(User.email).like(like))

    status = args.get('status')
    if status == 'active':
        query = query.filter(User.is_active.is_(True))
    elif status == 'disabled':
        query = query.filter(User.is_active.is_(False))

    days = JOINED_DAYS.get(args.get('joined') or '')
    if days:
        query = query.filter(User.created_at >= datetime.utcnow() - timedelta(days=days))

    for f in md.filters():
        value = args.get(f.key)
        if value and value in {v for v, _ in f.options}:
            query = f.apply(query, value)
    return query


def _ordered(query, args):
    column = SORTS.get(args.get('sort') or 'created_at', User.created_at)
    if (args.get('order') or 'desc') == 'asc':
        expr = column.asc().nulls_last()
    else:
        expr = column.desc().nulls_last()
    return query.order_by(expr, User.id.desc())


def _iso(value):
    return value.isoformat() if value else None


def _row(user, extras):
    attrs = user.attributes if isinstance(user.attributes, dict) else {}
    return {
        'id': user.id,
        'username': user.username,
        'email': user.email,
        'display_name': attrs.get('display_name') or None,
        'avatar': user.avatar,
        'role': user.role,
        'is_active': bool(user.is_active),
        'password_set': user.has_usable_password,
        'created_at': _iso(user.created_at),
        'last_login': _iso(user.last_login),
        'extras': extras,
    }


def _rows(users):
    """組列資料；模組欄位一頁一次批次取。"""
    values = {}
    for col in md.columns():
        try:
            values[col.key] = col.fetch(users) or {}
        except Exception as exc:  # noqa: BLE001  模組欄位失敗不該讓整頁掛掉
            from flask import current_app
            current_app.logger.error(f'member column {col.key} 失敗：{exc}')
            values[col.key] = {}
    return [_row(u, {k: v.get(u.id) for k, v in values.items()}) for u in users]


def _summary():
    base = _members_query()
    now = datetime.utcnow()
    return {
        'total': base.count(),
        'active': base.filter(User.is_active.is_(True)).count(),
        'new_7d': base.filter(User.created_at >= now - timedelta(days=7)).count(),
        'new_30d': base.filter(User.created_at >= now - timedelta(days=30)).count(),
    }


@bp.route('/members', methods=['GET'])
@jwt_required()
@require_permission('users.read')
def api_members():
    args = request.args
    page = max(args.get('page', 1, type=int) or 1, 1)
    per_page = args.get('per_page', 20, type=int)
    per_page = per_page if per_page in PER_PAGE_CHOICES else 20

    pagination = _ordered(_filtered_query(args), args).paginate(page=page, per_page=per_page, error_out=False)
    return jsonify({
        'members': _rows(pagination.items),
        'pagination': {'page': pagination.page, 'pages': pagination.pages,
                       'total': pagination.total, 'per_page': per_page},
        'summary': _summary(),
        **md.describe(),
    }), 200


@bp.route('/members/export.csv', methods=['GET'])
@jwt_required()
@require_permission('users.update')
def api_members_export():
    args = request.args
    users = _ordered(_filtered_query(args), args).limit(EXPORT_LIMIT).all()
    cols = md.columns()

    buf = io.StringIO()
    buf.write('﻿')  # Excel 開 UTF-8 CSV 需要 BOM
    writer = csv.writer(buf)
    writer.writerow(['ID', 'Email', '名稱', '狀態', '設過密碼', '註冊時間(UTC)', '最近登入(UTC)']
                    + [c.label for c in cols])
    for start in range(0, len(users), 500):  # 模組欄位分批取，避免一次丟上萬個 id
        for row in _rows(users[start:start + 500]):
            extras = []
            for c in cols:
                v = row['extras'].get(c.key)
                if isinstance(v, (list, tuple)):
                    v = '、'.join(str(x) for x in v)
                elif isinstance(v, bool):
                    v = '是' if v else '否'
                extras.append('' if v is None else v)
            writer.writerow([row['id'], row['email'], row['display_name'] or '',
                             '啟用' if row['is_active'] else '停用', '是' if row['password_set'] else '否',
                             row['created_at'] or '', row['last_login'] or ''] + extras)
    filename = f'members-{datetime.utcnow():%Y%m%d-%H%M}.csv'
    return Response(buf.getvalue(), mimetype='text/csv; charset=utf-8',
                    headers={'Content-Disposition': f'attachment; filename="{filename}"'})
