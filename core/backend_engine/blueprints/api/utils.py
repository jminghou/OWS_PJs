"""
API Utility Functions

Provides common utility functions for API routes including:
- Timezone conversions (Taiwan timezone)
- Authentication checks
- i18n settings
- JSON validation decorator
- Role-based access control decorator
"""

import pytz
from functools import wraps
from datetime import datetime
from flask import request as flask_request, jsonify
from marshmallow import ValidationError
from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity

# Taiwan timezone setting
TAIWAN_TZ = pytz.timezone('Asia/Taipei')


def now_tw():
    """Get current Taiwan time (aware datetime)"""
    return datetime.now(TAIWAN_TZ)


def utc_to_tw(dt):
    """Convert UTC time to Taiwan time"""
    if dt is None:
        return None
    if dt.tzinfo is None:
        # If naive datetime, assume UTC
        dt = pytz.utc.localize(dt)
    return dt.astimezone(TAIWAN_TZ)


def tw_to_utc(dt):
    """Convert Taiwan time to UTC (naive datetime for database storage)"""
    if dt is None:
        return None
    if dt.tzinfo is None:
        # If naive datetime, assume Taiwan time
        dt = TAIWAN_TZ.localize(dt)
    return dt.astimezone(pytz.utc).replace(tzinfo=None)


def parse_tw_datetime(dt_str):
    """Parse ISO format datetime string as Taiwan time and convert to UTC (naive) for database storage"""
    if not dt_str:
        return None
    try:
        # Parse ISO format string (may have Z or timezone)
        if dt_str.endswith('Z'):
            dt = datetime.fromisoformat(dt_str.replace('Z', '+00:00'))
        elif '+' in dt_str or dt_str.count('-') > 2:  # Has timezone info
            dt = datetime.fromisoformat(dt_str)
        else:
            # No timezone info, treat as Taiwan time
            dt = datetime.fromisoformat(dt_str)
            dt = TAIWAN_TZ.localize(dt)

        # Convert to UTC naive datetime
        return dt.astimezone(pytz.utc).replace(tzinfo=None)
    except Exception as e:
        print(f"Error parsing datetime: {dt_str}, {e}")
        return None


def is_authenticated():
    """Check if current request is authenticated (logged in)"""
    try:
        verify_jwt_in_request(optional=True)
        return get_jwt_identity() is not None
    except:
        return False


def get_i18n_setting(key, default=None):
    """Get i18n setting value"""
    from core.backend_engine.models import Setting
    setting = Setting.query.filter_by(key=key).first()
    return setting.value if setting else default


def is_i18n_enabled():
    """Check if multi-language feature is enabled"""
    return get_i18n_setting('i18n_enabled', 'false').lower() == 'true'


def get_localized_slug(entity, language):
    """Get entity's slug for a specific language"""
    if not entity:
        return None

    # Prefer slug from slugs JSON for the specific language
    slugs = entity.slugs or {}
    if language in slugs and slugs[language]:
        return slugs[language]

    # Fallback to default language
    default_lang = get_i18n_setting('i18n_default_language', 'zh-TW')
    if default_lang in slugs and slugs[default_lang]:
        return slugs[default_lang]

    # If still not found, return code
    return entity.code


def validate_json(schema_class, partial=False):
    """Request JSON body validation decorator

    Validates request body using Marshmallow schema, returns 422 on failure.
    On success, puts cleaned data into flask_request.validated_data.

    Usage:
        @bp.route('/example', methods=['POST'])
        @validate_json(MySchema)
        def create_example():
            data = flask_request.validated_data
            ...
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            json_data = flask_request.get_json(silent=True)
            if json_data is None:
                return jsonify({'message': 'Request must contain JSON body'}), 400

            schema = schema_class(partial=partial) if partial else schema_class()
            try:
                validated_data = schema.load(json_data)
                flask_request.validated_data = validated_data
            except ValidationError as err:
                return jsonify({
                    'message': 'Input data validation failed',
                    'errors': err.messages
                }), 422

            return f(*args, **kwargs)
        return decorated_function
    return decorator


def require_role(*roles):
    """Role-based access control decorator

    Checks if current JWT user has one of the specified roles.
    Must be used with @jwt_required().

    Usage:
        @bp.route('/admin/example', methods=['GET'])
        @jwt_required()
        @require_role('admin', 'editor')
        def admin_example():
            ...
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            from core.backend_engine.models import User
            user_id = get_jwt_identity()
            user = User.query.get(int(user_id))
            if not user or user.role not in roles:
                return jsonify({'message': 'Insufficient permissions'}), 403
            flask_request.current_user = user
            return f(*args, **kwargs)
        return decorated_function
    return decorator
