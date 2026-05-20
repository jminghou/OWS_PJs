"""
Media Library - Configuration

定義媒體庫的預設設定和圖片變體規格。
"""

# PostgreSQL Schema 名稱
SCHEMA_NAME = 'media_lib'

# 圖片變體規格
IMAGE_VARIANTS = {
    'thumbnail': {'max_width': 60, 'max_height': 60, 'quality': 80},
    'small':     {'max_width': 180, 'max_height': 180, 'quality': 85},
    'medium':    {'max_width': 600, 'max_height': 600, 'quality': 85},
    'large':     {'max_width': 1280, 'max_height': 1280, 'quality': 90},
    'hero':      {'max_width': 1920, 'max_height': 1080, 'quality': 90},
}

# 支援的圖片 MIME types（只有這些會產生變體）
SUPPORTED_IMAGE_TYPES = {
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
}

# GCS 路徑前綴
GCS_BASE_PATH = 'media'

# 上傳限制
MAX_FILE_SIZE = 16 * 1024 * 1024  # 16MB

# 副檔名 allowlist。注意：
# - 不包含 svg（XSS 風險：SVG 可內嵌 <script>。日後若要支援需 server-side sanitize）
# - 不包含 html/htm/js/exe 等可執行型副檔名
ALLOWED_EXTENSIONS = {
    'png', 'jpg', 'jpeg', 'gif', 'webp',
    'pdf', 'doc', 'docx', 'txt',
    'mp4', 'mov', 'avi',
}

# 副檔名 → 允許的 MIME types 對照表（雙重防線：擋掉副檔名與 MIME 不一致的偽裝檔案）
ALLOWED_MIME_TYPES = {
    'png':  {'image/png'},
    'jpg':  {'image/jpeg'},
    'jpeg': {'image/jpeg'},
    'gif':  {'image/gif'},
    'webp': {'image/webp'},
    'pdf':  {'application/pdf'},
    'doc':  {'application/msword'},
    'docx': {'application/vnd.openxmlformats-officedocument.wordprocessingml.document'},
    'txt':  {'text/plain'},
    'mp4':  {'video/mp4'},
    'mov':  {'video/quicktime'},
    'avi':  {'video/x-msvideo', 'video/avi'},
}
