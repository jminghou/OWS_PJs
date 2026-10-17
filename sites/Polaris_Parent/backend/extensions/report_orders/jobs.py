"""
客製報告的背景排程（階段 1 ①，2026-10-17）。

工作清單見 JOBS：逾期取消、匯款期限提醒、寄信重試、清除放棄的設計草稿、清除舊信件內文。
每個工作有自己的週期；是否到期看 shop.report_job_runs 的上次開始時間，所以多跑幾次也不會多做。

執行方式（兩種擇一或並用，結果相同）：
  * 後端程序內：REPORT_JOBS_ENABLED=true 時，每個 gunicorn worker 在收到第一個請求後啟動一條背景執行緒，
    每 REPORT_JOBS_INTERVAL_SECONDS 秒醒來一次。用 Postgres advisory lock 保證同一時間只有一個程序在跑
    （兩個 worker、部署交接時新舊兩個容器都一樣）。CLI（flask db upgrade 等）不會收到請求，不會啟動。
  * 指令：flask report_orders run-jobs（可給 Railway Cron 或手動執行；--force 忽略週期）。
"""

import json
import random
import threading
import time
from datetime import datetime, timedelta

from flask import current_app
from sqlalchemy import text

from core.backend_engine.factory import db
from sites.Polaris_Parent.backend.models import ReportJobRun

# 任意固定值：所有程序搶同一把 advisory lock
_LOCK_KEY = 0x504F4C4A  # 'POLJ'
# 匯款期限前多久提醒；訂單成立未滿 MIN_AGE 不提醒（期限只有 1 天時避免剛下單就收到提醒）
REMINDER_BEFORE = timedelta(hours=24)
REMINDER_MIN_AGE = timedelta(hours=12)


def _expire_overdue(now):
    from . import _expire_overdue as expire
    return {'cancelled': expire()}


def _payment_reminders(now):
    from packages.commerce.models import Order, OrderCheckout

    from . import _buyer_email, notify, payment
    bank = payment.manual_bank_info()
    if bank is None:
        return {'sent': 0, 'skipped': 'manual_payment_not_configured'}
    orders = (Order.query.join(OrderCheckout, OrderCheckout.order_id == Order.id)
              .filter(Order.status == 'pending', Order.payment_method == 'manual',
                      OrderCheckout.expires_at.isnot(None), OrderCheckout.expires_at > now,
                      OrderCheckout.expires_at <= now + REMINDER_BEFORE,
                      Order.created_at <= now - REMINDER_MIN_AGE)
              .all())
    sent = 0
    for order in orders:
        if payment.pending_manual_attempt(order) is not None:
            continue  # 已回報轉帳，等管理者對帳
        email = _buyer_email(order)
        if email and notify.send_payment_reminder(order, email, bank):
            sent += 1
    return {'sent': sent}


def _retry_mail(now):
    from . import notify
    sent, failed = notify.retry_due(now)
    return {'sent': sent, 'failed': failed}


def _cleanup_designs(now):
    from . import design
    return {'removed': design.cleanup(now)}


def _purge_mail_bodies(now):
    from . import notify
    return {'purged': notify.purge_bodies(now)}


# (名稱, 週期, 說明, 函式)
JOBS = [
    ('expire_overdue', timedelta(minutes=10), '取消逾期未回報轉帳的訂單', _expire_overdue),
    ('payment_reminders', timedelta(minutes=30), '匯款期限前 24 小時提醒', _payment_reminders),
    ('retry_mail', timedelta(0), '重寄寄失敗的通知信', _retry_mail),
    ('cleanup_designs', timedelta(days=1), '刪除放棄超過 30 天的設計草稿與照片', _cleanup_designs),
    ('purge_mail_bodies', timedelta(days=1), '清除 30 天前通知信的內文', _purge_mail_bodies),
]


def _due(run, every, now):
    return run is None or run.last_started_at is None or every <= timedelta(0) or run.last_started_at + every <= now


def run_due(now=None, force=False, only=None):
    """跑所有到期的工作；每個工作各自 commit，一個失敗不影響其他。回傳 {工作: 結果}。"""
    results = {}
    for name, every, _label, fn in JOBS:
        if only and name not in only:
            continue
        now_i = now or datetime.utcnow()
        run = db.session.get(ReportJobRun, name)
        if not force and not _due(run, every, now_i):
            continue
        if run is None:
            run = ReportJobRun(job=name)
            db.session.add(run)
        run.last_started_at = now_i
        db.session.commit()
        try:
            result = fn(now_i)
            status, error = 'ok', None
        except Exception as exc:  # noqa: BLE001
            db.session.rollback()
            result, status, error = None, 'error', f'{type(exc).__name__}: {exc}'[:1000]
            current_app.logger.exception(f'背景工作 {name} 失敗')
        run = db.session.get(ReportJobRun, name)
        run.last_finished_at = datetime.utcnow()
        run.last_status, run.last_error = status, error
        run.last_result = json.dumps(result, ensure_ascii=False) if result is not None else None
        db.session.commit()
        results[name] = result if status == 'ok' else {'error': error}
    return results


def run_locked(now=None, force=False, only=None):
    """搶到 advisory lock 才跑；搶不到（別的程序正在跑）回傳 None。非 Postgres（測試用 SQLite）直接跑。"""
    if db.engine.dialect.name != 'postgresql':
        return run_due(now, force, only)
    conn = db.engine.connect()
    trans = conn.begin()
    try:
        # transaction 層級的鎖：交易結束（含程序被殺、連線中斷）就自動釋放，不會卡死
        if not conn.execute(text('select pg_try_advisory_xact_lock(:k)'), {'k': _LOCK_KEY}).scalar():
            return None
        return run_due(now, force, only)
    finally:
        trans.rollback()
        conn.close()


def status():
    """後台用：每個工作的週期與最後執行結果。"""
    runs = {r.job: r for r in ReportJobRun.query.all()}
    out = []
    for name, every, label, _fn in JOBS:
        r = runs.get(name)
        out.append({
            'job': name, 'label': label, 'every_seconds': int(every.total_seconds()),
            'last_started_at': r.last_started_at.isoformat() if r and r.last_started_at else None,
            'last_finished_at': r.last_finished_at.isoformat() if r and r.last_finished_at else None,
            'last_status': r.last_status if r else None,
            'last_result': json.loads(r.last_result) if r and r.last_result else None,
            'last_error': r.last_error if r else None,
        })
    return {'enabled': bool(current_app.config.get('REPORT_JOBS_ENABLED')),
            'interval_seconds': _interval(current_app), 'jobs': out}


# ── 程序內排程 ───────────────────────────────────────────────────────────────
_started = False
_start_lock = threading.Lock()


def _interval(app):
    return max(60, int(app.config.get('REPORT_JOBS_INTERVAL_SECONDS', 300)))


def _loop(app):
    interval = _interval(app)
    time.sleep(random.uniform(20, 60))  # 錯開啟動：剛部署時不和健康檢查、其他 worker 擠在一起
    while True:
        try:
            with app.app_context():
                run_locked()
                db.session.remove()
        except Exception:  # noqa: BLE001 — 背景執行緒不能死，下一輪再試
            app.logger.exception('背景排程執行失敗')
        time.sleep(interval)


def start_background(app):
    """每個程序只啟動一次（由第一個請求觸發）。測試與未開啟時不啟動。"""
    global _started
    if _started or app.testing or not app.config.get('REPORT_JOBS_ENABLED'):
        return
    with _start_lock:
        if _started:
            return
        _started = True
    threading.Thread(target=_loop, args=(app,), name='report-jobs', daemon=True).start()
    app.logger.info(f'背景排程已啟動（每 {_interval(app)} 秒）')
