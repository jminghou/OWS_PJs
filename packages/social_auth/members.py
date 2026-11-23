"""在後台「會員管理」加「登入方式」欄位與篩選（core member_directory 的擴充點）。"""
from sqlalchemy import exists

from core.backend_engine.models import User
from core.backend_engine.services import member_directory as md
from packages.social_auth.models import SocialIdentity

PROVIDER_LABELS = {'google': 'Google', 'line': 'LINE'}


def _fetch(users):
    ids = [u.id for u in users]
    if not ids:
        return {}
    out = {}
    rows = (SocialIdentity.query.with_entities(SocialIdentity.user_id, SocialIdentity.provider)
            .filter(SocialIdentity.user_id.in_(ids)).order_by(SocialIdentity.created_at).all())
    for user_id, provider in rows:
        out.setdefault(user_id, []).append(PROVIDER_LABELS.get(provider, provider))
    return out


def _has(provider=None):
    cond = SocialIdentity.user_id == User.id
    if provider:
        cond = cond & (SocialIdentity.provider == provider)
    return exists().where(cond)


def _apply(query, value):
    if value == 'none':
        return query.filter(~_has())
    return query.filter(_has(value))


def register():
    md.register_column('login_methods', '社群登入', kind='badges', fetch=_fetch, order=10)
    md.register_filter('login_method', '登入方式', order=10, apply=_apply, options=[
        *PROVIDER_LABELS.items(),
        ('none', '只用 Email'),
    ])
