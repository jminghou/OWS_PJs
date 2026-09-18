"""
Studio 的狀態常數。沿用 repo 慣例：欄位是 String(20)、值是字串常數，沒有 Python Enum。

內容流程（專案與文件共用同一組 stage）：
    收集 → 整理 → 構思 → 撰寫 → 編輯 → 待發布 → 已發布 → 封存
"""

STAGES = (
    'collect',    # 收集
    'organize',   # 整理
    'ideate',     # 構思
    'write',      # 撰寫
    'edit',       # 編輯
    'scheduled',  # 待發布
    'published',  # 已發布
    'archived',   # 封存
)

PLATFORMS = (
    'blog',
    'facebook',
    'instagram',
    'threads',
    'linkedin',
    'newsletter',
    'video_script',
)

# 部落格文件的正文以 core 的 contents 為正式版；其他平台正文只存在 studio_documents.body
PLATFORMS_BOUND_TO_CONTENT = ('blog',)

CARD_KINDS = (
    'viewpoint',        # 觀點
    'case',             # 案例
    'research',         # 研究資料
    'ziwei',            # 紫微概念
    'brand_principle',  # 品牌原則
)

CARD_STATUSES = ('active', 'archived')

INBOX_KINDS = ('text', 'link', 'image')
INBOX_STATUSES = ('new', 'organized', 'archived')

REVISION_KINDS = ('autosave', 'named', 'published')

# 自動儲存版本每份文件只保留最近 N 筆；命名版本與正式版不修剪
AUTOSAVE_KEEP = 30

# 多型關聯允許的目標型別
CARD_REF_TARGETS = ('project', 'document')
TAG_TARGETS = ('project', 'document', 'card', 'inbox_item')

# 前端「今天」頁的五步流程列 → 專案 stage 的對應（改編 = 專案有 ≥1 個非 blog 文件，不看 stage）。
# 前端 constants.ts 的 FLOW_STEPS 是同一份，E2E 驗證兩邊一致。
FLOW_STEPS = {
    'capture':  ('collect',),
    'organize': ('organize', 'ideate'),
    'write':    ('write', 'edit'),
    'adapt':    (),
    'publish':  ('scheduled', 'published'),
}
