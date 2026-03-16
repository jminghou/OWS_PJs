"""
Media Library - Storage Service

支援 Local 本地儲存和 GCS 雲端儲存的媒體庫儲存服務。
透過 Flask config 中的 GCS_BUCKET_NAME 自動決定使用哪種後端：
- 有 GCS_BUCKET_NAME → GCS 模式
- 無 GCS_BUCKET_NAME → Local 模式（檔案存在 UPLOAD_FOLDER）
"""

import os
import uuid
from datetime import datetime, timezone
from io import BytesIO
from typing import Tuple, Optional, BinaryIO

from flask import current_app
from werkzeug.utils import secure_filename

from packages.media_lib.config import GCS_BASE_PATH


class MediaStorage:
    """
    媒體庫統一儲存介面（Singleton）。

    根據 Flask config 自動選擇 Local 或 GCS 後端。
    提供上傳、刪除、bytes 上傳等操作。
    """

    _instance = None

    def __init__(self, backend: str, **kwargs):
        self.backend = backend  # 'local' or 'gcs'

        if backend == 'gcs':
            from google.cloud import storage
            self.bucket_name = kwargs['bucket_name']
            self.public_url_prefix = f'https://storage.googleapis.com/{self.bucket_name}'
            credentials_path = kwargs.get('credentials_path')
            if credentials_path:
                self.client = storage.Client.from_service_account_json(credentials_path)
            else:
                self.client = storage.Client()
            self.bucket = self.client.bucket(self.bucket_name)

        elif backend == 'local':
            self.base_path = kwargs['base_path']
            self.url_prefix = kwargs.get('url_prefix', '/uploads')
            os.makedirs(self.base_path, exist_ok=True)

    @classmethod
    def get_instance(cls) -> 'MediaStorage':
        """取得 singleton instance（需在 Flask app context 中）。"""
        if cls._instance is None:
            bucket_name = current_app.config.get('GCS_BUCKET_NAME')

            if bucket_name:
                credentials_path = current_app.config.get('GCS_CREDENTIALS_JSON')
                cls._instance = cls(
                    'gcs',
                    bucket_name=bucket_name,
                    credentials_path=credentials_path,
                )
                current_app.logger.info(
                    f'MediaStorage initialized with GCS backend (bucket: {bucket_name})'
                )
            else:
                uploads_folder = current_app.config.get('UPLOAD_FOLDER', 'uploads')
                if os.path.isabs(uploads_folder):
                    base_path = uploads_folder
                else:
                    # Fallback: relative to Flask instance path
                    base_path = os.path.abspath(
                        os.path.join(current_app.instance_path, '..', uploads_folder)
                    )
                cls._instance = cls('local', base_path=base_path)
                current_app.logger.info(
                    f'MediaStorage initialized with Local backend (path: {base_path})'
                )

        return cls._instance

    @classmethod
    def reset_instance(cls):
        cls._instance = None

    @property
    def is_local(self) -> bool:
        return self.backend == 'local'

    @property
    def is_gcs(self) -> bool:
        return self.backend == 'gcs'

    # -------------------------------------------------------------------------
    # Path Generation
    # -------------------------------------------------------------------------

    def _generate_path(self, filename: str, prefix: str = '') -> Tuple[str, str]:
        """
        產生儲存路徑和唯一檔名。

        Returns:
            (storage_path, unique_filename)
            例如: ('media/2026/02/a1b2c3d4_image.jpg', 'a1b2c3d4_image.jpg')
        """
        safe_name = secure_filename(filename)
        unique_name = f'{uuid.uuid4().hex[:8]}_{safe_name}'
        now = datetime.now(timezone.utc)
        date_path = now.strftime('%Y/%m')

        if prefix:
            storage_path = f'{GCS_BASE_PATH}/{prefix}/{date_path}/{unique_name}'
        else:
            storage_path = f'{GCS_BASE_PATH}/{date_path}/{unique_name}'

        return storage_path, unique_name

    # -------------------------------------------------------------------------
    # Upload
    # -------------------------------------------------------------------------

    def upload(
        self,
        file: BinaryIO,
        filename: str,
        content_type: Optional[str] = None,
        prefix: str = '',
    ) -> Tuple[str, str, str]:
        """
        上傳檔案。

        Returns:
            (public_url, storage_path, unique_filename)
        """
        storage_path, unique_name = self._generate_path(filename, prefix)

        if self.is_gcs:
            return self._upload_gcs(file, storage_path, unique_name, content_type)
        else:
            return self._upload_local(file, storage_path, unique_name)

    def _upload_gcs(self, file, storage_path, unique_name, content_type):
        blob = self.bucket.blob(storage_path)
        if hasattr(file, 'seek'):
            file.seek(0)
        if content_type is None and hasattr(file, 'content_type'):
            content_type = file.content_type
        if hasattr(file, 'read'):
            blob.upload_from_file(file, content_type=content_type)
        else:
            blob.upload_from_filename(file, content_type=content_type)
        public_url = f'{self.public_url_prefix}/{storage_path}'
        return public_url, storage_path, unique_name

    def _upload_local(self, file, storage_path, unique_name):
        full_path = os.path.join(self.base_path, storage_path)
        os.makedirs(os.path.dirname(full_path), exist_ok=True)

        if hasattr(file, 'seek'):
            file.seek(0)

        if hasattr(file, 'save'):
            file.save(full_path)
        elif hasattr(file, 'read'):
            with open(full_path, 'wb') as f:
                f.write(file.read())
        else:
            import shutil
            shutil.copy2(file, full_path)

        public_url = f'{self.url_prefix}/{storage_path}'
        return public_url, storage_path, unique_name

    # -------------------------------------------------------------------------
    # Upload Bytes (for image variants)
    # -------------------------------------------------------------------------

    def upload_bytes(
        self,
        data: bytes,
        storage_path: str,
        content_type: str = 'image/jpeg',
    ) -> str:
        """
        上傳 bytes 資料到指定路徑（用於圖片變體）。

        Returns:
            public_url
        """
        if self.is_gcs:
            blob = self.bucket.blob(storage_path)
            blob.upload_from_string(data, content_type=content_type)
            return f'{self.public_url_prefix}/{storage_path}'
        else:
            full_path = os.path.join(self.base_path, storage_path)
            os.makedirs(os.path.dirname(full_path), exist_ok=True)
            with open(full_path, 'wb') as f:
                f.write(data)
            return f'{self.url_prefix}/{storage_path}'

    # -------------------------------------------------------------------------
    # Delete
    # -------------------------------------------------------------------------

    def delete(self, path_or_url: str) -> bool:
        """刪除儲存中的檔案。"""
        try:
            if self.is_gcs:
                return self._delete_gcs(path_or_url)
            else:
                return self._delete_local(path_or_url)
        except Exception as e:
            current_app.logger.error(f'Storage delete error: {e}')
            return False

    def _delete_gcs(self, path_or_url):
        gcs_path = path_or_url
        if path_or_url.startswith('http'):
            gcs_path = path_or_url.split(f'{self.bucket_name}/')[-1]
        blob = self.bucket.blob(gcs_path)
        blob.delete()
        return True

    def _delete_local(self, path_or_url):
        if path_or_url.startswith(self.url_prefix):
            relative_path = path_or_url[len(self.url_prefix):].lstrip('/')
        elif path_or_url.startswith('/'):
            relative_path = path_or_url.lstrip('/')
        else:
            relative_path = path_or_url

        full_path = os.path.abspath(os.path.join(self.base_path, relative_path))

        # Security: ensure path is within base_path
        if not full_path.startswith(os.path.abspath(self.base_path)):
            current_app.logger.warning(f'Path traversal attempt blocked: {path_or_url}')
            return False

        if os.path.exists(full_path):
            os.remove(full_path)
            return True

        current_app.logger.warning(f'File not found for deletion: {full_path}')
        return False

    # -------------------------------------------------------------------------
    # Exists
    # -------------------------------------------------------------------------

    def exists(self, path_or_url: str) -> bool:
        """檢查檔案是否存在。"""
        try:
            if self.is_gcs:
                gcs_path = path_or_url
                if path_or_url.startswith('http'):
                    gcs_path = path_or_url.split(f'{self.bucket_name}/')[-1]
                blob = self.bucket.blob(gcs_path)
                return blob.exists()
            else:
                if path_or_url.startswith(self.url_prefix):
                    relative_path = path_or_url[len(self.url_prefix):].lstrip('/')
                else:
                    relative_path = path_or_url
                full_path = os.path.join(self.base_path, relative_path)
                return os.path.exists(full_path)
        except Exception:
            return False

    # -------------------------------------------------------------------------
    # Local File Serving Helper
    # -------------------------------------------------------------------------

    def get_local_file_path(self, relative_path: str) -> Optional[str]:
        """
        取得本地檔案的完整路徑（僅 Local 模式）。
        用於 Flask send_file / send_from_directory。

        Returns:
            完整檔案路徑，或 None（GCS 模式或檔案不存在）
        """
        if self.is_gcs:
            return None

        full_path = os.path.abspath(os.path.join(self.base_path, relative_path))

        # Security check
        if not full_path.startswith(os.path.abspath(self.base_path)):
            return None

        if os.path.exists(full_path):
            return full_path
        return None


__all__ = ['MediaStorage']
