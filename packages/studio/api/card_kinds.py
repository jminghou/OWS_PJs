"""知識卡片類型（可設定）。"""
from flask import jsonify
from sqlalchemy import func

from core.backend_engine.factory import db
from packages.studio.blueprint import studio_bp as bp
from packages.studio.card_kinds import COLORS, load_kinds, save_kinds, validate_kinds
from packages.studio.models import StudioCard
from packages.studio.api._common import bad_request, json_body, studio_read, studio_write, with_session


def _usage() -> dict:
    return dict(db.session.query(StudioCard.kind, func.count()).group_by(StudioCard.kind).all())


def _payload():
    usage = _usage()
    kinds = load_kinds()
    for k in kinds:
        k['usage'] = usage.get(k['key'], 0)
    known = {k['key'] for k in kinds}
    # 已被刪除但仍有卡片在用的舊類型，讓前端能顯示、也能一鍵補回
    orphans = [{'key': key, 'usage': n} for key, n in usage.items() if key not in known]
    return {'kinds': kinds, 'orphans': orphans, 'colors': list(COLORS)}


@bp.route('/card-kinds', methods=['GET'])
@studio_read
def get_card_kinds():
    return jsonify(_payload())


@bp.route('/card-kinds', methods=['PUT'])
@studio_write
@with_session
def put_card_kinds():
    """整組覆寫。刪掉仍有卡片在用的類型會被擋（請改成停用，或先把卡片改類型）。"""
    raw = json_body().get('kinds')
    error = validate_kinds(raw)
    if error:
        return bad_request(error)
    usage = _usage()
    new_keys = {str(k.get('key', '')).strip() for k in raw}
    removed_in_use = [(key, n) for key, n in usage.items() if key not in new_keys and key in {k['key'] for k in load_kinds()}]
    if removed_in_use:
        detail = '、'.join(f'{key}（{n} 張）' for key, n in removed_in_use)
        return bad_request(f'以下類型仍有卡片在使用，不能刪除：{detail}。可以改成停用。', 409)
    save_kinds(raw)
    db.session.commit()
    return jsonify({'message': 'Card kinds saved', **_payload()})
