# Happy_Wu Podcast 一次性匯入研究

研究日期：2026-09-17。範圍：本機原始碼、設定的非機密欄位，以及來源目錄全部 414 份 Markdown 的結構掃描與代表性正文閱讀。未連線查詢目標資料庫，未呼叫正式站 API，未修改網站程式或原始文稿，未執行匯入。本文描述原始碼行為，不代表已驗證正式部署狀態。

## 1. 結論與建議範圍

建議完整搬入現有 Studio：69 個節目內容專案、345 份平台文件、69 份來源對照，並建立 69 篇綁定的官網文章草稿。資料不需全部擠成公開文章，也不需另造一套 CMS。

如果只需要官網長文，縮小成 69 篇 contents 草稿即可；但會少掉其餘 276 份平台文稿與 69 份來源對照的後台管理。依「資料一次性灌入後台」的目標，本報告建議完整 Studio 方案。這是匯入範圍建議，尚未執行。

## 2. 官網結構與相依

实际專案：`D:\PJ_Projects\OWS_PJs\sites\Happy_Wu`。

```text
OWS_PJs/
  sites/Happy_Wu/
    .env                         站台後端設定（不可匯出密碼）
    backend/
      app.py                     create_site_app 共用工廠入口
      config.py                  BaseSiteConfig 與本站設定
      extensions/                本站擴充位置；目前未掛額外功能
      migrations/                站台 migration；versions 目前只有 .gitkeep
    frontend/
      src/app/admin/             後台路由，多數 re-export 共用套件
        articles/                官網文章管理
        studio/                  專案、工作區、發布中心、來源與知識整理
      src/app/(public)/          公開文章、作者、首頁、關於、商品等
      src/app/[locale]/          語言路由
      src/app/api/revalidate/    前端快取更新
      src/components/platform/  站台 UI
      src/lib/api/               API 接線
      src/siteConfig.ts         網站識別、SEO 組織資料
      src/i18n/                 翻譯與首頁資料
  core/backend_engine/
    models.py                    Content、Category、Tag、User
    blueprints/api/contents.py  文章、分類、公開標籤 API
    schemas/content.py          回傳序列化（不等於寫入 API 契約）
    services/                  權限、快取、前端 revalidate
    factory.py、site_scaffold.py 共用 app 與模組掛載
  packages/
    studio/                     專案、五平台文件、來源、版本紀錄
    admin-app/                  文章管理、HTML 編輯器、媒體 UI
    platform-api/               共用 API client 與型別
    content-kit/                Markdown/HTML 的目錄、重點與結構抽取
    site-kit/                   公開文章卡片、SEO 等
    media_lib/                  圖片／檔案庫
    commerce/                   電商，這次不涉及
  core/migrations/              平台 migration
  docs/STUDIO.md                Studio 使用與部署說明
```

前端是 Next.js/React，後端是 Flask/SQLAlchemy；資料模型使用 PostgreSQL JSONB。Happy_Wu 已掛 Studio 前端，且本機 .env 的 `STUDIO_ENABLED=true`、`OWS_BLOG_SCHEMA=blog`、`OWS_IDENTITY_MODE=local`。這只能確認本機設定，正式資料庫、migration 版本及既有資料仍須查驗。

Content 沒有 site_id：站台隔離依賴資料庫連線與 schema，不能只靠指定 SITE_NAME 判斷寫入對象。啟動 importer 前必須核對資料庫、schema、Happy_Wu 帳號與 API 網址。不同站台的 models 會在 import 時讀環境變數，匯入程式應在獨立程序中僅載入 Happy_Wu。

主要證據：`sites/Happy_Wu/backend/app.py`、`config.py`、`frontend/src/app/admin/layout.tsx`；`core/backend_engine/models.py`；`packages/studio/models.py`、`constants.py`、`api/documents.py`。

## 3. 來源資料完整盤點

實際來源：`D:\Obsidian\wu_blog\職場媽媽崩潰啥`。

69 個資料夾：31 個 EP、38 個 MINI。每個資料夾完全相同的六檔結構，共 414 份 Markdown，沒有實體圖片或音訊。

| 每集檔案 | 數量 | 建議目的地 |
|---|---:|---|
| 00_來源對照.md | 69 | StudioSource.note，保留完整原文與來源路徑 |
| 01_部落格長文.md | 69 | StudioDocument(platform=blog)，1:1 綁 Content |
| 02_FB長貼文.md | 69 | StudioDocument(platform=facebook) |
| 03_IG短貼文.md | 69 | StudioDocument(platform=instagram)，保留 Caption 與圖卡腳本 |
| 04_Threads超短文.md | 69 | StudioDocument(platform=threads)，保留主文與留言／串文結構 |
| 05_電子報.md | 69 | StudioDocument(platform=newsletter)，保留候選主旨與 Preheader |

345 份平台文稿全部標示 draft；另外 35 份來源對照也有 draft，34 份來源對照沒有 status。69 篇長文各有一個 H1，也都有標籤，只是標籤寫法不同。

掃描結果：

- 34 篇長文使用文末「標籤：」，35 篇使用 `tags：`，後者另有 `description：`。不要把這些欄位當正文刊出。
- `00` 的上游欄位有「上游路徑」與「來源路徑」兩種，應正規化為 source_path 並保留原始 metadata。
- 全庫有 102 個 `{{PODCAST_URL}}`、108 個 `{{BLOG_URL}}`，分布在 175 份檔案；其中 34 篇長文有 Podcast 占位符。
- 414 檔未發現 http/https URL、Markdown 圖片語法或 Obsidian wikilink。沒有實際節目網址，不能只靠替換器完成補鏈。
- 10 篇長文有表格：EP03、EP06、EP08、EP14、EP15、EP18、EP19、EP22、EP26、EP31。
- 4 份電子報有表格：EP14、EP18、EP23、MINI11。全部 69 份來源對照也有表格。
- IG 的「圖卡」是文字腳本，不是已有圖片檔；電子報也包含編輯用候選主旨。可完整作為工作草稿保存，實際對外發送前再挑選與整理。
- MINI38A、MINI38B 是兩個獨立主題，來源註明節目端重複編號；不能抽成純數字 38 去重。
- 沒有逐字稿本體，只有指向上游知識庫的相對路徑與引文對照。此次是文稿資料庫，不能宣稱已搬入音檔／逐字稿。

完整逐檔清單、metadata、SHA-256、標籤與異常指標見 `source-inventory.json`；69 集人工補值表見 `episode-manifest.csv`。`audit_source.py` 僅讀來源、把報告寫在本目錄，可重跑。

## 4. 欄位轉換規則

| 來源 | 目的欄位／規則 |
|---|---|
| 資料夾 EP03／MINI38A | episode_key；保留字母後綴，source_key 包含節目名稱及檔案相對路徑 |
| 來源集 | StudioProject.title，保留節目原標題 |
| 長文第一個 H1 | Content.title 與 blog document.title；正文移除該 H1，避免頁首標題重複 |
| 其他平台認領選題 | document.title；沒有時用節目名＋平台作穩定 fallback |
| YAML frontmatter | 解析後移出正文；metadata、原文與 checksum 留在匯入封存包／Studio attributes |
| 長文 Markdown | 轉成編輯器可往返保存的 HTML，Content.content 與 blog body 保持一致 |
| 電子報 Markdown | 轉 HTML，候選主旨、Preheader 與正文保留清楚分段 |
| FB／IG／Threads | 依純文字編輯器保存；保留換行和圖卡／串文分段，不轉 HTML |
| description | summary、meta_description 的候選值；長度／語意檢查後採用 |
| 沒有 description | 從開頭導言建立摘要候選，列入人工審閱，不任意截斷完整句子 |
| 標籤／tags | 分割「、」、去空白去重，建立公開 Tag 並寫 tag_ids |
| 分類 | 額外指定 category_id；來源沒有統一分類欄位，不把每集建成分類 |
| draft | Content.status=draft；Studio.stage=write（Studio 不接受 draft 作流程狀態） |
| 建立日期 | 原始資料建立時間，不當成節目播出或官網發布時間 |
| 尚缺發布日期 | 草稿保持 published_at=null；正式發布前補明確時區日期 |
| episode_key | 建議 slug：podcast-ep03、podcast-mini38a、podcast-mini38b |
| 來源對照全文 | StudioSource.note（含原 metadata），匯入紀錄保存 source_id 與 hash |

公網站標籤與 Studio 標籤是不同資料表；可有相同文字，但 ID 不可互用。作者也不是自由填字串：現有文章 POST 固定使用登入帳號為 author_id，PUT 不提供改作者；應使用正確作者帳號或讓受控 importer 透過 ORM 指定已存在的使用者 ID。

`{{BLOG_URL}}` 由確認的正式網域＋固定 slug 產生，不能用 localhost。Podcast URL 需要逐集對照表或後续取得節目 feed。缺值可先留在工作草稿，但正式發布驗收必須清零；另 35 篇沒有 Podcast 占位符的長文，也要決定是否統一補上收聽連結。

## 5. 匯入前需處理的具體問題

### 5.1 HTML 往返與表格

前台 `PostDetailContent.tsx` 用 ReactMarkdown + remarkGfm + rehypeRaw，能顯示 Markdown 及 HTML；但後台 `packages/admin-app/src/components/TiptapEditor.tsx` 直接 setContent 並以 getHTML 儲存，沒有 Markdown 解析層，extensions 也沒有 Table。轉 HTML 並不足以保證表格在再次編輯後仍存在。

建議先替實際使用的 admin-app 編輯器補表格支援，再驗證「匯入 → 打開 → 小幅編輯 → 儲存 → 重開」保留表格、粗體、引文、清單與連結。若選擇不支援表格，必須明確轉為資訊等價的清單並留原始 Markdown，不能默默丟表格。packages/ui 的舊編輯器不是 Happy_Wu 使用的實作，且受凍結契約限制。

### 5.2 草稿存取

靜態原始碼發現：`contents.py` 的兩個 detail GET 以 `not is_preview and not is_logged_in` 才做公開限制，匿名 `?preview=true` 因而可略過 draft 檢查；列表 GET 也接受 status=draft 或空字串而沒有對應登入檢查。這是可從程式確認的缺口，尚未對部署端做重現。

在公開服務匯入草稿之前，應修成匿名請求一律只讀已發布且發布時間已到的文章；預覽必須具備明確權限。補列表、ID、slug、preview、未授權登入使用者等測試，並確認沒有草稿進公開快取。共用 core 修改須照 `docs/FROZEN_CONTRACT.md` 做相容檢查。

### 5.3 寫入 API 與防重複

Content model／回傳 schema 有 attributes、meta_data，但現有 POST/PUT 沒有寫入這兩欄。只把來源 ID 放進 API payload 會被忽略，不能拿它當已完成的溯源功能。

Studio project/document API 支援 attributes，但沒有 source_key 唯一限制；project slug 衝突會自動追加編號。因此反覆 POST 會產生重複專案，現有 slug 自動生成不等於匯入去重。

現有 API 逐次 commit，無法讓整集的專案、文章、五份文件與來源一次原子提交。一次性匯入建議使用獨立 Python CLI，在 Happy_Wu app context 內透過既有 ORM 操作，每集一個 transaction；無須先建批次匯入 UI。CLI 必須補上模型驗證、關聯檢查、快取失效与同步標記，不可假設 ORM 自帶 API 的所有副作用。

若執行環境只允許 API，也可採 API 路線：先建完整 Content 草稿，再建立 blog 文件並傳 content_id 綁定，接著其他文件與來源；需要額外紀錄每一步 ID、處理半成品與重跑，並解決作者與 metadata 限制。

## 6. 推進階段與交付物

### 第一階段：完成可審閱匯入規格

本次已完成全檔盤點、schema/API/編輯器追查，以及初版 69 集 CSV。下一步補上／定案：正式目標站、資料庫、作者、分類、節目 URL、封面策略、發布日期政策。封面可先空白，前台有條件顯示，但公開時應決定採節目共用圖或逐集圖。

只需先決定目標環境與完整 Studio／僅文章範圍，解析與乾跑即可開工；Podcast URL、封面及發布日期可在草稿審閱階段補齊。

### 第二階段：寫純本機 parser 與 dry-run

建議 CLI 子命令為 scan、plan、apply、verify、rollback。先實作 scan/plan：UTF-8/CRLF 正規化、真正 YAML 解析、兩套文尾 metadata、H1 抽取、HTML 轉換、標籤正規化、固定 slug、來源 hash。

產出 import-plan.json、errors.json、每集預覽，以及所有 414 份原始 Markdown 的唯讀封存。plan 明確列新增／跳過／衝突／待補值，這階段不寫資料庫。錯誤與警告分開：無法解析／碰撞是阻擋，草稿缺封面／待補 Podcast URL 是待辦。

### 第三階段：補必要系統能力並準備測試庫

補編輯器表格支援及草稿權限；核對 Happy_Wu migration 與 Studio 啟用，確認正確的本機作者及角色。若需 schema 變更，另建 migration，不以 create_all 代替。目標庫先備份並確認可還原。

### 第四階段：小批試匯入

建議 EP03（長文表格／舊格式）、EP14（電子報表格）、MINI02（新式 description/tags）、MINI38A 與 MINI38B（編號碰撞）共五集。

驗證 5 projects、25 documents、5 sources、5 contents 的關聯；只計該批次新增差額。測後台完整编辑往返、公開預覽／草稿權限、Podcast URL／文章 URL、分類與標籤、中文與 emoji。再次 apply 同一批時新增筆數必須為 0。

### 第五階段：全量草稿匯入

用確認後的 snapshot 及 plan 一次性執行，逐集交易。source_key 建議「節目命名空間／episode_key／檔案種類」，保存 source hash、轉換版本、batch_id 與所有目標 ID。外部 batch manifest 也要保留，避免只依賴数据库標記。

同 key 同 hash → skip；同 key 不同 hash → conflict；不同來源碰到既有 slug → conflict。不可自動覆蓋人工改過的內容。只允許單一匯入程序執行，或以資料庫鎖／唯一約束保護，避免並行重複。重跑時核對實際資料庫及 checksum，不能只看上次終端輸出。

為每份平台文件保存一筆命名版本「初次匯入」，並保存原 Markdown 與 metadata。 blog document 與 content 的內容及同步標記要一致。來源 Source 本身沒有 attributes，將 source_id/hash 留在 manifest 或 project.attributes。

### 第六階段：驗收與發布

預期新增總量：69 projects、345 documents、69 sources、69 contents；命名版本若每文件一筆為 345 筆。文章是 345 文件中的 69 份 blog 所綁定的資料，不是額外 69 份原文。

程式驗收全部文章的標題、分類、標籤、body 字元／結構摘要、source key、hash、關聯與草稿狀態。前端抽查長文、表格、電子報及 MINI A/B。重跑不得新增，匯入後的人工修改不得被覆蓋。

發布可獨立分批或一次執行，需把 article status 與 Studio 文件 stage 同步。Studio「發布中心」記錄社群狀態並不代表已發送到 Facebook、IG、Threads 或電子報服務；目前此 API 只更新資料與版本紀錄。官網 blog 正式發布走 sync-to-content，更新公開快取與 Next.js ISR；ORM 批次也必須在交易完成後觸發相應失效。

回復只能依 batch manifest 處理該批資料，先比對匯入後有無修改。注意刪除 Studio project/document 不會順便刪除綁定 Content；回復程序須逐一處理關聯、文章、版本，再視引用清理此次新增標籤與分類。已被人工修改／其他文章引用的資料不可盲刪。

## 7. 尚待確認與驗證範圍

- 正式部署是否與本機程式一致、資料庫與 schema 實際名稱、migration 目前版本。
- 既有文章／專案／標籤／作者資料，是否有已匯入或同 slug 內容。
- 實際登入權限、備份方式、目標網域及 revalidate 設定。
- 真實節目 URL／播出日期、圖像素材、作者與分類政策。
- 本次沒有逐篇進行內容事實查核或醫療／法律等編輯審閱；來源對照提及敘事潤飾與自創操作建議，原本 draft 狀態應保留到編輯確認。

建議下一個實作里程碑：完成 parser 與全量 dry-run，並提供上述五集的可審閱預覽。通過後再做五集測試庫匯入與全量草稿移轉。
