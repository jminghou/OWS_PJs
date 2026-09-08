"""
共用平台鏈（core/migrations）管理的資料表清單。

## 為什麼是明確清單，而不是自動推導

站台的 migrations/env.py 需要知道「哪些表歸 core 鏈管」，才能把它們排除在
站台鏈的 autogenerate 之外 —— 否則改一個 core 模型欄位時，migration 會被產在
站台鏈裡，那正是 P5-C 要消滅的情況（每站各寫一份、各自漂移）。

想從 `db.metadata` 自動推導行不通：env.py 執行時站台的 models 早就 import 進同一份
metadata 了，推導出來的集合會**連站台自己的表一起排除**，站台鏈就再也產不出任何
migration，而且是靜默失效。

所以列成清單，並用 `verify_manifest()` 在 CI 檢查它沒有過期 —— 新增 core 模型時
清單會對不上而失敗，那正是提醒你「這張表的 migration 該寫在 core 鏈」的時機。
"""

from __future__ import annotations

# core/backend_engine/models.py 定義的表
CORE_TABLES = frozenset({
    'activity_logs',
    'categories',
    'comments',
    'content_tags',
    'contents',
    'homepage_settings',
    'homepage_slides',
    'menu_items',
    'menus',
    'orders',
    'payment_methods',
    'permissions',
    'product_prices',
    'product_tags',
    'products',
    'role_permissions',
    'roles',
    'settings',
    'submissions',
    'tags',
    'user_roles',
    'users',
})

# packages/media_lib 定義的表（media_lib schema）
MEDIA_LIB_TABLES = frozenset({
    'files',
    'folders',
    'tags',            # media_lib.tags，與 blog.tags 同名不同 schema
    'file_metadata',
    'file_tags',
    'file_variants',
})

PLATFORM_TABLES = CORE_TABLES | MEDIA_LIB_TABLES


def actual_platform_tables() -> set[str]:
    """實際由 core + media_lib 定義的表名。

    **只能在乾淨的行程裡呼叫** —— 一旦站台的 models 被 import 進同一份 metadata，
    結果就會混入站台的表。verify_manifest() 由 CI 在子行程中執行。
    """
    from core.backend_engine.factory import db
    import core.backend_engine.models  # noqa: F401
    import packages.media_lib.models   # noqa: F401

    return {table.name for table in db.metadata.tables.values()}


def verify_manifest() -> tuple[bool, str]:
    """檢查清單是否與實際定義相符。回 (是否相符, 說明)。"""
    actual = actual_platform_tables()
    missing = actual - PLATFORM_TABLES
    stale = PLATFORM_TABLES - actual

    if not missing and not stale:
        return True, f"清單相符（{len(PLATFORM_TABLES)} 張平台表）"

    lines = []
    if missing:
        lines.append(
            "以下平台表不在清單裡 —— 它們的 migration 該寫在 core 鏈，"
            "請把表名加進 PLATFORM_TABLES：\n    " + ", ".join(sorted(missing))
        )
    if stale:
        lines.append(
            "以下表在清單裡但已不存在，請從 PLATFORM_TABLES 移除：\n    "
            + ", ".join(sorted(stale))
        )
    return False, "\n".join(lines)
