"""平台衍生：主體 → 社群／電子報／腳本版本的血緣，以及「主體已更新」提醒。

規則（刻意只有一層，避免環狀與難懂的鏈）：
- 主體＝同專案、原始語言（不是翻譯）、本身不是衍生版本的文件，通常是部落格。
- 衍生版本＝原始語言文件；它的各語言翻譯經 translation_source 跟著它，不另外記主體。
- 已經有衍生版本掛在底下的主體，不能再被設成別人的衍生版本。
"""
from flask import jsonify

from core.backend_engine.factory import db
from packages.studio.blueprint import studio_bp as bp
from packages.studio.models import StudioDocument
from packages.studio.api._common import bad_request, json_body, studio_write, with_session


def _fingerprint(doc):
    from packages.studio.api.languages import fingerprint
    return fingerprint(doc)


def validate_main(doc_project_id, doc, main_id):
    """回傳主體文件；main_id 為 None 時回傳 None（獨立版本）。不合法時丟 ValueError。"""
    if main_id is None:
        return None
    if type(main_id) is not int:
        raise ValueError('Invalid main document')
    main = db.session.get(StudioDocument, main_id)
    if not main or main.project_id != doc_project_id:
        raise ValueError('Main document must be in the same project')
    if main.translation_source_id:
        raise ValueError('Main document must be the original-language version')
    if main.derived_from_id:
        raise ValueError('A derived version cannot be a main document')
    if doc is not None:
        if doc.work_id == main.work_id:
            raise ValueError('A document cannot derive from its own language versions')
        if doc.translation_source_id:
            raise ValueError('Translations follow their source; set the main on the original-language version')
        if StudioDocument.query.filter_by(derived_from_id=doc.id).first():
            raise ValueError('This document already has derived versions')
    return main


def project_flags(docs):
    """一個專案的全部文件 → {id: {source_changed, derived_changed, main_id}}，只用記憶體裡的資料計算。"""
    by_id = {d.id: d for d in docs}
    prints = {}

    def fp(doc):
        if doc.id not in prints:
            prints[doc.id] = _fingerprint(doc)
        return prints[doc.id]

    flags = {}
    for d in docs:
        source = by_id.get(d.translation_source_id) if d.translation_source_id else None
        main = by_id.get(d.derived_from_id) if d.derived_from_id else None
        # 翻譯版本沿翻譯來源找主體，方便畫樹與回溯
        main_id = d.derived_from_id or (source.derived_from_id if source else None)
        flags[d.id] = {
            'source_changed': bool(source and d.source_fingerprint != fp(source)),
            'derived_changed': bool(main and d.derived_fingerprint != fp(main)),
            'main_id': main_id,
        }
    return flags


def decorate_lineage(doc, data):
    """工作區用：主體摘要、衍生版本清單、是否過期。"""
    docs = StudioDocument.query.filter_by(project_id=doc.project_id).all()
    flags = project_flags(docs)
    by_id = {d.id: d for d in docs}
    mine = flags.get(doc.id, {})
    main = by_id.get(mine.get('main_id')) if mine.get('main_id') else None
    data['derived_changed'] = mine.get('derived_changed', False)
    data['main_document'] = ({'id': main.id, 'title': main.title, 'platform': main.platform,
                              'language': main.language} if main else None)
    # 主體看得到「我散出去的版本」，含各自的翻譯
    root_ids = {d.id for d in docs if d.work_id == doc.work_id}
    data['derived_documents'] = [
        dict(d.to_dict(include_body=False), derived_changed=flags[d.id]['derived_changed'],
             source_changed=flags[d.id]['source_changed'])
        for d in sorted(docs, key=lambda x: (x.platform, x.language, x.id))
        if flags[d.id]['main_id'] in root_ids and d.work_id != doc.work_id
    ]
    data['main_candidates'] = [
        {'id': d.id, 'title': d.title, 'platform': d.platform, 'language': d.language}
        for d in docs
        if d.work_id != doc.work_id and not d.translation_source_id and not d.derived_from_id
    ]
    return data


@bp.route('/documents/<int:document_id>/derivation', methods=['PUT'])
@studio_write
@with_session
def set_derivation(document_id):
    """指定或解除主體。body: {"derived_from_id": int | null}"""
    from packages.studio.api.documents import _document_detail
    doc = StudioDocument.query.get_or_404(document_id)
    data = json_body()
    if 'derived_from_id' not in data:
        return bad_request('derived_from_id is required')
    try:
        main = validate_main(doc.project_id, doc, data['derived_from_id'])
    except ValueError as exc:
        return bad_request(str(exc))
    doc.derived_from_id = main.id if main else None
    doc.derived_fingerprint = _fingerprint(main) if main else None
    db.session.commit()
    return jsonify({'document': _document_detail(doc)})


@bp.route('/documents/<int:document_id>/derived-reviewed', methods=['POST'])
@studio_write
@with_session
def review_derived(document_id):
    """衍生版本已依主體的最新內容檢查／更新過 → 清掉「主體已更新」提醒。"""
    from packages.studio.api.documents import _document_detail
    doc = StudioDocument.query.get_or_404(document_id)
    main = db.session.get(StudioDocument, doc.derived_from_id) if doc.derived_from_id else None
    if not main:
        return bad_request('This document has no main document')
    doc.derived_fingerprint = _fingerprint(main)
    db.session.commit()
    return jsonify({'document': _document_detail(doc)})
