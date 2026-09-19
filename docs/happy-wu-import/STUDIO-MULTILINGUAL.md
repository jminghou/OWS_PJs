# Studio 多語文章整合

更新：2026-09-18。共用程式已整合至 Happy_Wu 與 Polaris_Parent；本機資料庫已遷移。未部署遠端環境。

## 使用方式

1. 在「內容專案」建立作品，選擇平台與原始語言，或在「寫作工作區」開啟現有文件。
2. 上方語言選單切換同作品的版本。「空白翻譯」與「複製為翻譯草稿」建立獨立草稿，不提供自動翻譯。完成校對後按「已完成翻譯校對」。
3. 部落格作品的「文章設定」提供摘要、網址代稱、SEO 標題／描述、作者、分類、網站標籤及列表圖片／封面；圖片可從媒體庫選取。
4. 「儲存草稿」保存正文及文章設定；「發布」選單提供立即發布、排程及下架／取消排程。每次操作只作用於目前語言。
5. 預覽顯示目前語言的正文排版，不等同網站完整頁面／SEO 預覽。iframe 封鎖腳本及表單。
6. 原文更新會提醒譯文校對，不覆寫譯文、不自動下架已發布譯文。
7. 「發布中心」可按語言篩選；網站文章的發布操作回到工作區執行。社群作品仍可手動記錄外站發布狀態。
8. 「發布中心」與工作區的文章入口可接管既有文章。原本的 `/admin/articles?id=...` 會開啟對應工作區；未接管文章會連同整個語言群組建立專案。文章 ID、slug、正文與發布狀態保留。

側欄「平台後台」改名為「網站管理」，移除重複的文章管理選項。分類、媒體、作者、語系、首頁及權限等仍留在網站管理。Claire 保留原介面。

Happy_Wu 現有啟用語言是 `zh-TW`、`zh-CN`、`en`。新增語言由「網站管理 → 語系設定」管理；停用語言會阻止新增該語言版本，現有版本仍能編輯。

## 資料與行為

- 結構：專案 → 作品 `work_id` → 語言版本。相同專案、相同平台可有多個作品。
- `studio_documents` 新增 `work_id`、`language`、`translation_source_id`、`source_fingerprint`。唯一約束為 `(work_id, language)`。
- 舊文件保留 ID。綁定文章的語言沿用 `Content.language`，其他平台沿用站台預設語言。
- 部落格每個語言各自綁定 Content；新譯文的 `original_id` 直接指向文章群組根節點。接管時整理歷史多層翻譯鏈；跨專案或重複語言衝突會停止接管，要求先處理資料。
- 文章設定草稿存於文件 attributes，明確發布時才同步到 Content。自動儲存不更新公開頁面。
- 新譯文必須確認校對才能發布；空正文不能發布。原文後續變更只提醒，不強制撤下譯文。
- 更新文章設定需要 `studio.write` 與 `contents.update`；發布、排程、下架需要 `studio.write` 與 `contents.publish`。帳號須有效；支援本機 User 與 Polaris 外部 AppUser。
- 公開文章 API 不列出尚未公開的語言版本。排程沿用 Content 的 published 狀態與未來 published_at，公開讀取會檢查時間。快取與站台重新驗證仍沿用既有機制。
- 網站文章及翻譯來源使用封存，避免刪除工作文件留下無法管理的文章。已發布文章先下架再封存。
- 文件內切換語言／連結會等待自動儲存成功；失敗則保留目前文件。關閉頁面有未儲存提示。命名／還原版本前也會先儲存。

## 遷移與備份

Studio migration：`0002_studio_trgm_search → 0003_studio_languages`，獨立版本表 `blog.alembic_version_studio`。

本機遷移完成且原有欄位逐列比對一致：

| 站台 | 專案 | 文件 | 歷史版本 | 來源 | 網站文章 |
|---|---:|---:|---:|---:|---:|
| Happy_Wu | 69 | 346 | 352 | 69 | 69 |
| Polaris | 1 | 2 | 2 | 0 | 2 |

Happy_Wu 使用完整資料庫備份；Polaris 僅備份 `blog` schema，還原須保留既有 `account` 身分資料。未更動 Polaris 命盤資料或帳號權限。

備份位置、比對計數與測試資料庫名稱記錄於忽略提交的 `generated/studio-language-migration.json`、`generated/polaris-language-migration.json`、`generated/studio-language-tests.json`。

其他環境部署順序：

1. 備份、安排停止寫入，確認目前 Studio migration 版本。
2. 使用該環境資料表擁有者／migration 帳號執行 `flask --app <site-app> db upgrade -d packages/studio/migrations`。不要把日常應用程式帳號改為管理員。
3. 部署並重新啟動共用後端與對應前端。
4. 驗證語系設定、工作區、舊文章接管、測試草稿與權限。

程式回退與資料回退須一起規劃。建立新譯文後直接 downgrade 會移除作品群組與來源追蹤欄位，應先匯出新資料，不能以舊備份直接覆蓋上線後新增內容。

注意：原匯入工具的 fingerprint 包含文件欄位；本次新增欄位及使用者後續修改會使原匯入基準不再相同。不要為了重新匯入而直接重設 fingerprint 或略過衝突檢查。

## 驗證

- PostgreSQL 複製資料庫：完整備份還原、遷移前後資料一致、作品／語言唯一性、翻譯根節點、草稿隔離、校對、排程可見性、下架隔離、發布權限、接管重入、社群翻譯與版本還原隔離、停用語言及停用帳號。
- 真實 React hook + 控制網路延遲：flush 等待進行中的請求、保存最新編輯、錯誤傳遞／重試、請求期間撤回文字。
- Studio、Happy_Wu、Polaris TypeScript 檢查；Happy_Wu 與 Claire 正式建置；Claire 凍結契約檢查。
- 本機 Happy_Wu 工作區、文章入口、發布中心 HTTP 200；登入身分的 editor-options、document、article catalog API 200。Polaris 外部身分 editor-options、projects、publishing API 200。
- 未完成瀏覽器逐項點擊驗收：此工作階段的內嵌瀏覽器存取 localhost 曾被工具封鎖。預覽、媒體選取等畫面可在本機手動驗收。
- 本機 Redis 未啟動時，現有快取程式會記錄連線警告。測試使用隔離 SimpleCache；正式環境仍需正常的快取與重新驗證服務。建置亦有既有 lint 與後端離線靜態資料警告。

可重跑：

```powershell
.\venv\Scripts\python.exe -X utf8 scripts/happy_wu_import/check_studio_languages.py
node scripts/happy_wu_import/check_autosave.cjs
npm run typecheck --workspace=@ows/studio
.\venv\Scripts\python.exe -X utf8 scripts/check_frozen_contract.py
```

整合測試只寫入新建立的本機測試資料庫，不向真實站台新增或發布測試文章。
