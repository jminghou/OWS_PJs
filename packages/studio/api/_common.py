"""Studio API 共用的小工具：身分、JSON、時間、分頁、標籤附掛。"""
from functools import wraps
from typing import Dict, Iterable, List

from flask import jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from core.backend_engine.blueprints.api.utils import parse_tw_datetime
from core.backend_engine.factory import db
from core.backend_engine.services.rbac import require_permission
from packages.studio.models import StudioTag, StudioTagging


def studio_read(f):
    """@jwt_required + studio.read（或 studio.write 亦可）。"""
    return jwt_required()(require_permission('studio.read', 'studio.write')(f))


def studio_write(f):
    return jwt_required()(require_permission('studio.write')(f))


def current_user_id() -> int:
    return int(get_jwt_identity())


def json_body() -> dict:
    return request.get_json(silent=True) or {}


def parse_dt(value):
    """接受台灣時間 ISO 字串（前端 datetime-local）→ 存 naive UTC；空值 → None。"""
    return parse_tw_datetime(value) if value else None


def bad_request(message: str, status: int = 422):
    return jsonify({'message': message}), status


def paginate(query, default_per_page: int = 20):
    page = request.args.get('page', 1, type=int)
    per_page = min(request.args.get('per_page', default_per_page, type=int), 200)
    result = query.paginate(page=page, per_page=per_page, error_out=False)
    return result.items, {
        'page': result.page,
        'pages': result.pages,
        'per_page': result.per_page,
        'total': result.total,
        'has_next': result.has_next,
        'has_prev': result.has_prev,
    }


def tags_for(target_type: str, target_ids: Iterable[int]) -> Dict[int, List[dict]]:
    """一次查出多個目標的標籤，回 {target_id: [tag dict]}。"""
    ids = list({i for i in target_ids if i is not None})
    result: Dict[int, List[dict]] = {i: [] for i in ids}
    if not ids:
        return result
    rows = (
        db.session.query(StudioTagging.target_id, StudioTag)
        .join(StudioTag, StudioTag.id == StudioTagging.tag_id)
        .filter(StudioTagging.target_type == target_type, StudioTagging.target_id.in_(ids))
        .order_by(StudioTag.name)
        .all()
    )
    for target_id, tag in rows:
        result[target_id].append(tag.to_dict())
    return result


def attach_tags(target_type: str, items: List[dict]) -> List[dict]:
    """把 tags 欄位掛到 to_dict() 結果上。"""
    lookup = tags_for(target_type, [item['id'] for item in items])
    for item in items:
        item['tags'] = lookup.get(item['id'], [])
    return items


def set_tags(target_type: str, target_id: int, tag_ids: Iterable[int]) -> None:
    """整組覆寫某目標的標籤（不 commit）。"""
    wanted = {int(i) for i in tag_ids}
    StudioTagging.query.filter_by(target_type=target_type, target_id=target_id).delete()
    for tag_id in wanted:
        db.session.add(StudioTagging(tag_id=tag_id, target_type=target_type, target_id=target_id))


def ensure_tags_by_name(names: Iterable[str]) -> List[StudioTag]:
    """依名稱取得或建立標籤（不 commit）。"""
    tags: List[StudioTag] = []
    for raw in names:
        name = (raw or '').strip()
        if not name:
            continue
        tag = StudioTag.query.filter_by(name=name).first()
        if not tag:
            tag = StudioTag(name=name)
            db.session.add(tag)
            db.session.flush()
        tags.append(tag)
    return tags


def with_session(f):
    """例外時 rollback 並回 422，避免每個路由重複 try/except。"""
    @wraps(f)
    def wrapper(*args, **kwargs):
        try:
            return f(*args, **kwargs)
        except Exception as exc:  # noqa: BLE001
            db.session.rollback()
            return jsonify({'message': f'Database error: {exc}'}), 422
    return wrapper
