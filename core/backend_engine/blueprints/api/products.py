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
- GET/POST /admin/products/<id>/translations - Product translation management
- PUT /admin/products/sort-order - Batch update sort order
"""

from flask import jsonify, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy.orm import joinedload, subqueryload
from sqlalchemy import or_, func

from core.backend_engine.factory import db
from core.backend_engine.blueprints.api import bp
from core.backend_engine.models import Product, User, Category, Tag, Media, ProductPrice
from core.backend_engine.schemas.ecommerce import ProductSchema

product_schema = ProductSchema()
products_schema = ProductSchema(many=True)


# ==================== Public Products API ====================

@bp.route('/products', methods=['GET'])
def get_products():
    """Get product list (only active products)"""
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 10, type=int)
    category_id = request.args.get('category_id', type=int)
    is_featured = request.args.get('is_featured', type=bool)
    search = request.args.get('search', '').strip()
    language = request.args.get('language', 'zh-TW')
    currency = request.args.get('currency', 'TWD')

    # Optimized query: Eager load all related objects
    query = Product.query.options(
        joinedload(Product.category),
        joinedload(Product.featured_image),
        joinedload(Product.original),
        subqueryload(Product.tags),
        subqueryload(Product.prices),
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

@bp.route('/admin/products', methods=['GET'])
@jwt_required()
def admin_get_products():
    """Admin: Get all product list"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user or not user.is_admin():
        return jsonify({'message': 'Insufficient permissions'}), 403

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
        query = query.filter(
            or_(
                Product.product_id.ilike(f'%{search}%'),
                func.json_extract(Product.names, '$.zh-TW').ilike(f'%{search}%')
            )
        )

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


@bp.route('/admin/products/<int:id>', methods=['GET'])
@jwt_required()
def admin_get_product(id):
    """Admin: Get single product detail"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user or not user.is_admin():
        return jsonify({'message': 'Insufficient permissions'}), 403

    product = Product.query.get(id)
    if not product:
        return jsonify({'message': 'Product not found'}), 404

    return jsonify(product.to_admin_dict()), 200


@bp.route('/admin/products', methods=['POST'])
@jwt_required()
def admin_create_product():
    """Admin: Create new product"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user or not user.is_admin():
        return jsonify({'message': 'Insufficient permissions'}), 403

    data = request.get_json()

    if not data.get('product_id') or not data.get('names') or not data.get('price'):
        return jsonify({'message': 'Missing required fields: product_id, names, price'}), 400

    if Product.query.filter_by(product_id=data['product_id']).first():
        return jsonify({'message': 'Product ID already exists'}), 400

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
            featured_image_id=data.get('featured_image_id'),
            gallery_images=data.get('gallery_images', []),
            category_id=data.get('category_id'),
            is_active=data.get('is_active', True),
            is_featured=data.get('is_featured', False),
            sort_order=data.get('sort_order', 0),
            meta_title=data.get('meta_title'),
            meta_description=data.get('meta_description'),
            detail_content_id=detail_content_id
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


@bp.route('/admin/products/<int:id>', methods=['PUT'])
@jwt_required()
def admin_update_product(id):
    """Admin: Update product"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user or not user.is_admin():
        return jsonify({'message': 'Insufficient permissions'}), 403

    product = Product.query.get(id)
    if not product:
        return jsonify({'message': 'Product not found'}), 404

    data = request.get_json()

    try:
        if 'product_id' in data and data['product_id'] != product.product_id:
            if Product.query.filter_by(product_id=data['product_id']).first():
                return jsonify({'message': 'Product ID already exists'}), 400
            product.product_id = data['product_id']

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
        if 'featured_image_id' in data:
            product.featured_image_id = data['featured_image_id']
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

        db.session.commit()

        return jsonify({'message': 'Product updated successfully'}), 200

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error updating product: {e}")
        return jsonify({'message': 'Failed to update product'}), 500


@bp.route('/admin/products/<int:id>', methods=['DELETE'])
@jwt_required()
def admin_delete_product(id):
    """Admin: Delete product"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user or not user.is_admin():
        return jsonify({'message': 'Insufficient permissions'}), 403

    product = Product.query.get(id)
    if not product:
        return jsonify({'message': 'Product not found'}), 404

    try:
        db.session.delete(product)
        db.session.commit()
        return jsonify({'message': 'Product deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error deleting product: {e}")
        return jsonify({'message': 'Failed to delete product'}), 500


@bp.route('/admin/products/<int:id>/toggle-status', methods=['POST'])
@jwt_required()
def admin_toggle_product_status(id):
    """Admin: Toggle product active status"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user or not user.is_admin():
        return jsonify({'message': 'Insufficient permissions'}), 403

    product = Product.query.get(id)
    if not product:
        return jsonify({'message': 'Product not found'}), 404

    try:
        product.is_active = not product.is_active
        db.session.commit()
        status = 'enabled' if product.is_active else 'disabled'
        return jsonify({'message': f'Product has been {status}', 'is_active': product.is_active}), 200
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error toggling product status: {e}")
        return jsonify({'message': 'Operation failed'}), 500


# ==================== Product Price Management API ====================

@bp.route('/admin/products/<int:product_id>/prices', methods=['GET'])
@jwt_required()
def admin_get_product_prices(product_id):
    """Admin: Get all prices for a product"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user or not user.is_admin():
        return jsonify({'message': 'Insufficient permissions'}), 403

    product = Product.query.get(product_id)
    if not product:
        return jsonify({'message': 'Product not found'}), 404

    prices = ProductPrice.query.filter_by(product_id=product_id).all()

    return jsonify({
        'prices': [p.to_dict() for p in prices]
    }), 200


@bp.route('/admin/products/<int:product_id>/prices', methods=['POST'])
@jwt_required()
def admin_create_product_price(product_id):
    """Admin: Create product price"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user or not user.is_admin():
        return jsonify({'message': 'Insufficient permissions'}), 403

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
def admin_update_product_price(product_id, price_id):
    """Admin: Update product price"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user or not user.is_admin():
        return jsonify({'message': 'Insufficient permissions'}), 403

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
def admin_delete_product_price(product_id, price_id):
    """Admin: Delete product price"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user or not user.is_admin():
        return jsonify({'message': 'Insufficient permissions'}), 403

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
def admin_get_product_translations(product_id):
    """Admin: Get all translation versions of a product"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user or not user.is_admin():
        return jsonify({'message': 'Insufficient permissions'}), 403

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
def admin_create_product_translation(product_id):
    """Admin: Create product translation version"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user or not user.is_admin():
        return jsonify({'message': 'Insufficient permissions'}), 403

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
            featured_image_id=product.featured_image_id,
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
def admin_update_product_sort_order():
    """Admin: Batch update product sort order"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user or not user.is_admin():
        return jsonify({'message': 'Insufficient permissions'}), 403

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
