"""在後台「會員管理」加「訂單數」欄位與「有無訂單」篩選（core member_directory 的擴充點）。"""
from sqlalchemy import exists, func

from core.backend_engine.factory import db
from core.backend_engine.models import User
from core.backend_engine.services import member_directory as md
from packages.commerce.models import Order


def _fetch(users):
    ids = [u.id for u in users]
    if not ids:
        return {}
    rows = (db.session.query(Order.user_id, func.count(Order.id))
            .filter(Order.user_id.in_(ids)).group_by(Order.user_id).all())
    counts = {uid: n for uid, n in rows}
    return {uid: counts.get(uid, 0) for uid in ids}


def _apply(query, value):
    has = exists().where(Order.user_id == User.id)
    return query.filter(has if value == 'yes' else ~has)


def register():
    md.register_column('order_count', '訂單', kind='number', fetch=_fetch, order=30)
    md.register_filter('has_orders', '訂單', order=30, apply=_apply,
                       options=[('yes', '有訂單'), ('no', '沒有訂單')])
