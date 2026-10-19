"""
實體書打樣（階段 1 ②，2026-10-19；docs/report-physical-addon-plan.md 階段 3 的打樣確認）。

流程：會員確認設計（awaiting_proof）→ 管理者上傳打樣 PDF（proof_ready）→ 會員在期限內
  * 確認送印 → approved（之後管理者才能標記印製中，physical.PROOF_APPROVAL_REQUIRED）
  * 提出修改 → changes_requested → 管理者上傳下一版 → proof_ready …
  * 期限到沒回應 → 背景排程自動確認送印（auto_approved），寄信通知會員與管理者
規則（使用者 2026-10-19 決定）：免費修改 1 次（REPORT_PROOF_FREE_REVISIONS），用完後只能確認送印；
會員另外聯絡、管理者同意時可在後台「多給一次修改」（extra_revisions）。回覆期限 7 天（REPORT_PROOF_RESPONSE_DAYS），
到期前 2 天寄提醒。管理者也可以代為確認（會員用電話或 Email 確認時）。
打樣 PDF 含個資，存私有儲存，用短效憑證開啟（與報告 PDF 同一套）。
"""

import uuid
from datetime import datetime, timedelta, timezone

from flask import current_app

from core.backend_engine.factory import db
from packages.commerce.models import OrderItem
from sites.Polaris_Parent.backend.models import ReportPrintJob, ReportPrintProof

from . import private_storage
from .service import OrderError

MAX_PDF_BYTES = 100 * 1024 * 1024
REMIND_BEFORE = timedelta(days=2)
UPLOADABLE = ('awaiting_proof', 'changes_requested', 'proof_ready')
DECISION_LABELS = {'approved': '會員確認送印', 'changes_requested': '會員要求修改', 'auto_approved': '期限到自動確認送印',
                   'admin_approved': '管理者代為確認送印', 'superseded': '已由新版取代'}


def free_revisions():
    return max(0, int(current_app.config.get('REPORT_PROOF_FREE_REVISIONS', 1)))


def response_days():
    return max(1, int(current_app.config.get('REPORT_PROOF_RESPONSE_DAYS', 7)))


def _now():
    return datetime.now(timezone.utc)


def _utc(dt):
    """資料庫讀回的時間：Postgres 帶時區、SQLite 不帶（視為 UTC）。統一成帶時區的 UTC。"""
    if dt is None:
        return None
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt.astimezone(timezone.utc)


def _iso(dt):
    return _utc(dt).isoformat() if dt else None


def proofs_of(job):
    return ReportPrintProof.query.filter_by(print_job_id=job.id).order_by(ReportPrintProof.version).all()


def current_proof(job):
    return (ReportPrintProof.query.filter_by(print_job_id=job.id)
            .order_by(ReportPrintProof.version.desc()).first())


def revisions_used(job):
    return ReportPrintProof.query.filter_by(print_job_id=job.id, decision='changes_requested').count()


def revisions_left(job):
    return max(0, free_revisions() + (job.extra_revisions or 0) - revisions_used(job))


def _lock(job):
    return ReportPrintJob.query.filter_by(id=job.id).with_for_update().one()


# ── 管理者 ───────────────────────────────────────────────────────────────────
def upload(job, admin_id, filename, data: bytes, note=None):
    """上傳新一版打樣。會員還沒決定的上一版標為 superseded（重新起算回覆期限）。回傳新版。"""
    job = _lock(job)
    if job.status not in UPLOADABLE:
        db.session.rollback()
        raise OrderError('這本實體書目前不能上傳打樣（要等會員確認設計內容，且尚未確認送印）', 409, 'invalid_status')
    name = (filename or '').strip() or 'proof.pdf'
    if not name.lower().endswith('.pdf') or not data.startswith(b'%PDF-'):
        db.session.rollback()
        raise OrderError('請上傳 PDF 檔', 400, 'invalid_file')
    if len(data) > MAX_PDF_BYTES:
        db.session.rollback()
        raise OrderError('PDF 不能超過 100 MB', 400, 'file_too_large')
    item = db.session.get(OrderItem, job.order_item_id)
    prev = current_proof(job)
    version = (prev.version + 1) if prev else 1
    key = f'proofs/{item.item_no}/v{version}-{uuid.uuid4().hex}.pdf'
    size, digest = private_storage.save(key, data, 'application/pdf')
    now = _now()
    if prev is not None and prev.decision is None:
        prev.decision, prev.decided_at = 'superseded', now
    proof = ReportPrintProof(print_job_id=job.id, version=version, file_key=key, filename=name[:200], bytes=size,
                             sha256=digest, admin_note=(note or '').strip()[:2000] or None, uploaded_by=admin_id,
                             created_at=now, due_at=now + timedelta(days=response_days()))
    db.session.add(proof)
    job.status = 'proof_ready'
    db.session.commit()
    return proof


def grant_revision(job, admin_id):
    """多給一次免費修改（會員另外聯絡、管理者同意時）。"""
    job = _lock(job)
    if job.status not in ('proof_ready', 'changes_requested', 'awaiting_proof'):
        db.session.rollback()
        raise OrderError('只有打樣階段可以增加修改次數', 409, 'invalid_status')
    job.extra_revisions = (job.extra_revisions or 0) + 1
    db.session.commit()
    current_app.logger.info(f'print job {job.id} extra revision granted by admin {admin_id}')
    return job


def admin_approve(job, admin_id, note):
    """管理者代為確認送印（會員用電話或 Email 確認時）。"""
    note = (note or '').strip()
    if not note:
        raise OrderError('請填寫說明（例如：會員 10/20 來電確認）', 400, 'note_required')
    return _decide(job, None, 'admin_approved', note[:1000], admin_id)


# ── 會員 ─────────────────────────────────────────────────────────────────────
def member_decide(job, member_id, proof_id, decision, comment=None):
    """會員確認送印（approve）或提出修改（changes）。proof_id 必須是目前這一版，避免對著舊版按確認。"""
    if decision not in ('approve', 'changes'):
        raise OrderError('不支援的操作', 400, 'invalid_decision')
    comment = (comment or '').strip()
    if decision == 'changes':
        if not comment:
            raise OrderError('請寫下想修改的地方', 400, 'comment_required')
        return _decide(job, proof_id, 'changes_requested', comment[:2000], member_id)
    return _decide(job, proof_id, 'approved', comment[:2000] or None, member_id)


def _decide(job, proof_id, decision, comment, actor_id):
    job = _lock(job)
    proof = current_proof(job)
    if job.status != 'proof_ready' or proof is None or proof.decision is not None:
        db.session.rollback()
        raise OrderError('目前沒有等待確認的打樣', 409, 'no_pending_proof')
    if proof_id is not None and int(proof_id) != proof.id:
        db.session.rollback()
        raise OrderError('打樣已更新，請重新整理後查看最新版', 409, 'stale_proof')
    if decision == 'changes_requested' and revisions_left(job) <= 0:
        db.session.rollback()
        raise OrderError('免費修改次數已用完；若仍需修改，請直接回信與我們聯絡', 409, 'no_revisions_left')
    now = _now()
    proof.decision, proof.comment, proof.decided_at, proof.decided_by = decision, comment, now, actor_id
    if decision == 'changes_requested':
        job.status = 'changes_requested'
    else:
        job.status, job.approved_at, job.approved_proof_id = 'approved', now, proof.id
    db.session.commit()
    return proof


# ── 背景排程 ─────────────────────────────────────────────────────────────────
def _waiting(now):
    """等待會員決定的打樣（目前版、job 在 proof_ready）。"""
    rows = (db.session.query(ReportPrintProof, ReportPrintJob)
            .join(ReportPrintJob, ReportPrintJob.id == ReportPrintProof.print_job_id)
            .filter(ReportPrintJob.status == 'proof_ready', ReportPrintProof.decision.is_(None),
                    ReportPrintProof.due_at.isnot(None))
            .all())
    return [(p, j) for p, j in rows if current_proof(j).id == p.id]


def auto_approve_due(now=None):
    """期限到還沒回應的打樣：自動確認送印。回傳 [(job, proof)]，由呼叫端寄信。"""
    now = _utc(now) if now else _now()
    done = []
    for proof, job in _waiting(now):
        if _utc(proof.due_at) > now:
            continue
        try:
            _decide(job, proof.id, 'auto_approved', None, None)
        except OrderError:
            continue  # 剛好被會員或管理者處理掉
        done.append((job, proof))
    return done


def reminders_due(now=None):
    """期限前 2 天內、還沒回應的打樣（寄提醒；notify 以 dedupe_key 保證每版只寄一次）。"""
    now = _utc(now) if now else _now()
    return [(job, proof) for proof, job in _waiting(now)
            if _utc(proof.due_at) - REMIND_BEFORE <= now < _utc(proof.due_at)]


# ── 顯示與下載 ───────────────────────────────────────────────────────────────
def proof_view(proof):
    return {
        'id': proof.id, 'version': proof.version, 'filename': proof.filename, 'bytes': proof.bytes,
        'admin_note': proof.admin_note, 'created_at': _iso(proof.created_at), 'due_at': _iso(proof.due_at),
        'decision': proof.decision, 'decision_label': DECISION_LABELS.get(proof.decision),
        'comment': proof.comment, 'decided_at': _iso(proof.decided_at),
    }


def job_proofs_view(job):
    """實體書的打樣狀態：歷次版本、目前等待確認的版本、剩餘免費修改次數。"""
    history = proofs_of(job)
    cur = history[-1] if history else None
    pending = cur if (cur is not None and job.status == 'proof_ready' and cur.decision is None) else None
    return {
        'versions': [proof_view(p) for p in history],
        'pending': proof_view(pending) if pending else None,
        'revisions_left': revisions_left(job),
        'free_revisions': free_revisions() + (job.extra_revisions or 0),
        'response_days': response_days(),
    }


def proof_for_download(proof_id, user_id, is_admin):
    proof = db.session.get(ReportPrintProof, proof_id)
    if proof is None:
        raise OrderError('找不到這份打樣', 404, 'not_found')
    job = db.session.get(ReportPrintJob, proof.print_job_id)
    item = db.session.get(OrderItem, job.order_item_id)
    if not is_admin and item.order.user_id != user_id:
        raise OrderError('找不到這份打樣', 404, 'not_found')
    return proof, private_storage.read(proof.file_key)
