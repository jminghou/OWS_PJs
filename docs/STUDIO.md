# Studio —— 個人內容與知識管理（選用模組）

以「內容專案」為中心：一個主題底下管理部落格、Facebook、Instagram、Threads、電子報、影片腳本等版本，
並保留草稿、自動儲存紀錄、命名版本與正式版。收集 → 整理 → 構思 → 撰寫 → 編輯 → 待發布 → 已發布 → 封存。

## 組成

| 層 | 位置 | 說明 |
|---|---|---|
| 後端 | `packages/studio/`（Python） | models、`/api/v1/studio/*` blueprint、migration 鏈 `alembic_version_studio` |
| 前端 | `packages/studio/src/`（`@ows/studio`） | 七個頁面、API client、`studioNav`、`StudioSearchButton`（⌘K） |
| 站台掛載 | `sites/Polaris_Parent/frontend/src/app/admin/studio/*/page.tsx` | 一行 re-export |

資料表十張，全部 `studio_` 前綴、落在 BLOG schema（與 core 表同 schema，靠前綴區分，不需新增 schema 環境變數）：
`studio_projects` `studio_documents` `studio_revisions` `studio_cards` `studio_card_refs` `studio_card_links`
`studio_inbox_items` `studio_sources` `studio_tags` `studio_taggings`。

## 啟用

1. 後端 config `STUDIO_ENABLED = True`（Polaris 已預設開；其他站台預設關）。
2. 跑 migration 鏈（順序：core → commerce → **studio** → 站台）：
   ```bash
   flask --app "sites.<站>.backend.app:app" db upgrade -d packages/studio/migrations
   ```
   `0002` 會嘗試 `CREATE EXTENSION pg_trgm` 建全域搜尋的 GIN 索引；無權限時只印警告，搜尋退化為全表 ILIKE。
3. 前端 `app/admin/layout.tsx`（labeled 外殼：頂列 + 文字標籤分組側欄 + 深淺色切換）：
   ```tsx
   import { PLATFORM_NAV } from '@ows/admin-app';
   import { studioNavGroups, StudioSearchBar, QuickCollectButton } from '@ows/studio';
   configureAdminApp({
     shell: 'labeled', productName: '…', homePath: '/admin/studio/today',
     globalSearch: <StudioSearchBar />, quickAction: <QuickCollectButton />,
     navGroups: [...studioNavGroups, { label: '平台後台', collapsible: true, defaultCollapsed: true, items: [...PLATFORM_NAV] }],
   });
   ```
   仍用舊的圖示長條外殼（`shell` 未設）時改成：`extraNav: [...studioNav], globalSearch: <StudioSearchButton />`。
   深色模式靠外殼根節點的 `dark` class，站台 Tailwind 需 `darkMode: 'class'`。
4. 權限：`studio.read` / `studio.write`。admin 角色自動擁有；editor 角色在 `rbac_seed.ROLE_DEFS` 已加入。

## 部落格文件與 contents 的關係

- blog 平台的文件 1:1 綁定 `contents` 一列（`studio_documents.content_id` unique）。建立時可綁既有文章或新建草稿文章。
- `studio_documents.body` 是**工作草稿**。自動儲存只寫草稿與 `studio_revisions(kind='autosave')`，**不碰 contents**。
- 「儲存到文章」／「立即發布文章」（`POST /documents/<id>/sync-to-content`）才把標題與內文寫進 contents，並呼叫既有的快取失效與 ISR revalidate。發布時額外寫一筆 `kind='published'` 的版本。
- 文章在文章管理頁被改過時，工作區會提示「從文章載入」（判斷依據：`attributes.content_synced_at`）。
- SEO、分類、公開標籤、封面仍在文章管理頁設定；工作區提供連結。

## 版本

- `autosave`：前端停止輸入 2 秒或最多 30 秒送一次；每份文件保留最近 30 筆。
- `named`：使用者命名；幫 autosave 命名會升格為 named（不再修剪）。
- `published`：發布時自動快照。
- 還原任何版本前，會先把現況存成一筆 named 備份。

## 標籤

Studio 的標籤（`studio_tags`）與公開站的 `blog.tags` 分離：前者是個人整理用的扁平標籤，可重新命名與合併；
後者是文章的公開分類標籤。

## 知識卡片類型（可設定）

`/admin/studio/card-kinds`（知識卡片頁篩選列右側的齒輪）管理類型：名稱、顏色、順序、啟用／停用、新增、刪除。
存在 core `settings` 表 `studio_card_kinds`（JSON），沒有設定時用預設五種（`packages/studio/card_kinds.py`）。
- 卡片存的是類型**代碼**（建立後固定），名稱與顏色隨時可改。
- 仍有卡片在用的類型不能刪，只能停用；停用後不出現在選單，既有卡片保留原類型。
- API：`GET/PUT /studio/card-kinds`（整組覆寫）。前端快取在 `src/cardKinds.ts` 的 `useCardKinds()`。

## 今天頁的五步流程列

前端 `FLOW_STEPS`（`packages/studio/src/constants.ts`）與後端 `constants.FLOW_STEPS` 是同一份對應：
捕捉＝`collect`（數字含收集箱待整理）、整理＝`organize`+`ideate`、寫作＝`write`+`edit`、
改編＝有任何非 blog 版本的專案、發布＝`scheduled`+`published`。點任一步 → `/admin/studio/projects?flow=<step>`。

## 本機後台直接連正式庫（單一資料來源）

本機與 Railway 之間**不做同步**。要在本機後台寫正式資料，用 `railway run` 把正式服務的環境變數注入本機後端（密碼不落地）：

```powershell
railway link -p graceful-dream -e production -s polaris-backend   # 一次性
railway run -- python scripts/dev_on_prod.py                       # 本機後端連正式庫，port 5000
railway run -- python scripts/dev_on_prod.py --check               # 只印連到哪
railway run -- python scripts/dev_on_prod.py --upgrade packages/studio/migrations   # 對正式庫跑某條鏈
```

腳本只覆蓋三樣：`FLASK_CONFIG=development`（本機 http 才登得進）、`CORS_ORIGINS` 改 localhost、`OWS_IDENTITY_MODE=external`
（正式庫 `blog.users` 是 view，FK 要指 `account.app_users`）。前端不用改，照常 `npm run dev:polaris`。
本機的 `db_pcount_v3` 只留作 migration 驗證（[[local-first-db-workflow]]）。

正式庫已知限制（帳號 `blog_app` 是受限角色，2026-09-16 跑 studio 鏈時確認）：
- 沒有 `media_lib` schema 的 USAGE / REFERENCES → `studio_inbox_items.file_id`、`studio_sources.file_id` 在正式庫**沒有外鍵**（migration 會自動略過並印提示）。
- 不能 `CREATE EXTENSION pg_trgm` → 正式庫沒有 trgm 索引，全域搜尋走全表 ILIKE。
- 要補上：以 superuser 執行 `GRANT USAGE ON SCHEMA media_lib TO blog_app; GRANT REFERENCES ON media_lib.files TO blog_app; CREATE EXTENSION pg_trgm;`，
  再 `--upgrade` 前先 `flask db downgrade -d packages/studio/migrations 0001_studio_baseline` 讓 0002 重跑。

## 驗證

- `python scripts/check_schema_drift.py --site Polaris_Parent`：四條鏈從零跑完、與 models 一致。
- `npx tsc --noEmit -p packages/studio/tsconfig.json`。
- Claire（未啟用）啟動後 `/api/v1/studio/*` 不存在、`studio.*` 權限未登記。
