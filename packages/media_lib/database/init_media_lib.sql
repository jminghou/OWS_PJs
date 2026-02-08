-- =============================================================================
-- Media Library - Database Schema Initialization Script
-- =============================================================================
-- 用途: 建立或重建 media_lib schema 及所有資料表
--
-- 使用方式:
--   psql -U postgres -d ows_polaris -f init_media_lib.sql
--   或在 pgAdmin 中直接執行
--
-- 注意: 此腳本會先 DROP 再重建，會清除所有媒體庫資料！
--       如只需要建立（不刪除），請忽略 DROP 部分。
-- =============================================================================

-- 建立 schema（如果不存在）
CREATE SCHEMA IF NOT EXISTS media_lib;

-- =============================================================================
-- 1. folders - 資料夾階層
-- =============================================================================
CREATE TABLE IF NOT EXISTS media_lib.folders (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    parent_id       INTEGER REFERENCES media_lib.folders(id),
    path            VARCHAR(500) NOT NULL,
    created_by      INTEGER REFERENCES public.users(id) DEFERRABLE,
    created_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT (NOW() AT TIME ZONE 'utc'),
    updated_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT (NOW() AT TIME ZONE 'utc')
);

CREATE INDEX IF NOT EXISTS ix_ml_folders_path
    ON media_lib.folders (path);

-- =============================================================================
-- 2. files - 媒體檔案主表
-- =============================================================================
CREATE TABLE IF NOT EXISTS media_lib.files (
    id                  SERIAL PRIMARY KEY,
    filename            VARCHAR(255) NOT NULL,
    original_filename   VARCHAR(255) NOT NULL,
    gcs_path            VARCHAR(500) NOT NULL,
    public_url          VARCHAR(700) NOT NULL,
    file_size           INTEGER,
    mime_type           VARCHAR(100),
    width               INTEGER,
    height              INTEGER,
    alt_text            VARCHAR(500),
    caption             TEXT,
    folder_id           INTEGER REFERENCES media_lib.folders(id),
    uploaded_by         INTEGER REFERENCES public.users(id) DEFERRABLE,
    attributes          JSONB DEFAULT '{}',
    created_at          TIMESTAMP WITHOUT TIME ZONE DEFAULT (NOW() AT TIME ZONE 'utc'),
    updated_at          TIMESTAMP WITHOUT TIME ZONE DEFAULT (NOW() AT TIME ZONE 'utc')
);

CREATE INDEX IF NOT EXISTS ix_ml_files_gcs_path
    ON media_lib.files (gcs_path);

-- =============================================================================
-- 3. file_variants - 圖片尺寸變體 (thumbnail, small, medium, large)
-- =============================================================================
CREATE TABLE IF NOT EXISTS media_lib.file_variants (
    id              SERIAL PRIMARY KEY,
    file_id         INTEGER NOT NULL REFERENCES media_lib.files(id) ON DELETE CASCADE,
    variant_type    VARCHAR(20) NOT NULL,  -- thumbnail, small, medium, large
    gcs_path        VARCHAR(500) NOT NULL,
    public_url      VARCHAR(700) NOT NULL,
    width           INTEGER,
    height          INTEGER,
    file_size       INTEGER
);

CREATE INDEX IF NOT EXISTS ix_ml_file_variants_file_id
    ON media_lib.file_variants (file_id);

-- =============================================================================
-- 4. tags - 標籤
-- =============================================================================
CREATE TABLE IF NOT EXISTS media_lib.tags (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(100) NOT NULL UNIQUE,
    slug            VARCHAR(100) NOT NULL UNIQUE,
    color           VARCHAR(7) DEFAULT '#6366f1',
    created_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT (NOW() AT TIME ZONE 'utc')
);

CREATE INDEX IF NOT EXISTS ix_ml_tags_slug
    ON media_lib.tags (slug);

-- =============================================================================
-- 5. file_tags - 檔案與標籤的多對多關聯
-- =============================================================================
CREATE TABLE IF NOT EXISTS media_lib.file_tags (
    file_id     INTEGER NOT NULL REFERENCES media_lib.files(id) ON DELETE CASCADE,
    tag_id      INTEGER NOT NULL REFERENCES media_lib.tags(id) ON DELETE CASCADE,
    PRIMARY KEY (file_id, tag_id)
);


-- =============================================================================
-- 6. file_metadata - 圖檔結構化 Metadata（1:1 對應 files）
-- =============================================================================
CREATE TABLE IF NOT EXISTS media_lib.file_metadata (
    id              SERIAL PRIMARY KEY,
    file_id         INTEGER NOT NULL UNIQUE REFERENCES media_lib.files(id) ON DELETE CASCADE,
    chart_id        VARCHAR(100),           -- 命盤ID（外部系統引用 key）
    location        VARCHAR(255),           -- 地點
    rating          SMALLINT,               -- 評級 1-5
    status          VARCHAR(20) DEFAULT 'draft',  -- 狀態: draft/published/archived
    source          VARCHAR(255),           -- 來源
    license         VARCHAR(100),           -- 授權
    notes           TEXT,                   -- 備註
    created_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT (NOW() AT TIME ZONE 'utc'),
    updated_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT (NOW() AT TIME ZONE 'utc')
);

CREATE INDEX IF NOT EXISTS ix_ml_file_metadata_file_id
    ON media_lib.file_metadata (file_id);

CREATE INDEX IF NOT EXISTS ix_ml_file_metadata_chart_id
    ON media_lib.file_metadata (chart_id);


-- =============================================================================
-- 完整重建用 (危險! 會刪除所有資料)
-- 如需要先清除再重建，取消下方註解後執行
-- =============================================================================

-- DROP TABLE IF EXISTS media_lib.file_metadata CASCADE;
-- DROP TABLE IF EXISTS media_lib.file_tags CASCADE;
-- DROP TABLE IF EXISTS media_lib.file_variants CASCADE;
-- DROP TABLE IF EXISTS media_lib.files CASCADE;
-- DROP TABLE IF EXISTS media_lib.folders CASCADE;
-- DROP TABLE IF EXISTS media_lib.tags CASCADE;
-- DROP SCHEMA IF EXISTS media_lib CASCADE;

-- 然後重新執行上面的 CREATE 語句


-- =============================================================================
-- 資料表總覽
-- =============================================================================
-- media_lib.folders        資料夾 (支援巢狀, parent_id 自引用)
-- media_lib.files          媒體檔案 (對應 GCS 上的物件)
-- media_lib.file_variants  圖片變體 (每張圖自動產生 4 種尺寸)
-- media_lib.tags           標籤分類
-- media_lib.file_tags      檔案-標籤 多對多關聯
-- media_lib.file_metadata  圖檔 Metadata（命盤ID/地點/評級/狀態/來源/授權/備註）
--
-- 變體尺寸規格:
--   thumbnail: 245x245, quality 80
--   small:     500x500, quality 85
--   medium:    750x750, quality 85
--   large:    1000x1000, quality 90
-- =============================================================================
