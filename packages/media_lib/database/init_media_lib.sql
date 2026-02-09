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
    description     TEXT,                   -- 資料夾描述
    thumbnail_id    INTEGER,                -- 資料夾縮圖 (FK 在 files 建立後補加)
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

-- 補加 folders.thumbnail_id 的外鍵約束（因 files 表在 folders 之後建立）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_folders_thumbnail_id'
          AND table_schema = 'media_lib'
    ) THEN
        ALTER TABLE media_lib.folders
            ADD CONSTRAINT fk_folders_thumbnail_id
            FOREIGN KEY (thumbnail_id) REFERENCES media_lib.files(id);
    END IF;
END $$;

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
-- Migration: 為既有資料庫新增 folders.description 和 folders.thumbnail_id
-- 如果是全新安裝則不需要執行（上方 CREATE TABLE 已包含）
-- =============================================================================

-- ALTER TABLE media_lib.folders ADD COLUMN IF NOT EXISTS description TEXT;
-- ALTER TABLE media_lib.folders ADD COLUMN IF NOT EXISTS thumbnail_id INTEGER REFERENCES media_lib.files(id);


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
