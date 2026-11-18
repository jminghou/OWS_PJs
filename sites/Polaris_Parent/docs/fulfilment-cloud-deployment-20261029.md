# 交易與交付功能：正式站部署紀錄

2026-10-29，約 14:33（Asia/Taipei）。本批正式部署及基礎連線驗證完成。

## 發布版本

使用獨立快照，只納入本批功能。未將開發目錄其他首頁、語系、排版、書籍產線修改一起發布。

| 系統 | 正式版本／發布識別 | 結果 |
| --- | --- | --- |
| 官網程式 | OWS_PJs `82ecd45280d4aa60fb5e366842c212640152ab65`（21 個檔案） | 已推送 main |
| 製作端程式 | Polaris_run `befd6e5e228a44e599eba50f670818189408d0ad`（5 個檔案） | 已推送 main |
| 官網後端 Railway | `57c86a53-94e1-4d66-a760-daf9f402a26e` | SUCCESS |
| 製作端 Railway | `eecd3f5c-c03b-4ab7-82d5-35560805275a` | SUCCESS |
| 官網 Vercel | `8hgopxqkTYuFQzrKjMzQx9HeJLkj`；GitHub deployment `7405661470` | success／Production |
| 製作工作台 Vercel | `9faCQgPHrfZofuUbu3iCyhRse9po`；GitHub deployment `7405642292` | success／Production |

官網：https://www.polaris-parent.com

官網 API：https://api.polaris-parent.com

製作 API：https://polarisrun-production.up.railway.app

部署經既有 GitHub 連線完成，不需新增 Vercel 登入。OWS 為多站共用儲存庫，既有連線也觸發其他站建置，所見狀態全部 success；其他站的程式未在本批更動。

## 資料與儲存

- 正式資料庫 public revision：`0029_ziwei_terms` → `0031_report_artifacts`，包含 `0030_fulfilment_controls`。
- 官網 blog revision 保持 `0019_page_modules`。
- 升級前在同一正式資料庫建立 `deployment_backup_20261029` schema，備份受影響既有 `account.report_requests` 與 `public.alembic_version`；已撤除 PUBLIC schema 權限。這是受影響資料表備份，不是全庫備份。
- 原先本機匯出備份被自動審查拒絕，未執行；改用上述雲端原地備份，沒有匯出客戶資料。
- 製作端設定 `REPORT_ARTIFACT_DIR=/data/report-artifacts`，使用既有 `/data` volume。
- 官網沿用既有私有 GCS bucket。
- 部署前與部署後檢查，正式 `shop.orders` 及 `account.report_requests` 均無資料。

## 本次正式環境驗證

- 官網首頁 HTTP 200。
- 兩個後端健康檢查 HTTP 200。
- 官網新增成品介面未登入回傳 401。
- 製作端成品介面無服務憑證回傳 403。
- 從正式官網容器以既有服務憑證呼叫正式製作端成品介面：通過驗證，對不存在的測試識別回傳契約定義的 409「尚無可交付的目前版本成品」。最初探測誤預期 404，查閱契約後改正驗收預期；未修改產品程式。
- 正式製作端持久磁碟：專用測試檔寫入、讀回與原子 hard link 通過，測試目錄已移除。
- 官網私有 GCS：專用無個資測試物件寫入及讀回通過，物件已刪除。
- 新增 `production_progress`、`fulfilment_controls` 已由正式排程執行，兩者 `last_status=ok`。

以上是正式發布、基礎連線及儲存驗證；本次未在正式站建立驗收訂單、收款或寄信，也未完整重跑會員端到端交付。完整訂單流程的既有驗收是本機環境，見 `fulfilment-local-acceptance-20261029.md`。

## 全庫自動排程的實際狀態

正式環境原本即為 production 設定，未顯式指定 `REPORT_JOBS_ENABLED`，因此依程式預設啟用。發布前已查到八個既有工作成功紀錄。本批保留此設定並加入兩個同步工作。

「全庫」指搜尋所有符合各工作條件的訂單／紀錄，不代表每次無條件修改所有資料。系統約每五分鐘檢查一次，各工作另有執行週期，並以資料庫鎖防止多個服務程序重複執行。

內容包括已付款派工、製作進度與暫停恢復同步、失敗通知重試、認領同步、匯款提醒、逾期未回報轉帳取消、打樣提醒與期限到自動確認送印、過期草稿及舊通知內文清理。打樣自動確認與逾期取消會改變業務狀態；PDF 成品仍需管理者核對接收，不會因製作完成就自動交付。

## 後續開發注意

正式提交由 `.test-tmp/cloud-release-20261029/` 內的獨立 Git 工作目錄發布。原開發目錄的分支與未提交內容未被重設，仍保留其他工作；後續提交前應先讀取遠端新版本，妥善合併，不要強制推送覆寫這兩個正式提交。

若需回復應用，使用 Railway／Vercel 已知先前部署；新增 schema 可暫留以維持相容。產生正式控制事件或成品版本後，不可盲目降版或用備份覆蓋資料。
