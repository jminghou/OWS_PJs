"""
Error Handlers Blueprint

Provides global error handlers for the application:
- 400 Bad Request
- 403 Forbidden
- 404 Not Found
- 500 Internal Server Error
- Marshmallow ValidationError

Returns JSON for API requests, HTML for browser requests.
"""

from flask import Blueprint, render_template, jsonify, request
from marshmallow import ValidationError

from core.backend_engine.factory import db

bp = Blueprint('errors', __name__)


def wants_json_response():
    """Check if client prefers JSON response over HTML"""
    return request.accept_mimetypes['application/json'] >= \
        request.accept_mimetypes['text/html']


@bp.app_errorhandler(ValidationError)
def marshmallow_validation_error(error):
    """Handle Marshmallow validation errors"""
    return jsonify({
        'message': 'Validation failed',
        'errors': error.messages
    }), 400


@bp.app_errorhandler(400)
def bad_request_error(error):
    """Handle 400 Bad Request errors"""
    if wants_json_response():
        return jsonify({
            'message': error.description or 'Bad request',
            'status': 400
        }), 400
    return render_template('errors/400.html'), 400


@bp.app_errorhandler(403)
def forbidden_error(error):
    """Handle 403 Forbidden errors"""
    if wants_json_response():
        return jsonify({'error': 'Forbidden'}), 403
    return render_template('errors/403.html'), 403


@bp.app_errorhandler(404)
def not_found_error(error):
    """Handle 404 Not Found errors"""
    if wants_json_response():
        return jsonify({'error': 'Not found'}), 404
    return render_template('errors/404.html'), 404


@bp.app_errorhandler(500)
def internal_error(error):
    """Handle 500 Internal Server Error"""
    db.session.rollback()
    if wants_json_response():
        return jsonify({'error': 'Internal server error'}), 500
    return render_template('errors/500.html'), 500
