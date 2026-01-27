"""
Users API Routes

Provides admin endpoints for user management:
- GET /users - List users with pagination (admin only)
- POST /users - Create new user (admin only)
- PUT /users/<id> - Update user (admin only)
- POST /users/<id>/toggle-status - Toggle user active status (admin only)
"""

from flask import jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime

from core.backend_engine.factory import db
from core.backend_engine.blueprints.api import bp
from core.backend_engine.models import User
from core.backend_engine.schemas.user import UserSchema

user_schema = UserSchema()
users_schema = UserSchema(many=True)


@bp.route('/users', methods=['GET'])
@jwt_required()
def api_users():
    """Get user list (admin only)"""
    user = User.query.get(int(get_jwt_identity()))
    if not user.is_admin():
        return jsonify({'message': 'Insufficient permissions'}), 403

    page = request.args.get('page', 1, type=int)
    per_page = min(request.args.get('per_page', 20, type=int), 100)
    role = request.args.get('role')
    search = request.args.get('search')

    query = User.query
    if role:
        query = query.filter_by(role=role)
    if search:
        query = query.filter((User.username.ilike(f'%{search}%')) | (User.email.ilike(f'%{search}%')))

    pagination = query.order_by(User.created_at.desc()).paginate(page=page, per_page=per_page, error_out=False)

    users_data = users_schema.dump(pagination.items)
    for idx, u in enumerate(pagination.items):
        users_data[idx]['content_count'] = u.contents.count()

    return jsonify({
        'users': users_data,
        'pagination': {
            'page': pagination.page,
            'pages': pagination.pages,
            'total': pagination.total
        }
    }), 200


@bp.route('/users', methods=['POST'])
@jwt_required()
def api_create_user():
    """Create new user (admin only)"""
    user = User.query.get(int(get_jwt_identity()))
    if not user.is_admin():
        return jsonify({'message': 'Insufficient permissions'}), 403

    data = request.get_json()
    if User.query.filter_by(username=data.get('username')).first() or User.query.filter_by(email=data.get('email')).first():
        return jsonify({'message': 'Username or email already exists'}), 400

    try:
        new_user = User(
            username=data['username'],
            email=data['email'],
            role=data.get('role', 'user'),
            is_active=data.get('is_active', True)
        )
        new_user.set_password(data['password'])
        db.session.add(new_user)
        db.session.commit()
        return jsonify({'message': 'User created successfully', 'user': user_schema.dump(new_user)}), 201
    except ValueError as e:
        return jsonify({'message': str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': f'Creation failed: {str(e)}'}), 500


@bp.route('/users/<int:user_id>', methods=['PUT'])
@jwt_required()
def api_update_user(user_id):
    """Update user (admin only)"""
    user = User.query.get(int(get_jwt_identity()))
    if not user.is_admin():
        return jsonify({'message': 'Insufficient permissions'}), 403

    target_user = User.query.get_or_404(user_id)
    data = request.get_json()

    if 'username' in data and User.query.filter(User.username == data['username'], User.id != user_id).first():
        return jsonify({'message': 'Username already exists'}), 400
    if 'email' in data and User.query.filter(User.email == data['email'], User.id != user_id).first():
        return jsonify({'message': 'Email already exists'}), 400

    try:
        if 'username' in data:
            target_user.username = data['username']
        if 'email' in data:
            target_user.email = data['email']
        if 'role' in data:
            target_user.role = data['role']
        if 'is_active' in data:
            target_user.is_active = data['is_active']
        if 'password' in data and data['password']:
            target_user.set_password(data['password'])
        target_user.updated_at = datetime.utcnow()
        db.session.commit()
        return jsonify({'message': 'User updated successfully', 'user': user_schema.dump(target_user)}), 200
    except ValueError as e:
        return jsonify({'message': str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': f'Update failed: {str(e)}'}), 500


@bp.route('/users/<int:user_id>/toggle-status', methods=['POST'])
@jwt_required()
def api_toggle_user_status(user_id):
    """Toggle user active status"""
    if int(get_jwt_identity()) == user_id:
        return jsonify({'message': 'Cannot disable your own account'}), 400
    user = User.query.get_or_404(user_id)
    user.is_active = not user.is_active
    db.session.commit()
    status_text = 'enabled' if user.is_active else 'disabled'
    return jsonify({'message': f'User has been {status_text}', 'is_active': user.is_active}), 200
