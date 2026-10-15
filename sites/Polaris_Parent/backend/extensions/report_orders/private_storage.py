"""
私有檔案儲存：報告 PDF、打樣、會員上傳的照片（含個資，不可放在公開的媒體庫）。

- 正式站：設定 PRIVATE_GCS_BUCKET_NAME 時存在該 GCS bucket（bucket 必須禁止公開存取）。
  憑證沿用媒體庫的 GCS_CREDENTIALS_JSON（沒設就用執行環境的預設憑證）。
- 本機：存在 PRIVATE_UPLOAD_DIR（預設 <instance>/private_uploads），不經過任何公開網址。

檔案一律由後端串流給已驗證身分的使用者（見 issue_download_token / read_download_token），
不產生 GCS 簽名網址，所以服務帳號不需要私鑰簽章權限。
"""

import hashlib
import os
from io import BytesIO

from flask import current_app
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

_TOKEN_SALT = 'report-private-file'


class StorageError(Exception):
    pass


def _bucket_name():
    return (current_app.config.get('PRIVATE_GCS_BUCKET_NAME') or os.environ.get('PRIVATE_GCS_BUCKET_NAME') or '').strip()


def _local_root():
    root = (current_app.config.get('PRIVATE_UPLOAD_DIR') or os.environ.get('PRIVATE_UPLOAD_DIR')
            or os.path.join(current_app.instance_path, 'private_uploads'))
    os.makedirs(root, exist_ok=True)
    return root


def _local_path(key):
    root = os.path.realpath(_local_root())
    path = os.path.realpath(os.path.join(root, *key.split('/')))
    if not path.startswith(root + os.sep):
        raise StorageError('檔案路徑不正確')
    return path


_gcs_bucket_cache = {}


def _gcs_bucket():
    name = _bucket_name()
    if name not in _gcs_bucket_cache:
        from google.cloud import storage

        creds = current_app.config.get('GCS_CREDENTIALS_JSON') or os.environ.get('GCS_CREDENTIALS_JSON')
        client = storage.Client.from_service_account_json(creds) if creds and os.path.isfile(creds) else storage.Client()
        _gcs_bucket_cache[name] = client.bucket(name)
    return _gcs_bucket_cache[name]


def backend_name():
    return 'gcs' if _bucket_name() else 'local'


def save(key, data: bytes, content_type: str):
    """寫入檔案，回傳 (bytes, sha256)。"""
    digest = hashlib.sha256(data).hexdigest()
    if _bucket_name():
        blob = _gcs_bucket().blob(key)
        blob.upload_from_file(BytesIO(data), size=len(data), content_type=content_type)
    else:
        path = _local_path(key)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, 'wb') as fh:
            fh.write(data)
    return len(data), digest


def read(key) -> bytes:
    if _bucket_name():
        blob = _gcs_bucket().blob(key)
        if not blob.exists():
            raise StorageError('找不到檔案')
        return blob.download_as_bytes()
    path = _local_path(key)
    if not os.path.isfile(path):
        raise StorageError('找不到檔案')
    with open(path, 'rb') as fh:
        return fh.read()


def delete(key):
    try:
        if _bucket_name():
            _gcs_bucket().blob(key).delete()
        else:
            path = _local_path(key)
            if os.path.isfile(path):
                os.remove(path)
    except Exception as exc:  # noqa: BLE001
        current_app.logger.warning(f'private storage delete failed {key}: {exc}')


# ── 短效下載憑證：讓瀏覽器用一般網址（<a>、pdf.js）下載，不必帶登入標頭 ──
def _serializer():
    return URLSafeTimedSerializer(current_app.config['SECRET_KEY'], salt=_TOKEN_SALT)


def issue_file_token(kind, file_id, user_id):
    """kind：doc（報告 PDF）／asset（會員上傳的照片）。"""
    return _serializer().dumps({'k': kind, 'i': int(file_id), 'u': int(user_id)})


def read_file_token(token, max_age=600):
    """回傳 (kind, file_id, user_id)；過期或被竄改回 None。"""
    try:
        data = _serializer().loads(token, max_age=max_age)
        return str(data['k']), int(data['i']), int(data['u'])
    except (BadSignature, SignatureExpired, KeyError, TypeError, ValueError):
        return None
