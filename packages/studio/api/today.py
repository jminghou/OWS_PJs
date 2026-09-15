"""「今天」：最近編輯、待完成草稿、即將發布、待整理。"""
from datetime import datetime

from flask import jsonify
from sqlalchemy import func

from core.backend_engine.factory import db
from packages.studio.blueprint import studio_bp as bp
from packages.studio.constants import FLOW_STEPS
from packages.studio.models import StudioDocument, StudioInboxItem, StudioProject, StudioRevision
from packages.studio.api._common import studio_read
from packages.studio.api.projects import apply_flow_filter


def _doc_rows(query, limit):
    rows = query.limit(limit).all()
    doc_ids = [doc.id for doc, _ in rows]
    counts = dict(
        db.session.query(StudioRevision.document_id, func.count())
        .filter(StudioRevision.document_id.in_(doc_ids))
        .group_by(StudioRevision.document_id).all()
    ) if doc_ids else {}
    return [
        {**doc.to_dict(include_body=False),
         'project': {'id': project.id, 'title': project.title},
         'revision_count': counts.get(doc.id, 0)}
        for doc, project in rows
    ]


@bp.route('/today', methods=['GET'])
@studio_read
def today():
    base = db.session.query(StudioDocument, StudioProject).join(
        StudioProject, StudioProject.id == StudioDocument.project_id
    ).filter(StudioDocument.stage != 'archived')

    recent = _doc_rows(base.order_by(StudioDocument.updated_at.desc()), 8)
    pending = _doc_rows(
        base.filter(StudioDocument.stage.in_(('write', 'edit'))).order_by(StudioDocument.updated_at.asc()), 10
    )
    upcoming = _doc_rows(
        base.filter(StudioDocument.stage == 'scheduled')
        .order_by(StudioDocument.scheduled_at.asc().nulls_last()), 10
    )
    inbox_new = (
        StudioInboxItem.query.filter_by(status='new')
        .order_by(StudioInboxItem.created_at.desc()).limit(8).all()
    )
    inbox_count = db.session.query(func.count(StudioInboxItem.id)).filter_by(status='new').scalar() or 0

    stage_counts = dict(
        db.session.query(StudioProject.stage, func.count()).group_by(StudioProject.stage).all()
    )
    flow_counts = {
        step: apply_flow_filter(db.session.query(func.count(StudioProject.id)), step).scalar() or 0
        for step in FLOW_STEPS
    }
    flow_counts['capture'] += inbox_count   # 捕捉 = 收集箱待整理 + 收集階段的專案
    return jsonify({
        'flow_counts': flow_counts,
        'now': datetime.utcnow().isoformat(),
        'recent': recent,
        'pending': pending,
        'upcoming': upcoming,
        'inbox': {'count': inbox_count, 'items': [i.to_dict() for i in inbox_new]},
        'project_stage_counts': stage_counts,
    })
