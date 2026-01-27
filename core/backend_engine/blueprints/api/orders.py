"""
Orders API Routes

Provides endpoints for order management:
- POST /orders - Create new order
- GET /orders - List user's orders
- POST /webhooks/mock-payment - Mock payment webhook (dev mode)
"""

from flask import jsonify, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
import uuid

from core.backend_engine.factory import db
from core.backend_engine.blueprints.api import bp
from core.backend_engine.models import Order, User, Product
from core.backend_engine.schemas.ecommerce import OrderSchema

order_schema = OrderSchema()
orders_schema = OrderSchema(many=True)


# ==================== Orders ====================

@bp.route('/orders', methods=['POST'])
@jwt_required()
def create_order():
    """Create order (with product validation + multi-currency support)"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user:
        return jsonify({'message': 'User not found'}), 401

    data = request.get_json()
    items = data.get('items', [])
    amount = data.get('amount')
    currency = data.get('currency', 'TWD')
    language = data.get('language', 'zh-TW')
    payment_method = data.get('payment_method')

    if not items or amount is None:
        return jsonify({'message': 'Missing items or amount'}), 400

    # Validate products and get latest info from database (multi-currency support)
    validated_items = []
    total_price = 0

    for item in items:
        product_id_str = item.get('product_id')

        product = Product.query.filter_by(product_id=product_id_str, is_active=True).first()
        if not product:
            return jsonify({'message': f'Product does not exist or is unavailable: {product_id_str}'}), 400

        if product.stock_status == 'out_of_stock':
            return jsonify({'message': f'Product is sold out: {product.names.get(language, product_id_str)}'}), 400

        if product.stock_quantity > 0 and product.stock_quantity < 1:
            return jsonify({'message': f'Insufficient stock: {product.names.get(language, product_id_str)}'}), 400

        # Use database price (by currency) to prevent frontend manipulation
        price_info = product.get_price(currency)
        product_price = price_info['price']

        validated_item = {
            'product_id': product.product_id,
            'name': product.names.get(language, product.product_id),
            'price': product_price,
            'currency': currency
        }
        validated_items.append(validated_item)
        total_price += product_price

    # Verify total amount
    if total_price != amount:
        return jsonify({'message': f'Amount verification failed, please refresh page. Expected: {total_price} {currency}, Received: {amount} {currency}'}), 400

    # Generate unique order number
    order_no = f"ORD-{datetime.utcnow().strftime('%Y%m%d')}-{uuid.uuid4().hex[:8].upper()}"

    order = Order(
        order_no=order_no,
        user_id=user.id,
        amount=total_price,
        items=validated_items,
        status='pending',
        currency=currency,
        language=language,
        payment_method=payment_method
    )

    try:
        db.session.add(order)
        db.session.commit()

        # Determine Payment URL based on environment
        if current_app.config.get('IS_DEV_MODE', False):
            payment_url = f"http://localhost:3000/mock-payment/{order_no}"
        else:
            # TODO: Integrate real payment gateway (ECPay/Stripe)
            payment_url = None

        return jsonify({
            'message': 'Order created successfully',
            'order_no': order_no,
            'payment_url': payment_url
        }), 201

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error creating order: {e}")
        return jsonify({'message': 'Failed to create order'}), 500


@bp.route('/orders', methods=['GET'])
@jwt_required()
def list_orders():
    """List user's order history"""
    user_id = get_jwt_identity()

    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 10, type=int)

    orders_query = Order.query.filter_by(user_id=user_id).order_by(Order.created_at.desc())
    orders = orders_query.paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        'orders': orders_schema.dump(orders.items),
        'pagination': {
            'page': orders.page,
            'pages': orders.pages,
            'per_page': orders.per_page,
            'total': orders.total
        }
    }), 200


@bp.route('/webhooks/mock-payment', methods=['POST'])
def mock_payment_webhook():
    """Mock payment callback webhook"""
    # Note: In production, webhooks should verify signatures for security

    data = request.get_json()
    order_no = data.get('order_no')
    status = data.get('status')  # 'success' or 'failed'

    if not order_no or not status:
        return jsonify({'message': 'Missing parameters'}), 400

    order = Order.query.filter_by(order_no=order_no).first()
    if not order:
        return jsonify({'message': 'Order not found'}), 404

    try:
        if status == 'success':
            order.status = 'paid'
            order.paid_at = datetime.utcnow()

            # Update product stock and sales count
            for item in order.items:
                product = Product.query.filter_by(product_id=item['product_id']).first()
                if product:
                    if product.stock_quantity > 0:
                        product.stock_quantity -= 1
                        if product.stock_quantity <= 0:
                            product.stock_status = 'out_of_stock'

                    product.sales_count += 1

            current_app.logger.info(f"Order {order_no} payment success. Fulfilling items...")

        elif status == 'failed':
            order.status = 'failed'
            current_app.logger.info(f"Order {order_no} payment failed.")

        else:
            return jsonify({'message': 'Invalid status'}), 400

        db.session.commit()
        return jsonify({'message': 'Webhook processed successfully'}), 200

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Webhook error: {e}")
        return jsonify({'message': 'Internal Server Error'}), 500
