"""
Media Library - GCS Storage Service

以 GCS 為主的檔案儲存服務。
基於 core/backend_engine/services/storage.py 的 GCSStorageBackend 重構。
"""

import uuid
from datetime import datetime, timezone
from typing import Tuple, Optional, BinaryIO

from flask import current_app
from google.cloud import storage
from werkzeug.utils import secure_filename

from packages.media_lib.config import GCS_BASE_PATH


class GCSStorage:
    """Google Cloud Storage 操作封裝。"""

    _instance = None

    def __init__(self, bucket_name: str, credentials_path: Optional[str] = None):
        self.bucket_name = bucket_name
        self.public_url_prefix = f'https://storage.googleapis.com/{bucket_name}'

        if credentials_path:
            self.client = storage.Client.from_service_account_json(credentials_path)
        else:
            self.client = storage.Client()

        self.bucket = self.client.bucket(bucket_name)

    @classmethod
    def get_instance(cls) -> 'GCSStorage':
        """取得 singleton instance（需在 Flask app context 中）。"""
        if cls._instance is None:
            bucket_name = current_app.config.get('GCS_BUCKET_NAME')
            credentials_path = current_app.config.get('GCS_CREDENTIALS_JSON')

            if not bucket_name:
                raise ValueError('GCS_BUCKET_NAME is required for media-lib')

            cls._instance = cls(bucket_name, credentials_path)
            current_app.logger.info(f'GCSStorage initialized (bucket: {bucket_name})')

        return cls._instance

    @classmethod
    def reset_instance(cls):
        cls._instance = None

    def _generate_gcs_path(self, filename: str, prefix: str = '') -> Tuple[str, str]:
        """
        產生 GCS 路徑和唯一檔名。

        Returns:
            (gcs_path, unique_filename)
            例如: ('media/2026/02/a1b2c3d4_image.jpg', 'a1b2c3d4_image.jpg')
        """
        safe_name = secure_filename(filename)
        unique_name = f'{uuid.uuid4().hex[:8]}_{safe_name}'
        now = datetime.now(timezone.utc)
        date_path = now.strftime('%Y/%m')

        if prefix:
            gcs_path = f'{GCS_BASE_PATH}/{prefix}/{date_path}/{unique_name}'
        else:
            gcs_path = f'{GCS_BASE_PATH}/{date_path}/{unique_name}'

        return gcs_path, unique_name

    def upload(
        self,
        file: BinaryIO,
        filename: str,
        content_type: Optional[str] = None,
        prefix: str = '',
    ) -> Tuple[str, str, str]:
        """
        上傳檔案到 GCS。

        Returns:
            (public_url, gcs_path, unique_filename)
        """
        gcs_path, unique_name = self._generate_gcs_path(filename, prefix)
        blob = self.bucket.blob(gcs_path)

        if hasattr(file, 'seek'):
            file.seek(0)

        if content_type is None and hasattr(file, 'content_type'):
            content_type = file.content_type

        if hasattr(file, 'read'):
            blob.upload_from_file(file, content_type=content_type)
        else:
            blob.upload_from_filename(file, content_type=content_type)

        public_url = f'{self.public_url_prefix}/{gcs_path}'
        return public_url, gcs_path, unique_name

    def upload_bytes(
        self,
        data: bytes,
        gcs_path: str,
        content_type: str = 'image/jpeg',
    ) -> str:
        """
        上傳 bytes 資料到指定的 GCS 路徑。用於上傳圖片變體。

        Returns:
            public_url
        """
        blob = self.bucket.blob(gcs_path)
        blob.upload_from_string(data, content_type=content_type)
        return f'{self.public_url_prefix}/{gcs_path}'

    def delete(self, gcs_path: str) -> bool:
        """刪除 GCS 上的檔案。"""
        try:
            # 從 URL 中提取 gcs_path
            if gcs_path.startswith('http'):
                gcs_path = gcs_path.split(f'{self.bucket_name}/')[-1]

            blob = self.bucket.blob(gcs_path)
            blob.delete()
            return True
        except Exception as e:
            current_app.logger.error(f'GCS delete error: {e}')
            return False

    def exists(self, gcs_path: str) -> bool:
        """檢查檔案是否存在。"""
        try:
            if gcs_path.startswith('http'):
                gcs_path = gcs_path.split(f'{self.bucket_name}/')[-1]
            blob = self.bucket.blob(gcs_path)
            return blob.exists()
        except Exception:
            return False


__all__ = ['GCSStorage']
