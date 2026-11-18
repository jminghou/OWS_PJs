"""
帳號對應規則：鑰匙是 (provider, subject)，信箱只在第一次連結時用來找人。

登入（sign_in）
| 情況                                                     | 結果                         |
|----------------------------------------------------------|------------------------------|
| (provider, sub) 已連結                                    | 登入                         |
| 沒見過、provider 沒給信箱（LINE 可取消勾選）               | EmailMissing → 收驗證碼補信箱 |
| 沒見過、信箱不是會員                                       | 註冊（建會員＋連結）          |
| 沒見過、信箱已是會員、provider 掌管這個信箱（Gmail／hd）     | 自動連結後登入                |
| 沒見過、信箱已是會員、其他情況                              | NeedsLink → 收驗證碼證明信箱  |
| 會員已停用                                                | AccountDisabled              |

收到驗證碼後（complete_with_email）：信箱已是會員 → 連到那位會員；不是 → 用這個信箱建新會員。
已登入時連結（link_to_user）：直接連到目前的會員。

這裡只 flush 不 commit，由 API 層統一提交。
"""
from datetime import datetime
from typing import Optional, Tuple

from flask import current_app
from sqlalchemy import or_

from core.backend_engine.factory import db
from core.backend_engine.models import User
from core.backend_engine.services.member_auth import normalise_email
from packages.social_auth import hooks
from packages.social_auth.models import SocialIdentity
from packages.social_auth.providers.base import ProviderProfile

AVATAR_SOURCE_UPLOAD = 'upload'


class NeedsLink(Exception):
    """信箱已是會員，但不能自動連結；要先證明信箱是本人的。"""

    def __init__(self, email):
        super().__init__(email)
        self.email = email


class EmailMissing(Exception):
    """provider 沒給信箱，要請對方補一個並驗證。"""


class AccountDisabled(Exception):
    pass


class LinkConflict(Exception):
    """連結衝突；message 直接顯示給使用者。"""


def _find_member_by_email(email: str) -> Optional[User]:
    # 慣例 username＝email；Polaris 的 email 存在 member_profiles，舊資料可能是空的，兩欄都查
    return User.query.filter(or_(User.username == email, User.email == email)).first()


def _set_attrs(user: User, **values):
    # JSONB 沒有變更追蹤：整包重新指派才會寫回
    user.attributes = {**(user.attributes or {}), **values}


def _refresh_avatar(user: User, profile: ProviderProfile):
    """大頭貼跟著 provider 更新；會員自己上傳過（或本來就有、來源不明）就不覆蓋。

    同時連了 Google 和 LINE 時，以最後登入的那個為準。
    """
    if not profile.picture:
        return
    source = user.get_attribute('avatar_source')
    if source == AVATAR_SOURCE_UPLOAD:
        return
    if user.avatar and source is None:
        return  # 既有會員原本就有頭像，不知道來源 → 當成自己設的
    if user.avatar != profile.picture or source != profile.provider:
        user.avatar = profile.picture
        _set_attrs(user, avatar_source=profile.provider)


def _touch_identity(identity: SocialIdentity, profile: ProviderProfile, now: datetime):
    identity.email = profile.email
    identity.display_name = profile.name
    identity.picture_url = profile.picture
    identity.last_login_at = now


def _create_member(profile: ProviderProfile, email: str, now: datetime) -> User:
    role = current_app.config.get('SOCIAL_AUTH_DEFAULT_ROLE') or 'member'
    user = User(username=email, email=email, role=role, is_active=True, last_login=now)
    user.set_unusable_password()
    attrs = {'signup_provider': profile.provider}
    if profile.name:
        attrs['display_name'] = profile.name
    if profile.picture:
        user.avatar = profile.picture
        attrs['avatar_source'] = profile.provider
    _set_attrs(user, **attrs)
    db.session.add(user)
    db.session.flush()  # 取得 id（Polaris 經 blog.users view 的 trigger 寫入 account.app_users）
    return user


def _attach(user: User, profile: ProviderProfile, now: datetime) -> SocialIdentity:
    """把這個社群帳號連到 user；已連到別人或 user 已連了同 provider 的另一個帳號 → LinkConflict。"""
    existing = SocialIdentity.query.filter_by(provider=profile.provider, subject=profile.subject).first()
    if existing is not None:
        if existing.user_id != user.id:
            raise LinkConflict('這個社群帳號已經連到另一位會員了。')
        return existing
    if SocialIdentity.query.filter_by(user_id=user.id, provider=profile.provider).first() is not None:
        raise LinkConflict('你的帳號已經連了另一個同類型的社群帳號，請先解除原本的連結。')
    identity = SocialIdentity(user_id=user.id, provider=profile.provider, subject=profile.subject, created_at=now)
    db.session.add(identity)
    return identity


def _finish(user: User, identity: SocialIdentity, profile: ProviderProfile, now: datetime, *, is_new: bool):
    if not user.is_active:
        raise AccountDisabled()
    _touch_identity(identity, profile, now)
    if not is_new:
        _refresh_avatar(user, profile)
        user.last_login = now
    db.session.flush()
    if is_new:
        hooks.run_member_created(user, profile)
    hooks.run_signed_in(user, profile)


def sign_in(profile: ProviderProfile) -> Tuple[User, bool]:
    """依對應規則找到或建立會員並建立連結。回傳 (user, is_new)。"""
    now = datetime.utcnow()
    identity = SocialIdentity.query.filter_by(provider=profile.provider, subject=profile.subject).first()
    is_new = False
    user = None

    if identity is not None:
        user = db.session.get(User, identity.user_id)
        if user is None:
            # 會員被刪掉但連結還在：清掉孤兒連結，當成沒見過重新處理
            db.session.delete(identity)
            db.session.flush()
            identity = None

    if identity is None:
        if not profile.email:
            raise EmailMissing()
        user = _find_member_by_email(profile.email)
        if user is None:
            user = _create_member(profile, profile.email, now)
            is_new = True
        elif not profile.email_authoritative:
            raise NeedsLink(profile.email)
        elif SocialIdentity.query.filter_by(user_id=user.id, provider=profile.provider).first() is not None:
            raise NeedsLink(profile.email)  # 這位會員已連了另一個同 provider 的帳號，不自動連第二個
        identity = SocialIdentity(user_id=user.id, provider=profile.provider, subject=profile.subject,
                                  created_at=now)
        db.session.add(identity)

    _finish(user, identity, profile, now, is_new=is_new)
    return user, is_new


def complete_with_email(profile: ProviderProfile, email: str) -> Tuple[User, bool]:
    """驗證碼已證明 email 是本人的：連到這個信箱的會員，沒有就用它建新會員。"""
    email = normalise_email(email)
    now = datetime.utcnow()
    proven = ProviderProfile(profile.provider, profile.subject, email, True, profile.email_authoritative,
                             profile.name, profile.picture)
    user = _find_member_by_email(email)
    is_new = user is None
    if is_new:
        if SocialIdentity.query.filter_by(provider=profile.provider, subject=profile.subject).first():
            raise LinkConflict('這個社群帳號已經連到另一位會員了。')
        user = _create_member(proven, email, now)
    elif not user.is_active:
        raise AccountDisabled()
    identity = _attach(user, proven, now)
    _finish(user, identity, proven, now, is_new=is_new)
    return user, is_new


def link_to_user(user: User, profile: ProviderProfile) -> SocialIdentity:
    """已登入的會員在會員中心加連一個社群帳號。"""
    now = datetime.utcnow()
    identity = _attach(user, profile, now)
    _touch_identity(identity, profile, now)
    _refresh_avatar(user, profile)
    db.session.flush()
    return identity


def unlink(user: User, provider: str) -> None:
    """解除連結；這是最後一種登入方式（沒密碼、也沒其他社群帳號）就不給解。"""
    identity = SocialIdentity.query.filter_by(user_id=user.id, provider=provider).first()
    if identity is None:
        raise LinkConflict('沒有連結這個社群帳號。')
    others = SocialIdentity.query.filter(SocialIdentity.user_id == user.id,
                                         SocialIdentity.provider != provider).count()
    if not user.has_usable_password and others == 0:
        raise LinkConflict('這是你目前唯一的登入方式。請先設定密碼或連結另一個帳號，再解除。')
    db.session.delete(identity)
    db.session.flush()


def identities_for(user: User):
    rows = SocialIdentity.query.filter_by(user_id=user.id).order_by(SocialIdentity.created_at).all()
    return [r.to_dict() for r in rows]
