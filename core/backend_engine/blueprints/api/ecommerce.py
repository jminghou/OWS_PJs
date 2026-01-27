"""
E-commerce API Routes

Provides endpoints for payment method management:
- GET /payment-methods - List available payment methods (public)
- GET /admin/payment-methods - List all payment methods (admin)
- POST /admin/payment-methods - Create payment method (admin)
"""

from flask import jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity

from core.backend_engine.factory import db
from core.backend_engine.blueprints.api import bp
from core.backend_engine.models import PaymentMethod, User
from core.backend_engine.schemas.ecommerce import PaymentMethodSchema

pm_schema = PaymentMethodSchema()
pms_schema = PaymentMethodSchema(many=True)


@bp.route('/payment-methods', methods=['GET'])
def get_payment_methods():
    """Get available payment methods"""
    currency = request.args.get('currency')
    language = request.args.get('language', 'zh-TW')
    query = PaymentMethod.query.filter_by(is_active=True)

    if currency:
        payment_methods = [pm.to_dict(language) for pm in query.all() if currency in pm.supported_currencies]
    else:
        payment_methods = [pm.to_dict(language) for pm in query.order_by(PaymentMethod.sort_order).all()]

    return jsonify({'payment_methods': payment_methods}), 200


@bp.route('/admin/payment-methods', methods=['GET'])
@jwt_required()
def admin_get_payment_methods():
    """Admin: Get all payment methods"""
    user = User.query.get(int(get_jwt_identity()))
    if not user or not user.is_admin():
        return jsonify({'message': 'Insufficient permissions'}), 403

    payment_methods = PaymentMethod.query.order_by(PaymentMethod.sort_order).all()
    return jsonify({'payment_methods': [pm.to_admin_dict() for pm in payment_methods]}), 200


@bp.route('/admin/payment-methods', methods=['POST'])
@jwt_required()
def admin_create_payment_method():
    """Admin: Create payment method"""
    user = User.query.get(int(get_jwt_identity()))
    if not user or not user.is_admin():
        return jsonify({'message': 'Insufficient permissions'}), 403

    data = request.get_json()
    if PaymentMethod.query.filter_by(code=data.get('code')).first():
        return jsonify({'message': 'Code already exists'}), 400

    try:
        pm = PaymentMethod(
            code=data['code'],
            name=data['name'],
            description=data.get('description', {}),
            supported_currencies=data['supported_currencies'],
            is_active=data.get('is_active', True),
            config=data.get('config', {}),
            sort_order=data.get('sort_order', 0)
        )
        db.session.add(pm)
        db.session.commit()
        return jsonify({'message': 'Payment method created successfully', 'payment_method': pm.to_admin_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': 'Creation failed'}), 500
