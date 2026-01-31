# Strapi Media Hub

媒體管理系統，用於管理相片、影片等媒體檔案的元資料。

## 快速開始

### 開發模式

```bash
npm run develop
```

### 生產模式

```bash
npm run build
npm run start
```

**首次啟動**：請訪問 `http://localhost:1337/admin` 建立管理員帳號。

---

## 重要：Strapi 5 資料庫同步問題

### 問題描述

在 Railway 等生產環境中，Strapi 5 **不會自動建立**新 Collection Type 的資料表。
即使 schema.json 正確且 Strapi 啟動成功，存取 Content Manager 時會出現：

```
relation "xxx" does not exist
```

### 解決方案

**必須手動建立資料表**。請參考下方的 [資料庫初始化腳本](#資料庫初始化腳本)。

---

## 現有 Collection Types

| Collection | 說明 | 關聯類型 | 資料表 |
|------------|------|----------|--------|
| Tag | 標籤系統 | - | `tags` |
| Category | 分類系統 | - | `categories` |
| MediaMeta | 媒體元資料 | tags: manyToMany, category: manyToMany | `media_metas` |

### MediaMeta Schema 結構

```json
{
  "attributes": {
    "file": { "type": "media", "multiple": false },
    "chartid": { "type": "string", "maxLength": 18 },
    "place": { "type": "string", "maxLength": 255 },
    "tags": { "type": "relation", "relation": "manyToMany", "target": "api::tag.tag" },
    "category": { "type": "relation", "relation": "manyToMany", "target": "api::category.category" },
    "copyright": { "type": "string", "maxLength": 255 },
    "isPublic": { "type": "boolean", "default": false }
  }
}
```

> **注意**：`category` 使用 `manyToMany` 而非 `manyToOne`，這是為了解決 Strapi 5 在 Railway 上的資料庫相容性問題。
> 實際使用時，應在應用層面限制每個 MediaMeta 只關聯一個 Category。

---

## 資料庫初始化腳本

以下 SQL 腳本用於在**全新的 PostgreSQL 資料庫**中建立所有必要的資料表。

> **適用場景**：
> - 在 Railway 建立新的 Strapi 部署
> - 在本機建立與 Railway 相同的開發環境
> - 資料庫重建或遷移

### 完整初始化腳本

```sql
-- ============================================
-- Strapi Media Hub - 資料庫初始化腳本
-- 適用於 Strapi 5 + PostgreSQL
-- ============================================

-- 1. 基礎資料表：Tags
CREATE TABLE IF NOT EXISTS tags (
    id SERIAL PRIMARY KEY,
    document_id VARCHAR(255) UNIQUE,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    published_at TIMESTAMP WITH TIME ZONE,
    created_by_id INTEGER,
    updated_by_id INTEGER,
    locale VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS idx_tags_document_id ON tags(document_id);
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);

-- 2. 基礎資料表：Categories
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    document_id VARCHAR(255) UNIQUE,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    published_at TIMESTAMP WITH TIME ZONE,
    created_by_id INTEGER,
    updated_by_id INTEGER,
    locale VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS idx_categories_document_id ON categories(document_id);
CREATE INDEX IF NOT EXISTS idx_categories_name ON categories(name);

-- 3. 基礎資料表：MediaMetas
CREATE TABLE IF NOT EXISTS media_metas (
    id SERIAL PRIMARY KEY,
    document_id VARCHAR(255) UNIQUE,
    chartid VARCHAR(18),
    place VARCHAR(255),
    copyright VARCHAR(255),
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    published_at TIMESTAMP WITH TIME ZONE,
    created_by_id INTEGER,
    updated_by_id INTEGER,
    locale VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS idx_media_metas_document_id ON media_metas(document_id);
CREATE INDEX IF NOT EXISTS idx_media_metas_chartid ON media_metas(chartid);

-- 4. 關聯表：MediaMetas <-> Tags (manyToMany)
CREATE TABLE IF NOT EXISTS media_metas_tags_lnk (
    id SERIAL PRIMARY KEY,
    media_meta_id INTEGER NOT NULL REFERENCES media_metas(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    media_meta_ord DOUBLE PRECISION DEFAULT 1,
    tag_ord DOUBLE PRECISION DEFAULT 1,
    UNIQUE(media_meta_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_media_metas_tags_lnk_fk ON media_metas_tags_lnk(media_meta_id);
CREATE INDEX IF NOT EXISTS idx_media_metas_tags_lnk_inv_fk ON media_metas_tags_lnk(tag_id);
CREATE INDEX IF NOT EXISTS idx_media_metas_tags_lnk_media_meta_id ON media_metas_tags_lnk(media_meta_id);
CREATE INDEX IF NOT EXISTS idx_media_metas_tags_lnk_tag_id ON media_metas_tags_lnk(tag_id);
CREATE INDEX IF NOT EXISTS idx_media_metas_tags_lnk_ord ON media_metas_tags_lnk(media_meta_ord);

-- 5. 關聯表：MediaMetas <-> Categories (manyToMany)
CREATE TABLE IF NOT EXISTS media_metas_category_lnk (
    id SERIAL PRIMARY KEY,
    media_meta_id INTEGER NOT NULL REFERENCES media_metas(id) ON DELETE CASCADE,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    media_meta_ord DOUBLE PRECISION DEFAULT 1,
    category_ord DOUBLE PRECISION DEFAULT 1,
    UNIQUE(media_meta_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_media_metas_category_lnk_fk ON media_metas_category_lnk(media_meta_id);
CREATE INDEX IF NOT EXISTS idx_media_metas_category_lnk_inv_fk ON media_metas_category_lnk(category_id);
CREATE INDEX IF NOT EXISTS idx_media_metas_category_lnk_media_meta_id ON media_metas_category_lnk(media_meta_id);
CREATE INDEX IF NOT EXISTS idx_media_metas_category_lnk_category_id ON media_metas_category_lnk(category_id);
CREATE INDEX IF NOT EXISTS idx_media_metas_category_lnk_ord ON media_metas_category_lnk(media_meta_ord);

-- 6. 媒體檔案關聯（Strapi 使用 morphic 關聯）
-- files 和 files_related_mph 表由 Strapi 自動建立
-- 但如果需要手動建立，可使用以下結構：

-- CREATE TABLE IF NOT EXISTS files (
--     id SERIAL PRIMARY KEY,
--     document_id VARCHAR(255) UNIQUE,
--     name VARCHAR(255),
--     alternative_text VARCHAR(255),
--     caption VARCHAR(255),
--     width INTEGER,
--     height INTEGER,
--     formats JSONB,
--     hash VARCHAR(255),
--     ext VARCHAR(255),
--     mime VARCHAR(255),
--     size DECIMAL(10,2),
--     url VARCHAR(255),
--     preview_url VARCHAR(255),
--     provider VARCHAR(255),
--     provider_metadata JSONB,
--     folder_path VARCHAR(255),
--     created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
--     updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
--     published_at TIMESTAMP WITH TIME ZONE,
--     created_by_id INTEGER,
--     updated_by_id INTEGER,
--     locale VARCHAR(255)
-- );

-- CREATE TABLE IF NOT EXISTS files_related_mph (
--     id SERIAL PRIMARY KEY,
--     file_id INTEGER REFERENCES files(id) ON DELETE CASCADE,
--     related_id INTEGER,
--     related_type VARCHAR(255),
--     field VARCHAR(255),
--     "order" DOUBLE PRECISION
-- );

-- ============================================
-- 完成！請重啟 Strapi 以載入新的資料表結構
-- ============================================
```

### 清除 Strapi Schema 快取

如果 Strapi 仍然無法識別資料表，執行以下 SQL：

```sql
-- 清除所有 Content Types 相關快取
DELETE FROM strapi_core_store_settings
WHERE key LIKE '%content_types%'
   OR key LIKE '%schema%'
   OR key LIKE '%media-meta%'
   OR key LIKE '%tag%'
   OR key LIKE '%category%';
```

---

## 修改 Content Types（手動編輯 Schema）

由於本專案的 Strapi 以生產模式運行，無法在 Admin 介面修改 Content Types。
請透過手動編輯 Schema JSON 文件來修改資料結構。

### 步驟 1：找到 Schema 文件

```
src/api/[collection-name]/content-types/[collection-name]/schema.json
```

### 步驟 2：編輯 Schema

**新增 Collection Type**：在 `src/api/` 下建立新資料夾結構：

```
src/api/article/
├── content-types/
│   └── article/
│       └── schema.json
├── controllers/
│   └── article.js
├── routes/
│   └── article.js
└── services/
    └── article.js
```

**controller、routes、services 範例**（最小配置）：

```javascript
// controllers/article.js
'use strict';
const { createCoreController } = require('@strapi/strapi').factories;
module.exports = createCoreController('api::article.article');

// services/article.js
'use strict';
const { createCoreService } = require('@strapi/strapi').factories;
module.exports = createCoreService('api::article.article');

// routes/article.js
'use strict';
const { createCoreRouter } = require('@strapi/strapi').factories;
module.exports = createCoreRouter('api::article.article');
```

### 步驟 3：建立資料表並重新部署

1. **手動建立資料表**（參考上方 SQL 範例）
2. **Commit 並 Push**：
   ```bash
   git add .
   git commit -m "feat: add new collection type"
   git push
   ```
3. **清除 Strapi 快取**（如需要）

---

## Strapi 5 Link Table 命名規則

Strapi 5 對所有關聯類型都使用 link table，命名規則如下：

| 關聯類型 | Link Table 命名 | 欄位結構 |
|----------|-----------------|----------|
| manyToMany | `{source}_lnk` | `{source_singular}_id`, `{target_singular}_id`, `{source_singular}_ord`, `{target_singular}_ord` |
| manyToOne | `{source}_{field}_lnk` | 同上 |
| oneToMany | 由反向關聯的 manyToOne 建立 | - |

**範例**：
- `media_metas` 的 `tags` 欄位 → `media_metas_tags_lnk`
- `media_metas` 的 `category` 欄位 → `media_metas_category_lnk`

---

## 常用欄位類型參考

| Schema 類型 | PostgreSQL 類型 | 說明 |
|-------------|-----------------|------|
| `string` | `VARCHAR(255)` | 短文字 |
| `text` | `TEXT` | 長文字 |
| `richtext` | `TEXT` | 富文本 |
| `integer` | `INTEGER` | 整數 |
| `boolean` | `BOOLEAN` | 布林值 |
| `date` | `DATE` | 日期 |
| `datetime` | `TIMESTAMP WITH TIME ZONE` | 日期時間 |
| `json` | `JSONB` | JSON 物件 |
| `enumeration` | `VARCHAR(255)` | 列舉 |
| `media` | 透過 `files_related_mph` 關聯 | 媒體檔案 |
| `relation` | 透過 `*_lnk` 表關聯 | 關聯 |

---

## 相關資源

- [Strapi 官方文件](https://docs.strapi.io)
- [Strapi CLI 指令](https://docs.strapi.io/dev-docs/cli)
- [部署指南](https://docs.strapi.io/dev-docs/deployment)
