"""Studio 模組管理的資料表清單（對應 packages/studio/migrations）。

鏈頭是 0005_studio_publish_requests，down_revision 為 0004_studio_derivation。
"""
STUDIO_TABLES = frozenset({
    'studio_projects',
    'studio_documents',
    'studio_revisions',
    'studio_cards',
    'studio_card_refs',
    'studio_card_links',
    'studio_inbox_items',
    'studio_sources',
    'studio_tags',
    'studio_taggings',
    'studio_document_media',
    'studio_publish_requests',
    'studio_publish_events',
})
