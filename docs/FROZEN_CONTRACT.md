# 凍結契約（Frozen Contract）

> **一句話**：本文件列出 `sites/Claire_Project` 對共用層的**全部**依賴。
> 清單**之內**的東西，改動前必須確認 Claire 仍能建置；清單**之外**的東西，可以自由重構。

## 背景

平台模組化以 **Polaris_Parent 為母體**進行：把 Polaris 的通用能力逐步抽成 `packages/*`，
供未來的第三、第四個站台直接複用。

Claire_Project 在這個階段**維持現狀、不遷移**。它目前擁有一份 Polaris 前端的複本
（約 14,000 行），這是已知且刻意接受的技術債，不在本階段處理。

因此重構的安全邊界不是「小心一點」，而是這份可稽核的清單 + CI 守門（`.github/workflows/frozen-contract.yml`）。

---

## A. 靜態依賴（Python）

Claire 後端對共用層的 import，**全部**在此：

| 檔案 | 行 | 匯入 |
|---|---|---|
| `backend/app.py` | 36 | `from core.backend_engine.factory import create_app, BlueprintConfig` |
| `backend/app.py` | 100 | `from core.backend_engine.factory import db` |
| `backend/app.py` | 101 | `from packages.media_lib import register_media_lib` |
| `backend/app.py` | 125 | `from core.backend_engine.factory import db` |
| `backend/app.py` | 126 | `from core.backend_engine.models import User` |
| `backend/migrations/versions/0001_baseline_schema.py` | 30, 40 | `from core.backend_engine.factory import db` |

**凍結的簽名：**

```python
core.backend_engine.factory.create_app(
    config_class, site_extensions, skip_blueprints,
    before_init_hooks, after_init_hooks,
) -> Flask
core.backend_engine.factory.BlueprintConfig(module_path, url_prefix, enabled)
core.backend_engine.factory.db          # SQLAlchemy 單例
core.backend_engine.models.User
packages.media_lib.register_media_lib(app, db)
```

> 這些簽名只准 **additive** 變更（加有預設值的參數、加新匯出）。
> 改名、刪參數、改回傳型別 = 破壞契約。

## B. 靜態依賴（TypeScript）

Claire 前端只引用 `packages/ui`，且全部透過 `src/` 下的 shim 檔轉出。**全部** 16 個模組：

```
packages/ui/src/admin                      （批次匯出，經 admin/shared.ts）
packages/ui/src/admin/DropZone
packages/ui/src/admin/NotionTitleInput
packages/ui/src/admin/SimpleTextEditor
packages/ui/src/admin/UploadProgress
packages/ui/src/editor/TiptapEditor
packages/ui/src/hooks                      （useDebounce）
packages/ui/src/lib/constants
packages/ui/src/lib/currency
packages/ui/src/lib/utils
packages/ui/src/types
packages/ui/src/ui/Button
packages/ui/src/ui/Card
packages/ui/src/ui/CollapsibleSection
packages/ui/src/ui/Input
packages/ui/src/ui/Popover
```

**規則：`packages/ui` 的既有 export 面凍結。**
新的共用 UI 一律進 `packages/site-kit` / `packages/admin-app`（Claire 不引用），
不要再往 `packages/ui` 加東西 —— 它是為了相容 Claire 而保留的過渡層。

## C. 執行期契約（無 import，但一樣會壞）

Claire 前端透過 HTTP 呼叫 core 後端。**這層沒有任何 import 可以被靜態檢查，
是最容易在重構時被忽略的破壞面。**

### C-1. Core API 路由（`/api/v1` 前綴）

以下路由由 `core/backend_engine/blueprints/api/` 註冊，Claire 前端有實際呼叫：

```
/auth/login  /auth/logout  /auth/profile  /auth/refresh
/contents  /contents/<id>  /contents/slug/<slug>
/categories  /categories/<id>
/tags  /tags/<id>  /tags/find-or-create
/authors  /authors/<identifier>
/products  /products/<id>
/admin/products  /admin/products/<id>  /admin/products/<id>/toggle-status
/admin/products/<id>/prices  /admin/products/<id>/prices/<pid>
/admin/products/<id>/translations  /admin/products/sort-order
/orders  /payment-methods  /admin/payment-methods
/webhooks/mock-payment
/settings/homepage  /settings/i18n  /settings/i18n/languages
/submissions  /submissions/contact  /admin/submissions  /admin/submissions/<id>
/users  /users/<id>  /users/<id>/toggle-status
/admin/rbac/permissions  /admin/rbac/roles  /admin/rbac/roles/<id>
/admin/users/<id>/roles
/public/lookup  /public/search
```

### C-2. Media Lib 路由（`/api/v1/media-lib` 前綴）

```
/files  /files/<id>  /files/<id>/metadata  /files/move
/folders  /folders/<id>
/import/scan  /import/execute
```

### C-3. 資料庫 schema

`core/backend_engine/models.py` 的 20 個模型（Role / Permission / RolePermission /
UserRole / User / Category / Content / Tag / Comment / Menu / MenuItem / Setting /
HomepageSlide / HomepageSettings / ActivityLog / Submission / Product / ProductPrice /
Order / PaymentMethod）對應 Claire 正式庫（Neon）的實際資料表。

**欄位改名或刪除 = 破壞 Claire 的正式資料庫。**
core 模型的變更一律走 additive migration（加欄位、加表），
且必須同時為 Claire 產生對應 migration。

> 註：兩站的 migration 已經漂移（Polaris `0001`+`0002`，Claire 僅 `0001_baseline`）。
> P5 階段會把 core 表的 migration 從站台 migration 拆出，在那之前 core 模型盡量不動。

---

## D. 自由區（想怎麼改都行）

以下不在 Claire 的依賴面內，重構時**不需要**考慮 Claire：

- `sites/Polaris_Parent/**` 全部
- `packages/ziwei-chart/**`（僅 Polaris 使用）
- `packages/platform-api/**`、`packages/admin-app/**`、`packages/site-kit/**`（新建，Claire 不引用）
- `core/backend_engine/blueprints/` 內**新增**的 blueprint（只要沒被塞進 `CORE_BLUEPRINTS`
  且改變既有路由行為）
- `scripts/**`、`docs/**`

---

## E. 怎麼驗證

CI workflow `.github/workflows/frozen-contract.yml` 在每個 PR 上：

1. **契約清單比對**：`scripts/check_frozen_contract.py` 重新掃描 Claire 的 import，
   若出現本文件未列出的新依賴 → 失敗（防止有人偷偷把 Claire 綁到更多共用碼上）。
2. **分層邊界**：`scripts/check_layering.py` 確認 Polaris 的平台層沒有反向依賴領域層。
3. **Claire 後端冒煙**：以 `FLASK_CONFIG=testing` import `sites.Claire_Project.backend.app`
   （app 是模組層級建立的，import 本身就跑完 `create_app()`），確認 A 節的 import
   全部可解析、blueprint 註冊成功，且 C-1 / C-2 的契約路由全數存在。
4. **Claire 前端型別檢查**：`tsc --noEmit`，確認 B 節的 16 個模組 export 面沒被改壞。

本地手動跑：

```bash
python scripts/check_frozen_contract.py
python scripts/check_layering.py
```

> 新增 core blueprint 時注意：core 的 API 由所有站台共用，無條件註冊的端點會
> 憑空出現在 Claire 上。凡是站台不一定要有的功能（例如會員系統），一律加
> config 開關、預設關閉，由站台明確啟用 —— 見 `MEMBER_AUTH_ENABLED` 的做法。

---

## F. 什麼時候可以解凍

當 Claire 也遷移到 `packages/admin-app` + `packages/platform-api` 之後，本文件作廢。
那是 P6（第三站驗收）之後的獨立決策，**不在目前的計畫範圍內**。
