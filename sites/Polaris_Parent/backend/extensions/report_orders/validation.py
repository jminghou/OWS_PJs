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


def validate_order(data: dict, today: date = None):
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
    if time_type == 'solar_time' and (not city or not country):
        errors['place'] = '使用真太陽時需選擇出生的國家與城市'

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

    shipping = None
    if variant == 'physical':
        shipping, ship_errors = validate_shipping(data.get('shipping') or {})
        errors.update(ship_errors)

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
        'place': {'continent': continent, 'country': country, 'city': city} if time_type == 'solar_time'
                 else {'continent': '', 'country': '', 'city': ''},
        'relation_label': relation,
        'audience': {'reader': reader, 'call_name': call_name, 'dedication': dedication},
        'shipping': shipping,
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
