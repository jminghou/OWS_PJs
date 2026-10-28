"""
Products API Routes

Provides endpoints for product management:
- GET /products - Public product list
- GET /products/<id> - Public product detail
- GET /admin/products - Admin product list
- GET /admin/products/<id> - Admin product detail
- POST /admin/products - Create product
- PUT /admin/products/<id> - Update product
- DELETE /admin/products/<id> - Delete product
- POST /admin/products/<id>/toggle-status - Toggle product status
- GET/POST/PUT/DELETE /admin/products/<id>/prices - Product price management
- GET/POST /admin/products/<id>/translations - Product translation management（舊介面，保留相容）
- POST /admin/products/<id>/translation-confirm - 確認語言版本內容已完成／已跟上原文
- PUT /admin/products/sort-order - Batch update sort order

多語言（2026-10-28）：一個語言一筆獨立商品，同一個 product_id 以 (product_id, language) 區分。
最早建立的那筆是「原文」（original_id 為空），其他語言版本的 original_id 指向它。
從別的語言複製建立的版本要按「確認內容已完成」才能上架；原文內容改過後，各語言版本標示「原文已更新」。
"""
import copy
from datetime import datetime

from flask import jsonify, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy.orm import joinedload, subqueryload
from sqlalchemy import or_, func

from core.backend_engine.factory import db, cache
from packages.commerce.blueprint import commerce_bp as bp
from core.backend_engine.blueprints.api.utils import skip_public_cache
from core.backend_engine.models import User, Category, Tag
from packages.commerce.models import Product, ProductPrice
from packages.commerce.schemas import ProductSchema
from core.backend_engine.services.rbac import require_permission

product_schema = ProductSchema()
products_schema = ProductSchema(many=True)


# ==================== Public Products API ====================

@bp.route('/products', methods=['GET'])
@cache.cached(timeout=120, query_string=True, unless=skip_public_cache)
def get_products():
    """Get product list (only active products)"""
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 10, type=int)
    category_id = request.args.get('category_id', type=int)
    is_featured = request.args.get('is_featured', type=bool)
    search = request.args.get('search', '').strip()
    language = request.args.get('language', 'zh-TW')
    currency = request.args.get('currency', 'TWD')

    # Optimized query: Eager load related objects.
    # 註：Product.prices 為 lazy='dynamic'，無法被 eager load（會 InvalidRequestError）；
    # get_price() 本就直接查 ProductPrice，故此處不 eager load prices。
    query = Product.query.options(
        joinedload(Product.category),
        joinedload(Product.original),
        subqueryload(Product.tags),
        subqueryload(Product.translations)
    ).filter_by(is_active=True, language=language)

    # Filter conditions
    if category_id:
        query = query.filter_by(category_id=category_id)
    if is_featured:
        query = query.filter_by(is_featured=True)
    if search:
        # Prefer PostgreSQL Full-Text Search
        if db.engine.name == 'postgresql':
            search_filter = or_(
                Product.product_id.ilike(f'%{search}%'),
                func.to_tsvector('simple', func.cast(Product.names, db.Text)).match(search, postgresql_regconfig='simple')
            )
        else:
            # Search JSON fields (SQLite/MySQL compatible)
            query_path = f'$.{language}'
            search_filter = or_(
                Product.product_id.ilike(f'%{search}%'),
                func.json_extract(Product.names, query_path).ilike(f'%{search}%')
            )
        query = query.filter(search_filter)

    # Sort: sort_order ascending, then id descending
    query = query.order_by(Product.sort_order.asc(), Product.id.desc())

    # Pagination
    products_page = query.paginate(page=page, per_page=per_page, error_out=False)

    # Build product list with price info
    products_data = products_schema.dump(products_page.items)
    for idx, p in enumerate(products_page.items):
        data = products_data[idx]
        price_info = p.get_price(currency)
        data.update(price_info)

        # Get available languages
        available_languages = [p.language]
        if p.original:
            available_languages.extend([p.original.language] + [t.language for t in p.original.translations])
        else:
            available_languages.extend([t.language for t in p.translations])
        data['available_languages'] = list(set(available_languages))

    return jsonify({
        'products': products_data,
        'pagination': {
            'page': products_page.page,
            'pages': products_page.pages,
            'per_page': products_page.per_page,
            'total': products_page.total,
            'has_next': products_page.has_next,
            'has_prev': products_page.has_prev
        }
    }), 200


@bp.route('/products/<product_id>', methods=['GET'])
@cache.cached(timeout=120, query_string=True, unless=skip_public_cache)
def get_product(product_id):
    """Get single product detail"""
    language = request.args.get('language', 'zh-TW')
    currency = request.args.get('currency', 'TWD')
    include_content = request.args.get('include_content', 'true').lower() == 'true'

    # Can query by id or product_id
    if product_id.isdigit():
        product = Product.query.filter_by(id=int(product_id), language=language).first()
    else:
        product = Product.query.filter_by(product_id=product_id, language=language, is_active=True).first()

    if not product or not product.is_active:
        return jsonify({'message': 'Product not found'}), 404

    # Increment view count
    product.views_count += 1
    db.session.commit()

    product_dict = product.to_dict(language)

    # Get price info
    price_info = product.get_price(currency)
    product_dict.update(price_info)

    # Get available languages
    available_languages = [product.language]
    if product.original:
        available_languages.append(product.original.language)
        available_languages.extend([t.language for t in product.original.translations])
    else:
        available_languages.extend([t.language for t in product.translations])
    product_dict['available_languages'] = list(set(available_languages))

    # Get available currencies
    available_currencies = ['TWD']
    available_currencies.extend([price.currency for price in product.prices if price.is_active])
    product_dict['available_currencies'] = list(set(available_currencies))

    # Include detail content if needed
    if include_content and product.detail_content:
        content = product.detail_content
        target_content = content
        if content.language != language:
            for translation in content.translations:
                if translation.language == language and translation.status == 'published':
                    target_content = translation
                    break

        if target_content.status == 'published':
            product_dict['detail_content'] = {
                'id': target_content.id,
                'title': target_content.title,
                'slug': target_content.slug,
                'content': target_content.content,
                'summary': target_content.summary,
                'featured_image': target_content.featured_image,
                'cover_image': target_content.cover_image,
                'language': target_content.language,
                'published_at': target_content.published_at.isoformat() if target_content.published_at else None,
            }

    return jsonify(product_dict), 200


# ==================== Admin Products API ====================

# 會影響「內容」的欄位：原文改了這些，其他語言版本就標示待更新
_CONTENT_FIELDS = ('names', 'descriptions', 'short_descriptions', 'meta_title', 'meta_description', 'attributes')


def _now_iso():
    return datetime.utcnow().isoformat(timespec='seconds')


def _root_of(product):
    """同一個 product_id 的原文那一筆"""
    if product.original_id:
        root = Product.query.get(product.original_id)
        if root:
            return root
    return product


def _content_snapshot(product):
    return [copy.deepcopy(getattr(product, f)) for f in _CONTENT_FIELDS]


def _translation_state(product, root=None):
    """語言版本相對原文的狀態；原文本身回 None"""
    root = root or _root_of(product)
    if root.id == product.id:
        return None
    t = (product.meta_data or {}).get('translation') or {}
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


def _activation_problems(product):
    """上架前的完整度檢查"""
    problems = []
    name = (product.names or {}).get(product.language) or ''
    if not name.strip():
        problems.append('產品名稱還沒填')
    if not product.price or product.price <= 0:
        problems.append('售價還沒設定')
    state = _translation_state(product)
    if state and not state['confirmed']:
        problems.append('這是從其他語言複製的版本，內容改寫完成後請先按「確認內容已完成」')
    return problems


def _admin_dict(product, root=None):
    d = product.to_admin_dict()
    d['translation'] = _translation_state(product, root)
    return d


def _language_summary(product, root):
    state = _translation_state(product, root)
    return {
        'id': product.id,
        'language': product.language,
        'is_active': product.is_active,
        'name': (product.names or {}).get(product.language) or '',
        'price': product.price,
        'currency': product.currency,
        'is_root': product.id == root.id,
        'stale': bool(state and state['stale']),
        'confirmed': state['confirmed'] if state else True,
    }

@bp.route('/admin/products', methods=['GET'])
@jwt_required()
@require_permission('products.read')
def admin_get_products():
    """Admin: Get all product list"""
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    is_active = request.args.get('is_active', type=str)
    search = request.args.get('search', '').strip()

    query = Product.query

    if is_active == 'true':
        query = query.filter_by(is_active=True)
    elif is_active == 'false':
        query = query.filter_by(is_active=False)

    if search:
        # PostgreSQL（JSONB）沒有 json_extract；把整個 names 轉成文字比對（中文以原字輸出）
        if db.engine.name == 'postgresql':
            name_match = func.cast(Product.names, db.Text).ilike(f'%{search}%')
        else:
            name_match = func.json_extract(Product.names, '$.zh-TW').ilike(f'%{search}%')
        query = query.filter(or_(Product.product_id.ilike(f'%{search}%'), name_match))

    if request.args.get('group') in ('1', 'true'):
        return _grouped_list(query, page, per_page)

    query = query.order_by(Product.sort_order.asc(), Product.id.desc())
    products_page = query.paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        'products': [p.to_admin_dict() for p in products_page.items],
        'pagination': {
            'page': products_page.page,
            'pages': products_page.pages,
            'per_page': products_page.per_page,
            'total': products_page.total,
            'has_next': products_page.has_next,
            'has_prev': products_page.has_prev
        }
    }), 200


def _grouped_list(query, page, per_page):
    """一個產品 ID 一列（代表那筆是原文），languages 列出所有語言版本；篩選條件命中任一語言版本就列出"""
    ids = (query.with_entities(Product.product_id, func.min(Product.sort_order).label('so'), func.max(Product.id).label('mx'))
           .group_by(Product.product_id).order_by(func.min(Product.sort_order).asc(), func.max(Product.id).desc()))
    total = ids.count()
    page_ids = [r[0] for r in ids.offset((page - 1) * per_page).limit(per_page).all()]
    rows = Product.query.filter(Product.product_id.in_(page_ids)).all() if page_ids else []
    by_id = {}
    for r in rows:
        by_id.setdefault(r.product_id, []).append(r)
    items = []
    for pid in page_ids:
        group = by_id.get(pid, [])
        if not group:
            continue
        root = next((r for r in group if not r.original_id), None) or min(group, key=lambda r: r.id)
        d = _admin_dict(root, root)
        d['languages'] = [_language_summary(r, root) for r in sorted(group, key=lambda r: r.id)]
        items.append(d)
    pages = (total + per_page - 1) // per_page if per_page else 1
    return jsonify({
        'products': items,
        'pagination': {
            'page': page, 'pages': pages, 'per_page': per_page, 'total': total,
            'has_next': page < pages, 'has_prev': page > 1,
        }
    }), 200


@bp.route('/admin/products/<int:id>', methods=['GET'])
@jwt_required()
@require_permission('products.read')
def admin_get_product(id):
    """Admin: Get single product detail"""
    product = Product.query.get(id)
    if not product:
        return jsonify({'message': 'Product not found'}), 404

    return jsonify(_admin_dict(product)), 200


@bp.route('/admin/products', methods=['POST'])
@jwt_required()
@require_permission('products.create')
def admin_create_product():
    """Admin: Create new product"""
    data = request.get_json() or {}

    if data.get('copy_from'):
        return _create_language_copy(data)

    language = data.get('language') or 'zh-TW'
    if not data.get('product_id') or not data.get('names') or not data.get('price'):
        return jsonify({'message': 'Missing required fields: product_id, names, price'}), 400

    if Product.query.filter_by(product_id=data['product_id'], language=language).first():
        return jsonify({'message': 'Product ID already exists'}), 400
    # 同一個產品 ID 已有其他語言：這筆是新的語言版本（從頭撰寫，不必再確認）
    root = Product.query.filter_by(product_id=data['product_id'], original_id=None).order_by(Product.id).first()

    detail_content_id = data.get('detail_content_id')
    if detail_content_id:
        from core.backend_engine.models import Content
        content = Content.query.get(detail_content_id)
        if not content:
            return jsonify({'message': 'Specified content does not exist'}), 400

    try:
        product = Product(
            product_id=data['product_id'],
            names=data.get('names', {}),
            descriptions=data.get('descriptions', {}),
            short_descriptions=data.get('short_descriptions', {}),
            price=data['price'],
            original_price=data.get('original_price'),
            stock_quantity=data.get('stock_quantity', -1),
            stock_status=data.get('stock_status', 'in_stock'),
            featured_image=data.get('featured_image'),
            gallery_images=data.get('gallery_images', []),
            category_id=data.get('category_id'),
            is_active=data.get('is_active', True),
            is_featured=data.get('is_featured', False),
            sort_order=data.get('sort_order', 0),
            meta_title=data.get('meta_title'),
            meta_description=data.get('meta_description'),
            detail_content_id=detail_content_id,
            attributes=data['attributes'] if isinstance(data.get('attributes'), dict) else {},
            language=language,
            original_id=root.id if root else None,
            meta_data={'currency': data.get('currency') or 'TWD'},
        )

        tag_ids = data.get('tag_ids', [])
        if tag_ids:
            tags = Tag.query.filter(Tag.id.in_(tag_ids)).all()
            product.tags = tags

        db.session.add(product)
        db.session.commit()

        return jsonify({
            'message': 'Product created successfully',
            'id': product.id
        }), 201

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error creating product: {e}")
        return jsonify({'message': 'Failed to create product'}), 500


def _create_language_copy(data):
    """從某個語言版本複製出新語言版本：文案、圖片、站台設定都帶過去當草稿，預設停用、待確認"""
    src = Product.query.get(data['copy_from'])
    if not src:
        return jsonify({'message': 'Product not found'}), 404
    language = (data.get('language') or '').strip()
    if not language:
        return jsonify({'message': 'Missing language field'}), 400
    if Product.query.filter_by(product_id=src.product_id, language=language).first():
        return jsonify({'message': f'這個產品已經有 {language} 版本'}), 400
    root = _root_of(src)
    sl = src.language
    pick = lambda m: (m or {}).get(sl, '')  # noqa: E731
    try:
        product = Product(
            product_id=src.product_id,
            language=language,
            original_id=root.id,
            names={language: data.get('name') or pick(src.names)},
            descriptions={language: pick(src.descriptions)},
            short_descriptions={language: pick(src.short_descriptions)},
            # 幣別不同時價格不能照抄：沒給就是 0，上架前一定要設
            price=int(data.get('price') or 0),
            stock_quantity=src.stock_quantity,
            stock_status=src.stock_status,
            featured_image=src.featured_image,
            gallery_images=copy.deepcopy(src.gallery_images or []),
            category_id=src.category_id,
            is_active=False,
            is_featured=src.is_featured,
            sort_order=src.sort_order,
            meta_title=src.meta_title,
            meta_description=src.meta_description,
            detail_content_id=src.detail_content_id,
            attributes=copy.deepcopy(src.attributes or {}),
            meta_data={
                'currency': data.get('currency') or src.currency,
                'translation': {'confirmed': False, 'copied_from': src.id, 'copied_language': sl,
                                'synced_at': None},
            },
        )
        product.tags = list(src.tags)
        db.session.add(product)
        db.session.commit()
        return jsonify({'message': 'Language version created', 'id': product.id}), 201
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error copying product language version: {e}")
        return jsonify({'message': 'Failed to create product'}), 500


@bp.route('/admin/products/<int:id>', methods=['PUT'])
@jwt_required()
@require_permission('products.update')
def admin_update_product(id):
    """Admin: Update product"""
    product = Product.query.get(id)
    if not product:
        return jsonify({'message': 'Product not found'}), 404

    data = request.get_json()

    try:
        before = _content_snapshot(product)
        was_active = product.is_active

        if 'product_id' in data and data['product_id'] != product.product_id:
            if Product.query.filter_by(product_id=data['product_id']).count() > 0 or \
                    Product.query.filter_by(product_id=product.product_id).count() > 1:
                return jsonify({'message': 'Product ID already exists'}), 400
            product.product_id = data['product_id']

        if data.get('currency'):
            meta = dict(product.meta_data or {})
            meta['currency'] = data['currency']
            product.meta_data = meta

        # Support two update modes:
        # 1. New: Single language fields (name, description, short_description, language)
        # 2. Old: Multi-language JSON fields (names, descriptions, short_descriptions)
        if 'name' in data and 'language' in data:
            language = data['language']
            if 'name' in data:
                product.names[language] = data['name']
            if 'description' in data:
                product.descriptions[language] = data['description']
            if 'short_description' in data:
                product.short_descriptions[language] = data['short_description']
            from sqlalchemy.orm.attributes import flag_modified
            flag_modified(product, 'names')
            flag_modified(product, 'descriptions')
            flag_modified(product, 'short_descriptions')
        else:
            if 'names' in data:
                product.names = data['names']
            if 'descriptions' in data:
                product.descriptions = data['descriptions']
            if 'short_descriptions' in data:
                product.short_descriptions = data['short_descriptions']

        if 'price' in data:
            product.price = data['price']
        if 'original_price' in data:
            product.original_price = data['original_price']
        if 'stock_quantity' in data:
            product.stock_quantity = data['stock_quantity']
        if 'stock_status' in data:
            product.stock_status = data['stock_status']
        if 'featured_image' in data:
            product.featured_image = data['featured_image']
        if 'gallery_images' in data:
            product.gallery_images = data['gallery_images']
        if 'category_id' in data:
            product.category_id = data['category_id']
        if 'is_active' in data:
            product.is_active = data['is_active']
        if 'is_featured' in data:
            product.is_featured = data['is_featured']
        if 'sort_order' in data:
            product.sort_order = data['sort_order']
        if 'meta_title' in data:
            product.meta_title = data['meta_title']
        if 'meta_description' in data:
            product.meta_description = data['meta_description']

        if 'detail_content_id' in data:
            if data['detail_content_id']:
                from core.backend_engine.models import Content
                content = Content.query.get(data['detail_content_id'])
                if not content:
                    return jsonify({'message': 'Specified content does not exist'}), 400
            product.detail_content_id = data['detail_content_id']

        if 'tag_ids' in data:
            tags = Tag.query.filter(Tag.id.in_(data['tag_ids'])).all()
            product.tags = tags

        # attributes 依頂層鍵合併：各站台用自己的鍵（例如 report_display），互不覆蓋
        if isinstance(data.get('attributes'), dict):
            merged = dict(product.attributes or {})
            merged.update(data['attributes'])
            product.attributes = merged  # 重新賦值新 dict 讓 SQLAlchemy 偵測到變更

        if product.is_active and not was_active:
            problems = _activation_problems(product)
            if problems:
                db.session.rollback()
                return jsonify({'message': '還不能上架：' + '；'.join(problems), 'problems': problems}), 400

        # 原文內容有變：記下時間，其他語言版本據此標示「原文已更新」
        if not product.original_id and _content_snapshot(product) != before:
            meta = dict(product.meta_data or {})
            meta['content_updated_at'] = _now_iso()
            product.meta_data = meta

        db.session.commit()

        return jsonify({'message': 'Product updated successfully'}), 200

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error updating product: {e}")
        return jsonify({'message': 'Failed to update product'}), 500


@bp.route('/admin/products/<int:id>', methods=['DELETE'])
@jwt_required()
@require_permission('products.delete')
def admin_delete_product(id):
    """Admin: Delete product"""
    product = Product.query.get(id)
    if not product:
        return jsonify({'message': 'Product not found'}), 404

    try:
        others = Product.query.filter(Product.product_id == product.product_id, Product.id != product.id).order_by(Product.id).all()
        if others and not product.original_id:
            new_root = next((o for o in others if o.is_active), others[0])
            new_root.original_id = None
            for o in others:
                if o.id != new_root.id:
                    o.original_id = new_root.id
            db.session.flush()
        else:
            for o in others:
                if o.original_id == product.id:
                    o.original_id = _root_of(product).id if product.original_id else None
            db.session.flush()
        db.session.delete(product)
        db.session.commit()
        return jsonify({'message': 'Product deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error deleting product: {e}")
        return jsonify({'message': 'Failed to delete product'}), 500


@bp.route('/admin/products/<int:id>/toggle-status', methods=['POST'])
@jwt_required()
@require_permission('products.update')
def admin_toggle_product_status(id):
    """Admin: Toggle product active status"""
    product = Product.query.get(id)
    if not product:
        return jsonify({'message': 'Product not found'}), 404

    if not product.is_active:
        problems = _activation_problems(product)
        if problems:
            return jsonify({'message': '還不能上架：' + '；'.join(problems), 'problems': problems}), 400

    try:
        product.is_active = not product.is_active
        db.session.commit()
        status = 'enabled' if product.is_active else 'disabled'
        return jsonify({'message': f'Product has been {status}', 'is_active': product.is_active}), 200
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error toggling product status: {e}")
        return jsonify({'message': 'Operation failed'}), 500


@bp.route('/admin/products/<int:id>/translation-confirm', methods=['POST'])
@jwt_required()
@require_permission('products.update')
def admin_confirm_translation(id):
    """確認語言版本的內容已用該語言寫完、跟上目前的原文"""
    product = Product.query.get(id)
    if not product:
        return jsonify({'message': 'Product not found'}), 404
    if not product.original_id:
        return jsonify({'message': '這一筆是原文，不需要確認'}), 400
    meta = dict(product.meta_data or {})
    t = dict(meta.get('translation') or {})
    t.update({'confirmed': True, 'synced_at': _now_iso()})
    meta['translation'] = t
    product.meta_data = meta
    db.session.commit()
    return jsonify({'message': 'Confirmed', 'translation': _translation_state(product)}), 200


# ==================== Product Price Management API ====================

@bp.route('/admin/products/<int:product_id>/prices', methods=['GET'])
@jwt_required()
@require_permission('products.read')
def admin_get_product_prices(product_id):
    """Admin: Get all prices for a product"""
    product = Product.query.get(product_id)
    if not product:
        return jsonify({'message': 'Product not found'}), 404

    prices = ProductPrice.query.filter_by(product_id=product_id).all()

    return jsonify({
        'prices': [p.to_dict() for p in prices]
    }), 200


@bp.route('/admin/products/<int:product_id>/prices', methods=['POST'])
@jwt_required()
@require_permission('products.update')
def admin_create_product_price(product_id):
    """Admin: Create product price"""
    product = Product.query.get(product_id)
    if not product:
        return jsonify({'message': 'Product not found'}), 404

    data = request.get_json()

    if 'currency' not in data or 'price' not in data:
        return jsonify({'message': 'Missing required fields'}), 400

    existing_price = ProductPrice.query.filter_by(
        product_id=product_id,
        currency=data['currency']
    ).first()

    if existing_price:
        return jsonify({'message': f'This product already has a {data["currency"]} price setting'}), 400

    try:
        price = ProductPrice(
            product_id=product_id,
            currency=data['currency'],
            price=data['price'],
            original_price=data.get('original_price'),
            is_active=data.get('is_active', True)
        )

        db.session.add(price)
        db.session.commit()

        return jsonify({
            'message': 'Price created successfully',
            'price': price.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error creating product price: {e}")
        return jsonify({'message': 'Failed to create price'}), 500


@bp.route('/admin/products/<int:product_id>/prices/<int:price_id>', methods=['PUT'])
@jwt_required()
@require_permission('products.update')
def admin_update_product_price(product_id, price_id):
    """Admin: Update product price"""
    price = ProductPrice.query.filter_by(id=price_id, product_id=product_id).first()
    if not price:
        return jsonify({'message': 'Price not found'}), 404

    data = request.get_json()

    try:
        if 'price' in data:
            price.price = data['price']
        if 'original_price' in data:
            price.original_price = data['original_price']
        if 'is_active' in data:
            price.is_active = data['is_active']

        db.session.commit()

        return jsonify({
            'message': 'Price updated successfully',
            'price': price.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error updating product price: {e}")
        return jsonify({'message': 'Failed to update price'}), 500


@bp.route('/admin/products/<int:product_id>/prices/<int:price_id>', methods=['DELETE'])
@jwt_required()
@require_permission('products.update')
def admin_delete_product_price(product_id, price_id):
    """Admin: Delete product price"""
    price = ProductPrice.query.filter_by(id=price_id, product_id=product_id).first()
    if not price:
        return jsonify({'message': 'Price not found'}), 404

    try:
        db.session.delete(price)
        db.session.commit()

        return jsonify({'message': 'Price deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error deleting product price: {e}")
        return jsonify({'message': 'Failed to delete price'}), 500


# ==================== Product Translation Management API ====================

@bp.route('/admin/products/<int:product_id>/translations', methods=['GET'])
@jwt_required()
@require_permission('products.read')
def admin_get_product_translations(product_id):
    """Admin: Get all translation versions of a product"""
    product = Product.query.get(product_id)
    if not product:
        return jsonify({'message': 'Product not found'}), 404

    translations = []

    if product.original:
        translations.append({
            'id': product.original.id,
            'language': product.original.language,
            'name': product.original.names.get(product.original.language, ''),
            'is_original': True
        })
        for t in product.original.translations:
            if t.id != product_id:
                translations.append({
                    'id': t.id,
                    'language': t.language,
                    'name': t.names.get(t.language, ''),
                    'is_original': False
                })
    else:
        for t in product.translations:
            translations.append({
                'id': t.id,
                'language': t.language,
                'name': t.names.get(t.language, ''),
                'is_original': False
            })

    return jsonify({'translations': translations}), 200


@bp.route('/admin/products/<int:product_id>/translations', methods=['POST'])
@jwt_required()
@require_permission('products.update')
def admin_create_product_translation(product_id):
    """Admin: Create product translation version"""
    product = Product.query.get(product_id)
    if not product:
        return jsonify({'message': 'Product not found'}), 404

    data = request.get_json()

    if 'language' not in data:
        return jsonify({'message': 'Missing language field'}), 400

    original_id = product.original_id if product.original_id else product.id
    existing = Product.query.filter_by(
        product_id=product.product_id,
        language=data['language']
    ).first()

    if existing:
        return jsonify({'message': f'A {data["language"]} language version already exists'}), 400

    try:
        translation = Product(
            product_id=product.product_id,
            names={data['language']: data.get('name', product.names.get(product.language, ''))},
            descriptions={data['language']: data.get('description', product.descriptions.get(product.language, ''))},
            short_descriptions={data['language']: data.get('short_description', product.short_descriptions.get(product.language, ''))},
            price=product.price,
            original_price=product.original_price,
            stock_quantity=product.stock_quantity,
            stock_status=product.stock_status,
            featured_image=product.featured_image,
            gallery_images=product.gallery_images,
            category_id=product.category_id,
            is_active=product.is_active,
            is_featured=product.is_featured,
            sort_order=product.sort_order,
            language=data['language'],
            original_id=original_id
        )

        translation.tags = product.tags

        db.session.add(translation)
        db.session.commit()

        db.session.refresh(translation)

        return jsonify({
            'message': 'Translation version created successfully',
            'product': {
                'id': translation.id,
                'product_id': translation.product_id,
                'language': translation.language,
                'names': translation.names,
                'original_id': translation.original_id
            }
        }), 201
    except Exception as e:
        db.session.rollback()
        import traceback
        error_details = traceback.format_exc()
        current_app.logger.error(f"Error creating product translation: {e}\n{error_details}")
        return jsonify({'message': f'Failed to create translation version: {str(e)}'}), 500


# ==================== Product Sort Order Management API ====================

@bp.route('/admin/products/sort-order', methods=['PUT'])
@jwt_required()
@require_permission('products.update')
def admin_update_product_sort_order():
    """Admin: Batch update product sort order"""
    data = request.get_json()

    if 'sort_orders' not in data:
        return jsonify({'message': 'Missing sort_orders field'}), 400

    sort_orders = data['sort_orders']

    if not isinstance(sort_orders, list):
        return jsonify({'message': 'sort_orders must be an array'}), 400

    try:
        for item in sort_orders:
            if 'id' not in item or 'sort_order' not in item:
                continue

            product = Product.query.get(item['id'])
            if product:
                product.sort_order = item['sort_order']

        db.session.commit()

        return jsonify({'message': 'Sort order updated successfully'}), 200

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error updating product sort order: {e}")
        return jsonify({'message': 'Failed to update sort order'}), 500
