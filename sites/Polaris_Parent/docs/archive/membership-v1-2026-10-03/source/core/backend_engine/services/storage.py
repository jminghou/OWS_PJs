"""
OWS Core Engine - Storage Service

Provides an abstraction layer for file storage operations.
Supports LOCAL filesystem and Google Cloud Storage (GCS) backends.

Usage:
    # In application context
    storage = StorageService.get_instance()
    url, filename = storage.upload(file, 'image.png')
    storage.delete(url)

Configuration:
    USE_GCS=true/false
    GCS_BUCKET_NAME=your-bucket-name
    GCS_CREDENTIALS_JSON=/path/to/credentials.json (optional)
"""

import os
import uuid
from abc import ABC, abstractmethod
from typing import Tuple, Optional, BinaryIO

from werkzeug.utils import secure_filename
from flask import current_app


# =============================================================================
# Abstract Base Class
# =============================================================================

class StorageBackend(ABC):
    """Abstract base class for storage backends."""

    @abstractmethod
    def upload(
        self,
        file: BinaryIO,
        filename: str,
        folder: str = 'media',
        content_type: Optional[str] = None
    ) -> Tuple[str, str]:
        """
        Upload a file to storage.

        Args:
            file: File-like object to upload
            filename: Original filename
            folder: Destination folder/prefix
            content_type: MIME type of the file

        Returns:
            Tuple of (public_url_or_path, stored_filename)
        """
        pass

    @abstractmethod
    def delete(self, file_path_or_url: str) -> bool:
        """
        Delete a file from storage.

        Args:
            file_path_or_url: The file path or URL to delete

        Returns:
            True if deletion was successful, False otherwise
        """
        pass

    @abstractmethod
    def exists(self, file_path_or_url: str) -> bool:
        """Check if a file exists in storage."""
        pass

    @abstractmethod
    def get_url(self, file_path: str) -> str:
        """Get the public URL for a file path."""
        pass


# =============================================================================
# Local Storage Backend
# =============================================================================

class LocalStorageBackend(StorageBackend):
    """Local filesystem storage backend."""

    def __init__(self, base_path: str, url_prefix: str = '/uploads'):
        """
        Initialize local storage.

        Args:
            base_path: Absolute path to the uploads directory
            url_prefix: URL prefix for serving files
        """
        self.base_path = os.path.abspath(base_path)
        self.url_prefix = url_prefix

    def upload(
        self,
        file: BinaryIO,
        filename: str,
        folder: str = 'media',
        content_type: Optional[str] = None
    ) -> Tuple[str, str]:
        """Upload a file to local filesystem."""
        # Generate unique filename
        safe_filename = secure_filename(filename)
        unique_filename = f"{uuid.uuid4().hex}_{safe_filename}"

        # Ensure directory exists
        target_dir = os.path.join(self.base_path, folder)
        os.makedirs(target_dir, exist_ok=True)

        # Save file
        file_path = os.path.join(target_dir, unique_filename)

        # Handle both file objects and werkzeug FileStorage
        if hasattr(file, 'save'):
            file.save(file_path)
        else:
            with open(file_path, 'wb') as f:
                file.seek(0)
                f.write(file.read())

        # Return URL and filename
        url = f"{self.url_prefix}/{folder}/{unique_filename}"
        return url, unique_filename

    def delete(self, file_path_or_url: str) -> bool:
        """Delete a file from local filesystem."""
        try:
            # Convert URL to filesystem path if needed
            if file_path_or_url.startswith(self.url_prefix):
                relative_path = file_path_or_url[len(self.url_prefix):].lstrip('/')
                full_path = os.path.join(self.base_path, relative_path)
            elif file_path_or_url.startswith('/'):
                # Absolute path
                full_path = file_path_or_url
            else:
                # Relative path
                full_path = os.path.join(self.base_path, file_path_or_url)

            # Security check: ensure path is within base_path
            full_path = os.path.abspath(full_path)
            if not full_path.startswith(self.base_path):
                current_app.logger.warning(f"Attempted path traversal: {file_path_or_url}")
                return False

            if os.path.exists(full_path):
                os.remove(full_path)
                current_app.logger.info(f"Deleted file: {full_path}")
                return True

            current_app.logger.warning(f"File not found for deletion: {full_path}")
            return False

        except Exception as e:
            current_app.logger.error(f"Local delete error: {e}")
            return False

    def exists(self, file_path_or_url: str) -> bool:
        """Check if a file exists locally."""
        if file_path_or_url.startswith(self.url_prefix):
            relative_path = file_path_or_url[len(self.url_prefix):].lstrip('/')
            full_path = os.path.join(self.base_path, relative_path)
        else:
            full_path = os.path.join(self.base_path, file_path_or_url)

        return os.path.exists(full_path)

    def get_url(self, file_path: str) -> str:
        """Get the URL for a file path."""
        if file_path.startswith(self.url_prefix):
            return file_path
        if file_path.startswith('http'):
            return file_path
        return f"{self.url_prefix}/{file_path.lstrip('/')}"


# =============================================================================
# Google Cloud Storage Backend
# =============================================================================

class GCSStorageBackend(StorageBackend):
    """Google Cloud Storage backend."""

    def __init__(
        self,
        bucket_name: str,
        credentials_path: Optional[str] = None,
        public_url_prefix: Optional[str] = None
    ):
        """
        Initialize GCS storage.

        Args:
            bucket_name: GCS bucket name
            credentials_path: Path to service account JSON (optional)
            public_url_prefix: Custom public URL prefix (optional)
        """
        from google.cloud import storage

        self.bucket_name = bucket_name
        self.public_url_prefix = (
            public_url_prefix or
            f"https://storage.googleapis.com/{bucket_name}"
        )

        if credentials_path:
            self.client = storage.Client.from_service_account_json(credentials_path)
        else:
            # Use default credentials (e.g., from environment)
            self.client = storage.Client()

        self.bucket = self.client.bucket(bucket_name)

    def upload(
        self,
        file: BinaryIO,
        filename: str,
        folder: str = 'media',
        content_type: Optional[str] = None
    ) -> Tuple[str, str]:
        """Upload a file to GCS."""
        safe_filename = secure_filename(filename)
        unique_filename = f"{uuid.uuid4().hex}_{safe_filename}"
        blob_name = f"{folder}/{unique_filename}"

        blob = self.bucket.blob(blob_name)

        # Reset file position if needed
        if hasattr(file, 'seek'):
            file.seek(0)

        # Determine content type
        if content_type is None and hasattr(file, 'content_type'):
            content_type = file.content_type

        # Upload
        if hasattr(file, 'read'):
            blob.upload_from_file(file, content_type=content_type)
        else:
            blob.upload_from_filename(file, content_type=content_type)

        url = f"{self.public_url_prefix}/{blob_name}"
        current_app.logger.info(f"Uploaded to GCS: {url}")
        return url, unique_filename

    def delete(self, file_path_or_url: str) -> bool:
        """Delete a file from GCS."""
        try:
            # Extract blob name from URL
            if self.public_url_prefix in file_path_or_url:
                blob_name = file_path_or_url.replace(f"{self.public_url_prefix}/", "")
            elif f"storage.googleapis.com/{self.bucket_name}/" in file_path_or_url:
                blob_name = file_path_or_url.split(f"{self.bucket_name}/")[-1]
            else:
                blob_name = file_path_or_url

            blob = self.bucket.blob(blob_name)
            blob.delete()
            current_app.logger.info(f"Deleted from GCS: {blob_name}")
            return True

        except Exception as e:
            current_app.logger.error(f"GCS delete error: {e}")
            return False

    def exists(self, file_path_or_url: str) -> bool:
        """Check if a file exists in GCS."""
        try:
            if self.public_url_prefix in file_path_or_url:
                blob_name = file_path_or_url.replace(f"{self.public_url_prefix}/", "")
            elif f"storage.googleapis.com/{self.bucket_name}/" in file_path_or_url:
                blob_name = file_path_or_url.split(f"{self.bucket_name}/")[-1]
            else:
                blob_name = file_path_or_url

            blob = self.bucket.blob(blob_name)
            return blob.exists()

        except Exception:
            return False

    def get_url(self, file_path: str) -> str:
        """Get the public URL for a file."""
        if file_path.startswith('http'):
            return file_path
        return f"{self.public_url_prefix}/{file_path.lstrip('/')}"


# =============================================================================
# Storage Service (Singleton)
# =============================================================================

class StorageService:
    """
    Storage service that provides unified access to storage backends.

    Uses singleton pattern to ensure consistent backend across the application.

    Usage:
        # In application context
        storage = StorageService.get_instance()
        url, filename = storage.upload(file, 'image.png')
    """

    _instance: Optional['StorageService'] = None

    def __init__(self, backend: StorageBackend):
        self.backend = backend

    @classmethod
    def get_instance(cls) -> 'StorageService':
        """Get the singleton storage service instance."""
        if cls._instance is None:
            cls._instance = cls._create_from_config()
        return cls._instance

    @classmethod
    def _create_from_config(cls) -> 'StorageService':
        """Create storage service based on app configuration."""
        use_gcs = current_app.config.get('USE_GCS', False)

        if use_gcs:
            bucket_name = current_app.config.get('GCS_BUCKET_NAME')
            credentials_path = current_app.config.get('GCS_CREDENTIALS_JSON')

            if not bucket_name:
                raise ValueError("GCS_BUCKET_NAME is required when USE_GCS is True")

            backend = GCSStorageBackend(
                bucket_name=bucket_name,
                credentials_path=credentials_path
            )
            current_app.logger.info(f"StorageService initialized with GCS backend (bucket: {bucket_name})")
        else:
            # Determine base path for local storage
            uploads_folder = current_app.config.get('UPLOAD_FOLDER', 'uploads')
            if os.path.isabs(uploads_folder):
                base_path = uploads_folder
            else:
                base_path = os.path.abspath(
                    os.path.join(current_app.root_path, '..', uploads_folder)
                )

            backend = LocalStorageBackend(base_path=base_path)
            current_app.logger.info(f"StorageService initialized with Local backend (path: {base_path})")

        return cls(backend)

    @classmethod
    def reset_instance(cls):
        """Reset the singleton instance (useful for testing)."""
        cls._instance = None

    def upload(
        self,
        file: BinaryIO,
        filename: str,
        folder: str = 'media',
        content_type: Optional[str] = None
    ) -> Tuple[str, str]:
        """Upload a file and return (url, stored_filename)."""
        return self.backend.upload(file, filename, folder, content_type)

    def delete(self, file_path_or_url: str) -> bool:
        """Delete a file from storage."""
        return self.backend.delete(file_path_or_url)

    def exists(self, file_path_or_url: str) -> bool:
        """Check if a file exists."""
        return self.backend.exists(file_path_or_url)

    def get_url(self, file_path: str) -> str:
        """Get the public URL for a file."""
        return self.backend.get_url(file_path)


# =============================================================================
# Convenience Functions (Backward Compatibility)
# =============================================================================

def upload_file(file: BinaryIO, folder: str = 'media') -> Tuple[str, str]:
    """
    Upload a file to storage.

    This function provides backward compatibility with the existing codebase.

    Args:
        file: File-like object (e.g., werkzeug FileStorage)
        folder: Destination folder

    Returns:
        Tuple of (url, stored_filename)
    """
    storage = StorageService.get_instance()
    filename = getattr(file, 'filename', 'unknown')
    content_type = getattr(file, 'content_type', None)
    return storage.upload(file, filename, folder, content_type)


def delete_file(file_url_or_path: str) -> bool:
    """
    Delete a file from storage.

    This function provides backward compatibility with the existing codebase.

    Args:
        file_url_or_path: The file URL or path to delete

    Returns:
        True if deletion was successful
    """
    storage = StorageService.get_instance()
    return storage.delete(file_url_or_path)


# =============================================================================
# Exports
# =============================================================================

__all__ = [
    'StorageBackend',
    'LocalStorageBackend',
    'GCSStorageBackend',
    'StorageService',
    'upload_file',
    'delete_file',
]
