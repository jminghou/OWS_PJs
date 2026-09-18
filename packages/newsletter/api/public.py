"""
公開端點（免登入）：訂閱、確認、退訂。

防濫用：IP 限流＋honeypot 欄位。subscribe 除了「email 格式錯誤」以外一律回相同的 200，
外部無法藉由回應差異探測某個信箱是否已在名單上。
confirm / unsubscribe 都是 POST：信箱的安全掃描會預先抓信裡的 GET 連結，
若 GET 就生效，使用者還沒點就被確認或被退訂了。前台頁面收到 token 後再 POST 過來。
"""
import re
from datetime import datetime, timedelta

from flask import jsonify, request
from sqlalchemy.exc import IntegrityError

from core.backend_engine.factory import db
from core.backend_engine.services.member_auth import normalise_email
from packages.newsletter.blueprint import newsletter_bp
from packages.newsletter.emails import send_confirmation
from packages.newsletter.models import (
    STATUS_ACTIVE, STATUS_PENDING, STATUS_UNSUBSCRIBED, NewsletterSubscriber,
)

try:
    from core.backend_engine.factory import limiter
except Exception:  # pragma: no cover - 限流器不可用時不擋功能
    limiter = None

CONFIRM_TTL = timedelta(days=7)
RESEND_COOLDOWN = timedelta(minutes=5)

_EMAIL_RE = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')
_GENERIC_OK = {'message': 'If the address is valid, a confirmation email is on its way.'}


def _limit(rule):
    """有 limiter 才套用限流，否則 no-op（本機/測試不依賴 Redis）。"""
    def deco(fn):
        return limiter.limit(rule)(fn) if limiter is not None else fn
    return deco


def _client_ip() -> str:
    forwarded = request.headers.get('X-Forwarded-For', '')
    ip = forwarded.split(',')[0].strip() if forwarded else (request.remote_addr or '')
    return ip[:45]


def _record_consent(subscriber, data, now) -> None:
    subscriber.locale = (str(data.get('locale') or '')[:10]) or subscriber.locale
    subscriber.source = (str(data.get('source') or '')[:50]) or subscriber.source
    subscriber.consent_at = now
    subscriber.consent_ip = _client_ip()
    subscriber.consent_user_agent = (request.headers.get('User-Agent') or '')[:255]


@newsletter_bp.route('/subscribe', methods=['POST'])
@_limit('5 per minute;30 per hour')
def subscribe():
    data = request.get_json(silent=True) or {}

    # honeypot：真人看不到這個欄位，有值就是機器人 —— 假裝成功、什麼都不做
    if data.get('website'):
        return jsonify(_GENERIC_OK), 200

    email = normalise_email(data.get('email'))
    if len(email) > 254 or not _EMAIL_RE.match(email):
        return jsonify({'message': 'Invalid email address', 'errors': {'email': 'invalid'}}), 400

    now = datetime.utcnow()
    subscriber = NewsletterSubscriber.query.filter_by(email=email).first()
    should_send = False

    if subscriber is None:
        subscriber = NewsletterSubscriber(email=email, status=STATUS_PENDING)
        _record_consent(subscriber, data, now)
        db.session.add(subscriber)
        should_send = True
    elif subscriber.status == STATUS_UNSUBSCRIBED:
        subscriber.status = STATUS_PENDING
        subscriber.unsubscribed_at = None
        subscriber.confirmed_at = None
        _record_consent(subscriber, data, now)
        should_send = True
    elif subscriber.status == STATUS_PENDING:
        # 重寄確認信，但設冷卻時間，避免被拿來轟炸別人的信箱
        should_send = not subscriber.confirm_sent_at or now - subscriber.confirm_sent_at > RESEND_COOLDOWN
    # 已 active：不動

    if should_send:
        subscriber.confirm_sent_at = now
    try:
        db.session.commit()
    except IntegrityError:
        # 同一信箱的並發訂閱：另一個請求已經建好並寄信了
        db.session.rollback()
        return jsonify(_GENERIC_OK), 200

    if should_send:
        send_confirmation(subscriber)
    return jsonify(_GENERIC_OK), 200


def _subscriber_from_token():
    token = str((request.get_json(silent=True) or {}).get('token') or '')
    if not token or len(token) > 64:
        return None
    return NewsletterSubscriber.query.filter_by(token=token).first()


@newsletter_bp.route('/confirm', methods=['POST'])
@_limit('20 per minute')
def confirm():
    subscriber = _subscriber_from_token()
    if subscriber is None:
        return jsonify({'message': 'Invalid link', 'code': 'invalid'}), 404

    if subscriber.status == STATUS_ACTIVE:
        return jsonify({'message': 'Already confirmed', 'status': STATUS_ACTIVE}), 200
    if subscriber.status == STATUS_UNSUBSCRIBED:
        # 退訂後不能用舊的確認連結復活，要重新訂閱（重新取得同意）
        return jsonify({'message': 'Please subscribe again', 'code': 'expired'}), 410

    now = datetime.utcnow()
    if not subscriber.confirm_sent_at or now - subscriber.confirm_sent_at > CONFIRM_TTL:
        return jsonify({'message': 'Link expired, please subscribe again', 'code': 'expired'}), 410

    subscriber.status = STATUS_ACTIVE
    subscriber.confirmed_at = now
    subscriber.confirmed_ip = _client_ip()
    db.session.commit()
    return jsonify({'message': 'Subscription confirmed', 'status': STATUS_ACTIVE}), 200


@newsletter_bp.route('/unsubscribe', methods=['POST'])
@_limit('20 per minute')
def unsubscribe():
    subscriber = _subscriber_from_token()
    if subscriber is None:
        return jsonify({'message': 'Invalid link', 'code': 'invalid'}), 404

    if subscriber.status != STATUS_UNSUBSCRIBED:
        subscriber.status = STATUS_UNSUBSCRIBED
        subscriber.unsubscribed_at = datetime.utcnow()
        db.session.commit()
    return jsonify({'message': 'Unsubscribed', 'status': STATUS_UNSUBSCRIBED}), 200
