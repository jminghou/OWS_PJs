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
    """Health check endpoint for load balancers and monitoring.

    有模組載入失敗且站台設了 HEALTH_FAIL_ON_MODULE_ERROR 時回 503：Railway 的健康檢查
    就不會把少了一整組 API 的新版本切上線。失敗清單只寫進日誌，不對外公開模組路徑。
    """
    failed = current_app.extensions.get('ows_failed_modules') or []
    degraded = bool(failed) and current_app.config.get('HEALTH_FAIL_ON_MODULE_ERROR', False)
    return jsonify({
        "status": "degraded" if degraded else "healthy",
        "failed_modules": len(failed),
        "timestamp": __import__('datetime').datetime.utcnow().isoformat()
    }), (503 if degraded else 200)
