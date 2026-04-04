# OWS 雲端遷移：完整操作指南

> 兩個網站同時部署：Claire Project + Polaris Parent
> NAS Docker + Cloudflare Tunnel → Railway (後端) + Vercel (前端)
> 操作順序：DB → Redis → 資料遷移 → 後端 × 2 → 前端 × 2 → DNS → 驗證

---

## 第一階段：建立外部資料庫和快取

### 1-1. Neon PostgreSQL（免費）

> Free plan 只能有 1 個 Project，但一個 Project 裡可以建多個 Database
> 如果已有 Project（如 `btw_web_sql`），直接在裡面新增 Database 即可

1. 打開 https://console.neon.tech，登入
2. 點進你現有的 Project（例如 `btw_web_sql`）
3. 左側選 **Databases**
4. 點 **New Database** → 名稱填 `ows_claire` → **Create**
5. 再次 **New Database** → 名稱填 `ows_polaris` → **Create**
6. 回到左側 **Dashboard**，上方有 **Database 下拉選單**，切換到 `ows_claire`
7. 複製 **Connection string**（格式如下）：
   ```
   postgresql://neondb_owner:abc123@ep-xxx.ap-southeast-1.aws.neon.tech/ows_claire?sslmode=require
   ```
8. 存到記事本，標記為 **`CLAIRE_DATABASE_URL`**
9. 下拉選單切換到 `ows_polaris`，複製 Connection string
10. 存到記事本標記為 **`POLARIS_DATABASE_URL`**
    - 跟 Claire 的差別只有結尾的 database name：`/ows_claire` vs `/ows_polaris`

---

### 1-2. Upstash Redis（免費）

> 兩站共用一個 Redis instance，用不同 DB 編號區分

1. 打開 https://console.upstash.com/login
2. 用 GitHub 帳號登入
3. 點上方 **Redis** 標籤 → **Create Database**
4. 填寫：
   - Name: `ows-production`
   - Type: **Regional**
   - Region: **Asia Pacific (Singapore)**
5. 點 **Create**
6. 在詳情頁找到 **Endpoint** 區塊，複製 `redis://` 格式的連線字串：
   ```
   redis://default:abc123@apn1-xxx.upstash.io:6379
   ```
7. 存到記事本，製作兩個版本：
   - **`CLAIRE_REDIS_URL`** = `redis://default:abc123@apn1-xxx.upstash.io:6379/0`（DB 0）
   - **`POLARIS_REDIS_URL`** = `redis://default:abc123@apn1-xxx.upstash.io:6379/1`（DB 1）
   - 差別只有結尾的 `/0` 和 `/1`

> **記事本上現在應該有 4 段連線字串：**
> ```
> CLAIRE_DATABASE_URL  = postgresql://...neon.tech/ows_claire?sslmode=require
> POLARIS_DATABASE_URL = postgresql://...neon.tech/ows_polaris?sslmode=require
> CLAIRE_REDIS_URL     = redis://...upstash.io:6379/0
> POLARIS_REDIS_URL    = redis://...upstash.io:6379/1
> ```

---

### 1-3. 從 NAS 匯出資料庫

> 兩個 DB 一起匯出、一起匯入

**Step A：SSH 到 NAS，一次匯出兩個 DB**

```bash
ssh Jermaine@192.168.30.65

# 兩個 DB 一起匯出
sudo docker exec ows_postgres pg_dump -U postgres --no-owner --no-acl ows_claire > /tmp/claire_backup.sql
sudo docker exec ows_postgres pg_dump -U postgres --no-owner --no-acl ows_polaris > /tmp/polaris_backup.sql

# 確認兩個檔案都有內容
ls -lh /tmp/claire_backup.sql /tmp/polaris_backup.sql
```

**Step B：傳回本機（開另一個 terminal）**

```bash
scp Jermaine@192.168.30.65:/tmp/claire_backup.sql D:/PJ_Projects/
scp Jermaine@192.168.30.65:/tmp/polaris_backup.sql D:/PJ_Projects/
```

**Step C：匯入 Neon（兩個一起）**

用 psql（需要安裝 PostgreSQL）：
```bash
psql "<CLAIRE_DATABASE_URL>" < D:/PJ_Projects/claire_backup.sql
psql "<POLARIS_DATABASE_URL>" < D:/PJ_Projects/polaris_backup.sql
```

或用 Neon SQL Editor（不需安裝）：
1. https://console.neon.tech → 選 `ows-production` project
2. 左側 **SQL Editor**
3. 上方 Database 下拉選 `ows_claire` → 貼入 `claire_backup.sql` 內容 → **Run**
4. 切換到 `ows_polaris` → 貼入 `polaris_backup.sql` 內容 → **Run**

**驗證（兩個都要確認）：**
```sql
-- 在 ows_claire 執行
SELECT count(*) FROM users;

-- 切換到 ows_polaris 執行
SELECT count(*) FROM users;
```

---

## 第二階段：Railway 部署後端（兩個 Service 在同一個 Project）

### 2-0. 推送最新程式碼到 GitHub

```bash
cd d:/PJ_Projects/OWS_PJs
git add -A
git status    # 確認沒有 .env 等敏感檔案
git commit -m "準備雲端部署：Railway + Vercel 設定"
git push
```

### 2-1. 建立 Railway 專案

1. 打開 https://railway.app → **Login with GitHub**
2. 進入 Dashboard → **New Project** → **Empty Project**
3. 點左上角專案名稱，改為 `ows-production`

### 2-2. 同時建立兩個 Backend Service

> Railway 一個 Project 可以有多個 Service，共用同一個內網

**先讀取 NAS 上的 .env（等一下兩個都要用）：**

```bash
ssh Jermaine@192.168.30.65
echo "=== Claire ===" && cat /volume1/docker/OWS_PJs/sites/Claire_Project/.env
echo "=== Polaris ===" && cat /volume1/docker/OWS_PJs/sites/Polaris_Parent/.env
```

把 `SECRET_KEY`、`JWT_SECRET_KEY`、`GCS_BUCKET_NAME`、`GCS_CREDENTIALS_JSON` 等值記到記事本。

---

#### Service 1：Claire Backend

4. 在 Railway 專案畫面，點 **New** → **GitHub Repo** → 選 `OWS_PJs`
5. Railway 開始 build → 先點 **Cancel deploy**

**Settings（點 Service 卡片 → 上方 Settings）：**

6. Service Name: `claire-backend`
7. Build 區塊：
   - Builder: **Dockerfile**
   - Dockerfile Path: `sites/Claire_Project/backend/Dockerfile`
   - （Root Directory 留空）
8. Networking 區塊：
   - 點 **Generate Domain** → 記下域名（如 `claire-backend-production-xxxx.up.railway.app`）

**Variables（上方 Variables → Raw Editor）：**

9. 貼入（**所有 `<...>` 都要換成真實值**）：

```
FLASK_CONFIG=production
DATABASE_URL=<CLAIRE_DATABASE_URL>
REDIS_URL=<CLAIRE_REDIS_URL>
SECRET_KEY=<NAS .env 的 SECRET_KEY>
JWT_SECRET_KEY=<NAS .env 的 JWT_SECRET_KEY>
JWT_COOKIE_DOMAIN=.clairelab.tw
JWT_COOKIE_SAMESITE=None
CORS_ORIGINS=https://clairelab.tw,https://www.clairelab.tw
SITE_NAME=Claire Project
GUNICORN_WORKERS=2
PYTHONPATH=/app
```

有 GCS 就加上：
```
GCS_BUCKET_NAME=<值>
GCS_CREDENTIALS_JSON=<值>
```

10. 點 **Update Variables** → 自動觸發 deploy

---

#### Service 2：Polaris Backend（不用等 Claire deploy 完，直接建）

11. 回到專案畫面，再次 **New** → **GitHub Repo** → 選同一個 `OWS_PJs`
12. 先 **Cancel deploy**

**Settings：**

13. Service Name: `polaris-backend`
14. Builder: **Dockerfile**
15. Dockerfile Path: `sites/Polaris_Parent/backend/Dockerfile`
16. Networking → **Generate Domain** → 記下域名

**Variables（Raw Editor）：**

```
FLASK_CONFIG=production
DATABASE_URL=<POLARIS_DATABASE_URL>
REDIS_URL=<POLARIS_REDIS_URL>
SECRET_KEY=<NAS .env 的 SECRET_KEY>
JWT_SECRET_KEY=<NAS .env 的 JWT_SECRET_KEY>
JWT_COOKIE_DOMAIN=.polaris-parent.com
JWT_COOKIE_SAMESITE=None
CORS_ORIGINS=https://polaris-parent.com,https://www.polaris-parent.com
SITE_NAME=Polaris Parent
GUNICORN_WORKERS=2
PYTHONPATH=/app
```

有 astrology DB 就加：
```
ASTROLOGY_DATABASE_URL=<值>
```

有 GCS 就加：
```
GCS_BUCKET_NAME=<值>
GCS_CREDENTIALS_JSON=<值>
```

17. **Update Variables** → 自動 deploy

---

#### 兩個同時 Deploy，等待結果

18. 回到專案畫面，你應該能看到兩個 Service 卡片同時在 build
19. 各自點進 **Deployments** 看進度，等兩個都顯示綠色 ✓

**驗證（兩個都要打開確認）：**
- `https://<CLAIRE_BACKEND_DOMAIN>/health` → `{"status":"ok"}`
- `https://<POLARIS_BACKEND_DOMAIN>/api/v1/health` → `{"status":"ok"}`

---

## 第三階段：Vercel 部署前端（兩個 Project 同一個 repo）

### 3-1. 建立 Vercel 帳號

1. 打開 https://vercel.com/signup → **Continue with GitHub**

### 3-2. 同時部署兩個前端

> Vercel 每個 Project 對應一個網站。同一個 repo 可以 import 多次。

#### Project 1：Claire Frontend

2. **Add New...** → **Project**
3. Import `OWS_PJs` repo
4. Configure Project：
   - **Project Name**: `claire-frontend`
   - **Root Directory**: 點 Edit → `sites/Claire_Project/frontend`
   - **Framework Preset**: Next.js（自動偵測）
5. Environment Variables（逐一加入）：

| Key | Value |
|-----|-------|
| `NEXT_PUBLIC_API_URL` | `https://api.clairelab.tw/api/v1` |
| `NEXT_SERVER_BACKEND_URL` | `https://api.clairelab.tw` |
| `NEXT_PUBLIC_BACKEND_URL` | `https://api.clairelab.tw` |
| `NEXT_PUBLIC_SITE_NAME` | `Claire Project` |

> 如果 DNS 還沒設定，先暫時用 Railway 域名：
> 把 `https://api.clairelab.tw` 換成 `https://<CLAIRE_BACKEND_DOMAIN>`
> DNS 設好後再到 Settings → Environment Variables 改回來並 Redeploy

6. 點 **Deploy** → 等待 build

---

#### Project 2：Polaris Frontend（不用等 Claire build 完）

7. 回到 Dashboard → **Add New...** → **Project** → 選同一個 `OWS_PJs` repo
8. Configure Project：
   - **Project Name**: `polaris-frontend`
   - **Root Directory**: `sites/Polaris_Parent/frontend`
9. Environment Variables：

| Key | Value |
|-----|-------|
| `NEXT_PUBLIC_API_URL` | `https://api.polaris-parent.com/api/v1` |
| `NEXT_SERVER_BACKEND_URL` | `https://api.polaris-parent.com` |
| `NEXT_PUBLIC_BACKEND_URL` | `https://api.polaris-parent.com` |
| `NEXT_PUBLIC_SITE_NAME` | `Polaris Parent` |

10. 點 **Deploy**

---

#### 等兩個都 build 完成

11. 兩個 Project 各自會有預覽網址：
    - `claire-frontend-xxx.vercel.app`
    - `polaris-frontend-xxx.vercel.app`
12. 分別打開確認頁面能載入

> **如果 Build 失敗，常見原因：**
> - `Module not found: @ows/ui` → Root Directory 設定錯誤
> - TypeScript 錯誤 → 需要回本機修 code 再 push
> - 截圖 Build Logs 給我看，我幫你排查

---

## 第四階段：DNS 設定（兩個域名一起切）

### 4-1. Vercel 綁定域名（兩個一起設）

**Claire：**
1. Vercel → `claire-frontend` → Settings → Domains
2. 加入 `clairelab.tw` 和 `www.clairelab.tw`

**Polaris：**
3. Vercel → `polaris-frontend` → Settings → Domains
4. 加入 `polaris-parent.com` 和 `www.polaris-parent.com`

### 4-2. Railway 綁定域名（兩個一起設）

5. Railway → `claire-backend` → Settings → Networking → Custom Domain → `api.clairelab.tw`
6. Railway → `polaris-backend` → Settings → Networking → Custom Domain → `api.polaris-parent.com`

### 4-3. Cloudflare DNS（兩個域名一起改）

> **重要：全部用 DNS Only（灰雲 ☁️）**

登入 https://dash.cloudflare.com

**clairelab.tw（刪除舊 Tunnel 記錄後新增）：**

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| CNAME | `@` | `cname.vercel-dns.com` | DNS only |
| CNAME | `www` | `cname.vercel-dns.com` | DNS only |
| CNAME | `api` | `claire-backend-production-xxxx.up.railway.app` | DNS only |

**polaris-parent.com（同樣操作）：**

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| CNAME | `@` | `cname.vercel-dns.com` | DNS only |
| CNAME | `www` | `cname.vercel-dns.com` | DNS only |
| CNAME | `api` | `polaris-backend-production-xxxx.up.railway.app` | DNS only |

### 4-4. 如果之前用了暫時的 Railway 域名作為 API URL

DNS 生效後，回到 Vercel 更新環境變數：
1. Vercel → `claire-frontend` → Settings → Environment Variables
2. 把 `NEXT_PUBLIC_API_URL` 等改回 `https://api.clairelab.tw/...`
3. 點 **Deployments** → 最近一次 → **...** → **Redeploy**
4. 對 `polaris-frontend` 重複同樣步驟

### 4-5. 驗證 DNS

```bash
nslookup clairelab.tw
nslookup api.clairelab.tw
nslookup polaris-parent.com
nslookup api.polaris-parent.com
```

---

## 第五階段：檔案上傳遷移

> 兩站的 uploads 一起搬

```bash
# SSH 到 NAS，一次匯出兩個
ssh Jermaine@192.168.30.65
sudo docker cp ows_claire_backend:/app/uploads /tmp/claire_uploads
sudo docker cp ows_polaris_backend:/app/uploads /tmp/polaris_uploads

# 傳回本機
scp -r Jermaine@192.168.30.65:/tmp/claire_uploads D:/PJ_Projects/
scp -r Jermaine@192.168.30.65:/tmp/polaris_uploads D:/PJ_Projects/

# 上傳到 GCS（如果有用的話）
gsutil -m cp -r D:/PJ_Projects/claire_uploads/* gs://<bucket>/claire/
gsutil -m cp -r D:/PJ_Projects/polaris_uploads/* gs://<bucket>/polaris/
```

---

## 第六階段：最終驗證

### 兩站同時驗證：

```
Claire Project:
[ ] https://api.clairelab.tw/health → {"status":"ok"}
[ ] https://clairelab.tw → 頁面正常
[ ] 登入/登出正常
[ ] 圖片顯示正常

Polaris Parent:
[ ] https://api.polaris-parent.com/api/v1/health → {"status":"ok"}
[ ] https://polaris-parent.com → 頁面正常
[ ] 登入/登出正常
[ ] 圖片顯示正常
```

### 全部通過 → 關閉 NAS

```bash
ssh Jermaine@192.168.30.65
cd /volume1/docker/OWS_PJs
sudo docker-compose down    # 停止所有容器，但保留資料
```

> **不要 `docker-compose down -v`（會刪除 volume 資料）！**
> 保留 NAS 資料作為備份，出問題可以 `docker-compose up -d` 回滾。

最後清理 Cloudflare Tunnel：
1. Cloudflare Dashboard → Zero Trust → Networks → Tunnels
2. 刪除你的 Tunnel

---

## 日後更新流程（兩站共用）

```bash
git add <修改的檔案>
git commit -m "修改描述"
git push
```

- 如果改了 `sites/Claire_Project/frontend/` → Vercel 自動 redeploy Claire 前端
- 如果改了 `sites/Polaris_Parent/frontend/` → Vercel 自動 redeploy Polaris 前端
- 如果改了 `sites/Claire_Project/backend/` 或 `core/` → Railway 自動 redeploy 兩個後端（因為同一個 repo）

> 再也不用 SSH 到 NAS 手動 docker-compose build 了！

---

## 費用預估

| 服務 | 內容 | 月費 |
|------|------|------|
| Neon | 1 Project, 2 Databases | $0（Free tier） |
| Upstash | 1 Redis instance | $0（Free tier） |
| Railway | 2 Backend Services | ~$5-15（用量計費） |
| Vercel | 2 Frontend Projects | $0（Hobby plan） |
| GCS/R2 | 圖片儲存 | ~$1-5 |
| **總計** | | **~$5-20/月** |

---

## 常見問題

### Q: Build 失敗，`@ows/ui` 找不到
確認 Vercel 的 Root Directory 設定正確。它需要能從根目錄找到 `packages/ui/`。

### Q: 登入後 Cookie 沒有設定
確認 Railway 環境變數：
- `JWT_COOKIE_DOMAIN=.clairelab.tw`（前面要有點）
- `JWT_COOKIE_SAMESITE=None`
- `CORS_ORIGINS=https://clairelab.tw`（要有 https://）

### Q: Railway 兩個 Service 會互相影響嗎？
不會。雖然是同一個 repo，但各自獨立 build、獨立 deploy、獨立的環境變數。

### Q: Vercel 推 code 後兩個前端都會 redeploy？
Vercel 有 Ignored Build Step 功能，可以設定只有特定目錄有變更才 rebuild。
但一般來說 rebuild 很快（1-2 分鐘），不設也沒關係。

### Q: Neon 資料庫連不上
確認 connection string 結尾有 `?sslmode=require`。
config.py 會自動把 `postgresql://` 轉成 `postgresql+psycopg://`，這是正常行為。
