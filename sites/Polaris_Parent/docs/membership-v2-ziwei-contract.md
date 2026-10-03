# 會員 v2 × 紫微系統介接契約（第 1 步產出）

日期：2026-10-03。狀態：**已確認（2026-10-03）**；§4.5 修正已完成。依據：唯讀檢查紫微系統 `D:\P_Polaris_Parent\1_run`（PolarisUI/backend、P_Union）與本 repo 現行程式；尚未連線核對實際資料庫。上層文件：[規劃](membership-v2-planning.md)、[實作架構](membership-v2-architecture.md)。

## 1. 核對結論

| 問題 | 結論 | 依據（紫微 repo 路徑） |
| --- | --- | --- |
| save-and-register 會不會啟動報告生產 | **不會**。同步算盤＋寫命盤，不碰 LLM、workflow、報告；也不寫 252 筆流運 | `PolarisUI/backend/routes/public_charts.py:106-202`；`chart_upload.py:115-119` |
| 報告現在怎麼產出 | **全程人工操作**：編輯在 PolarisUI 跑 workflow（約 34–63 次 LLM 呼叫）→ 人工逐項審稿 → 組書 → 匯出 zip → **人工在 InDesign 排版出 PDF** | `main.py:744-827`；`routes/book.py:141-191, 658-690`；`book_compose.py:861-910` |
| 有沒有可交付的 PDF 成品表 | **沒有**。`account.chart_artifacts` 存 JSON/markdown 書稿；最終 PDF 在系統外產生、未存回系統 | `artifact_store/store.py:214-267` |
| graph.graph_reports 是什麼 | **分析表，不是成品**（確定性分析段落，原地覆寫、無版本） | `p_a_foundation/sql/12_create_graph_schema.sql:184-213` |
| 有沒有工作佇列 | 只有行程內 thread＋`account.workflow_jobs` 紀錄；重啟即中斷、不重試、無自動觸發 | `main.py:551-594, 815-869` |
| 完成後會不會通知外部 | **不會**，也沒有任何 order／paid／webhook 概念 | 全 backend 搜尋無結果 |
| 會員帳號 | `account.app_users`：email 存在 `username`（UNIQUE）、id 為 BIGINT、**無 email 欄位與驗證旗標**、password_hash NOT NULL | `auth.py:84-106` |
| 命主與擁有者 | 擁有者＝`app_users.id`；命主＝`account.users`（`owner_member_id`、`relation_label VARCHAR(20)`）；命盤＝`account.user_profiles` | migrations 0004、0005 |
| 出生資料版本 | **沒有版本概念**；後台修改出生資料是原地更新，且不重算編碼 | `routes/profiles.py:83-99, 590-630` |
| migration 版本表衝突 | 無衝突：紫微用 `public.alembic_version`，OWS 各鏈用 blog schema 下的獨立版本表 | `p12_sql/migrations/env.py:69`；本 repo `core/migrations/env.py:32-45` |

**對設計的影響**：「付款後紫微自動產出報告」目前不存在。v2 的生產交接要設計成**付款後在紫微端排入一張人工工作單**，編輯照現行產線完成後，把最終 PDF 上傳回系統，官網再交付給會員。交期以「天」計，不是即時。

## 2. 寫入權責矩陣

原則：各系統只寫自己擁有的表；跨系統一律經紫微 `/public/*` 服務 API（`X-Service-Token`），不直接寫對方的表。OWS 的 `blog_app` 角色對 `account.user_profiles` 沒有 REFERENCES 權限，所以 OWS 表對紫微 id 一律**軟參照**（存 id、不建 FK），歸屬在寫入時經 API 驗證（沿用 v1 `models.py:66-68` 的做法）。

### 紫微擁有

| 表 | 紫微寫 | OWS 寫 | OWS 讀 | 備註 |
| --- | --- | --- | --- | --- |
| account.app_users | save-and-register 建立免密碼會員 | `username`、`password_hash`、`is_active`（經 `blog.users` view 與 trigger，core `member_auth.py:115-127`） | 是 | 兩邊都會建帳號，一律「先查再建」 |
| account.users（命主） | 建立、`owner_member_id`、`relation_label` | 否（改名、關係經 PATCH API） | 經 API | |
| account.user_profiles 與命盤衍生表 | 是 | 否 | 經 API | |
| account.user_fortune_codes | 升級／降級 API | 否 | 否 | v2 報告不需要流運列 |
| account.chart_artifacts（書稿、成品 PDF） | 是 | 否 | 經 API | 新增成品種類見 §4 |
| account.report_requests（新） | 狀態、指派、成品回填 | 否（經 API 建立） | 經 API | 見 §4 |
| account.workflow_jobs、workflows | 是 | 否 | 否 | |
| graph.*、search.*、biography.* | 是 | 否 | 否 | |

### OWS 擁有

| 表 | OWS 寫 | 紫微寫 | 紫微讀 | 備註 |
| --- | --- | --- | --- | --- |
| blog.member_profiles | 是（加 `email_verified_at`） | 否 | 否 | |
| shop.orders、order_items、payment_*、order_invoices | 是 | 否 | 否 | 紫微不需要知道金流細節 |
| shop.report_fulfillments（新） | 是 | 否 | 否 | 交接狀態、紫微狀態快取、交付紀錄 |
| shop.shipments（新） | 是 | 否 | 否 | 印刷廠在系統外，由管理者登錄 |

## 3. OWS 端資料表變更清單

2026-10-03 已實作並在本機驗證（正式庫尚未套用）。

| 鏈 | 表 | 重點欄位 | 狀態 |
| --- | --- | --- | --- |
| commerce `0002_orders_v2` | shop.order_checkouts（1:1 orders） | `submission_key`（UNIQUE，防重複送出）、`policy_version`、`policy_consented_at`、`expires_at` | ✅ |
| commerce | shop.order_items | `item_no`（UNIQUE，也是紫微工作單編號）、`product_id`、`product_code`／`name` 快照、`variant`（digital／physical）、`kind`（purchase／addon）、`parent_item_id`、`unit_price`、`currency`、`quantity`、`customization` JSONB | ✅ |
| commerce | shop.payment_attempts | 見實作架構 §4；部分唯一索引保證同一訂單最多一筆 succeeded | ✅ |
| commerce | shop.payment_notifications | 通知原文、驗證結果、處理結果 | ✅ |
| commerce | shop.order_invoices | 開立方式、載具／統編／愛心碼、開立結果；發票未開時 `not_applicable` | ✅ |
| commerce | shop.order_notifications | `dedupe_key` UNIQUE，寄信去重 | ✅ |
| Polaris 站台 `0004_membership_v2` | shop.report_fulfillments | `order_item_id`（UNIQUE）、`request_no`（UNIQUE）、`member_id`、`chart_id`／`person_user_id`（軟參照）、`environment`、`handoff_status`（not_ready／pending／sent／failed／cancelled）、`handoff_attempts`、`last_error`、`ziwei_status`、`member_note`、`deliverable_ready_at`、`synced_at` | ✅ |
| Polaris 站台 | shop.shipments | `order_item_id`（UNIQUE）、收件人快照、`status`（pending／printing／shipped／delivered／cancelled）、`printer`、`carrier`、`tracking_no`、各狀態時間、`updated_by` | ✅ |
| Polaris 站台 | blog.member_email_verifications | `app_user_id`（PK）、`email`、`verified_at` | ✅ |
| 待定（做登入時） | Email 驗證碼表 | email、用途（註冊／重設密碼）、雜湊後驗證碼、到期、嘗試次數 | 未做 |

與原草案的差異：

- **不在既有表加欄位**：Claire 的庫不跑 commerce 鏈，`orders` 多一個欄位就會讓 Claire 查訂單失敗；結帳資訊改放新表 `order_checkouts`。`blog.member_profiles` 由 postgres 以 SQL 建立，blog_app 無法 ALTER，Email 驗證改放新表 `member_email_verifications`（並記錄是哪個 Email 通過驗證，改 Email 後需重新驗證）。
- **出生資料與讀者設定的快照放在 `order_items.customization`**（購買者填寫內容的通用快照），`report_fulfillments` 不重複存；共用電商套件不出現命盤欄位。

`customization` 內容（Polaris 報告商品）：`subject_name`、`gender`、`birth`（年月日時分、曆法、閏月）、`place`、`relation_label`、`audience`（讀者身分、書中稱呼、題字）。

不改既有欄位型別、不刪欄位；`orders.items` JSONB 照舊寫入，維持 Claire、Happy_Wu 現行行為。

## 4. 紫微端變更清單

這些改動在紫微 repo，以紫微的 Alembic 鏈管理。

### 4.1 新表 account.report_requests（製作工作單）

| 欄位 | 說明 |
| --- | --- |
| `id` | PK |
| `request_no` | UNIQUE；等於 OWS `order_item_no`，作為冪等鍵 |
| `env` | `test`／`live`；`test` 工作單不進正式工作佇列 |
| `member_id` | FK → app_users |
| `chart_id` | FK → user_profiles |
| `plan_name`、`edition` | 例：`vault_v1`、`''`（本命書） |
| `variant` | `digital`／`physical`（實體需要另產送印檔） |
| `audience` | JSONB：讀者身分、書中稱呼、題字（客製頁 `p01-custom` 的內容來源） |
| `status` | `queued` → `in_progress` → `needs_info` → `completed`；另有 `failed`、`cancelled` |
| `member_note` | 可顯示給會員的進度說明 |
| `needs_info_code`、`internal_error` | 內部錯誤只給管理者看 |
| `assigned_to` | 負責編輯 |
| `pdf_artifact_id`、`print_artifact_id` | FK → chart_artifacts |
| `paid_at`、`created_at`、`updated_at`、`completed_at` | |

### 4.2 成品 PDF 存放

- `chart_artifacts` 新增 `kind`：`book_pdf`（會員下載用）與 `book_print_pdf`（送印檔，含出血）。payload 存 `{storage, key, sha256, bytes, pages}`，不把檔案塞進 JSONB。
- 檔案放在紫微現有的 GCS（`artist/storage_gcs.py`），使用**私有** bucket 或路徑，不公開讀取。
- PolarisUI 加「上傳最終 PDF」功能：編輯在 InDesign 輸出後上傳，上傳完成時把工作單標為 `completed`。

### 4.3 新服務 API（`X-Service-Token`）

| 方法與路徑 | 用途 | 冪等 |
| --- | --- | --- |
| `POST /public/report-requests` | OWS 付款確認後建立工作單 | `request_no` 已存在就回原單 |
| `GET /public/report-requests/{request_no}` | 查詢狀態、會員可見說明、成品是否就緒 | — |
| `GET /public/report-requests/{request_no}/download-url?kind=pdf\|print` | 回傳 5–10 分鐘有效的 GCS 簽名網址 | — |
| `POST /public/report-requests/{request_no}/cancel` | 例外處理時取消（只限尚未完成的單） | 是 |

OWS 一定要先確認登入會員擁有該訂單項目，才代為呼叫下載 API。紫微端也比對 `member_id`。

### 4.4 PolarisUI 工作佇列

新增「訂單工作單」頁：列出 `live` 且 `queued`／`in_progress`／`needs_info` 的單，點進去直接開該命盤的命主工作台，並帶入 `audience`。可標記待補資料（附會員可見說明）、上傳 PDF、完成。

### 4.5 既有 save-and-register 修正（2026-10-03 已完成，尚未 commit）

修改位置：紫微 repo `PolarisUI/backend/routes/public_charts.py`、`modules/ziwei/logic/chart_input/chart_upload.py`；測試 `PolarisUI/backend/test_public_charts.py`（9 項，全數通過）。

| 原問題 | 修正後行為 |
| --- | --- |
| 去重鍵不含性別，性別不同也回傳舊盤 | 去重鍵加入性別：性別不同就建立新盤 |
| 出生地不同時被靜默忽略 | 出生地不參與排盤（只是描述欄位），所以仍回傳既有盤，但回應帶 `place_differs: true` 與已存的 `place` |
| 歸戶 UPDATE 失敗不檢查 | 失敗回 500；重試走重存分支時，若命主仍無主會自動補歸戶 |
| `relation_label` 超過 20 字讓歸戶靜默失敗 | 在任何寫入之前檢查長度，超過回 400（PATCH 路由同樣檢查）；不做白名單，避免影響既有呼叫端 |
| 暫存檔與合併檔以「年份＋姓名」命名，會互相覆寫、個資留在磁碟 | 會員盤改以 chart_id 命名；上傳成功不留合併檔，失敗才留在 `fail_upload/` 供除錯；暫存檔在例外時也會清除 |
| 服務 token 用 `!=` 比對 | 改用 `hmac.compare_digest`，未設定 token 時仍一律拒絕 |

回應新增欄位：`gender`、`clock_time`、`place`、`place_differs`。OWS 建單前應核對 `gender` 與 `clock_time` 等於送出值；`place_differs` 為真時以 OWS 的 `customization` 為準，不需要擋單。

仍未處理：同一筆資料**同時**送兩次時，第二筆可能回 500（主鍵衝突）。OWS 以 `submission_key` 防重複送出，重試時會走重存分支拿到同一張盤，可接受。

## 5. 端到端流程

1. **送出訂單（未付款）**：會員已登入且 Email 已驗證 → OWS 呼叫 save-and-register（帶會員本人 Email、固定的 `relation_label`）→ 拿到 `chart_id`、`person_user_id` → 建立 `orders`＋`order_checkouts`＋`order_items`（出生資料與讀者設定存於 `customization`）＋`report_fulfillments`（`handoff_status=not_ready`），訂單狀態為待付款。
   - 核對回應的 `gender`、`clock_time` 與 `customization` 一致，不一致就拒絕建單（防禦性檢查；§4.5 已修正去重邏輯）。
2. **付款成功**（綠界或人工確認）：同一 transaction 內更新訂單、付款嘗試，並把 `report_fulfillments.handoff_status` 從 `not_ready` 改為 `pending`（建單時已建立）。佔位模式不會走到這一步。
3. **交接**：transaction 提交後呼叫 `POST /public/report-requests`；失敗則留在「待送出」，由排程或後台按鈕重送（冪等）。
4. **製作**：紫微編輯照現行產線製作 → 審稿 → 組書 → InDesign 排版 → 上傳 PDF（實體版另傳送印檔）→ 標為完成。
5. **同步**：OWS 排程每 10–15 分鐘查詢未完成工作單的狀態並更新 `ziwei_status`；會員開「我的報告」時也即時查一次。狀態有變就寄對應通知信（待補資料、報告完成）。
6. **交付**：會員按下載 → OWS 核對擁有權 → 向紫微取簽名網址 → 302 導向。實體版由管理者取得送印檔交給印刷廠，在 `shipments` 登錄進度與單號 → 寄出貨通知。

會員看到的製作狀態（由 `ziwei_status` 對照）：待製作 → 製作中 → 待補資料 → 完成。

## 6. 需要你確認的決定

2026-10-03 使用者已確認第 1–4 項（工作單放紫微端、PDF 放紫微 GCS、訂單表單收讀者身分／書中稱呼／題字、交期以工作天計且天數之後設定）；第 5 項已修正完成。

1. **工作單放紫微端（建議）還是 OWS 端？** 建議放紫微：紫微編輯直接在自己的系統操作，OWS 只透過 API，不必開跨 schema 寫入權限。代價是付款與交接無法同一 transaction，所以要靠 `report_fulfillments` 的待送出與重送機制補上。
2. **成品 PDF 存紫微的 GCS（建議）**，由紫微發簽名網址；不另接 R2。
3. **訂單表單要不要多收「讀者身分、書中稱呼、題字」？** 紫微產線本來就有讀者設定（本人／父母／伴侶／子女／朋友…），客製頁 `p01-custom` 目前也沒有內容來源，正好用購買者的題字填上，接近 Wonderbly 的體驗。建議收，題字為選填。
4. **交期**：每本約 34–63 次 LLM 呼叫，加上名人研究、人工審稿與 InDesign 排版，商品頁的交期要以工作天計（實際天數之後設定）。
5. ~~§4.5 的 save-and-register 修正~~：已於 2026-10-03 完成（見 §4.5），待使用者 commit。

## 7. 對開工順序的影響

- 第 2 步的官網骨架（商品頁、表單、確認頁、註冊登入、佔位付款、order_items）不受紫微端影響，確認後即可開工。
- 交接、同步、下載（實作架構第 3 步）要等紫微端完成 §4.1–§4.3。
- 紫微的工作佇列頁與 PDF 上傳（§4.4、§4.2）是紫微 repo 的工作，可與官網第 2 步並行。
