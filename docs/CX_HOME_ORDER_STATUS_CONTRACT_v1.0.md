# 親紫之間｜Home 訂單狀態機技術契約（v1.0）

**層級：** L2 契約草案（僅文件；不含正式部署、不含程式變更）
**定案回填：** 2026-11-05 fulfill＝董事長／指定管理者；對客檔＝PDF。
**E1 終裁：** 「E1：暫停時收回下載；改程式二期 L3；首單暫停單不代傳、不給連結。」（董事長於 Berry t18s1（2026-11-05 20:56 Asia/Taipei）點選原文；Cook 轉達終裁）
**日期：** 2026-11-05（Asia/Taipei）
**起草：** Poteto（Home／Run 拆解）
**上游：** `CX_DELIVERY_HANDOFF_MIN_v1.0.md`（Berry 交驗，Cook 2026-11-05 通過，v1.0.1 修訂）
**對齊：** `REPORT_QC_WORKFLOW_v1.0.md`；`sites/Polaris_Parent/docs/membership-v2-ziwei-contract.md`
**範圍：** 顧客可見的「報告訂單交付狀態」——Home（官網訂單頁）側。Run（紫微產線）側只定介面，不定內部流程。
**性質：** 對內。首單過渡期的人工銜接寫在 §4，勿對外發布。

**證據標記：**
`【已驗證】` = 讀過 `origin/main` 程式碼或 DB 約束直接可證
`【推論】` = 由已驗證的程式路徑合理推得，但沒有實際跑過
`【假設】` = 契約為了可施工而先行假定，須由指定對口確認

---

## 0. 讀這份文件前要先知道的三件事

**首單對客交付檔＝PDF。** 【已驗證】 路徑 A／B 落地的都是 `ReportDocument(kind='book_pdf')`；Cook＋Berry 2026-11-05 鎖定對客包為 PDF（文本＋圖組書後匯出之交客 PDF），不含合規／品質分報。

1. **官網沒有「已交付」這個狀態欄位。** `【已驗證】` 訂單只有三個狀態（`pending` / `paid` / `cancelled`，見 §1.1）。顧客眼中的「已交付」在現行程式裡是一個**推導結果**：「這張訂單底下存在一份 current 的報告 PDF」。

2. **「已交付」的顧客入口在程式裡已經存在，但從沒被真實顧客走過。** `【已驗證】` 前端 `ReportDownload` 區塊與短效網址 API 都在 `origin/main`（也在落後兩個 commit 的本機 main）；`【推論】` 它的顯示條件是 `order.report != null`，而該欄位要有一份已上傳的 `ReportDocument` 才會非空——目前沒有任何真實交客單產出過這份文件，所以上游「Poteto-Home：訂單頁僅到待付款／匯款說明」的描述在**實際觀測上成立**，在**程式能力上不成立**。這兩件事要分開記，否則二期會重做已經有的東西。

3. **`human_released`、`preview_sampling`、`chart_artifacts` 不是 Home 的詞彙。** `【已驗證】` 這三個詞在 `sites/Polaris_Parent/backend/` 全無出現（`chart_artifacts` 只在三份規劃文件中被引用）。它們是 Run 側的狀態；Home 只能透過 §3 的介面間接知道。

---

## 1. 現況盤點（狀態欄位的真相）

### 1.1 `shop.orders.status`——唯一的顧客可見訂單狀態

`【已驗證】`（`packages/commerce/models.py`；前端 `(public)/report/orders/[order_no]/page.tsx`）

| 值 | 前端文案（`ORDER_STATUS`） | 備註 |
| --- | --- | --- |
| `pending` | 待付款 | 徽章色 warning |
| `paid` | 已付款，報告製作中 | 徽章色 success |
| `cancelled` | 已取消 | 徽章色中性 |

**沒有** `delivered` / `fulfilled` / `released` 任何值。這是整個銜接缺口的根。

### 1.2 徽章實際顯示的優先序

`【已驗證】` 前端徽章不是直接印 `ORDER_STATUS[status]`，而是一條五段優先序：

```
1. fulfilment_control.blocked || commerce.external.fulfilment_blocked  → 「後續履約暫停」
2. isAddon && status === 'paid'                                        → 「已付款」
3. order.report                                                        → 「報告已完成」
4. order.production.progress.status_label                              → 產線標籤（§1.4）
5. ORDER_STATUS[status]                                                → 待付款／已付款，報告製作中／已取消
```

也就是說，**顧客看到的「狀態」是四個不同資料來源的疊加結果**，而不是一個欄位。這是本契約要收斂的主要風險。

### 1.3 `shop.report_fulfillments.handoff_status`——內部交接狀態

`【已驗證】` DB CheckConstraint `ck_report_fulfillments_handoff_status`：
`not_ready`（未付款）→ `pending`（待送出）→ `sent`（紫微已建工作單）；失敗 `failed`（可重送）；例外 `cancelled`。

**不對顧客顯示。** 由 `payment.prepare_fulfilment` 在付款同一交易內把 `not_ready` 改成 `pending`，再由背景排程 `jobs.handoff_reports` → `handoff.send()` 送出。

### 1.4 `shop.report_fulfillments.ziwei_status`——產線進度快取

`【已驗證】` `progress.LABELS`（非 DB enum，`sync_one` 以此集合做白名單驗證）：

| 值 | 顧客可見標籤 |
| --- | --- |
| `queued` | 待製作 |
| `in_progress` | 製作中 |
| `needs_info` | 待補資料 |
| `completed` | 製作已完成，待交付 |
| `failed` | 製作待處理 |
| `cancelled` | 製作已取消 |

`【已驗證】` 這是**唯讀輪詢**（`progress.py` 檔頭明寫 "Never grants rights or publishes a document"）。`completed` **不會**讓顧客拿到檔案——它只是把徽章文字換成「製作已完成，待交付」。這正是契約裡「處理中」與「已交付」之間那道必須人工跨越的門。

### 1.5 「已交付」的真實判定式

`【已驗證】` `service.order_summary()`：

```python
'report': delivery.current_document(item) → document_view(...)
          if item.kind == 'purchase' and order.status == 'paid' else None
```

`delivery.current_document()` 取 `ReportDocument(order_item_id, kind='book_pdf', is_current=True)`。

→ **交付 = 存在一份 is_current 的 book_pdf，且訂單已付款，且主項目是 purchase。**

`【已驗證】` 首次上傳時 `ReportFulfillment.deliverable_ready_at` 會被蓋上時戳，並呼叫 `commerce.complete(item, 'report', ...)` 結掉資格。這兩者是目前最接近「已交付時間」的欄位。

### 1.6 產生那份 PDF 的兩條路

`【已驗證】` 兩條都是**管理者明確操作**，沒有任何自動觸發：

| 路徑 | 端點 | 權限 | 說明 |
| --- | --- | --- | --- |
| A 人工上傳 | `POST /api/v1/admin/report-orders/:order_no/report-pdf` | `report_orders.fulfill` | 直接 multipart 上傳 PDF |
| B 產線匯入 | `GET` 查版本 → `POST /api/v1/admin/report-orders/:order_no/production-artifact` | `report_orders.fulfill` | 先取 Run 的 manifest（`/public/report-requests/:no/artifact`），比對 `request_no`／`order_no`／`member_id`／`chart_id`／`language`／`env`／`product_code`／`variant` 全等＋`sha256`＋`bytes`，再抓檔、重算雜湊、再比一次 manifest，才落地 |

`【已驗證】` 兩條路首次成功後都會寄 `report_ready` 信（`notify.send_report_ready`）。

`【已驗證】` 寄出前還有 `notification_gate.decision()` 把關：若當下 `delivery.current_document()` 已不存在就 `skip`（「目前沒有可下載的報告，停止寄送舊通知」），若履約暫停則 `defer`。

### 1.7 履約暫停（異常分支的既有機制）

`【已驗證】` `control.py`，存在 `Order.attributes.fulfilment_control`：
`desired` ∈ {`active`, `paused`}；`sync` ∈ {`synced`, `pending`, `attention`}；
`blocked = (desired == 'paused') or (sync != 'synced')`。

前端 `blocked` 時顯示「後續履約暫停」＋「後續製作暫停處理中，請聯絡客服。此狀態不表示已退款。」

`【已驗證】` 暫停／恢復需帶 `expected_revision`（樂觀鎖），恢復時會重跑全部資格檢查。

### 1.8 付款模式

`【已驗證】` `payment.mode` ∈ `placeholder`（付款未開放，訂單停在待付款）／`manual`（轉帳＋顧客回報末五碼，管理者對帳）／`external_verified`（外部平台成交已核對）。

`【已驗證】` 上游說的「轉帳 manual」對應第二種，顧客回報後 `transfer.status === 'created'`，前端顯示「已收到你的轉帳回報，我們對帳後會寄信通知你」。**入帳確認是人工的**，沒有任何金流 webhook。

### 1.9 另一條獨立軸：實體書

`【已驗證】` `physical.STATUS_LABELS`：`awaiting_payment` / `awaiting_customization` / `awaiting_proof` / `proof_ready` / `changes_requested` / `approved` / `printing` / `shipped` / `delivered` / `cancelled`。

**這是實體書的狀態，不是報告交付的狀態。** 本契約不改它；只規定 §2 的三態判定不得被實體書狀態污染（§5 驗點 7）。

---

## 2. 狀態機（契約本體）

### 2.1 顧客可見三態＋兩個異常分支

```
                   ┌──────────────┐
      下單成立 ───▶ │ S1 待付款     │
                   └──────┬───────┘
                          │ T1 管理者確認入帳
                          ▼
                   ┌──────────────┐        T4 管理者暫停履約
      ┌──────────▶ │ S2 處理中     │ ──────────────────────▶ ┌──────────────┐
      │            └──────┬───────┘                          │ E1 暫停處理中 │
      │ T5 恢復履約        │ T2 交付物落地（§1.5 判定式成立）   └──────┬───────┘
      └───────────────────┼─────────────────────────────────────────┘
                          ▼
                   ┌──────────────┐
                   │ S3 已交付     │ ◀── T3 更正重傳（仍為 S3，版本遞增）
                   └──────────────┘

      S1 ──── T6 逾期／取消 ───▶ ┌──────────────┐
      S2 ──── T7 退件取消 ─────▶ │ E2 已取消     │
                                 └──────────────┘
```

### 2.2 狀態定義（以可查詢的條件寫，不以人的感覺寫）

| 狀態 | 判定條件（唯一真相） | 現況支援 |
| --- | --- | --- |
| **S1 待付款** | `order.status == 'pending'` 且未 blocked | `【已驗證】` 已有 |
| **S2 處理中** | `order.status == 'paid'` 且 `order.report == null` 且未 blocked | `【已驗證】` 已有（文案為「已付款，報告製作中」或產線標籤） |
| **S3 已交付** | `order.status == 'paid'` 且 `order.report != null` 且未 blocked | `【已驗證】` 判定式與前端區塊都已存在；`【推論】` 從未被真實單觸發 |
| **E1 暫停處理中** | `fulfilment_control.blocked` 或 `commerce.external.fulfilment_blocked` | `【已驗證】` 已有 |
| **E2 已取消** | `order.status == 'cancelled'` | `【已驗證】` 已有 |

**S2 的內部細分（顧客可見、但不構成新狀態）：** `production.progress.status_label`（§1.4）。

契約規定：**`ziwei_status == 'completed'` 仍然是 S2**，文案「製作已完成，待交付」。這是刻意的——Run 說做完了，不等於 Berry 已經交到顧客手上。

### 2.3 轉移觸發（誰觸發、訊號從哪來、首單 vs 二期）

| # | 轉移 | 觸發者 | 訊號來源 | 首單（過渡期） | 二期（目標態） |
| --- | --- | --- | --- | --- | --- |
| **T1** | S1 → S2 | **人**：管理者（對帳） | 顧客回報轉帳 → 管理者在後台按「確認收款」 | `【已驗證】` 現行即如此。Mango 確認收款後通知管理者操作 | 不變。`【已驗證】`「收款自動觸發產線」明列不進首單（§4.4） |
| **T1b** | （S2 內）建工作單 | **系統**：`jobs.handoff_reports` 背景排程 | `handoff_status` `pending` → `sent` | `【已驗證】` 已自動。失敗自動重試，用完次數後每 12h 再試並寄管理者警示 | 不變 |
| **T1c** | （S2 內）進度更新 | **系統**：`jobs` 輪詢 Run | `GET /public/report-requests/:no` → `ziwei_status` | `【已驗證】` 已自動，成功後約 5 分鐘一輪、失敗指數退避最長 1h；逾 15 分鐘未同步標 `stale` | 不變 |
| **T2** | S2 → S3 | **人**：Berry／管理者 | **這是契約的核心缺口。** 唯一合法訊號＝§1.6 的 A 或 B 成功落地一份 `ReportDocument` | 首單走 **路徑 A 人工上傳**：審查員放行後把完成檔交 Berry；Berry **核對** formal＋`human_released` 後**指示**上傳；**實際上傳**＝董事長／指定管理者（持 `report_orders.fulfill`）。Berry **不**持後台 fulfill 權限。`【已裁｜Cook＋Berry 2026-11-05】` | 走 **路徑 B 產線匯入**：`【已驗證】` 程式已在 `origin/main`，但須 Run 側提供 `/artifact` 與 `/artifacts/:v/file` 且其放行條件綁 `human_released`。`【假設】` Run 側端點是否已實作＝待 Apple／Run 確認 |
| **T3** | S3 → S3（更正） | **人**：管理者 | 重新上傳／匯入更高版本 | `【已驗證】` 舊文件 `is_current=False`，新文件遞增；`report_ready` 信**不重寄**（`first_time` 為 False）。首單若更正須人工告知顧客 | 加「報告已更新」通知（L3） |
| **T4** | S2 → E1 | **人**：管理者 | 後台履約控制面板，帶 `expected_revision` | `【已驗證】` 已有 | 不變 |
| **T5** | E1 → S2 | **人**：管理者 | 同上，`desired='active'` | `【已驗證】` 已有；恢復時重跑全部資格檢查 | 不變 |
| **T6** | S1 → E2 | **系統**：逾期自動取消 | `checkout.expires_at` 到期 | `【已驗證】` 前端已明示「逾期未回報轉帳，訂單會自動取消」 | 不變 |
| **T7** | S2 → E2 | **人**：管理者（退件） | 人工取消訂單 | `【推論】` 已付款後取消的退款是人工轉帳（前端文案：「已付款的金額會以轉帳退還，完成後寄信通知你」） | 不變 |

**契約硬規則（不得違反）：**

- **R1**：T2 只能由「`ReportDocument` 落地」這一個事實驅動。**禁止**用 `ziwei_status == 'completed'`、`deliverable_ready_at`、或任何 Run 側狀態單獨把顧客頁翻成「已交付」。`【已驗證】` 現行程式已符合，本規則是防止二期為了方便而退化。
- **R2**：交客檔**不含**合規／品質分報（上游 v1.0.1 Apple／Cook 裁定）。路徑 B 的 manifest 只接 `kind == 'book_pdf'` `【已驗證】`，天然符合；路徑 A 靠人（§4 第 5 步）。
- **R3**：`preview_sampling` 類抽樣件永不進交付。`【已驗證】` 路徑 B 的 `identity()` 比對含 `env`（`test`／`live`），測試件無法混入 live 單。路徑 A 無此保護，靠 §4 人工。
- **R4**：E1（暫停）優先級高於 S3，且**目標態＝收回下載入口**。`【已驗證】` 現行仍同時顯示「後續履約暫停」與下載（程式尚未收回）。`【已裁｜董事長原文】` 「E1：暫停時收回下載；改程式二期 L3；首單暫停單不代傳、不給連結。」。改程式＝二期 L3；首單靠流程：暫停單**不代傳、不給連結**。下架／內容有誤走 **T3**，不綁 E1。

---

## 3. 每狀態的前端文案與可見元素（目標態定義）

此節是**目標態**。「現況」欄標明今天是否已經長這樣。
位置皆指 `/report/orders/[order_no]`（`(public)` 與 `[locale]` 兩套路由同構）。

### S1 待付款

| 元素 | 內容 | 現況 |
| --- | --- | --- |
| 頁首 | 「訂單已成立」＋訂單編號 | `【已驗證】` 已有 |
| 狀態徽章 | **待付款**（warning 色） | `【已驗證】` 已有 |
| 轉帳資訊卡 | 銀行／代碼／帳號／戶名／金額／匯款期限 | `【已驗證】` 已有（`payment.mode == 'manual'`） |
| 警示 | 「逾期未回報轉帳，訂單會自動取消。我們確認入帳後才會開始製作報告。」 | `【已驗證】` 已有 |
| 轉帳回報表單 | 末五碼＋轉帳日期＋金額＋備註 | `【已驗證】` 已有 |
| 回報後 | success：「已收到你的轉帳回報，我們對帳後會寄信通知你。」＋可重填 | `【已驗證】` 已有 |
| 核對失敗 | error：「轉帳資料無法核對：{review_note}。請確認後重新回報。」 | `【已驗證】` 已有 |
| 下載入口 | **不出現** | `【已驗證】` `order.report` 需 `status == 'paid'` |
| `placeholder` 模式 | 「付款功能尚未開放，訂單已保留為『待付款』…」 | `【已驗證】` 已有 |

### S2 處理中

| 元素 | 內容 | 現況 |
| --- | --- | --- |
| 狀態徽章 | 無產線進度時：**已付款，報告製作中**；有進度時：§1.4 標籤 | `【已驗證】` 已有 |
| 收款確認列 | 「確認收款 {時間}」（`external_verified` 顯示「平台成交確認」） | `【已驗證】` 已有 |
| 主要說明（無進度） | success：「已確認收款，報告製作中。完成後會寄信通知你，到這個頁面就能下載。」 | `【已驗證】` 已有 |
| 產線進度卡（有進度） | info：進度標籤＋`member_note`（若有）＋`stale` 時加「進度待更新，以上為最近取得的狀態。」 | `【已驗證】` 已有 |
| `completed` 時 | 「製作已完成，待交付」——**不得**出現下載入口或「可取件」字樣 | `【已驗證】` 現行即如此 |
| 下載入口 | **不出現** | `【已驗證】` `order.report == null` |

**目標態補強（二期，L3 部署）** `【假設】` 文案待 Lemon 定稿：

- `needs_info`（待補資料）應附一句「我們需要你補一點資料，已寄信給你」＋客服聯絡方式。現行只印標籤，顧客不知道要做什麼。
- `failed`（製作待處理）對顧客顯示「製作待處理」語意偏弱，建議改為「我們正在處理，進度稍後更新」並同步寄管理者警示。

### S3 已交付

| 元素 | 內容 | 現況 |
| --- | --- | --- |
| 狀態徽章 | **報告已完成** | `【已驗證】` 已有（徽章優先序第 3 條） |
| 下載區塊標題 | 「你的報告完成了」 | `【已驗證】` `ReportDownload` 已在 `origin/main` |
| 檔案資訊 | 檔名・大小（MB，一位小數）・上傳時間 | `【已驗證】` 已有 |
| 「線上閱讀」鈕 | 先開新分頁再填短效網址（避免被瀏覽器擋） | `【已驗證】` 已有 |
| 「下載 PDF」鈕 | 同一網址加 `?download=1` | `【已驗證】` 已有 |
| 取檔 API | `POST /api/v1/report-orders/:order_no/report-pdf/link` → 短效網址 | `【已驗證】` 已有 |
| 授權 | 會員只能取自己 `status == 'paid'` 訂單的 current 文件；非 current 回 404「檔案已更新或不存在，請回到訂單頁重新下載」 | `【已驗證】` `delivery.document_for_download` |
| 通知信 | 【親紫之間】你的報告完成了 {order_no}；內含訂單頁連結 | `【已驗證】` `notify.send_report_ready`；**首單不開通對外推播**（§4.3） |

**下載入口的出現條件（單一來源，供驗收逐條核）** `【已驗證】`：

```
顯示 ReportDownload  ⇔  order.report != null
order.report != null ⇔  item.kind == 'purchase'
                     ∧ order.status == 'paid'
                     ∧ ∃ ReportDocument(order_item_id=item.id, kind='book_pdf', is_current=True)
```

加購訂單（`kind == 'addon'`）永不顯示下載區塊；它的交付走實體書／專人解讀自己的軸 `【已驗證】`。

### E1 暫停處理中

| 元素 | 內容 | 現況 |
| --- | --- | --- |
| 狀態徽章 | **後續履約暫停** | `【已驗證】` 已有 |
| 說明（外部成交證據問題） | 「平台成交證據需要重新釐清，後續製作已暫停，請聯絡客服。此狀態不表示平台已完成退款。」 | `【已驗證】` 已有 |
| 說明（管理者手動暫停） | 「後續製作暫停處理中，請聯絡客服。此狀態不表示已退款。」 | `【已驗證】` 已有 |
| 產線進度卡 | **抑制**（blocked 時不顯示） | `【已驗證】` 已有 |
| 下載入口 | **目標態＝應收回**（R4） | `【已驗證】` 現行仍顯示。`【已裁｜董事長】` 改碼＝二期 L3；首單：不代傳、不給連結 |

### E2 已取消

| 元素 | 內容 | 現況 |
| --- | --- | --- |
| 頁首 | 「訂單已取消」 | `【已驗證】` 已有 |
| 狀態徽章 | **已取消**（中性底） | `【已驗證】` 已有 |
| 說明（已付款） | 「這筆訂單已取消。已付款的金額會以轉帳退還，完成後寄信通知你。」 | `【已驗證】` 已有 |
| 說明（未付款） | 「這筆訂單已取消。若你其實已經轉帳，請直接回覆訂單通知信與我們聯絡。」 | `【已驗證】` 已有 |

---

## 4. 首單人工對照表（過渡期｜對內，勿對外發布）

**前提：首單可以不改任何正式頁。** 對客檔＝**PDF**。上傳權限＝**董事長／指定管理者**（Berry 不持 `report_orders.fulfill`；Berry＝核對 formal＋`human_released` → 指示上傳 → 對客告知）。 `【已驗證】` 理由：S1、S2、E1、E2 的文案與元素今天就已存在；S3 的下載入口與 API 也已存在，只是沒有資料去點亮它。缺的不是程式，是「把檔案放上去」這個人工動作，以及 §6 的幾個待決文案。

### 4.1 逐步人工對照

| 步 | 系統狀態 | 系統自動做的 | 人要做的（誰） | 顧客看到什麼 |
| --- | --- | --- | --- | --- |
| 1 | S1 | 顯示匯款資訊、收顧客的轉帳回報、逾期自動取消 | **Mango**：對帳確認入帳 → 出場，**不交件** | 待付款＋轉帳資訊＋「已收到你的轉帳回報」 |
| 2 | S1→S2 | — | **管理者**：後台「確認收款」（T1） | 徽章翻成「已付款，報告製作中」 |
| 3 | S2 | `handoff` 自動建 Run 工作單；`progress` 自動輪詢 | **產線／品管**：人點入隊 → Apple 合規＋品質分報 → formal 進人審佇列。`【已驗證】`「審查員待審通知」不進首單，靠現有 QC 佇列人工看 | 「製作中」等產線標籤 |
| 4 | S2（`completed`） | 徽章變「製作已完成，待交付」 | **人類審查員（暫董事長）**：裁定放行 → Run 側標 `human_released` → **從審頁／組書人工匯出完成檔**，連同訂單／審件 ID 交 Berry | 「製作已完成，待交付」——**顧客此時還拿不到檔案，這是正常的** |
| 5 | S2 | — | **Berry**：核對是否為 formal 放行件（拒收抽樣件，R3）→ 確認**只含交客候選成品（文本＋圖），不含合規／品質分報**（R2） | 同上 |
| 6 | **S2→S3** | 上傳成功後自動：蓋 `deliverable_ready_at`、`commerce.complete`、寫 `report_uploaded` 稽核、產生 `report_ready` 信（**首單不寄，見 4.3**） | **管理者**：後台「報告交付」頁，走**路徑 A 人工上傳 PDF**（`POST /admin/report-orders/:no/report-pdf`） | 徽章翻「報告已完成」＋「你的報告完成了」卡＋線上閱讀／下載 PDF |
| 7 | S3 | 短效網址每次點擊重新簽發 | **Berry**：以郵件／約定通道告知顧客「可以到訂單頁下載了」，並**內部記錄已交付時間與對象** | 自助下載（會員登入後） |
| 8 | 異常 | — | **客服窗口（首單）**：Berry 對內承接詢問草稿；對外正式話術定稿前調 Lemon，上線屬 L3 | — |

### 4.2 「代傳／暫時連結」怎麼做（首單）

**E1 暫停單流程（已裁）：** 暫停單 Berry **不代傳、不給連結**（董事長原文）。改程式收回下載入口＝二期 L3。

`【已驗證】` 管理者側已有可直接用的取檔工具，**不需要為首單另做任何東西**：

- `POST /api/v1/admin/report-orders/:order_no/report-pdf/link`（權限 `report_orders.fulfill`）→ 回傳一組短效網址，管理者可自行開啟或轉傳。
- 顧客側 `POST /api/v1/report-orders/:order_no/report-pdf/link`（會員自己）→ 同樣是短效網址，由訂單頁按鈕呼叫。

**首單建議的優先序：**

1. **首選：請顧客登入訂單頁自取。** 入口已經在了，顧客體驗最完整，也順便把 S3 走一次真實驗證。
2. **次選：Berry 郵件附檔代傳。** 適用於顧客登入有困難或外部平台來的客人。
3. **末選：管理者用 `/admin/.../report-pdf/link` 取短效網址轉傳。** `【已驗證】` `private_storage.read_file_token(..., max_age=600)`＝**10 分鐘**；憑證為 itsdangerous 限時簽章（到期失效；有效期內同一 token 可重放，非一次性）。對外訊息貼連結前確認未過期。

**不要做的代傳方式**：把 PDF 丟進公開 bucket、或產生永久公開連結。`【已驗證】` 報告檔走 `private_storage`，私有 bucket 是刻意設計。

### 4.3 首單的通知處理

`【已驗證】` 路徑 A 首次上傳成功會呼叫 `notify.send_report_ready`。但上游明列「信箱／訊息推播正式開通」不進首單。

**契約規定（首單）：** 以**環境層**關閉對客寄信（`MAIL_*` 未設或收件白名單），**不要**為此改程式路徑。

`【已驗證】` 關閉後 outbox 會留下 `report_ready` 紀錄；`notification_gate` 不會誤寄舊通知（寄送前條件重驗）。

`【已驗證｜部分】` Railway `pure-grace`／`polaris-backend`／`production` **已存在**變數名：`MAIL_DEFAULT_SENDER`、`REPORT_ADMIN_NOTIFY_EMAIL`、`RESEND_API_KEY`（OAuth 連線看不到明文值）。**演練前必須**用 `railway variables` 或儀表板確認是否非空／實際收件人——**不可假設已關閉對客寄信**；若已接通，首單上傳前須先處理環境層關閉或白名單，否則顧客可能在 Berry 告知前先收到 `report_ready`。

### 4.4 明確不進首單（照抄上游，並補對應的程式位置）

| 不做項 | 對應程式位置 | 首單處置 |
| --- | --- | --- |
| 收款自動觸發產線 | 無金流 webhook；T1 必經人工「確認收款」 | 維持人工，不接金流 |
| 信箱／訊息推播正式開通 | `notify.py` outbox＋6 次重試 | 環境層關閉（4.3） |
| 通訊軟體對客開通 | 不存在 | 不做 |
| `human_released` → 自動交檔／上傳 API | 路徑 B `production-artifact`（程式已存在） | **不啟用**。首單只走路徑 A |
| 顧客自助下載上正式 | `ReportDownload`＋`report-pdf/link`（程式已存在） | 入口本來就只在有檔案時才出現；首單**可以**讓顧客自取（4.2），但這屬於「用既有功能」，不是「上線新功能」 |

> 註：上游的「自助下載不上正式」在程式層已經是既成事實的反面——入口已部署。本契約的處理是**不新增、不移除**，靠「沒有 `ReportDocument` 就不顯示」這個既有條件自然守住。若 Cook／Berry 認為首單連自取都不要，則處置改為「§4.2 只用次選與末選」，仍不需改程式。

---

## 5. 首驗點：狀態機桌面演練檢查清單

> **執行 SOP：** 見 [`CX_HOME_SECTION5_DRILL_SOP_v1.0.md`](./CX_HOME_SECTION5_DRILL_SOP_v1.0.md)（本機／test only；禁止 production 路徑 A；production MAIL 暫不動等董事長裁示）。

**演練方式：** 本機環境、一張測試報告訂單（`env='test'`）、不碰正式庫。每一步都要能回答「顧客現在看到哪個狀態、那個狀態是否在 §2.2 的五個之中」。

**通過標準：** 15 條全綠，且**沒有任何一步的畫面無法歸類到 S1／S2／S3／E1／E2**。出現無法歸類的中間態即為不通過，須回頭修契約或修文案。

| # | 檢查項 | 期望結果 | 對應 |
| --- | --- | --- | --- |
| 1 | 新建訂單，開訂單頁 | 徽章「待付款」；有轉帳資訊卡與回報表單；**無**下載區塊 | S1 |
| 2 | 送出轉帳回報 | 顯示「已收到你的轉帳回報…」；徽章仍「待付款」 | S1（不產生新狀態） |
| 3 | 後台拒絕轉帳 | 顯示「轉帳資料無法核對：…」；徽章仍「待付款」 | S1 |
| 4 | 後台確認收款 | 徽章→「已付款，報告製作中」；出現「已確認收款，報告製作中…」 | T1 → S2 |
| 5 | 等背景排程建工作單 | `handoff_status` 由 `pending` → `sent`；**顧客頁無任何變化** | T1b（內部態不外洩） |
| 6 | 產線輪詢回 `in_progress` | 徽章→「製作中」；出現產線進度卡 | T1c，仍 S2 |
| 7 | 訂單同時含實體書 | 實體書區塊自己顯示 `awaiting_customization` 等狀態；**報告徽章不受其影響** | §1.9 不污染 |
| 8 | 產線輪詢回 `needs_info` | 徽章→「待補資料」；**仍無下載入口** | 仍 S2 |
| 9 | 產線輪詢回 `completed` | 徽章→「製作已完成，待交付」；**仍無下載入口、無「可取件」字樣** | **R1 核心驗點**，仍 S2 |
| 10 | 停掉產線輪詢超過 15 分鐘 | 進度卡多一行「進度待更新，以上為最近取得的狀態。」；狀態歸類不變 | 仍 S2 |
| 11 | 管理者路徑 A 上傳 PDF | 徽章→「報告已完成」；出現「你的報告完成了」＋兩顆鈕；`deliverable_ready_at` 已蓋 | T2 → S3 |
| 12 | 點「線上閱讀」與「下載 PDF」 | 都能取到同一份檔；短效網址可用 | S3 |
| 13 | 管理者重傳更正版 | 舊文件 `is_current=False`；顧客頁仍 S3，檔名／時間／大小更新；舊網址回 404 並顯示「檔案已更新或不存在，請回到訂單頁重新下載」 | T3 |
| 14 | 管理者暫停履約 | 徽章→「後續履約暫停」；進度卡消失；出現暫停說明 | T4 → E1 |
| 15 | 管理者恢復履約 | 回到先前狀態（S2 或 S3），且恢復時資格檢查全過 | T5 |

**另有兩條「必須刻意失敗」的負向驗點：**

| # | 檢查項 | 期望結果 | 依據 |
| --- | --- | --- | --- |
| N1 | 拿 `env='test'` 的成品，試著匯入一張 `live` 訂單（路徑 B） | 被 `identity()` 比對擋下，回「成品資訊或版本不符，請重新查詢」；**不得**落地 | `【已驗證】` R3 |
| N2 | 先讓 current 文件不存在，再讓 outbox 寄 `report_ready` | `notification_gate` 判 `skip`，理由「目前沒有可下載的報告，停止寄送舊通知」 | `【已驗證】` |

**演練紀錄要留什麼：** 每一步的徽章文字**逐字抄錄**＋歸類到的狀態代號＋時間。文字回報優先（不靠截圖），這樣異常才能被精確復述。

---

## 6. 待決事項（阻擋首驗的，標★）

| # | 問題 | 對口 | 標記 |
| --- | --- | --- | --- |
| 1 | E1（暫停）是否收回 S3 下載入口 | **已裁＝收回**（董事長原文／Cook 轉達） | 原文：「E1：暫停時收回下載；改程式二期 L3；首單暫停單不代傳、不給連結。」。現行仍顯示＝`【已驗證】`；改碼＝二期 L3；首單流程擋 |
| 2 | ★ 正式環境 `MAIL_*`／`REPORT_ADMIN_NOTIFY_EMAIL`／`RESEND_API_KEY` 明文是否非空與收件人 | Home／Poteto 演練前儀表板或 `railway variables` 實查 | `【已驗證｜部分】` 變數**名**已存在；明文值未讀到——演練前必須回填 |
| 3 | 誰持有 `report_orders.fulfill`（誰能上傳） | **已裁＝董事長／指定管理者**；Berry **不**持後台權 | Berry＝核對 formal＋`human_released`→指示上傳→對客告知；二期再議 berry 服務帳 |
| 4 | `/admin/.../report-pdf/link` 短效網址有效期與可重放性 | **已回填** | `【已驗證】` `max_age=600`（10 分鐘）；有效期內可重放 |
| 5 | Run 側 `/public/report-requests/:no/artifact` 與 `/artifacts/:v/file` 是否已實作、放行條件是否綁 `human_released` | Apple／Run | `【假設】` |
| 6 | `needs_info`／`failed` 的對客文案定稿 | Lemon（L3） | `【假設】` |
| 7 | 「已交付時間與對象」的內部紀錄放哪：沿用 `deliverable_ready_at`＋稽核事件，或另開欄位 | Poteto 二期設計 | `【推論】` 現有兩者已夠首單用 |

---

## 7. 工期覆核

### 7.1 首單契約：約 1.5 人日 — **覆核結果：合理，略偏緊**

| 項目 | 估時 |
| --- | --- |
| 本文件定稿＋§6 待決 2／3／4 實查回填 | 0.5 |
| 桌面演練（§5 的 15＋2 條，含環境準備與測試單） | 0.5 |
| 文案微調（`needs_info`／`failed`／暫停時的下載入口處置）＋對內 SOP 落稿 | 0.3 |
| 緩衝（演練失敗回修一輪） | 0.2 |
| **合計** | **1.5 人日** |

**成立的前提**（任一不成立就會超）：

- 首單**不改**正式前端程式。`【已驗證】` 本契約已確認可行——所有必要元素都已部署。
- §6 的 1／2／3 在演練開始前已有答案。若第 1 題（暫停時的下載入口）裁定為「要收回」，那就是程式變更，**應併入二期**，不要塞進 1.5 人日。
- 本機環境能跑起 Run 的輪詢 stub。若要真連 Run，另計。

### 7.2 二期系統化：4–6 人日 — **覆核結果：下緣 4 偏樂觀，建議以 5–6 規劃**

| 項目 | 估時 |
| --- | --- |
| 路徑 B 端到端打通（含 Run 側對接驗證、§6 第 5 題） | 1.5–2.0 |
| 顧客可見狀態收斂：把 §1.2 的五段徽章優先序改成單一狀態推導，含 `[locale]` 多語系文案 | 1.0–1.5 |
| 通知正式開通（`report_ready` 對客、審查員待審、Berry 放行通知）＋退信處理 | 1.0 |
| E1 下載入口處置、`needs_info`／`failed` 文案落地 | 0.5 |
| 正式庫 migration 演練＋部署（若需新欄位記錄交付時間／對象） | 0.5–1.0 |
| **合計** | **4.5–6.0 人日** |

**偏向上緣的理由：** 顧客可見狀態收斂要同時改 `(public)` 與 `[locale]` 兩套路由、七個語系，而語言上線開關本身還有未完的 wiring；通知正式開通牽到 outbox 重試與 `notification_gate` 的既有行為，不是加一行寄信。

**排程條件：** 二期須另批 L3，且依既有規矩——**正式庫 migration 先演練、先上，才 push main**。

---

## 8. 變更紀錄

| 版本 | 日期 | 說明 |
| --- | --- | --- |
| v1.0 | 2026-11-05 | 首版 L2 草案。依 `CX_DELIVERY_HANDOFF_MIN_v1.0.md`（含 v1.0.1 修訂）拆 Home 側狀態機；交叉 `origin/main` 程式碼盤點現況；確認首單可不改正式頁。 |
| v1.0.1 | 2026-11-05 | 回填：`report_orders.fulfill`＝董事長／指定管理者（Berry 不持後台權）；首單對客檔＝PDF；短效連結 `max_age=600`（10 分鐘）；MAIL 變數名已存在、明文待演練前實查。 |
| v1.0.2 | 2026-11-05 | Cook 凍結 E1：§6★1／R4／E1 下載＝**待董事長裁示（Cook 已凍結，Berry 改口多次）**；去掉「應收回」寫死。fulfill／PDF 維持已裁。暫停單不代傳僅作保守建議、非終態。 |
| v1.0.4 | 2026-11-05 | 交叉引用 §5 演練 SOP（本機／test；禁 production 路徑 A；MAIL 暫不動）。 |
| v1.0.3 | 2026-11-05 | E1 終裁（董事長於 Berry t18s1 點選原文）：暫停時收回下載；改程式二期 L3；首單暫停單不代傳、不給連結。 |
