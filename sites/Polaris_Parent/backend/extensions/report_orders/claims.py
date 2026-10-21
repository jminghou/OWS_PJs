"""
外部平台客人認領（第五項；docs/external-proxy-orders-plan.md 第 8 節；2026-10-21）
==============================================================================

代客建單的訂單掛在「客人檔案」底下一個不能登入的帳號（*@customers.polaris-parent.invalid，proxy.py）。
管理者為檔案發一組**認領碼**，在平台上傳給客人；客人到官網註冊、驗證 Email 後在會員中心輸入，
這份檔案的訂單與命盤就轉到他的正式帳號。

* 認領碼 12 碼（Crockford Base32，顯示成 XXXX-XXXX-XXXX，約 60 bit），只存 HMAC-SHA256（以 SECRET_KEY 為鍵）。
  輸入時不分大小寫、可省略連字號，O／I／L 視為 0／1。
* 重發＝舊碼作廢；作廢＝清掉雜湊；預設 90 天到期；用過即失效（檔案標記已認領）。
* 官網這邊在**同一個交易**裡轉移所有掛在舊帳號下的東西：訂單、報告交付、平台成交證據、製作資格、啟用碼、
  設計你的書。平台成交證據只改會員欄位（存下的指紋不重算），binding.require_evidence 比對的「證據會員＝訂單會員」
  照樣成立；每張訂單的時間軸留下「由哪位會員認領」。舊帳號停用，留著當歷史紀錄。
* 紫微那邊（命主歸屬 account.users.owner_member_id、訂單工作單 account.report_requests）由 PolarisUI 的
  POST /public/members/transfer 轉——官網的資料庫角色不能寫紫微的表。認領成功後立刻呼叫一次；失敗由背景排程
  （jobs.py 的 claim_sync）重試，後台客人檔案顯示同步狀態。紫微端只接受從客人檔案帳號轉出、重送安全。
"""

from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

from flask import current_app

from core.backend_engine.factory import db
from core.backend_engine.models import User
from packages.commerce.models import Order
from sites.Polaris_Parent.backend.models import ExternalCustomer

from . import audit
from .service import OrderError

ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"  # Crockford Base32（沒有 I L O U）
CODE_LEN = 12
DEFAULT_DAYS = 90
_FIX = str.maketrans({"O": "0", "I": "1", "L": "1"})

# 認領時要從舊帳號轉到新帳號的官網欄位（ORM 表；schema 由 SQLAlchemy 處理）
def _site_columns():
    from sites.Polaris_Parent.backend.commerce_models import (CommerceActivation, CommerceEntitlement,
                                                             CommerceExternalReceipt)
    from sites.Polaris_Parent.backend.models import ReportBookDesign, ReportFulfillment
    return ((Order, "user_id"), (ReportFulfillment, "member_id"), (CommerceExternalReceipt, "member_id"),
            (CommerceEntitlement, "holder_id"), (CommerceEntitlement, "operator_id"),
            (CommerceActivation, "recipient_id"), (ReportBookDesign, "user_id"))


def _fail(message, code="invalid", status=400):
    raise OrderError(message, status, code)


def _now():
    return datetime.now(timezone.utc)


def _utc(dt):
    return dt if dt is None or dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def normalise(code: str) -> str:
    return "".join(c for c in str(code or "").upper().translate(_FIX) if c in ALPHABET)


def digest(code: str) -> str:
    key = (current_app.config.get("SECRET_KEY") or "").encode()
    return hmac.new(key, f"claim:{normalise(code)}".encode(), hashlib.sha256).hexdigest()


def display(code: str) -> str:
    c = normalise(code)
    return "-".join(c[i:i + 4] for i in range(0, len(c), 4))


def _new_code() -> str:
    return "".join(secrets.choice(ALPHABET) for _ in range(CODE_LEN))


def _orders_of(customer):
    return Order.query.filter_by(user_id=customer.app_user_id).order_by(Order.id).all()


def status_view(customer) -> dict:
    expires = _utc(customer.claim_code_expires_at)
    active = bool(customer.claim_code_digest) and customer.claimed_at is None and (expires is None or expires > _now())
    claimer = db.session.get(User, customer.claimed_by) if customer.claimed_by else None
    return {"has_code": active, "issued_at": _utc(customer.claim_code_issued_at).isoformat() if customer.claim_code_issued_at else None,
            "expires_at": expires.isoformat() if expires else None,
            "expired": bool(customer.claim_code_digest) and expires is not None and expires <= _now(),
            "claimed": customer.claimed_at is not None,
            "claimed_at": _utc(customer.claimed_at).isoformat() if customer.claimed_at else None,
            "claimed_by_email": (claimer.email or claimer.username) if claimer else None,
            # 紫微那邊（命盤歸屬、工作單）：None＝還沒認領；True＝已轉；False＝待重試
            "ziwei_synced": None if customer.claimed_at is None else customer.ziwei_transferred_at is not None,
            "ziwei_error": customer.ziwei_transfer_error}


# ── 管理端 ───────────────────────────────────────────────────────────────────
def issue(customer, actor, days: int = DEFAULT_DAYS) -> str:
    """發（或重發）認領碼。回傳明碼——只在這一次給管理者看，庫裡只留雜湊。"""
    if customer.claimed_at is not None:
        _fail("這份客人檔案已經被認領了", "already_claimed", 409)
    if not 1 <= int(days) <= 365:
        _fail("期限請設 1–365 天")
    for _ in range(5):
        code = _new_code()
        d = digest(code)
        if not ExternalCustomer.query.filter_by(claim_code_digest=d).first():
            break
    customer.claim_code_digest = d
    customer.claim_code_issued_at = _now()
    customer.claim_code_expires_at = _now() + timedelta(days=int(days))
    for order in _orders_of(customer):
        audit.log(order, "claim_code_issued", actor, days=int(days))
    db.session.commit()
    return display(code)


def revoke(customer, actor) -> None:
    if customer.claimed_at is not None:
        _fail("這份客人檔案已經被認領了", "already_claimed", 409)
    if not customer.claim_code_digest:
        _fail("目前沒有有效的認領碼", "no_code", 409)
    customer.claim_code_digest = None
    customer.claim_code_expires_at = None
    for order in _orders_of(customer):
        audit.log(order, "claim_code_revoked", actor)
    db.session.commit()


# ── 會員端 ───────────────────────────────────────────────────────────────────
def _find(code: str, lock: bool = False):
    if len(normalise(code)) != CODE_LEN:
        _fail("認領碼不正確或已失效", "invalid_code", 404)
    q = ExternalCustomer.query.filter_by(claim_code_digest=digest(code))
    if lock:
        q = q.populate_existing().with_for_update()
    c = q.first()
    expires = _utc(c.claim_code_expires_at) if c else None
    if c is None or c.claimed_at is not None or (expires is not None and expires <= _now()):
        _fail("認領碼不正確或已失效", "invalid_code", 404)
    return c


def _check_member(member):
    from .proxy import is_external_email
    if member is None or not member.is_active or is_external_email(member.email or member.username):
        _fail("請用自己的會員帳號登入後再認領", "invalid_member", 403)


def preview(code: str, member) -> dict:
    """認領前讓客人確認：這份檔案底下有哪些訂單。"""
    _check_member(member)
    c = _find(code)
    from .overview import row
    orders = [row(o) for o in _orders_of(c) if o.order_items]
    return {"customer_name": c.display_name,
            "orders": [{"order_no": o["order_no"], "subject_name": o["subject_name"], "lines": o["lines"],
                        "status_label": o["status_label"]} for o in orders]}


def _move(old, new) -> dict:
    moved = {}
    for model, col in _site_columns():
        column = getattr(model.__table__.c, col)
        n = db.session.execute(model.__table__.update().where(column == old).values({col: new})).rowcount
        if n:
            moved[f"{model.__tablename__}.{col}"] = n
    return moved


def claim(code: str, member) -> dict:
    """認領：同一個交易裡把舊帳號的訂單與命盤轉給 member。回 {customer_name, orders: [order_no], moved}。"""
    _check_member(member)
    c = _find(code, lock=True)
    old, new = c.app_user_id, member.id
    if old == new:
        _fail("認領碼不正確或已失效", "invalid_code", 404)
    orders = _orders_of(c)
    moved = _move(old, new)
    c.claimed_by, c.claimed_at = new, _now()
    c.claim_code_digest = None
    old_user = db.session.get(User, old)
    if old_user is not None:
        old_user.is_active = False
    db.session.flush()
    for order in orders:
        db.session.expire(order)  # 上面用 SQL 直接改了 user_id，讓 ORM 重讀
        audit.log(order, "claimed_by_member", new, ref="claimed",
                  customer=c.display_name, member=member.email or member.username)
    db.session.commit()
    sync_ziwei(c)  # 紫微那邊：立刻試一次，失敗由排程重試
    return {"customer_name": c.display_name, "orders": [o.order_no for o in orders], "moved": moved}


# ── 紫微那邊的轉移（PolarisUI /public/members/transfer）──────────────────────────
MAX_ATTEMPTS_ALERT = 6


def sync_ziwei(customer) -> bool:
    """把紫微那邊的命主歸屬與工作單從客人檔案帳號轉給認領的會員。回傳是否成功；結果一律 commit。"""
    from sites.Polaris_Parent.backend.extensions.astrology import _ziwei_call
    if customer.claimed_by is None or customer.ziwei_transferred_at is not None:
        return True
    data, err = _ziwei_call("POST", "/public/members/transfer",
                            {"from_member_id": int(customer.app_user_id), "to_member_id": int(customer.claimed_by)})
    customer.ziwei_transfer_attempts = (customer.ziwei_transfer_attempts or 0) + 1
    if err:
        customer.ziwei_transfer_error = str(err)[:1000]
        current_app.logger.warning(f"claim ziwei transfer failed for customer {customer.id}: {err}")
        if customer.ziwei_transfer_attempts == MAX_ATTEMPTS_ALERT:
            _alert_admin(customer, err)
    else:
        customer.ziwei_transferred_at, customer.ziwei_transfer_error = _now(), None
        current_app.logger.info(f"claim ziwei transfer ok for customer {customer.id}: {(data or {}).get('moved')}")
    db.session.commit()
    return not err


def _alert_admin(customer, err):
    """轉移一直失敗：寄一封警示給管理者（掛在這位客人的第一張訂單上，寄信紀錄查得到）。"""
    from . import notify
    to = notify._admin_to()
    from .proxy import orders_of_customer
    orders = orders_of_customer(customer)
    if not to or not orders:
        return
    body = "\n".join([
        f"客人檔案「{customer.display_name}」（#{customer.id}）已由會員認領，官網的訂單已轉過去，",
        f"但紫微系統那邊的命盤歸屬與工作單轉移失敗 {customer.ziwei_transfer_attempts} 次。", "",
        f"錯誤：{err}", "",
        "系統會繼續每次排程重試。確認紫微系統正常後即會自動補上。",
        f"{notify._frontend_url()}/admin/external-customers/{customer.id}",
    ])
    notify._deliver(orders[0], "claim_sync_failed_admin", to,
                    f"【親紫之間後台】客人認領：紫微命盤歸屬轉移失敗（{customer.display_name}）", body,
                    key=f"claim_sync_failed:{customer.id}")


def sync_due(limit: int = 20):
    """排程：認領了、但紫微那邊還沒轉成功的客人檔案。回傳 (成功, 失敗)。"""
    rows = (ExternalCustomer.query.filter(ExternalCustomer.claimed_at.isnot(None),
                                          ExternalCustomer.ziwei_transferred_at.is_(None))
            .order_by(ExternalCustomer.id).limit(limit).all())
    ok = failed = 0
    for c in rows:
        if sync_ziwei(c):
            ok += 1
        else:
            failed += 1
    return ok, failed
