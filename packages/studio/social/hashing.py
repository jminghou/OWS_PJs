"""發布內容雜湊。確認綁這顆雜湊；內容一改，雜湊就對不上。"""
import hashlib
import json
import unicodedata
from datetime import datetime
from typing import Any, Optional


def normalize_message(message: Optional[str]) -> str:
    """Unicode NFC，並把 CRLF / CR 收成 LF。雜湊與字數都看這份。"""
    text = unicodedata.normalize('NFC', message or '')
    return text.replace('\r\n', '\n').replace('\r', '\n')


def stable_ts(value: Any) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.strftime('%Y-%m-%dT%H:%M:%S')
    return str(value)


def canonical_json(data: Any) -> str:
    return json.dumps(data, ensure_ascii=False, sort_keys=True, separators=(',', ':'))


def hash_material(*, target, target_ref, message, link, media, scheduled_for) -> dict:
    return {
        'target': target,
        'target_ref': target_ref or '',
        'message': normalize_message(message),
        'link': link or '',
        'media': [
            {
                'file_id': item['file_id'],
                'gcs_path': item['gcs_path'],
                'file_size': item['file_size'],
                'updated_at': stable_ts(item.get('updated_at')),
            }
            for item in media
        ],
        'scheduled_for': scheduled_for or '',
    }


def content_hash_from_parts(*, target, target_ref, message, link, media, scheduled_for) -> str:
    material = hash_material(
        target=target,
        target_ref=target_ref,
        message=message,
        link=link,
        media=media,
        scheduled_for=scheduled_for,
    )
    return hashlib.sha256(canonical_json(material).encode('utf-8')).hexdigest()
