"""Facebook 粉專發文的核查清單。純資料，判斷在 checks.py。"""

# 粉專貼文上限（與前端 platforms.facebook.maxChars 相同）。
MESSAGE_MAX_CHARS = 63206

IMAGE_MAX_BYTES = 10 * 1024 * 1024
PNG_WARN_BYTES = 1 * 1024 * 1024
IMAGE_MAX_COUNT = 10
IMAGE_MIN_WIDTH = 600
IMAGE_MAX_RATIO = 1.91
IMAGE_MIN_RATIO = 4 / 5

ALLOWED_IMAGE_MIMES = frozenset({
    'image/jpeg',
    'image/jpg',
    'image/pjpeg',
    'image/png',
    'image/gif',
    'image/bmp',
    'image/x-ms-bmp',
    'image/tiff',
    'image/tif',
})

BRAND_NAME = '親紫之間'

# 簡體與已知誤植。出現就 block，即使同一則也寫了正確的「親紫之間」。
BRAND_TYPOS = (
    '亲紫之间',
    '親紫之閒',
    '親紫之問',
    '親紫之簡',
    '親子之間',
    '亲紫之間',
    '親紫之间',
)

# 焦慮行銷詞。待 Lemon/Berry 定稿；以下只是示意，命中即 block，不是正式品牌清單。
ANXIETY_MARKETING_TERMS = (
    '再不看就來不及',
    '你一定會後悔',
    '最後機會錯失就沒了',
)

POLARIS_DOMAIN = 'polaris-parent.com'

HTTP_TIMEOUT_SECONDS = 5
HTTP_MAX_REDIRECTS = 3

# 每條規則都會進 check_report，方便正反例與畫面逐條顯示。
RULES = (
    'message_length',
    'message_or_link',
    'image_format',
    'image_size',
    'png_size',
    'image_dimensions',
    'image_count',
    'image_reachable',
    'link_reachable',
    'link_domain',
    'brand_name',
    'brand_typo',
    'anxiety_marketing',
    'pii_tw_id',
    'pii_phone',
    'pii_email',
    'pii_order',
    'pii_birthdate',
    'page_mention',
)
