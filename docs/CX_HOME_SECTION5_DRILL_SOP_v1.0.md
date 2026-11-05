# 親紫之間｜Home §5 狀態機桌面演練 SOP（v1.0）

**層級：** L2 文件（僅 docs；無程式、無正式部署）
**對齊契約：** `docs/CX_HOME_ORDER_STATUS_CONTRACT_v1.0.md` §5（15＋2）
**裁示來源：** Cook／Poteto 2026-11-05（MAIL 實查後）；E1 背景見契約 v1.0.3／Berry t18s1

---

## 0. 硬規則（置頂｜一字不改執行）

1. **桌面演練＝本機／`env=test`；禁止 production 路徑 A 上傳**（避免觸發對客 `report_ready`）。
2. **流程硬規則：** 未獲**當日明示**前，任何人不得在 production 做會觸發對客／管理信的 fulfill／路徑 A。
3. **暫不改** production MAIL（不關、不改白名單）——等董事長 A／B 裁示。
4. §5（15＋2）只在 test 跑；**有本機測試單後再聯 Berry**。

### 禁止事項

| 禁止 | 原因 |
| --- | --- |
| production 路徑 A（`admin` 上傳報告 PDF）首傳 | 會 `notify.send_report_ready` → Resend 真寄 |
| production 路徑 B 首傳匯入 | 同上 |
| `scripts/dev_on_prod.py` | 本機後端直連正式庫＋正式 env，上傳也會真寄 |
| 對正式庫跑 `dev-seed-demo`／`dev-mark-paid` | CLI 雖擋非 localhost，仍勿試 |
| 在演練中改 production `MAIL_*`／`RESEND_*` | 等董事長裁示 |

**已驗證（2026-11-05）：** Railway `pure-grace`／`polaris-backend`／`production` 的 `MAIL_DEFAULT_SENDER`、`REPORT_ADMIN_NOTIFY_EMAIL`、`RESEND_API_KEY` **皆非空**；對客寄信路徑已接通。本機 Polaris `.env` **無**上述鍵時不會走 Resend。

---

## 1. 本機準備

1. Postgres 指向 **localhost**（確認 `DATABASE_URL` host 為 `localhost`／`127.0.0.1`）。
2. Redis：`docker compose up -d redis`（或本機 Redis）；`REDIS_URL` 可用。
3. 啟動 Polaris：`npm run polaris`（FE `http://localhost:3000`、API `http://localhost:5000/health`）。
4. 首次／空庫：依 README 跑 migrate → `init-site` → `create-admin` → `seed-rbac`。
5. **本機寄信：** `RESEND_API_KEY` 留空；勿把 production Resend key 寫進本機 `.env`。

### 本機 CLI（僅 localhost DB）

```powershell
$flask = "sites/Polaris_Parent/backend/venv/Scripts/flask.exe"
& $flask --app "sites.Polaris_Parent.backend.app:app" report_orders dev-seed-demo
& $flask --app "sites.Polaris_Parent.backend.app:app" report_orders dev-mark-paid <ORDER_NO>
& $flask --app "sites.Polaris_Parent.backend.app:app" report_orders run-jobs
```

- `dev-seed-demo`：已驗證測試會員＋**已付款**訂單（適合從 S2 起測／上傳演練）。
- §5 **第 1–3 步**需要**待付款**單 → 用測試會員在本機前台下單，勿用已付款 demo 冒充第 1 步。
- 後台 fulfill：本機 `create-admin` 帳號；Berry **不持**後台權（契約已裁）。

---

## 2. §5 檢查表（執行＋紀錄）

**通過標準：** 15 條全綠，且畫面皆可歸類到 S1／S2／S3／E1／E2。
**紀錄格式（每步一行）：** `時間(Asia/Taipei) | # | 徽章原文 | 狀態代號 | 備註`

| # | 檢查項 | 期望 | 誰操作 | 依賴 |
| --- | --- | --- | --- | --- |
| 1 | 新建待付款單，開訂單頁 | 徽章「待付款」；有轉帳卡；無下載 | 測試會員 | 本機 FE |
| 2 | 送出轉帳回報 | 「已收到你的轉帳回報…」；仍待付款 | 測試會員 | |
| 3 | 後台拒絕轉帳 | 「轉帳資料無法核對：…」；仍待付款 | 本機 admin | |
| 4 | 後台確認收款（或 `dev-mark-paid`） | →「已付款，報告製作中」 | admin／CLI | |
| 5 | 背景建工作單 | `handoff_status` pending→sent；顧客頁不變 | `run-jobs`／排程 | **產線／handoff** |
| 6 | 產線 `in_progress` | 徽章「製作中」＋進度卡 | workbench | **:3100／Run** |
| 7 | 同單含實體書 | 實體書區塊獨立；報告徽章不受污染 | 下單含實體書 | |
| 8 | 產線 `needs_info` | 「待補資料」；無下載 | workbench | **Run** |
| 9 | 產線 `completed` | 「製作已完成，待交付」；無下載／無可取件 | workbench | **R1／Run** |
| 10 | 停輪詢 >15 分 | 進度卡多「進度待更新…」 | 停 workbench | **Run** |
| 11 | 本機路徑 A 上傳 PDF | 「報告已完成」＋兩鈕；`deliverable_ready_at` | **本機** admin | private storage |
| 12 | 線上閱讀／下載 PDF | 同檔；短效網址可用 | 測試會員 | |
| 13 | 重傳更正版 | 舊 is_current=False；舊網址 404 文案 | 本機 admin | |
| 14 | 暫停履約 | 「後續履約暫停」 | 本機 admin | E1 現行仍可能顯示下載＝已知；改碼二期 L3 |
| 15 | 恢復履約 | 回 S2 或 S3 | 本機 admin | |

### 負向

| # | 檢查項 | 期望 | 依賴 |
| --- | --- | --- | --- |
| N1 | `env=test` 成品匯入 `live` 單（路徑 B） | identity 擋下；不落地 | **Run artifact** |
| N2 | 無 current 文件時 outbox `report_ready` | gate `skip` | 本機可造 |

**未就緒則標「卡點／跳過」：** 5、6、8、9、10、N1（產線 workbench／Run）。可先跑 1–4、7、11–15、N2。

---

## 3. 聯 Berry 時機

- 本機已有可開的測試訂單頁（待付款或已付款 demo）且硬規則已寫入本 SOP／契約交叉引用後，再請 Berry 觀摩或對客文案核對。
- Berry 不操作正式後台；不代傳、不發 production 連結（E1／首單流程）。

---

## 4. 變更紀錄

| 版 | 日期 | 說明 |
| --- | --- | --- |
| v1.0 | 2026-11-05 | 初版：Cook／Poteto 硬規則＋§5 執行表；production MAIL 暫不動。 |
