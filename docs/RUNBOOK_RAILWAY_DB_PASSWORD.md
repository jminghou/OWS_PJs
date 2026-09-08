# Runbook：更換 Railway Postgres 超級使用者密碼

2026-09-08 第一次做花了三小時，正確做法其實十分鐘。本文先講正確步驟，再列當時踩的坑，讓下一次不必重走。

## 先知道的事實（不知道就會走錯）

| 事實 | 影響 |
|---|---|
| Postgres 服務在 Railway 專案 **pure-grace**，polaris-backend 在 **graceful-dream** | `${{Postgres.X}}` 引用**只在同專案有效**，後端不能引用 Postgres，只能貼字面值 |
| polaris-backend 用 **`blog_app`** 帳號、走公開代理 `kodama.proxy.rlwy.net` | 換 `postgres` 密碼**不影響**後端；「正式站正常」不代表密碼換好了 |
| **Polaris_run**（紫微 FastAPI，同在 pure-grace）用 **`postgres`** 帳號，`DB_HOST=postgres.railway.internal` | 換密碼後它會**啟動即崩潰（CRASHED）且不自動重啟**，需 redeploy |
| Railway Postgres 映像重啟時**不會**套用 `POSTGRES_PASSWORD`（日誌 `Skipping initialization`） | 只改變數＝變數與資料庫不一致；一定要自己執行 `ALTER USER` |
| 容器內有 `PGHOST` 環境變數指向網路位址 | 容器裡的 `psql` 必須加 `-h /var/run/postgresql` 走 socket（trust 免密碼），否則走 TCP 用到錯的密碼 |
| `railway ssh -p` 不認專案**名稱** | 用 `railway link` 切服務，再跑不帶參數的 `railway ssh` |

## 正確步驟（約十分鐘）

前置（一次性）：`ssh-keygen -t ed25519` → `railway ssh keys add`。Polaris_run 的 `DB_PASSWORD` 已改為 `${{Postgres.POSTGRES_PASSWORD}}` 引用，之後不必再手動同步。

1. **產新密碼**（只用英數字，會嵌在 URL 裡；不要截圖）
   ```
   python -c "import secrets,string;print(''.join(secrets.choice(string.ascii_letters+string.digits) for _ in range(32)))"
   ```
2. **Railway 改變數**：pure-grace → Postgres → Variables → `POSTGRES_PASSWORD` 貼新值 → ✓ → Deploy。
   `PGPASSWORD` / `DATABASE_URL` / `DATABASE_PUBLIC_URL` 都引用它，會自動跟。
3. **進容器把資料庫對齊到變數**
   ```
   railway link -p pure-grace -e production -s Postgres
   railway ssh
   psql -h /var/run/postgresql -U postgres -d railway -c "ALTER USER postgres WITH PASSWORD '$POSTGRES_PASSWORD'"
   exit
   ```
   看到 `ALTER ROLE` 才算成功。密碼取自容器內環境變數，不會出現在畫面。
4. **重啟 Polaris_run**（它已因密碼不一致崩潰）
   ```
   railway link -p pure-grace -e production -s Polaris_run
   railway redeploy -y
   railway link -p graceful-dream -e production -s polaris-backend
   ```
5. **驗證**
   - 從本機用 Railway 的 `DATABASE_PUBLIC_URL` 連（用 getpass 型腳本或 `psql`，別把 URL 貼進聊天）
   - `https://polarisrun-production.up.railway.app/health` 回 200，`railway logs` 無 `password authentication failed`
   - `https://api.polaris-parent.com/api/v1/categories` 回 200（後端本來就不受影響，但確認一下）
6. **收尾**：本機 shell 若設過 `$env:DATABASE_URL` 指向正式庫，`Remove-Item Env:DATABASE_URL`，否則本機後端會一直連正式庫。

## 當時踩的坑

- **改了變數就以為換好了**：資料庫其實還是舊密碼，Railway 變數與資料庫不一致，所有「用新 URL 連」都被拒。
- **用本機 `psql`／自寫腳本 ALTER**：本機沒 psql；腳本在不同 venv 缺 psycopg2；URL 貼上時帶了 `<>` 佔位符——三次嘗試三種失敗，每次都以為做完了。
- **截圖回報**：舊密碼與兩組新密碼先後出現在截圖裡，每洩一次就得重產一組再做一輪。回報請用文字打出「畫面最後一行」。
- **正式站正常造成誤判**：後端用 `blog_app`，跟 `postgres` 無關；真正受影響的 Polaris_run 崩潰了一小時才被發現。
- **本機 shell 掛著正式庫的環境變數**：`$env:DATABASE_URL` 覆蓋 `.env`，「本機後台登不進去」其實是在打正式庫。
- **在後端填 `${{Postgres.DATABASE_URL}}`**：跨專案解析不到，幸好未部署；已捨棄。
- **Railway CLI 一直沒用**：`railway status / variables --json / logs --json / deployment list / ssh` 三分鐘就能拿到全部事實，前面全靠猜。

## 尚未輪換

- Neon `neondb_owner`（claire-backend）
- `blog_app`（換了要同步 polaris-backend 的 `DATABASE_URL` 字面值）
