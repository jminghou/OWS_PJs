"""
API Authentication Routes

Provides JWT-based authentication endpoints:
- POST /auth/login - Login with username/password, returns JWT in httpOnly cookies
- POST /auth/refresh - Refresh access token using refresh token
- POST /auth/logout - Logout by clearing JWT cookies
- GET /auth/profile - Get current user profile
"""

from flask import jsonify, request, current_app
from flask_jwt_extended import (
    create_access_token, create_refresh_token,
    jwt_required, get_jwt_identity,
    set_access_cookies, set_refresh_cookies, unset_jwt_cookies
)
from datetime import datetime

from core.backend_engine.factory import db, limiter
from core.backend_engine.blueprints.api import bp
from core.backend_engine.models import User
from core.backend_engine.schemas.user import UserSchema

user_schema = UserSchema()


@bp.route('/auth/login', methods=['POST'])
@limiter.limit("10/minute")
def api_login():
    """API Login endpoint - Returns JWT via httpOnly cookies"""
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({'message': 'Missing username or password'}), 400

    user = User.query.filter_by(username=username).first()

    if not user or not user.is_active or not user.check_password(password):
        return jsonify({'message': 'Invalid credentials'}), 401

    user.last_login = datetime.utcnow()
    db.session.commit()

    access_token = create_access_token(identity=str(user.id))
    refresh_token = create_refresh_token(identity=str(user.id))

    response = jsonify({
        'user': user_schema.dump(user)
    })
    set_access_cookies(response, access_token)
    set_refresh_cookies(response, refresh_token)
    return response, 200


@bp.route('/auth/refresh', methods=['POST'])
@jwt_required(refresh=True)
def api_refresh():
    """Use Refresh Token to get a new Access Token"""
    user_id = get_jwt_identity()
    user = User.query.get(int(user_id))

    if not user or not user.is_active:
        return jsonify({'message': 'User does not exist or is disabled'}), 401

    access_token = create_access_token(identity=str(user.id))
    response = jsonify({'user': user_schema.dump(user)})
    set_access_cookies(response, access_token)
    return response, 200


@bp.route('/auth/logout', methods=['POST'])
def api_logout():
    """Logout - Clear JWT cookies"""
    response = jsonify({'message': 'Successfully logged out'})
    unset_jwt_cookies(response)
    return response, 200


@bp.route('/auth/profile', methods=['GET'])
@jwt_required()
def api_profile():
    """Get current user profile"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:
        return jsonify({'message': 'User not found'}), 404

    return jsonify(user_schema.dump(user)), 200
