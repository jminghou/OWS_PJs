# 部署指南 — RBAC 啟用 + Schema Migration 化

本文件對應 2026-05-20 的一批變更（RBAC 啟用、schema 改由 migration 管理、
舊 Media 系統移除、安全性強化）。照順序執行即可把這些變更安全上線。

> 前提：本批變更已驗證於本地 dev，但**生產資料庫尚未套用**。
> 以下流程假設「生產資料庫沒有要保留的資料，可重建」。
> 若日後生產已累積真實資料，**不要**用本文件的「清空重建」步驟，改用增量 migration。

---

## 0. 名詞對照（兩個 Site）

| | Polaris Parent | Claire Project |
|---|---|---|
| App 路徑 | `sites.Polaris_Parent.backend.app:app` | `sites.Claire_Project.backend.app:app` |
| migrations 目錄 | `sites/Polaris_Parent/backend/migrations` | `sites/Claire_Project/backend/migrations` |
| 後端 Port（本機） | 5000 | 5002 |
| 資料庫（本機） | `ows_polaris` | `ows_claire` |

下面指令以 Polaris 為例；Claire 把 `--app` 與 `-d` 換成對應值再跑一次。

---

## 1. 推送程式碼

```bash
git push origin main
```

---

## 2. 設定生產環境變數（每個後端）

這批變更收緊了安全性：**以下變數缺任何一個，生產後端會啟動失敗**（刻意設計，
避免靜默使用弱預設值）。

| 變數 | 必填 | 說明 |
|------|:---:|------|
| `FLASK_CONFIG` | ✅ | 設為 `production` |
| `CORS_ORIGINS` | ✅ | 前端實際網域，逗號分隔。**不可為 `*`** |
| `SECRET_KEY` | ✅ | 強隨機字串（勿用 dev 的弱值） |
| `JWT_SECRET_KEY` | ✅ | 強隨機字串 |
| `DATABASE_URL` | ✅ | PostgreSQL 連線字串 |
| `REDIS_URL` | 視情況 | 有用快取/rate limit 才需要 |

產生強隨機金鑰範例：
```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

---

## 3. 重建生產資料庫（每站各做一次）

> ⚠️ **破壞性操作**：會清掉資料庫所有資料表。僅在「沒有要保留的資料」時使用。

```bash
# (1) 清空舊 schema（清掉舊 Media 表、舊 alembic_version 等殘留）
psql "$DATABASE_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public; DROP SCHEMA IF EXISTS media_lib CASCADE;"

# (2) 由 migration 建立全新 schema（baseline 建 28 張表：22 core + 6 media_lib）
flask --app "sites.Polaris_Parent.backend.app:app" db upgrade -d sites/Polaris_Parent/backend/migrations

# (3) 建立管理員帳號（會互動詢問 username / email / password）
flask --app "sites.Polaris_Parent.backend.app:app" create-admin

# (4) 建立權限/角色，並把管理員的 legacy role 同步到 user_roles
flask --app "sites.Polaris_Parent.backend.app:app" seed-rbac
```

完成後對 Claire 重跑 (1)~(4)（換 `--app`、`-d`、各自的 `DATABASE_URL`）。

> **重點**：`flask db` 指令一定要帶 `-d sites/<Site>/backend/migrations`，
> 否則會找到根目錄空的 `migrations/versions`，報 `Can't locate revision`。

---

## 4. 部署前端

- 若前端（Vercel）綁定 git 自動部署：push 後會自動重建。
- 否則手動觸發 redeploy。
- 確認前端環境變數 `NEXT_PUBLIC_API_URL` 指向對應後端網域。

---

## 5. 部署後驗證

1. 用管理員帳號登入後台。
2. 進 **權限管理**（`/admin/roles`）頁，確認：
   - 看得到全部選單項目（admin 具備 25 個權限）
   - 能建立 / 刪除自訂角色、能勾選角色權限並儲存
   - 「使用者角色指派」表格能正常勾選
3. （可選）建一個受限角色與測試帳號，登入確認：選單只剩有權限的項目、
   越權的 API 會被擋（HTTP 403）。

---

## 6. 建立你的多使用者權限（上線後的日常操作）

1. 在 **權限管理** 頁建立角色，例如「客座作者」只勾 `contents.create` + `contents.read`。
2. 建立使用者（後台或 `create-admin`），到「使用者角色指派」把角色發給他。
3. 該使用者登入後即受該角色權限約束。

也可用 CLI 指派：
```bash
flask --app "sites.Polaris_Parent.backend.app:app" assign-role <username> <role_code>
```

---

## 日後維護備忘

- **改了權限/角色定義**（`core/backend_engine/services/rbac_seed.py`）後，
  對每站重跑 `flask ... seed-rbac`（冪等，只補新項目，不覆蓋自訂）才會生效。
- **改了 model（加/改欄位）**：用 `flask ... db migrate -m "..." -d <migrations>`
  產生增量 migration → review → `db upgrade`。**不要再手動 ALTER TABLE，也不要靠
  db.create_all（已移除）**。
- **新增 API 端點**：用 `@require_permission('module.action')` 控管，不要再寫
  `user.is_admin()` / `user.is_editor()`（已全數移除）。
- 權威種子來源是 `rbac_seed.py`；`core/scripts/init_db.sql` 的 RBAC 段落是
  legacy、已被取代，勿再依賴。
