# 統一資料庫架構規劃：部落格 × 紫微命盤系統

> 狀態：規劃（待施工）　|　最後更新：2026-06-06
> 範圍：跨兩個 repo —— 部落格 `d:\PJ_Projects\OWS_PJs`（Flask）與紫微系統 `d:\P_Polaris_Parent\1_run\PolarisUI`（FastAPI）

---

## 1. 背景與目標

部落格官網（`ows_polaris`）原本只為「管理文章」設計，沒有會員系統。現在要：

1. 開放公眾**註冊會員、管理自己的訂單**。
2. 把「人 / 會員 / 命主」資料**統合到紫微系統的資料庫**（`db_pcount_v3` 的 `account` schema 已是成熟的「人 + 命盤」中心）。
3. 核心新功能：**線上排盤後一鍵建檔 + 註冊**——使用者輸入生辰算出命盤，按一個按鈕即把命盤存入資料庫並完成低摩擦會員註冊。

**最終結論：合併成單一資料庫 `db_pcount_v3`，以 schema 分流。** 因為部落格目前**尚無任何資料**，現在是遷移成本最低的時機。

---

## 2. 決策摘要（已與需求方確認）

| # | 決策 |
|---|---|
| 1 | **單一資料庫** `db_pcount_v3`，用 schema（`account` / `graph` / `blog` / `shop`）內部切割 |
| 2 | `ows_polaris` 搬上 Railway，與 `db_pcount_v3` 併入同一個 Postgres 實例 |
| 3 | **同一個人**：會員＝命主背後是同一筆身分，住在 `account.app_users` |
| 4 | **各自獨立登入**：兩站各有登入頁、各發各的 token，但驗同一份 `app_users` |
| 5 | 一鍵建檔當下**收 email**；未來支援第三方登入（Google/LINE） |
| 6 | **部落格 RBAC 改用紫微 `app_users` 的 `role` + `permissions` JSONB**，淘汰部落格自有的 `roles`/`permissions`/`role_permissions`/`user_roles` 四表 |
| 7 | **先做「地基」**（連線改向 + schema 化 + 修 migration），趁零資料零風險 |
| 8 | **開發守則：每次 schema/migration 變更一律先在本機驗證通過，才推上 Railway 正式庫** |

---

## 3. 目標架構

### 3.1 單庫四 schema

```
                ┌──────────────── db_pcount_v3（單一 Railway Postgres）────────────────┐
                │                                                                        │
 部落格 (Flask) │  blog schema   : contents, categories, comments, tags, menus,         │
  排盤/文章/訂單 │                  settings, homepage_*, activity_logs, submissions       │
        │       │  shop schema   : products, product_prices, orders, payment_methods     │
        │ ①一鍵建檔                                  │ shop.orders.member_id ─FK─┐        │
        │ POST → 紫微 API ──寫──►                     ▼                          ▼        │
 紫微 (FastAPI) │  account schema: app_users(會員/身分), users(命主),                     │
  排盤/分析/身分源頭                  user_chart_raw / user_*_codes / user_profiles …      │
                │  graph schema  : graph_analysis, graph_vectors, graph_reports …         │
                └────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Schema 擁有權（誰能寫）

| schema | 內容 | 寫入擁有者 |
|--------|------|-----------|
| `account` | 會員/身分、命主、命盤原始資料 | **紫微後端**（既有，唯一寫入者） |
| `graph` | 命理圖譜分析 | 紫微後端（既有） |
| `blog` | 文章、分類、留言、選單、設定、提問 | **部落格後端** |
| `shop` | 產品、訂單、付款設定 | 部落格後端 |

**鐵則**：`account` 只能由紫微後端寫。部落格要建會員 / 存命盤 → **一律呼叫紫微 API**，不直接寫 `account`。

### 3.3 跨 schema 連通（真外鍵）

- `shop.orders.member_id` → `account.app_users.id`
- `account.users.owner_member_id` → `account.app_users.id`（命盤歸戶到會員；欄位若不存在則由紫微側新增）
- 同實例 → 這些 FK / JOIN / 單一 transaction **真的成立**，這是單庫多 schema 相對雙庫的核心優勢。

---

## 4. 認證模型

- **唯一身分表**：`account.app_users`（已含 `username`, `password_hash`(bcrypt), `display_name`, `role`, `permissions` JSONB, `is_active`）。
- **權限模型統一**：部落格淘汰自有 RBAC 四表，改讀 `app_users.role` + `permissions` JSONB（決策 #6）。`role='admin'` 視為全權；其餘看 `permissions` 清單（與紫微 `has_permission()` 同語意）。
- **各自獨立登入**：部落格續發 cookie+CSRF token、紫微發 bearer token，**都驗同一份 `app_users`**。兩邊皆 bcrypt，雜湊相容。
- **寫入身分一律走紫微**：建會員、改密碼、綁 OAuth → 紫微 API。部落格只**讀** `account.app_users` 做登入驗證。
- **第三方登入（未來）**：`account` 新增 `oauth_accounts(provider, provider_uid, member_id)`，Google/LINE 綁到同一 `app_users.id`。

---

## 5. 關鍵技術陷阱與對策

### 5.1 ⚠️ 兩套 Alembic migration 會撞版本表（最高優先）

- 紫微的 Alembic 版本表在 `public.alembic_version`（`p12_sql/migrations/env.py` 明設 `version_table_schema="public"`）。
- 部落格 Flask-Migrate **預設也是 `public.alembic_version`** → 兩套不同歷史互相覆蓋，版本控制即損毀。
- **對策**：部落格 Alembic 版本表改放自己的 schema。於部落格 `sites/Polaris_Parent/backend/migrations/env.py` 的 `context.configure(...)` 加入：
  ```python
  version_table_schema='blog',
  include_schemas=True,
  ```
  （線上、離線兩個 `run_migrations_*` 都要加。）兩套 migration 從此各管各的。

### 5.2 Postgres role 權限隔離（讓「切割」在 DB 層成立）

即使同庫，給部落格 app 一個受限 role —— 只寫 `blog`/`shop`、只讀 `account`：

```sql
-- 在 db_pcount_v3 執行（以超級使用者）
CREATE ROLE blog_app LOGIN PASSWORD '<set-strong-pw>';

GRANT USAGE, CREATE ON SCHEMA blog, shop TO blog_app;       -- 地基期需 CREATE 建表/跑 migration
GRANT ALL ON ALL TABLES IN SCHEMA blog, shop TO blog_app;
GRANT ALL ON ALL SEQUENCES IN SCHEMA blog, shop TO blog_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA blog, shop GRANT ALL ON TABLES TO blog_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA blog, shop GRANT ALL ON SEQUENCES TO blog_app;

-- account 讀取（身分整合期，第二期再加）：
-- GRANT USAGE ON SCHEMA account TO blog_app;
-- GRANT SELECT ON account.app_users TO blog_app;
```

> 註：地基期 `blog_app` 需要 `CREATE` 以跑 migration 建表；上線穩定後可考慮收回 `CREATE`、改由專責 migration role 執行。

### 5.3 Railway 連線數

兩個 app 連同一實例，連線總和受 Railway Postgres 上限約束。控制各自 pool 大小（部落格現為 `pool_size=10` + `max_overflow=20`），必要時導入 PgBouncer。

---

## 6. 分期計畫總覽

| 期 | 目標 | 風險 |
|----|------|------|
| **第一期：地基** | 部落格連線改向 `db_pcount_v3`、所有表進 `blog`/`shop` schema、修 Alembic 版本表、建 `blog_app` role | 低（零資料） |
| 第二期：身分整合 | 部落格登入改讀 `account.app_users`、淘汰自有 RBAC 四表與 `users` 表、JWT 橋接、`orders.member_id` FK 改指向 `account.app_users` | 中 |
| 第三期：一鍵建檔 | 紫微 `POST /public/charts/save-and-register`、部落格排盤頁加 email + 建檔按鈕 + 串接 | 中 |
| 第四期：會員體驗 | 驗證信/魔術連結/重設密碼、會員中心（我的命盤/訂單）、第三方登入 | 中 |
| 第五期（未來） | 真實金流（ECPay/Stripe） | 高 |

---

## 7. 第一期「地基」—— 詳細執行步驟

> ✅ **本機已完成（2026-06-06）**。實作上的關鍵調整：
> - **schema 改用環境變數驅動**（`OWS_BLOG_SCHEMA=blog` / `OWS_SHOP_SCHEMA=shop`，設在 Polaris `.env`）。因為 `core/backend_engine/models.py` 是**跨站共用**（Claire 也 import），不能寫死 schema；未設變數的站別 → schema=None＝public，行為不變。
> - **`packages/media_lib/models.py`** 的 user 外鍵（`created_by`/`uploaded_by`）同樣改成讀 `OWS_BLOG_SCHEMA`，指向 `blog.users`。
> - **Alembic env.py** 加 `include_name` + `include_object`，把 autogenerate 嚴格限定在 blog/shop，徹底排除 account/graph/media_lib/public，避免誤建或誤刪。
> - 驗證結果：blog 17 表 / shop 5 表建妥；`blog.alembic_version` 與紫微 `public.alembic_version` 並存互不干擾；`account` 命盤資料未動；blog_app 無法寫 account；HTTP 登入/JWT/排盤健康檢查全通過。
> - 本機 `blog_app` 開發密碼存於 `.env`（正式環境另設強密碼）。
> - **media_lib 已補上**（2026-06-06）：在 db_pcount_v3 建 `media_lib` schema 與 6 表（沿用 `init_media_lib.sql`，但 user 外鍵 `created_by`/`uploaded_by` 改指 `blog.users`，未改原檔），授權 blog_app；blog_app search_path 設為 `blog, shop, media_lib, public`。**圖片本體仍在 GCS（設定驅動、未改）**，DB 只存中繼資料。已驗證 ORM 跨 schema 寫入與 `/files`/`/folders`/`/tags` list 端點。正式環境上 Railway 時，這套 DDL 需同樣以 `blog.users` 為 user 外鍵目標執行。


> 目標：**部落格行為完全不變**，只是把它從 `ows_polaris` 搬進 `db_pcount_v3` 的 `blog`/`shop` schema。身分系統（users/RBAC）此期**原樣保留在 `blog` schema**，待第二期再整合進 `account.app_users`。如此地基期零行為變更、最易驗證。

### 步驟 0：前置
- 確認可連到 `db_pcount_v3`（本機或 Railway）。
- 在 `db_pcount_v3` 執行：`CREATE SCHEMA IF NOT EXISTS blog; CREATE SCHEMA IF NOT EXISTS shop;`
- 建立 `blog_app` role（見 §5.2，地基期只授 blog/shop）。

### 步驟 1：連線改向
- 部落格 `.env` 的 `DATABASE_URL` 指向 `db_pcount_v3`（config 透過 `_get_database_url('DATABASE_URL')` 讀取，見 `sites/Polaris_Parent/backend/config.py`）。
- 連線帳號用 `blog_app`。

### 步驟 2：模型加上 schema（`core/backend_engine/models.py`）

按下表把每個 model 指定 schema。SQLAlchemy 作法：在 `__table_args__` 放 `{'schema': 'blog'}`；若該 model 已有約束/索引的 tuple，schema dict 放在 **tuple 最後一個元素**：
```python
__table_args__ = (db.Index('ix_...'), {'schema': 'blog'})   # 既有 tuple → 補 dict
__table_args__ = {'schema': 'shop'}                          # 原本沒有 → 直接 dict
```
**外鍵字串要 schema 限定**，例如 `db.ForeignKey('blog.categories.id')`、`db.ForeignKey('blog.users.id')`。

| 目標 schema | 資料表（`__tablename__`） |
|---|---|
| `blog` | `contents`, `categories`, `tags`, `comments`, `menus`, `menu_items`, `settings`, `homepage_slides`, `homepage_settings`, `activity_logs`, `submissions` |
| `shop` | `products`, `product_prices`, `orders`, `payment_methods` |
| `blog`（暫放，第二期淘汰） | `users`, `roles`, `permissions`, `role_permissions`, `user_roles` |

> 跨 schema 外鍵需注意：`contents.author_id` → `blog.users.id`（暫）；第二期改指 `account.app_users.id`。

### 步驟 3：Alembic 版本表修正
- 編輯 `sites/Polaris_Parent/backend/migrations/env.py`，在 online/offline 兩處 `context.configure(...)` 加 `version_table_schema='blog'` 與 `include_schemas=True`（見 §5.1）。

### 步驟 4：重建 baseline migration（因零資料，最乾淨）
- 刪除 `sites/Polaris_Parent/backend/migrations/versions/` 下既有 baseline（`0001_baseline_schema.py`）。
- 重新產生：
  ```
  flask --app "sites.Polaris_Parent.backend.app:app" db migrate \
    -m "unified baseline in blog/shop schema" \
    -d sites/Polaris_Parent/backend/migrations
  ```
- 檢查產生的 migration：所有 `create_table` 都帶 `schema='blog'`/`'shop'`，且不含 `account`/`graph`/`public` 的表（避免誤動紫微資料）。
- 套用：
  ```
  flask --app "sites.Polaris_Parent.backend.app:app" db upgrade \
    -d sites/Polaris_Parent/backend/migrations
  ```
- 確認版本表落在 `blog.alembic_version`，`public.alembic_version`（紫微的）**未被觸碰**。

### 步驟 5：重建初始管理員
- 因換了新庫，用既有 CLI 重新建 admin：`flask create-admin`（site app 內定義）+ `flask seed-rbac`（地基期仍用部落格 RBAC，第二期才淘汰）。

### 步驟 6：地基期驗證
1. **migration 隔離**：確認 `blog.alembic_version` 存在、`public.alembic_version` 不受影響；紫微後端重啟仍正常。
2. **建表正確**：`\dn` 看到 `blog`/`shop`/`account`/`graph`；`\dt blog.*`、`\dt shop.*` 表齊全。
3. **功能不變**：啟動部落格前後端，登入後台 → 文章 CRUD、產品、訂單 API 全部如常（行為應與搬遷前一致）。
4. **權限隔離**：以 `blog_app` 連線嘗試寫 `account.app_users` 應被拒（權限不足）。
5. **無誤觸**：確認部落格 migration 沒有對 `account`/`graph` 產生任何 `create/drop/alter`。

---

## 8. 後續各期摘要

**第二期 身分整合**
- 部落格 `User` 改為對應 `account.app_users` 的唯讀映射（`__bind_key__` 或同 metadata 跨 schema 讀），登入驗證改打 `account.app_users`。
- 淘汰 `blog.users` / RBAC 四表；`contents.author_id`、`orders.member_id` 改 FK 指向 `account.app_users.id`。
- 授予 `blog_app` 對 `account.app_users` 的 `SELECT`（§5.2 第二段）。
- 權限判斷改用 `role` + `permissions` JSONB：**直接沿用部落格現有權限碼**（`contents.create` 等），只把原本存在 `role_permissions` 的碼搬進 `app_users.permissions` JSONB 陣列。部落格用 `module.action`、紫微用 `page:*`/`collector:*`，前綴不同可同陣列共存，**無需翻譯對照表**。`@require_permission('contents.create')` 的字串與呼叫維持不變，只改「權限來源」。

**第三期 一鍵建檔 API**（紫微後端）
- `POST /public/charts/save-and-register`：單一 transaction 內 ① UPSERT `account.app_users`（以 email 找/建，免密碼）② INSERT `account.users` + `user_chart_raw` + 本命/流運 codes（命盤歸到該會員）③ 回 `member_id` + `chart_id`。
- 公開端點防護：rate limit、email 驗證、防重複建命主。
- 部落格排盤頁（`astrology` 擴充已能算盤、`chart_id` 與紫微同源）加 email 欄 + 建檔按鈕 + 串接 + 設定登入態。

**第四期 會員體驗**：驗證信/魔術連結/重設密碼、會員中心、Google/LINE OAuth（`account.oauth_accounts`）。

---

## 9. 風險清單

| 風險 | 等級 | 對策 |
|---|---|---|
| 兩套 Alembic 撞 `alembic_version` | **高** | 部落格版本表移 `blog` schema（地基期必做，§5.1） |
| migration 誤動紫微 `account`/`graph` | 高 | baseline 檢查只含 blog/shop；`blog_app` 無 account 寫權限 |
| 公開 save-and-register 被灌爆 | 高 | rate limit + email 驗證 + 防重複建命主 |
| 跨服務故障（紫微掛→建檔失敗） | 中 | 降級提示：命盤仍可看、僅「暫時無法儲存」 |
| Railway 連線數上限 | 中 | 控制 pool 大小，必要時 PgBouncer |
| 單庫共命運（備份/還原一起動） | 低 | 規模可接受；schema 層級備份策略 |

---

## 10. 決議與待辦

- [x] **開發守則：一律先在本機驗證，通過後才推上 Railway 正式庫。** 地基期先用本機 `db_pcount_v3` 跑通整套流程再上 Railway；之後每一次 schema/migration 變更都同樣先本機 `migrate`/`upgrade` + 驗證，確認無誤才對正式庫執行。（見 §2 決策 #8）
- [x] **權限碼整合（第二期）**：採「**直接沿用部落格現有權限碼**，原樣存進 `app_users.permissions` JSONB 陣列」。部落格 `module.action`（如 `contents.create`）與紫微 `page:*`/`collector:*` 前綴不同，可共存於同一陣列，**無需翻譯對照表**。程式碼字串不變，只改權限來源。（見 §8）
- [x] **命主歸戶 `owner_member_id`（第三期）**：先做最基礎外殼（命盤綁到 member 即可），欄位/結構**日後再擴充**。屆時由紫微側新增 migration。

---

## 附錄：關鍵檔案

**部落格（OWS_PJs）**
- 連線設定：`sites/Polaris_Parent/backend/config.py`（`_get_database_url`, `SQLALCHEMY_BINDS`）
- 模型：`core/backend_engine/models.py`（加 schema）
- Alembic：`sites/Polaris_Parent/backend/migrations/env.py`（版本表 schema）
- 認證 API：`core/backend_engine/blueprints/api/auth.py`
- 訂單 API：`core/backend_engine/blueprints/api/orders.py`
- 排盤擴充：`sites/Polaris_Parent/backend/extensions/astrology/__init__.py`

**紫微（PolarisUI）**
- DB 連線：`1_run/PolarisUI/backend/db.py`
- 認證/帳號：`1_run/PolarisUI/backend/auth.py`（`app_users`、JWT、bcrypt）
- 命主 API：`1_run/PolarisUI/backend/routes/users.py`
- 表登錄：`1_run/P_Union/p12_sql/table_registry.py`（`account.*` / `graph.*`）
- 紫微 Alembic：`1_run/P_Union/p12_sql/migrations/env.py`（`version_table_schema="public"`）
