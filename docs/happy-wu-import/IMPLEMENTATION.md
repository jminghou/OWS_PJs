# 實作與匯入紀錄

2026-09-17 已完成本機 Happy_Wu 全量草稿匯入。研究文件 README.md 是實作前盤點；目前狀態以本文件與 generated 下驗收紀錄為準。

## 已匯入

目標：localhost PostgreSQL 的 `ows_happy_wu`、`blog` schema。

| 資料 | 實際數量 |
|---|---:|
| Studio 專案 | 69 |
| 平台文件 | 345（五平台各 69） |
| 來源對照 | 69 |
| 官網文章 | 69，全部 draft |
| 初次匯入命名版本 | 345 |
| 公開文章標籤 | 230，已去重 |
| 缺少文章綁定的 blog 文件 | 0 |

作者暫用既有的 admin（ID 1）。分類、封面、正式作者、節目網址與發布日期列在專案 `attributes.review_pending`；未任意生成分類或日期。345 份工作文稿 stage=write。原始資料夾保持原樣，全部 414 份原檔已封存於 generated/source-snapshot.zip。

此次完成的是本機資料灌入與程式修正，沒有部署正式服務，也沒有公開發布文章或發送社群文稿。

## 工具與規則

- `scripts/happy_wu_import/prepare.py`：真正 YAML 解析、兩種 metadata 格式、H1/摘要/標籤抽取、Markdown→HTML、允許 HTML 標籤檢查、全量／五集預覽、原檔封存。
- `scripts/happy_wu_import/database.py`：plan/apply/verify/rollback，限 localhost 的 Happy_Wu 或具指定前綴的測試庫；檢查站台及 schema，每集交易、匯入鎖、來源與目標指紋、防重複、拒絕覆寫人工變更。
- `scripts/happy_wu_import/check_roundtrip.mjs`：使用與正式編輯器共用的文章結構擴充，將全部 138 份 HTML 文稿打開、儲存、重開後驗證文字、粗斜體、清單、標題與表格。
- `scripts/happy_wu_import/check_database.py`：建立獨立測試庫、實際還原備份，在副本清空內容建立測試資料，驗證五集匯入、重跑、修改衝突、回復、重新匯入，以及草稿 API 權限。

本機產物和含使用者資料的資料庫備份位於 `generated/`，已由本目錄 .gitignore 排除版本控制。資料庫備份不能放到公開網站。每次 apply/rollback 前以 pg_dump 建立備份；測試已驗證 pg_restore 還原。回復保留標籤，以免刪掉其他內容可能引用的共享分類資料。

## 程式修正

1. `packages/admin-app/src/components/articleExtensions.ts`：新增 Tiptap TableKit，讓表格可編輯與儲存。現有 TiptapEditor 使用此共用設定。
2. `core/backend_engine/blueprints/api/contents.py`：未登入、一般會員與停用帳號僅可讀已公開且已到發布時間的內容；preview=true 不會提高權限。編輯權限或 Studio 讀寫權限才可讀未發布內容。
3. 新增 admin-app 的表格依賴與 DOM 測試依賴；Python 匯入依賴另列在 scripts/happy_wu_import/requirements.txt。

## 驗證結果

- 69 集 / 345 份文稿：解析錯誤 0。
- 全量資料庫 verify：69 集指紋與關聯一致。
- 編輯器往返：138 份通過，14 張表格、220 個儲存格保留。
- 五集整合測試：初次建立、重跑全部 skip、人工修改拒絕覆寫、修改後拒絕回復、未修改內容回復及重新匯入均通過。
- 48 項 API 檢查通過：匿名／管理員／一般會員／停用帳號，含 ID、slug、preview、列表與快取隔離情境。
- admin-app、Happy_Wu TypeScript 檢查通過；Happy_Wu 與 Claire 正式建置均成功，凍結契約檢查通過。
- 建置保留原有 hooks/img lint 警告；Claire 因後端未啟動，靜態資料擷取採空資料 fallback，不能視為 Claire 線上資料驗證。
- 實際本機 HTTP：health 200、後台登入頁 200、匿名 draft 列表 total=0、匿名 `podcast-ep03?preview=true` 回傳 404。
- 瀏覽器自動化工具開啟 localhost 時回報 ERR_BLOCKED_BY_CLIENT，因此沒有宣稱完成可見 UI 的人工式點選驗收；已完成實際 HTTP、資料庫與編輯器 DOM 測試。

期間發現既有開發程序仍載入舊後端，而且 Next 建置和開發程序共用 .next，導致前台 500。已只重啟 Happy_Wu，清除其可重建 .next 生成檔，前後台現已恢復 HTTP 正常。

本機設定的 Redis localhost:6379 未啟動，既有快取失效函式會記錄連線警告；目前端點仍可回應，草稿不對外公開。正式部署前需確認 Redis 或選定的快取後端可用，並重新執行發布／快取驗收。匯入 CLI 不向正式網域送 revalidate，這次只匯入本機草稿。

## 操作方式

在 `D:\PJ_Projects\OWS_PJs` 執行，使用既有 venv：

```powershell
# 重新產出乾跑計畫與預覽（會更新 generated 中的計畫）
.\venv\Scripts\python.exe scripts/happy_wu_import/prepare.py

# 檢查與目前資料庫的差異，不寫入
.\venv\Scripts\python.exe scripts/happy_wu_import/database.py plan --report docs/happy-wu-import/generated/recheck-plan.json

# 全量驗收，不寫入
.\venv\Scripts\python.exe scripts/happy_wu_import/database.py verify --report docs/happy-wu-import/generated/recheck-verify.json

# 必要時重跑；相同來源與未修改目標會跳過
.\venv\Scripts\python.exe scripts/happy_wu_import/database.py apply --report docs/happy-wu-import/generated/reapply.json

# 單集範圍範例：附加 --episodes EP03,EP14
# rollback 會刪除此計畫匯入且未修改的專案、文章、來源及版本，先自動備份。
# 已有人工修改時一律拒絕；不要用它回復整個資料庫。

# 編輯器測試
node --experimental-strip-types scripts/happy_wu_import/check_roundtrip.mjs

# 獨立資料庫整合測試（需本機 postgres 建庫權限；留下測試庫便於查驗）
.\venv\Scripts\python.exe -X utf8 scripts/happy_wu_import/check_database.py

# 啟動本機後台
npm run happy-wu
```

本機後台：`http://localhost:3010/admin/studio/projects`；官網文章管理：`http://localhost:3010/admin/articles`。

## 接續工作

先在後台審閱五集及其他文稿，再補齊正式網域、逐集收聽連結、作者、分類、封面及發布日期。所有占位符都仍保留於工作草稿，發布前必須檢查清零。若要把這批內容移到正式部署，先確認正式資料庫／站台身分，另做備份及移轉計畫；本工具刻意不接受遠端資料庫。
