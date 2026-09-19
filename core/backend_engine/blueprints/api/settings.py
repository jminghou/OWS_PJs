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
import re
from datetime import datetime

from core.backend_engine.factory import db
from core.backend_engine.blueprints.api import bp
from core.backend_engine.blueprints.api.utils import get_i18n_setting
from core.backend_engine.models import Setting, User, HomepageSlide, HomepageSettings
from core.backend_engine.services.rbac import require_permission
from core.backend_engine.services.revalidate import trigger_frontend_revalidate


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
@require_permission('settings.update')
def api_update_i18n_settings():
    """Update i18n multi-language settings (requires settings.update)"""
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
@require_permission('settings.update')
def api_add_language():
    """Add language (requires settings.update)"""
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
    return _homepage_settings_response()


@bp.route('/settings/homepage/admin', methods=['GET'])
@jwt_required()
@require_permission('contents.update')
def api_get_admin_homepage_settings():
    """Editors must retain scheduled and inactive slides when saving."""
    return _homepage_settings_response(include_all=True)


def _homepage_settings_response(include_all=False):
    from sqlalchemy import or_
    now = datetime.utcnow()

    # Feature 8: Filter by active status AND scheduled date range
    slides = HomepageSlide.query.filter(
        HomepageSlide.is_active == True,
        or_(HomepageSlide.start_date == None, HomepageSlide.start_date <= now),
        or_(HomepageSlide.end_date == None, HomepageSlide.end_date >= now),
    ).order_by(HomepageSlide.sort_order).all()
    if include_all:
        slides = HomepageSlide.query.order_by(HomepageSlide.sort_order).all()

    # 改用 Setting 表讀取
    about_setting = Setting.query.filter_by(key='homepage_about_section').first()
    try:
        about_section = json.loads(about_setting.value) if about_setting and about_setting.value else {}
    except (json.JSONDecodeError, TypeError, ValueError):
        about_section = {}

    # 服務宣言區塊（Banner）
    banner_setting = Setting.query.filter_by(key='homepage_banner_section').first()
    try:
        banner_section = json.loads(banner_setting.value) if banner_setting and banner_setting.value else {}
    except (json.JSONDecodeError, TypeError, ValueError):
        banner_section = {}

    wall_setting = Setting.query.filter_by(key='homepage_article_wall').first()
    try:
        article_wall = validate_article_wall(json.loads(wall_setting.value)) if wall_setting and wall_setting.value else {'mode': 'latest', 'article_ids': []}
    except (ValueError, TypeError):
        article_wall = {'mode': 'latest', 'article_ids': []}

    hero_setting = Setting.query.filter_by(key='homepage_hero_intro').first()
    try:
        hero_intro = validate_hero_intro(json.loads(hero_setting.value)) if hero_setting and hero_setting.value else {'locales': {}}
    except (ValueError, TypeError):
        hero_intro = {'locales': {}}

    homepage_settings = HomepageSettings.query.first()
    button_text = homepage_settings.button_text if homepage_settings else {}
    # Features 7 & 9: global carousel settings
    pause_on_hover = (homepage_settings.pause_on_hover
                      if homepage_settings and homepage_settings.pause_on_hover is not None
                      else True)
    lazy_loading = (homepage_settings.lazy_loading
                    if homepage_settings and homepage_settings.lazy_loading is not None
                    else True)

    latest_slide = HomepageSlide.query.order_by(HomepageSlide.updated_at.desc()).first()
    updated_at = latest_slide.updated_at.isoformat() if latest_slide else datetime.utcnow().isoformat()

    return jsonify({
        'slides': [s.to_dict() for s in slides],
        'button_text': button_text,
        'article_wall': article_wall,
        'hero_intro': hero_intro,
        'about_section': about_section,
        'banner_section': banner_section,
        'pause_on_hover': pause_on_hover,
        'lazy_loading': lazy_loading,
        'updated_at': updated_at
    }), 200


def validate_article_wall(value):
    """Bound and normalize the ordered IDs; an empty manual wall stays empty."""
    if not isinstance(value, dict) or value.get('mode') not in ('latest', 'manual'):
        raise ValueError('Invalid article wall mode')
    ids = value.get('article_ids')
    if not isinstance(ids, list) or len(ids) > 24 or any(type(i) is not int or i <= 0 for i in ids):
        raise ValueError('Article wall requires up to 24 positive integer IDs')
    return {'mode': value['mode'], 'article_ids': list(dict.fromkeys(ids))}


# 文字型首頁 Hero（取代輪播的站台用）：每語系一組文案 + 一張共用的選填圖片。
_HERO_INTRO_FIELDS = {'eyebrow': 200, 'headline': 200, 'body': 2000, 'newsletter_note': 300, 'proof_line': 300}
_LOCALE_RE = re.compile(r'^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})?$')


def validate_hero_intro(value):
    """Keep only known string fields within length caps; unknown keys are dropped, not rejected."""
    if not isinstance(value, dict) or not isinstance(value.get('locales', {}), dict):
        raise ValueError('Invalid hero intro')
    if len(value.get('locales', {})) > 12:
        raise ValueError('Too many hero intro locales')
    locales = {}
    for locale, fields in value.get('locales', {}).items():
        if not isinstance(locale, str) or not _LOCALE_RE.match(locale) or not isinstance(fields, dict):
            raise ValueError('Invalid hero intro locale')
        cleaned = {}
        for name, limit in _HERO_INTRO_FIELDS.items():
            text = fields.get(name, '')
            if not isinstance(text, str) or len(text) > limit:
                raise ValueError(f'Hero intro {name} must be text up to {limit} characters')
            if text.strip():
                cleaned[name] = text.strip()
        locales[locale] = cleaned
    image_url = value.get('image_url') or ''
    if not isinstance(image_url, str) or len(image_url) > 500 or (image_url and not image_url.startswith(('/', 'http://', 'https://'))):
        raise ValueError('Hero intro image_url must be a site path or http(s) URL')
    return {'image_url': image_url, 'locales': locales}


def _parse_datetime(value):
    """Safely parse ISO datetime string or return None."""
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace('Z', '+00:00'))
    except (ValueError, AttributeError):
        return None


@bp.route('/settings/homepage', methods=['PUT'])
@jwt_required()
@require_permission('contents.update')
def api_update_homepage_settings():
    """Update homepage slideshow settings (requires contents.update)"""
    data = request.get_json()
    if not isinstance(data, dict):
        return jsonify({'message': 'Expected a settings object'}), 400
    if 'article_wall' in data:
        try:
            wall = validate_article_wall(data['article_wall'])
        except ValueError as error:
            return jsonify({'message': str(error)}), 400
        setting = Setting.query.filter_by(key='homepage_article_wall').first()
        if not setting:
            setting = Setting(key='homepage_article_wall')
            db.session.add(setting)
        setting.value = json.dumps(wall)
    if 'hero_intro' in data:
        try:
            hero_intro = validate_hero_intro(data['hero_intro'])
        except ValueError as error:
            return jsonify({'message': str(error)}), 400
        setting = Setting.query.filter_by(key='homepage_hero_intro').first()
        if not setting:
            setting = Setting(key='homepage_hero_intro')
            db.session.add(setting)
        setting.value = json.dumps(hero_intro, ensure_ascii=False)

    # 1. 處理關於我們 (使用 Setting 表，這是最穩定的做法)
    if 'about_section' in data:
        about_data = data.get('about_section')
        setting = Setting.query.filter_by(key='homepage_about_section').first()
        if setting:
            setting.value = json.dumps(about_data, ensure_ascii=False)
        else:
            db.session.add(Setting(key='homepage_about_section', value=json.dumps(about_data, ensure_ascii=False)))

    # 1b. 處理服務宣言區塊 (Banner，使用 Setting 表)
    if 'banner_section' in data:
        banner_data = data.get('banner_section')
        setting = Setting.query.filter_by(key='homepage_banner_section').first()
        if setting:
            setting.value = json.dumps(banner_data, ensure_ascii=False)
        else:
            db.session.add(Setting(key='homepage_banner_section', value=json.dumps(banner_data, ensure_ascii=False)))

    # 2. 處理全域設定 (按鈕文字 + Features 7 & 9)
    homepage_settings = HomepageSettings.query.first()
    if not homepage_settings:
        homepage_settings = HomepageSettings()
        db.session.add(homepage_settings)

    if 'button_text' in data:
        homepage_settings.button_text = data.get('button_text')
    if 'pause_on_hover' in data:
        homepage_settings.pause_on_hover = data['pause_on_hover']
    if 'lazy_loading' in data:
        homepage_settings.lazy_loading = data['lazy_loading']
    homepage_settings.updated_at = datetime.utcnow()

    # 3. 處理幻燈片
    if 'slides' in data:
        slides_data = data.get('slides', [])
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
                # Feature 1: CTA
                slide.cta_url = slide_data.get('cta_url', '')
                slide.cta_text = slide_data.get('cta_text', {})
                slide.cta_new_tab = slide_data.get('cta_new_tab', False)
                # Feature 2: per-slide autoplay delay
                slide.autoplay_delay = slide_data.get('autoplay_delay')  # None preserved
                # Feature 3: video
                slide.video_url = slide_data.get('video_url', '')
                slide.media_type = slide_data.get('media_type', 'image')
                # Feature 4: focal point
                slide.focal_point = slide_data.get('focal_point', 'center center')
                # Feature 5: overlay opacity
                slide.overlay_opacity = slide_data.get('overlay_opacity', 40)
                # Feature 6: per-slide title
                slide.titles = slide_data.get('titles', {})
                # Feature 8: scheduling
                slide.start_date = _parse_datetime(slide_data.get('start_date'))
                slide.end_date = _parse_datetime(slide_data.get('end_date'))
                slide.updated_at = datetime.utcnow()
            else:
                db.session.add(HomepageSlide(
                    slide_id=slide_id,
                    image_url=slide_data.get('image_url', ''),
                    alt_text=slide_data.get('alt_text', ''),
                    sort_order=slide_data.get('sort_order', 0),
                    subtitles=slide_data.get('subtitles', {}),
                    cta_url=slide_data.get('cta_url', ''),
                    cta_text=slide_data.get('cta_text', {}),
                    cta_new_tab=slide_data.get('cta_new_tab', False),
                    autoplay_delay=slide_data.get('autoplay_delay'),
                    video_url=slide_data.get('video_url', ''),
                    media_type=slide_data.get('media_type', 'image'),
                    focal_point=slide_data.get('focal_point', 'center center'),
                    overlay_opacity=slide_data.get('overlay_opacity', 40),
                    titles=slide_data.get('titles', {}),
                    start_date=_parse_datetime(slide_data.get('start_date')),
                    end_date=_parse_datetime(slide_data.get('end_date')),
                ))

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': f'Database error: {str(e)}'}), 500

    # 通知前端立即清除首頁 ISR 快取（best-effort，失敗不影響儲存結果）
    trigger_frontend_revalidate()
    return jsonify({'message': 'Homepage settings updated'}), 200
