"""
Settings API Routes

Provides endpoints for system settings:
- GET /settings/i18n - Get i18n settings (public)
- PUT /settings/i18n - Update i18n settings (admin)
- POST /settings/i18n/languages - Add language (admin)
- GET /settings/homepage - Get homepage settings (public)
- PUT /settings/homepage - Update homepage settings (editor)
"""

from flask import jsonify, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
import json
from datetime import datetime

from core.backend_engine.factory import db
from core.backend_engine.blueprints.api import bp
from core.backend_engine.blueprints.api.utils import get_i18n_setting
from core.backend_engine.models import Setting, User, HomepageSlide, HomepageSettings


# ==================== i18n Settings ====================

@bp.route('/settings/i18n', methods=['GET'])
def api_get_i18n_settings():
    """Get i18n multi-language settings (public API, no login required)"""
    enabled = get_i18n_setting('i18n_enabled', 'false').lower() == 'true'
    default_language = get_i18n_setting('i18n_default_language', 'zh-TW')
    languages_str = get_i18n_setting('i18n_languages', 'zh-TW')
    language_names_str = get_i18n_setting('i18n_language_names', '{}')

    languages = [lang.strip() for lang in languages_str.split(',') if lang.strip()]
    try:
        language_names = json.loads(language_names_str)
    except json.JSONDecodeError:
        language_names = {}

    return jsonify({
        'enabled': enabled,
        'default_language': default_language,
        'languages': languages,
        'language_names': language_names
    }), 200


@bp.route('/settings/i18n', methods=['PUT'])
@jwt_required()
def api_update_i18n_settings():
    """Update i18n multi-language settings (admin only)"""
    user = User.query.get(int(get_jwt_identity()))
    if not user or user.role != 'admin':
        return jsonify({'message': 'Admin permission required'}), 403

    data = request.get_json()
    settings_to_update = {
        'i18n_enabled': str(data.get('enabled', False)).lower(),
        'i18n_default_language': data.get('default_language', 'zh-TW'),
        'i18n_languages': ','.join(data.get('languages', ['zh-TW'])),
        'i18n_language_names': json.dumps(data.get('language_names', {}), ensure_ascii=False)
    }

    for key, value in settings_to_update.items():
        setting = Setting.query.filter_by(key=key).first()
        if setting:
            setting.value = value
        else:
            db.session.add(Setting(key=key, value=value))

    db.session.commit()
    return jsonify({'message': 'i18n settings updated'}), 200


@bp.route('/settings/i18n/languages', methods=['POST'])
@jwt_required()
def api_add_language():
    """Add language (admin only)"""
    user = User.query.get(int(get_jwt_identity()))
    if not user or user.role != 'admin':
        return jsonify({'message': 'Admin permission required'}), 403

    data = request.get_json()
    code = data.get('code')
    name = data.get('name')
    if not code or not name:
        return jsonify({'message': 'Language code and name are required'}), 400

    languages = [lang.strip() for lang in get_i18n_setting('i18n_languages', 'zh-TW').split(',') if lang.strip()]
    if code in languages:
        return jsonify({'message': f'Language {code} already exists'}), 400

    languages.append(code)
    setting = Setting.query.filter_by(key='i18n_languages').first()
    if setting:
        setting.value = ','.join(languages)

    language_names = json.loads(get_i18n_setting('i18n_language_names', '{}'))
    language_names[code] = name
    names_setting = Setting.query.filter_by(key='i18n_language_names').first()
    if names_setting:
        names_setting.value = json.dumps(language_names, ensure_ascii=False)

    db.session.commit()
    return jsonify({'message': f'Added language: {name} ({code})', 'languages': languages, 'language_names': language_names}), 201


# ==================== Homepage Settings ====================

@bp.route('/settings/homepage', methods=['GET'])
def api_get_homepage_settings():
    """Get homepage slideshow settings (public API, no login required)"""
    slides = HomepageSlide.query.filter_by(is_active=True).order_by(HomepageSlide.sort_order).all()
    homepage_settings = HomepageSettings.query.first()
    if not homepage_settings:
        homepage_settings = HomepageSettings(button_text={'zh-TW': 'About Us'})
        db.session.add(homepage_settings)
        db.session.commit()

    latest_slide = HomepageSlide.query.order_by(HomepageSlide.updated_at.desc()).first()
    updated_at = latest_slide.updated_at.isoformat() if latest_slide else datetime.utcnow().isoformat()

    return jsonify({
        'slides': [s.to_dict() for s in slides],
        'button_text': homepage_settings.button_text or {},
        'updated_at': updated_at
    }), 200


@bp.route('/settings/homepage', methods=['PUT'])
@jwt_required()
def api_update_homepage_settings():
    """Update homepage slideshow settings (editor permission required)"""
    user = User.query.get(int(get_jwt_identity()))
    if not user or not user.is_editor():
        return jsonify({'message': 'Editor permission required'}), 403

    data = request.get_json()
    slides_data = data.get('slides', [])
    if len(slides_data) > 5:
        return jsonify({'message': 'Maximum 5 slides allowed'}), 400

    button_text = data.get('button_text')
    if button_text is not None:
        homepage_settings = HomepageSettings.query.first()
        if not homepage_settings:
            homepage_settings = HomepageSettings(button_text=button_text)
            db.session.add(homepage_settings)
        else:
            homepage_settings.button_text = button_text
            homepage_settings.updated_at = datetime.utcnow()

    existing_slide_ids = [slide.slide_id for slide in HomepageSlide.query.all()]
    new_slide_ids = [slide_data.get('id') for slide_data in slides_data if slide_data.get('id')]
    slides_to_delete = set(existing_slide_ids) - set(new_slide_ids)
    if slides_to_delete:
        HomepageSlide.query.filter(HomepageSlide.slide_id.in_(slides_to_delete)).delete(synchronize_session=False)

    for slide_data in slides_data:
        slide_id = slide_data.get('id')
        if not slide_id:
            continue
        slide = HomepageSlide.query.filter_by(slide_id=slide_id).first()
        if slide:
            slide.image_url = slide_data.get('image_url', slide.image_url)
            slide.alt_text = slide_data.get('alt_text', '')
            slide.sort_order = slide_data.get('sort_order', 0)
            slide.subtitles = slide_data.get('subtitles', {})
            slide.updated_at = datetime.utcnow()
        else:
            db.session.add(HomepageSlide(
                slide_id=slide_id,
                image_url=slide_data.get('image_url', ''),
                alt_text=slide_data.get('alt_text', ''),
                sort_order=slide_data.get('sort_order', 0),
                subtitles=slide_data.get('subtitles', {})
            ))

    db.session.commit()
    return jsonify({'message': 'Homepage settings updated'}), 200
