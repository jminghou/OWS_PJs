"""
Main Blueprint

Provides basic routes for the application:
- / and /index - API service status page
"""

from flask import Blueprint, jsonify, request, current_app

bp = Blueprint('main', __name__)


@bp.route('/')
@bp.route('/index')
def index():
    """API service status page"""
    return jsonify({
        "status": "online",
        "service": "OWS CMS API",
        "version": "2.0.0",
        "message": "This is the backend API service, please access through frontend application.",
        "frontend_url": current_app.config.get('FRONTEND_URL', 'http://localhost:3000')
    })


@bp.route('/health')
def health_check():
    """Health check endpoint for load balancers and monitoring"""
    return jsonify({
        "status": "healthy",
        "timestamp": __import__('datetime').datetime.utcnow().isoformat()
    })
