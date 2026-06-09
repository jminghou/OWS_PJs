# Polaris 正式環境切換到統一資料庫 db_pcount_v3（Runbook）

> 狀態：待執行　|　最後更新：2026-06-09
> 目標：把 **polaris-backend（部落格/會員 Flask）** 的正式資料庫，從 Neon `ows_polaris`
> 切到紫微正式 Postgres（`db_pcount_v3`，已含 `account`/`graph`），並建立 `blog`/`shop`
> schema 與會員系統表。**Claire 完全不動**（續用 Neon `ows_polaris` 的 public schema）。

---

## 0. 現況與目標拓樸

**確認的事實**
- 正式 `db_pcount_v3` = Railway 專案中接在 **Polaris_run（紫微 FastAPI）** 下的那顆 **Postgres**，已有 `account`/`graph`。
- `polaris-backend` 與該 Postgres **在不同 Railway 專案** → 連線要用 Postgres 的**公開**連線字串。
- 正式 Polaris 部落格資料**幾乎是空的**（1 admin、1 文章）→ **全新建置，不做資料搬遷**。
- `core/` 是兩站共用程式碼；DB 由各服務的環境變數決定，已用 `OWS_BLOG_SCHEMA` 分流，**對 Claire 安全**。

```
  polaris-backend (Flask)  ─┐                         ┌─ account / graph   ← Polaris_run 寫
                            ├─► Postgres db_pcount_v3 ┤
  Polaris_run (FastAPI)  ───┘   (Railway, 跨專案公開連線) └─ blog / shop      ← polaris-backend 寫（本次新建）

  claire-backend (Flask) ─► Neon ows_polaris (public)   ← 不動
```

**取得連線資訊（先準備好，勿貼進聊天/commit）**
- Postgres 公開連線：Railway → Postgres 服務 → Variables → `DATABASE_PUBLIC_URL`（形如 `...proxy.rlwy.net:PORT`）。
- 內含的 superuser 帳密（跑一次性建置用）；資料庫名為 `db_pcount_v3`。
- 待會替 polaris-backend 設的連線改用受限帳號 **`blog_app`**（本 runbook 會建立）。

---

## 1. 一次性建置（在正式 db_pcount_v3 上）

> ⚠️ 全程「先備份、逐步驗證」。Part 1 的 1〜4 以 **superuser** 連 `db_pcount_v3` 執行（psql 或 Railway Postgres 的 Query 介面）。

### 1.0 備份
- Railway → Postgres → **Backups** 建一個手動 snapshot（或 `pg_dump`）。雖只新增 schema、不動 `account`/`graph`，仍先備份。

### 1.1 建 schema + blog_app 角色 + 授權（superuser 執行）
```sql
-- 1) schema
CREATE SCHEMA IF NOT EXISTS blog;
CREATE SCHEMA IF NOT EXISTS shop;

-- 2) 受限應用帳號（密碼請改強）
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='blog_app') THEN
    CREATE ROLE blog_app LOGIN PASSWORD 'CHANGE-ME-STRONG';
  END IF;
END $$;

-- 3) blog/shop：地基期需 CREATE 以建表/跑 migration
GRANT USAGE, CREATE ON SCHEMA blog, shop TO blog_app;
GRANT ALL ON ALL TABLES    IN SCHEMA blog, shop TO blog_app;
GRANT ALL ON ALL SEQUENCES IN SCHEMA blog, shop TO blog_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA blog, shop GRANT ALL ON TABLES    TO blog_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA blog, shop GRANT ALL ON SEQUENCES TO blog_app;

-- 4) 讀 account 身分 + 可建外鍵（init_member_profiles.sql 也會再授一次，冪等）
GRANT USAGE ON SCHEMA account TO blog_app;
GRANT SELECT, REFERENCES ON account.app_users TO blog_app;
```

### 1.2 身分整合 SQL（superuser 執行，因含 SECURITY DEFINER + 寫 account）
依序執行（兩支皆冪等）：
1. `sites/Polaris_Parent/backend/database/init_member_profiles.sql` — 建 `blog.member_profiles`（1:1 對 `account.app_users`）。
2. `sites/Polaris_Parent/backend/database/init_users_view.sql` — 建 `blog.users` 可讀寫 VIEW + INSTEAD OF triggers（讓共用 `User` 模型透明運作）。

> 順序重要：view 會 JOIN `member_profiles`，故先 1 再 2。

### 1.3 媒體庫（若正式要用媒體庫；superuser 執行）
- 執行 `packages/media_lib/database/init_media_lib.sql`（建 `media_lib` schema + 6 表）。
- 授權並把 blog_app 的 search_path 納入 media_lib：
```sql
GRANT USAGE ON SCHEMA media_lib TO blog_app;
GRANT ALL ON ALL TABLES IN SCHEMA media_lib TO blog_app;
GRANT ALL ON ALL SEQUENCES IN SCHEMA media_lib TO blog_app;
ALTER ROLE blog_app SET search_path = blog, shop, media_lib, public;
```
> 圖片本體仍在 GCS；DB 只存中繼資料。media_lib 的 user 外鍵目標由 `OWS_BLOG_SCHEMA` 驅動（Polaris→account.app_users）。

### 1.4 套用 Alembic migration（以 **blog_app** 連線，從本機對正式庫跑）
在本機 repo 根目錄，臨時把連線指向正式庫（用 `DB_URL_OVERRIDE`，不改 .env）：
```powershell
# PowerShell（值請替換；不要寫進檔案）
$env:DB_URL_OVERRIDE = "postgresql://blog_app:<pw>@<proxy_host>:<port>/db_pcount_v3?sslmode=require"
$env:OWS_BLOG_SCHEMA = "blog"
$env:OWS_SHOP_SCHEMA = "shop"

# 先看會跑什麼（應只有 0001 + 0002 的 blog/shop CREATE，且不碰 account/graph）
venv\Scripts\python -m flask --app "sites.Polaris_Parent.backend.app:app" db upgrade --sql -d sites\Polaris_Parent\backend\migrations

# 確認無誤後實際套用
venv\Scripts\python -m flask --app "sites.Polaris_Parent.backend.app:app" db upgrade -d sites\Polaris_Parent\backend\migrations
venv\Scripts\python -m flask --app "sites.Polaris_Parent.backend.app:app" db current -d sites\Polaris_Parent\backend\migrations
# 預期 current = 0002_member_commerce_loop
```
> 這會建立 blog/shop 全部表（含本次新增的 product_types / coupon_configs / order_submissions / reward_grants / saved_articles），版本表落在 `blog.alembic_version`。

### 1.5 建立後台管理者（經 view 寫入 account.app_users）
正式 `account.app_users` 已有紫微 admin（統一身分，可直接用其帳密登入後台）。若要另建專屬部落格 admin：
```powershell
# 沿用上面的 DB_URL_OVERRIDE / 環境變數
venv\Scripts\python -m flask --app "sites.Polaris_Parent.backend.app:app" create-admin
```
> `role='admin'` 即擁有全部 blog 權限（不需 seed-rbac；Polaris 無 RBAC 四表）。

### 1.6 驗證（對正式庫，唯讀）
1. `blog.alembic_version` = `0002_member_commerce_loop`；紫微 `public.alembic_version` 未變。
2. `\dt blog.*`、`\dt shop.*` 表齊全；5 張會員表存在。
3. 外鍵 `order_submissions/reward_grants/saved_articles.member_id → account.app_users` 存在。
4. 以 blog_app 連線可寫 blog/shop、**不能**寫 account（只讀）。
5. `account`/`graph` 既有資料筆數未變。

---

## 2. 切換 polaris-backend 服務連線（Railway）

到 **polaris-backend** 服務 → Variables，設定/調整：

| 變數 | 值 |
|---|---|
| `DATABASE_URL` | `postgresql://blog_app:<pw>@<proxy_host>:<port>/db_pcount_v3?sslmode=require`（Postgres 公開連線、blog_app） |
| `OWS_BLOG_SCHEMA` | `blog` |
| `OWS_SHOP_SCHEMA` | `shop` |
| `ZIWEI_API_URL` | Polaris_run 的對外網址（如 `https://polarisrun-production.up.railway.app`） |
| `PUBLIC_SERVICE_TOKEN` | 與 Polaris_run 端**相同**的服務密鑰（一鍵建檔/命盤管理 proxy 用） |

- 存檔後 **Redeploy** polaris-backend。
- 跨專案以公開連線：留意 Postgres 連線數上限，控制 pool（現為 pool_size=10 + overflow=20），必要時導入 PgBouncer。

---

## 3. 煙霧測試（正式環境）

1. 後台 `api.polaris-parent.com` 對應前台 `/admin/login` 用 admin 登入 → 看得到「外部商品 / 折扣碼 / 訂單審核」。
2. 新增 1 個外部商品 + 1 組 active 折扣碼。
3. 前台排盤 `/ziwei` → 一鍵建檔（會打 Polaris_run）→ 設密碼信流程 → 登入 → 會員中心四分頁正常。
4. 登錄訂單 → 後台審核通過 → 會員端出現折扣碼；退回 → 會員可修正重送。
5. 確認 Claire（`api.clairelab.tw`）一切如常（它仍連 Neon、完全沒被動到）。

---

## 4. 回滾

- **DB**：本次只「新增」blog/shop（不影響 account/graph）。要撤回會員表：
  ```powershell
  venv\Scripts\python -m flask --app "sites.Polaris_Parent.backend.app:app" db downgrade -1 -d sites\Polaris_Parent\backend\migrations
  ```
  或從 1.0 的 snapshot 還原。
- **服務**：把 polaris-backend 的 `DATABASE_URL` 改回原本的 Neon `ows_polaris`、移除 `OWS_BLOG_SCHEMA`/`OWS_SHOP_SCHEMA`，Redeploy 即回到切換前狀態。

---

## 5. 注意事項

- **Claire 不動**：它與 `core/` 共用程式碼，但連自己的 Neon 庫、用 public schema 與自有 RBAC；本流程完全不碰它。
- **紫微命盤編輯/刪除**：是 Polaris_run（FastAPI）的端點，**沒有新表、不需 DB migration**，只要 Polaris_run 部署到含 `feat/member-chart-management` 的版本即可。
- **本機優先守則**：以上每步先在本機 db_pcount_v3 驗過（已完成）；正式執行務必先備份、逐步驗證。
