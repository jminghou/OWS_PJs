"""
Media Library - Configuration

定義媒體庫的預設設定和圖片變體規格。
"""

# PostgreSQL Schema 名稱
SCHEMA_NAME = 'media_lib'

# 圖片變體規格（參考 Strapi）
IMAGE_VARIANTS = {
    'thumbnail': {'max_width': 200, 'max_height': 200, 'quality': 80},
    'small':     {'max_width': 450, 'max_height': 450, 'quality': 85},
    'medium':    {'max_width': 800, 'max_height': 800, 'quality': 85},
    'large':     {'max_width': 1920, 'max_height': 1080, 'quality': 90},
}

# 支援的圖片 MIME types（只有這些會產生變體）
SUPPORTED_IMAGE_TYPES = {
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
}

# GCS 路徑前綴
GCS_BASE_PATH = 'media'

# 上傳限制
MAX_FILE_SIZE = 16 * 1024 * 1024  # 16MB
ALLOWED_EXTENSIONS = {
    'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg',
    'pdf', 'doc', 'docx', 'txt',
    'mp4', 'mov', 'avi',
}
