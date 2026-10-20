"""
客製報告下單內容的後端驗證（前端 lib/report/draft.ts 的 validateDraft 對應版本，以這裡為準）。

只做格式與範圍檢查，不碰資料庫；回傳 (乾淨的資料, 錯誤 dict)。
"""

import re
from datetime import date

VARIANTS = ('digital', 'physical')
GENDERS = ('男', '女')
TIME_TYPES = ('clock_time', 'solar_time')
RELATIONS = ('self', 'son', 'daughter', 'father', 'mother', 'spouse', 'brother', 'sister', 'friend', 'other')
READERS = ('命主本人', '父母', '伴侶', '子女', '朋友', '主管或同事', '其他')
NAME_MAX = 40
CALL_NAME_MAX = 20
DEDICATION_MAX = 200

_DATE_RE = re.compile(r'^\d{4}-\d{2}-\d{2}$')
_TIME_RE = re.compile(r'^([01]\d|2[0-3]):[0-5]\d$')
_PHONE_RE = re.compile(r'^\+?[0-9][0-9\- ]{6,18}[0-9]$')
_POSTAL_RE = re.compile(r'^\d{3,6}$')


def _text(value, limit=None):
    s = (value or '').strip() if isinstance(value, str) else ''
    return s[:limit] if limit else s


def _clean_place(place, allow_manual, errors):
    """全球城市（geonameid）與手動經緯度：由伺服器查出名稱與座標，不採信前端送來的名稱。
    常用城市（洲／國家／城市）回 None，沿用原本的欄位（建單時再查）。"""
    from sites.Polaris_Parent.backend.extensions.astrology import birthplace as bp_mod

    try:
        if place.get('geonameid') not in (None, ''):
            bp = bp_mod.world_place(place['geonameid'])
            return {'continent': '', 'country': bp.country, 'city': bp.city, 'geonameid': bp.geonameid}
        if place.get('manual'):
            if not allow_manual:
                raise bp_mod.BirthplaceError('請從選單選擇或搜尋出生地')
            bp = bp_mod.manual_place(place.get('lat'), place.get('lon'), place.get('tz'),
                                     place.get('city') or place.get('label'), place.get('country'))
            return {'continent': '', 'country': bp.country, 'city': bp.city, 'manual': True,
                    'lat': bp.lat, 'lon': bp.lon, 'tz': bp.tz}
    except bp_mod.BirthplaceError as exc:
        errors['place'] = str(exc)
        return {}
    return None


def validate_order(data: dict, today: date = None, allow_manual_place: bool = False):
    today = today or date.today()
    errors = {}
    birth = data.get('birth') or {}
    place = data.get('place') or {}
    audience = data.get('audience') or {}

    variant = data.get('variant')
    if variant not in VARIANTS:
        errors['variant'] = '請選擇數位版或實體書版'

    subject_name = _text(data.get('subject_name'))
    if not subject_name:
        errors['subject_name'] = '請填寫報告主角的姓名'
    elif len(subject_name) > NAME_MAX:
        errors['subject_name'] = f'姓名請在 {NAME_MAX} 字以內'

    gender = data.get('gender')
    if gender not in GENDERS:
        errors['gender'] = '請選擇性別'

    birth_date = birth.get('date') if isinstance(birth.get('date'), str) else ''
    parsed_date = None
    if not _DATE_RE.match(birth_date):
        errors['birth_date'] = '請填寫出生日期'
    else:
        try:
            parsed_date = date.fromisoformat(birth_date)
        except ValueError:
            errors['birth_date'] = '日期不正確'
        else:
            if parsed_date.year < 1900:
                errors['birth_date'] = '目前支援 1900 年以後的出生日期'
            elif parsed_date > today:
                errors['birth_date'] = '出生日期不能晚於今天'

    birth_time = birth.get('time') if isinstance(birth.get('time'), str) else ''
    if not _TIME_RE.match(birth_time):
        errors['birth_time'] = '請填寫出生時間（時與分）'

    time_type = birth.get('time_type')
    if time_type not in TIME_TYPES:
        errors['time_type'] = '時間類型不正確'

    city, country, continent = _text(place.get('city'), 100), _text(place.get('country'), 100), _text(place.get('continent'), 50)
    # 兩種時間都要出生地：真太陽時要經度與時區，一般時間要判斷當天是否在夏令時
    clean_place = _clean_place(place, allow_manual_place, errors)
    if clean_place is None and (not city or not country):
        errors['place'] = '請選擇出生的國家與城市'

    relation = data.get('relation_label')
    if relation not in RELATIONS:
        errors['relation_label'] = '請選擇關係'

    reader = audience.get('reader')
    if reader not in READERS:
        errors['reader'] = '請選擇這份報告的讀者'

    call_name = _text(audience.get('call_name'))
    if not call_name:
        errors['call_name'] = '請填寫書中對主角的稱呼'
    elif len(call_name) > CALL_NAME_MAX:
        errors['call_name'] = f'稱呼請在 {CALL_NAME_MAX} 字以內'

    dedication = audience.get('dedication') if isinstance(audience.get('dedication'), str) else ''
    dedication = dedication.strip()
    if len(dedication) > DEDICATION_MAX:
        errors['dedication'] = f'題字請在 {DEDICATION_MAX} 字以內'

    shipping = physical = None
    if variant == 'physical':
        shipping, ship_errors = validate_shipping(data.get('shipping') or {})
        errors.update(ship_errors)
        # 規格／數量／特殊客製的合法值依後台設定，在 physical.price_physical 檢查；這裡只取出原始值
        raw = data.get('physical') if isinstance(data.get('physical'), dict) else {}
        physical = {'spec_key': raw.get('spec_key') if isinstance(raw.get('spec_key'), str) else None,
                    'quantity': raw.get('quantity', 1), 'custom': raw.get('custom') or [],
                    'spreads': raw.get('spreads', 0)}

    if errors:
        return None, errors

    hour, minute = (int(x) for x in birth_time.split(':'))
    clean = {
        'variant': variant,
        'subject_name': subject_name,
        'gender': gender,
        'birth': {'date': birth_date, 'time': birth_time, 'time_type': time_type,
                  'year': parsed_date.year, 'month': parsed_date.month, 'day': parsed_date.day,
                  'hour': hour, 'minute': minute},
        'place': clean_place or {'continent': continent, 'country': country, 'city': city},
        'relation_label': relation,
        'audience': {'reader': reader, 'call_name': call_name, 'dedication': dedication},
        'shipping': shipping,
        'physical': physical,
        # 專人解讀次數（0＝不買），合法範圍依後台設定，在 physical.price_consult 檢查
        'consult_sessions': data.get('consult_sessions') or 0,
    }
    return clean, {}


def validate_shipping(s: dict):
    errors = {}
    name = _text(s.get('recipient_name'))
    phone = _text(s.get('recipient_phone'))
    postal = _text(s.get('postal_code'))
    address = _text(s.get('address'))
    if not name or len(name) > 50:
        errors['recipient_name'] = '請填寫收件人姓名（50 字以內）'
    if not _PHONE_RE.match(phone):
        errors['recipient_phone'] = '請填寫可聯絡的電話'
    if postal and not _POSTAL_RE.match(postal):
        errors['postal_code'] = '郵遞區號格式不正確'
    if len(address) < 5 or len(address) > 200:
        errors['address'] = '請填寫完整的收件地址'
    if errors:
        return None, errors
    return {'recipient_name': name, 'recipient_phone': phone, 'postal_code': postal, 'address': address}, {}
