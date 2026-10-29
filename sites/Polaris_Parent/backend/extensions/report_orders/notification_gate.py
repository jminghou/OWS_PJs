"""Revalidate actionable customer notifications immediately before each send."""
from datetime import timezone
from core.backend_engine.factory import db
from packages.commerce.models import OrderItem
from sites.Polaris_Parent.backend.models import ReportPrintProof, ReportPrintJob
from . import commerce, delivery, proofs
from .service import OrderError

EVENTS = {'report_ready', 'proof_ready', 'proof_reminder'}


def decision(note, order, now):
    """Return (send|defer|skip, reason). Caller holds the order lock."""
    if note.event not in EVENTS:
        return 'send', None
    if order is None or order.status != 'paid':
        return 'skip', '訂單已不符合此通知的寄送條件'
    if note.event == 'report_ready':
        item = OrderItem.query.filter_by(order_id=order.id, kind='purchase').first()
        if item is None or delivery.current_document(item) is None:
            return 'skip', '目前沒有可下載的報告，停止寄送舊通知'
        kind = 'report'
    else:
        try:
            proof_id = int(note.dedupe_key.rsplit(':', 1)[1])
        except (ValueError, IndexError):
            return 'skip', '無法核對打樣版本，請人工確認'
        proof = db.session.get(ReportPrintProof, proof_id)
        job = db.session.get(ReportPrintJob, proof.print_job_id) if proof else None
        item = db.session.get(OrderItem, job.order_item_id) if job else None
        due = proof.due_at.replace(tzinfo=timezone.utc) if proof and proof.due_at and proof.due_at.tzinfo is None else (proof.due_at if proof else None)
        current_time = now.replace(tzinfo=timezone.utc) if now.tzinfo is None else now
        current = proofs.current_proof(job) if job else None
        if (item is None or item.order_id != order.id or current is None or current.id != proof_id
                or job.status != 'proof_ready' or proof.decision is not None or due is None or due <= current_time):
            return 'skip', '打樣已回覆、到期或已有新版，停止寄送舊提醒'
        kind = 'book'
    try:
        commerce.require(item, kind)
    except OrderError:
        return 'defer', '履約暫停或資格待確認，稍後重新檢查'
    return 'send', None
