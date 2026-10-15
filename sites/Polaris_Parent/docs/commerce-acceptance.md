# 隔離測試環境操作驗收

驗收日期：2026-10-14～2026-10-15（Asia/Taipei）。範圍：階段 0 的外部人工查證、單份數位報告契約對應、資格與交付路徑。

## 結果

本範圍的主要操作路徑通過；不代表正式部署或所有階段 0 功能都完成瀏覽器驗收。

| 操作 | 實際結果 |
| --- | --- |
| 管理員新增渠道與商品履約對應 | 儲存成功，顯示版本、期限與審查依據 |
| 成交總額與品項加總不一致 | 400，顯示金額不符 |
| 未確認付款與會員歸屬即查證 | 400，提示必須完成兩項核對 |
| 查證、預覽、確認資格 | 兩筆訂單皆成功；確認前需備註與勾選 |
| 重複匯入同筆外部成交 | 保留同一筆帳本，沒有重複發放 |
| 只有 intake 權限的 reviewer | 可查證；不顯示渠道管理、商品對應及資格發放操作 |
| 會員查看已確認外部成交 | 顯示平台成交確認，不要求再次付款 |
| 作廢第一筆成交證據 | 會員顯示履約暫停及非退款說明；上傳 PDF 被 409 阻擋 |
| 第二筆有效成交上傳 PDF | 200，後台已上傳數量為 1；會員顯示報告已完成 |
| 會員點擊下載 PDF | 更新測試登入後，連結 POST 與實際檔案 GET 均 200；未驗證瀏覽器下載落地檔案的雜湊 |

最終隔離帳本：receipts=2、bindings=2、entitlements=2、tasks=2、payment_attempts=0。兩筆訂單皆為 external_verified；第一筆保留成交歷史，但後續履約受作廢證據阻擋。

## 本次修正

- 會員訂單詳情的主狀態改為優先顯示「後續履約暫停」，避免與「報告製作中」矛盾；訂單列表也補上暫停提示。
- 稽核事件改用中文名稱；API 時間明確帶 UTC offset，前端兼容舊有不帶時區的 UTC 時間，避免被誤認為本地時間。新增時間格式斷言。

## 自動驗證

- 136 項 Python 測試通過（58.97 秒）：foundation、activation、backfill、intake、binding 及既有建單、實體、設計、交付回歸。測試有 4311 項 warnings，未視為零警告結果。
- 實際 frontend 執行 TypeScript `tsc --noEmit --incremental false --pretty false` 通過。
- 一次性 PostgreSQL 18：0010–0013 migration、並行核款／發放／兌換／回填／查證／契約綁定、人工與外部成交競爭、舊證據刷新、唯一約束與 downgrade 保護通過；叢集已自動停止清除。

## 環境與重現

`backend/tests/serve_commerce_acceptance.py` 是獨立、僅 loopback 的驗收入口。重用既有 BindingTests fixture，提供記憶體 SQLite、假排盤、假寄信、受控角色權限、兩筆測試訂單與明確測試登入。它不載入正式 app 或 .env，也不會在正式應用註冊測試登入路由。每次重啟資料重新建立。

1. 在本站目錄設定 TMP/TEMP 為 `.test-tmp`、PYTHONDONTWRITEBYTECODE=1，使用 repo `.venv/Scripts/python.exe -B backend/tests/serve_commerce_acceptance.py` 啟動 127.0.0.1:5187。
2. 複製 frontend/src 與 Next/TypeScript/Tailwind/PostCSS/package 設定到同層 `.acceptance-frontend`，勿複製 .env。保持相同相對目錄深度以使用既有 monorepo dependencies。
3. 僅在該程序設定 NEXT_SERVER_BACKEND_URL=http://127.0.0.1:5187、NEXT_SERVER_API_URL 與 NEXT_PUBLIC_API_URL=http://127.0.0.1:5187/api/v1、NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3187，以 Next dev 綁定 127.0.0.1:3187。
4. 開啟 `/api/v1/__acceptance` 切換 admin、buyer、reviewer。建立測試渠道及 TEST-DIGITAL 商品對應；範本 R-ACCEPTANCE-1；金額 TWD 1980；訂單 ACCEPTANCE-ORDER-1 / 2。
5. 合成 PDF 位於 `backend/tests/fixtures/acceptance-report.pdf`，不含個資。操作完成後停止兩個服務。正式設定與資料庫不受影響。

## 限制及待完成環境驗收

本次使用測試登入與受控權限，沒有驗證真實登入、token refresh、寄信、排盤、雲端檔案儲存、外部派工或支付商。兩次工具等待跨越兩小時測試登入期限，產生 401；重新登入後分別確認作廢上傳 409、有效下載 200。未以這些 401 誤判業務檢查通過。

精簡 fixture 缺少共用首頁/i18n/studio 設定端點，造成 404 與開發工具 issue 提示；這不是完整網站整合驗收。未完成手機尺寸、正式認證與全站導覽驗收。Etsy、Creema、idus 未串接，測試政策文字不表示真實平台許可。其餘實體、加購、啟用碼、回填及解讀流程本次由自動測試涵蓋，尚須在整合 staging 逐一操作。

## 證據

- [外部成交確認](acceptance/2026-10-14/member-confirmed.jpg)
- [作廢後暫停（修正後）](acceptance/2026-10-14/member-voided.jpg)
- [有效報告完成](acceptance/2026-10-14/member-completed.jpg)
- [請求紀錄（不含 token 或 body）](acceptance/2026-10-14/requests.json)

截圖目錄沿用本次驗收開始日期；內容包含隔日完成的操作。
