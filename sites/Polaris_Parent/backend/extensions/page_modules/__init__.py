"""
Page Modules Extension — 產品管理「模組管理」（2026-10-28，Polaris 專屬）

商品頁與報告目錄頁的內容區塊（介紹、亮點、推薦語、詳細說明、圖文特色、製作流程、讀者評價、FAQ、送禮對象）
各自是一個模組；商品的 attributes.report_modules 依位置引用 module_key（{slot: module_key}，'' 或沒有＝不顯示），
目錄頁設定是 type=catalog_page、key=report-catalog 的模組（data.audiences / data.faq 也是 module_key）。
多語言同商品：一個 module_key 一種語言一筆，前台取該語言那一筆；語言版本從原文複製、確認後才能啟用。

公開：
    GET  /api/v1/page-modules?keys=a,b&language=en     已啟用的模組內容（前台商品頁／目錄頁）

管理端：
    GET    /api/v1/admin/page-modules                       依 module_key 分組的清單＋使用中的頁面（products.read）
    GET    /api/v1/admin/page-modules/<id>                  單筆（products.read）
    POST   /api/v1/admin/page-modules                       新增／複製成新模組（duplicate_of）／加語言版本（copy_from）
    POST   /api/v1/admin/page-modules/bulk                  從現有商品頁內容一次建立（略過已存在的 key＋語言）
    PUT    /api/v1/admin/page-modules/<id>                  修改名稱、內容、啟用狀態
    POST   /api/v1/admin/page-modules/<id>/translation-confirm
    DELETE /api/v1/admin/page-modules/<id>                  只能刪停用、沒被引用的版本
寫入需要 page_modules.manage。

上架檢查：commerce 的 register_activation_check —— 商品引用的模組（＋目錄頁）缺該語言版本或未啟用時不能上架。
上架中的頁面正在用的模組版本不能停用、被引用的不能刪除。
"""

import copy
import secrets
from datetime import datetime

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from core.backend_engine.factory import db
from core.backend_engine.services.rbac import require_permission
from core.backend_engine.services.rbac_seed import register_permissions
from packages.commerce.api.products import register_activation_check
from packages.commerce.models import Product
from sites.Polaris_Parent.backend.models import PageModule

bp = Blueprint('page_modules', __name__)

register_permissions([
    ('page_modules.manage', 'page_modules', 'manage', '管理頁面模組', 'Manage Page Modules'),
])

MODULE_TYPES = ('intro', 'highlights', 'testimonial', 'details', 'features', 'process', 'reviews', 'faq',
                'audiences', 'catalog_page')
LANGUAGES = ('zh-TW', 'zh-CN', 'en', 'ja')
LANGUAGE_NAMES = {'zh-TW': '繁中', 'zh-CN': '簡中', 'en': '英文', 'ja': '日文'}
DEFAULT_LANGUAGE = 'zh-TW'

PRODUCT_REFS_KEY = 'report_modules'
CATALOG_KEY = 'report-catalog'
CATALOG_REF_FIELDS = ('audiences', 'faq')


def _error(message, status=400, **extra):
    return jsonify({'success': False, 'error': message, **extra}), status


def _now_iso():
    return datetime.utcnow().isoformat(timespec='seconds')


def _lang_name(code):
    return LANGUAGE_NAMES.get(code, code)


def _version(key, language):
    return PageModule.query.filter_by(module_key=key, language=language).first()


def _root_of(m):
    if m.original_id:
        root = PageModule.query.get(m.original_id)
        if root:
            return root
    return m


def _translation_state(m, root=None):
    """語言版本相對原文的狀態；原文本身回 None（規則同商品多語言）"""
    root = root or _root_of(m)
    if root.id == m.id:
        return None
    t = (m.meta_data or {}).get('translation') or {}
    source_changed = (root.meta_data or {}).get('content_updated_at')
    synced_at = t.get('synced_at')
    return {
        'source_id': root.id,
        'source_language': root.language,
        'confirmed': t.get('confirmed', True),
        'synced_at': synced_at,
        'source_updated_at': source_changed,
        'stale': bool(source_changed and synced_at and source_changed > synced_at),
    }


def _dict(m, with_data=True):
    d = {
        'id': m.id,
        'module_key': m.module_key,
        'language': m.language,
        'type': m.type,
        'name': m.name,
        'is_active': m.is_active,
        'original_id': m.original_id,
        'translation': _translation_state(m),
        'updated_at': m.updated_at.isoformat() if m.updated_at else None,
    }
    if with_data:
        d['data'] = m.data or {}
    return d


# ── 引用關係 ───────────────────────────────────────────────

def _product_refs(product):
    refs = (product.attributes or {}).get(PRODUCT_REFS_KEY)
    if not isinstance(refs, dict):
        return {}
    return {slot: key for slot, key in refs.items() if isinstance(key, str) and key}


def _catalog_refs(m):
    data = m.data or {}
    return {f: data[f] for f in CATALOG_REF_FIELDS if isinstance(data.get(f), str) and data[f]}


def _usages(key, language=None):
    """引用某個 module_key 的商品與目錄頁（language 指定時只看該語言）"""
    out = []
    q = Product.query
    if language:
        q = q.filter(Product.language == language)
    for p in q.all():
        for slot, k in _product_refs(p).items():
            if k == key:
                out.append({'kind': 'product', 'id': p.id, 'product_id': p.product_id, 'language': p.language,
                            'name': (p.names or {}).get(p.language) or p.product_id, 'slot': slot,
                            'is_active': bool(p.is_active)})
    cq = PageModule.query.filter_by(module_key=CATALOG_KEY)
    if language:
        cq = cq.filter_by(language=language)
    for c in cq.all():
        for slot, k in _catalog_refs(c).items():
            if k == key:
                out.append({'kind': 'catalog', 'id': c.id, 'language': c.language, 'name': '報告目錄頁',
                            'slot': slot, 'is_active': bool(c.is_active)})
    return out


def _required_keys(product):
    """商品上架需要的模組：商品頁引用的；已建立目錄頁設定時，再加上目錄頁與它引用的"""
    keys = list(_product_refs(product).values())
    if keys:
        catalog = _version(CATALOG_KEY, product.language) or _version(CATALOG_KEY, DEFAULT_LANGUAGE)
        if catalog is not None:
            keys.append(CATALOG_KEY)
            keys.extend(_catalog_refs(catalog).values())
    return list(dict.fromkeys(keys))


def product_module_problems(product):
    problems = []
    for key in _required_keys(product):
        m = _version(key, product.language)
        if m is None:
            root = PageModule.query.filter_by(module_key=key, original_id=None).first()
            label = root.name if root else key
            problems.append(f'模組「{label}」還沒有{_lang_name(product.language)}版本（到「模組管理」新增）')
        elif not m.is_active:
            problems.append(f'模組「{m.name}」的{_lang_name(product.language)}版本還沒啟用')
    return problems


register_activation_check(product_module_problems)


def _catalog_problems(m):
    problems = []
    for key in _catalog_refs(m).values():
        ref = _version(key, m.language)
        if ref is None or not ref.is_active:
            problems.append(f'目錄頁選用的模組「{key}」沒有已啟用的{_lang_name(m.language)}版本')
    return problems


def _activation_problems(m):
    problems = []
    if not (m.name or '').strip():
        problems.append('模組名稱還沒填')
    state = _translation_state(m)
    if state and not state['confirmed']:
        problems.append('這是從其他語言複製的版本，內容改寫完成後請先按「確認內容已完成」')
    if m.module_key == CATALOG_KEY:
        problems.extend(_catalog_problems(m))
    return problems


def _in_use_by_active(m):
    return [u for u in _usages(m.module_key, m.language) if u['is_active']]


def _usage_text(usages):
    return '、'.join(f"{u['name']}（{_lang_name(u['language'])}）" for u in usages)


# ── 公開 ───────────────────────────────────────────────────

@bp.route('/page-modules', methods=['GET'])
def public_modules():
    language = request.args.get('language') or DEFAULT_LANGUAGE
    if language not in LANGUAGES:
        return _error('不支援這個語言')
    keys = [k for k in (request.args.get('keys') or '').split(',') if k][:50]
    if not keys:
        return jsonify({'success': True, 'modules': {}})
    rows = PageModule.query.filter(PageModule.module_key.in_(keys), PageModule.language == language,
                                   PageModule.is_active.is_(True)).all()
    return jsonify({'success': True, 'modules': {m.module_key: {'type': m.type, 'data': m.data or {}} for m in rows}})


# ── 管理 ───────────────────────────────────────────────────

@bp.route('/admin/page-modules', methods=['GET'])
@jwt_required()
@require_permission('products.read', 'page_modules.manage')
def admin_list():
    rows = PageModule.query.order_by(PageModule.type, PageModule.id).all()
    groups = {}
    for m in rows:
        g = groups.setdefault(m.module_key, {'module_key': m.module_key, 'type': m.type, 'versions': []})
        if not m.original_id:
            g.update(root_id=m.id, name=m.name, type=m.type)
        g['versions'].append(_dict(m, with_data=False))
    for g in groups.values():
        g.setdefault('root_id', g['versions'][0]['id'])
        g.setdefault('name', g['versions'][0]['name'])
        g['used_by'] = _usages(g['module_key'])
    return jsonify({'success': True, 'modules': list(groups.values()), 'pages': _pages()})


def _pages():
    """改用模組的頁面（各語言商品＋目錄頁）與各位置選的模組；後台依出版品檢視時連沒選的位置也要列出"""
    out = []
    for p in Product.query.order_by(Product.product_id, Product.id).all():
        if not isinstance((p.attributes or {}).get(PRODUCT_REFS_KEY), dict):
            continue
        out.append({'kind': 'product', 'id': p.id, 'product_id': p.product_id, 'language': p.language,
                    'name': (p.names or {}).get(p.language) or p.product_id, 'is_active': bool(p.is_active),
                    'refs': _product_refs(p)})
    for c in PageModule.query.filter_by(module_key=CATALOG_KEY).all():
        out.append({'kind': 'catalog', 'id': c.id, 'language': c.language, 'name': '報告目錄頁',
                    'is_active': bool(c.is_active), 'refs': _catalog_refs(c)})
    return out


@bp.route('/admin/page-modules/<int:id>', methods=['GET'])
@jwt_required()
@require_permission('products.read', 'page_modules.manage')
def admin_get(id):
    m = PageModule.query.get(id)
    if m is None:
        return _error('找不到這個模組', 404)
    return jsonify({'success': True, 'module': _dict(m), 'used_by': _usages(m.module_key)})


def _new_key(type_):
    for _ in range(10):
        key = f'{type_.replace("_", "-")}-{secrets.token_hex(3)}'
        if not PageModule.query.filter_by(module_key=key).first():
            return key
    raise RuntimeError('無法產生模組代碼')


@bp.route('/admin/page-modules', methods=['POST'])
@jwt_required()
@require_permission('page_modules.manage')
def admin_create():
    data = request.get_json(silent=True) or {}

    if data.get('copy_from'):
        # 加語言版本：從原文（或任一版本）複製，先停用、待確認
        src = PageModule.query.get(data['copy_from'])
        if src is None:
            return _error('找不到要複製的模組', 404)
        language = data.get('language')
        if language not in LANGUAGES:
            return _error('不支援這個語言')
        if _version(src.module_key, language):
            return _error(f'這個模組已經有{_lang_name(language)}版本', 409)
        root = _root_of(src)
        m = PageModule(module_key=src.module_key, language=language, type=src.type, name=src.name,
                       data=copy.deepcopy(src.data or {}), is_active=False, original_id=root.id,
                       meta_data={'translation': {'confirmed': False, 'synced_at': _now_iso(), 'copied_from': src.id}})
    elif data.get('duplicate_of'):
        # 複製成新模組：新的 module_key，繁中，名稱另取
        src = PageModule.query.get(data['duplicate_of'])
        if src is None:
            return _error('找不到要複製的模組', 404)
        if src.module_key == CATALOG_KEY:
            return _error('目錄頁設定只有一份，不能複製')
        name = (data.get('name') or f'{src.name}（複製）').strip()
        m = PageModule(module_key=_new_key(src.type), language=DEFAULT_LANGUAGE, type=src.type, name=name,
                       data=copy.deepcopy(src.data or {}), is_active=True, meta_data={})
    else:
        type_ = data.get('type')
        if type_ not in MODULE_TYPES:
            return _error('不支援這個模組類型')
        if type_ == 'catalog_page' and _version(CATALOG_KEY, DEFAULT_LANGUAGE):
            return _error('目錄頁設定已經存在', 409)
        name = (data.get('name') or '').strip()
        if not name:
            return _error('請填模組名稱')
        key = CATALOG_KEY if type_ == 'catalog_page' else _new_key(type_)
        m = PageModule(module_key=key, language=DEFAULT_LANGUAGE, type=type_, name=name,
                       data=data['data'] if isinstance(data.get('data'), dict) else {}, is_active=True, meta_data={})

    db.session.add(m)
    db.session.commit()
    return jsonify({'success': True, 'module': _dict(m)}), 201


@bp.route('/admin/page-modules/bulk', methods=['POST'])
@jwt_required()
@require_permission('page_modules.manage')
def admin_bulk_create():
    """從現有商品頁內容建立模組。繁中先建；其他語言掛在同 key 的繁中下，視為已確認（內容是後台原本就寫好的）。"""
    items = (request.get_json(silent=True) or {}).get('modules') or []
    items = sorted([i for i in items if isinstance(i, dict)], key=lambda i: (i.get('language') or DEFAULT_LANGUAGE) != DEFAULT_LANGUAGE)
    created, skipped = [], []
    for it in items:
        key, language, type_ = it.get('module_key'), it.get('language') or DEFAULT_LANGUAGE, it.get('type')
        if not isinstance(key, str) or not key or type_ not in MODULE_TYPES or language not in LANGUAGES:
            db.session.rollback()
            return _error(f'資料有誤：{key}')
        if _version(key, language):
            skipped.append(f'{key}:{language}')
            continue
        root = _version(key, DEFAULT_LANGUAGE) if language != DEFAULT_LANGUAGE else None
        meta = {'translation': {'confirmed': True, 'synced_at': _now_iso()}} if root else {}
        m = PageModule(module_key=key, language=language, type=type_, name=(it.get('name') or key).strip(),
                       data=it['data'] if isinstance(it.get('data'), dict) else {}, is_active=True,
                       original_id=root.id if root else None, meta_data=meta)
        db.session.add(m)
        db.session.flush()
        created.append(f'{key}:{language}')
    db.session.commit()
    return jsonify({'success': True, 'created': created, 'skipped': skipped})


@bp.route('/admin/page-modules/<int:id>', methods=['PUT'])
@jwt_required()
@require_permission('page_modules.manage')
def admin_update(id):
    m = PageModule.query.get(id)
    if m is None:
        return _error('找不到這個模組', 404)
    data = request.get_json(silent=True) or {}
    changed = False
    if 'name' in data:
        name = (data.get('name') or '').strip()
        if not name:
            return _error('請填模組名稱')
        changed = changed or name != m.name
        m.name = name
    if isinstance(data.get('data'), dict):
        changed = changed or data['data'] != (m.data or {})
        m.data = data['data']
    if 'is_active' in data:
        want = bool(data['is_active'])
        if want and not m.is_active:
            problems = _activation_problems(m)
            if problems:
                db.session.rollback()
                return _error('還不能啟用：' + '；'.join(problems), problems=problems)
        if not want and m.is_active:
            users = _in_use_by_active(m)
            if users:
                db.session.rollback()
                return _error(f'上架中的頁面正在使用這個模組，不能停用：{_usage_text(users)}。請先在那些頁面改選其他模組。',
                              409, used_by=users)
        m.is_active = want
    if m.is_active and m.module_key == CATALOG_KEY:
        # 目錄頁啟用中：改選的模組也要有已啟用的同語言版本
        problems = _catalog_problems(m)
        if problems:
            db.session.rollback()
            return _error('；'.join(problems), problems=problems)
    if changed and not m.original_id:
        meta = dict(m.meta_data or {})
        meta['content_updated_at'] = _now_iso()
        m.meta_data = meta
    db.session.commit()
    return jsonify({'success': True, 'module': _dict(m), 'used_by': _usages(m.module_key)})


@bp.route('/admin/page-modules/<int:id>/translation-confirm', methods=['POST'])
@jwt_required()
@require_permission('page_modules.manage')
def admin_confirm(id):
    m = PageModule.query.get(id)
    if m is None:
        return _error('找不到這個模組', 404)
    if not m.original_id:
        return _error('這一筆是原文，不需要確認')
    meta = dict(m.meta_data or {})
    t = dict(meta.get('translation') or {})
    t.update({'confirmed': True, 'synced_at': _now_iso()})
    meta['translation'] = t
    m.meta_data = meta
    db.session.commit()
    return jsonify({'success': True, 'module': _dict(m)})


@bp.route('/admin/page-modules/<int:id>', methods=['DELETE'])
@jwt_required()
@require_permission('page_modules.manage')
def admin_delete(id):
    m = PageModule.query.get(id)
    if m is None:
        return _error('找不到這個模組', 404)
    if m.is_active:
        return _error('請先停用再刪除')
    if not m.original_id and PageModule.query.filter(PageModule.original_id == m.id).count():
        return _error('這是原文，請先刪除其他語言版本')
    users = _usages(m.module_key, m.language)
    if users:
        return _error(f'還有頁面引用這個模組，不能刪除：{_usage_text(users)}', 409, used_by=users)
    db.session.delete(m)
    db.session.commit()
    return jsonify({'success': True})
