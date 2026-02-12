# Polaris Parent - NAS 部署指南

## 架構概覽

```
Cloudflare Tunnel
├── frontend.polaris-parent.com → http://192.168.30.65:3000 (Next.js)
└── api.polaris-parent.com      → http://192.168.30.65:5001 (Flask)

NAS Docker (192.168.30.65)
├── polaris_db        (PostgreSQL 15)     :5432
├── polaris_redis     (Redis 7)           internal
├── polaris_backend   (Flask/Gunicorn)    :5001 → container :5000
└── polaris_frontend  (Next.js)           :3000
```

## 方法一：透過 Synology Container Manager「專案」功能部署

這是最適合 Synology NAS 的部署方式，使用 DSM 內建的 Container Manager。

### 步驟 1：上傳專案到 NAS

將整個專案資料夾上傳到 NAS。建議路徑：

```
/volume1/docker/OWS_PJs/
```

可透過 File Station 上傳，或使用 SSH：

```bash
# 從開發機同步（排除不需要的檔案）
rsync -avz \
  --exclude='node_modules' \
  --exclude='venv' \
  --exclude='.next' \
  --exclude='__pycache__' \
  --exclude='.git' \
  /path/to/OWS_PJs/ user@192.168.30.65:/volume1/docker/OWS_PJs/
```

### 步驟 2：設定環境變數

SSH 進入 NAS 或透過 File Station 編輯：

```bash
cd /volume1/docker/OWS_PJs/deploy
cp .env.production.example .env.production
```

**必須修改的項目：**

```env
# 用強密碼
DB_PASSWORD=你的資料庫密碼

# 產生安全金鑰（在任何有 Python 的環境執行）
# python -c "import secrets; print(secrets.token_hex(32))"
SECRET_KEY=產生的金鑰
JWT_SECRET_KEY=產生的金鑰
```

### 步驟 3：在 Container Manager 建立專案

1. 打開 DSM → **Container Manager** → **專案**
2. 點擊 **建立**
3. 設定：
   - **專案名稱**：`polaris`
   - **路徑**：選擇 `/volume1/docker/OWS_PJs/deploy`
   - **來源**：選擇「使用已有的 docker-compose.yml」
4. Container Manager 會自動偵測到 `docker-compose.yml`
5. 點擊 **下一步** → **完成**

> **注意**：Container Manager 會從 `deploy/` 目錄為起點，`docker-compose.yml` 中的 `context: ..` 會正確指向專案根目錄。

### 步驟 4：建置與啟動

在 Container Manager 的專案頁面：

1. 點擊專案 `polaris`
2. 點擊 **建置** (Build)
3. 等待映像建置完成（首次約需 5-10 分鐘）
4. 建置完成後點擊 **啟動**

或透過 SSH：

```bash
cd /volume1/docker/OWS_PJs/deploy
docker compose build
docker compose up -d
```

### 步驟 5：初始化資料庫（首次部署）

```bash
# SSH 進入 NAS
ssh user@192.168.30.65

# 建立資料表
docker exec polaris_backend python -c "
from sites.Polaris_Parent.backend.app import app
from core.backend_engine.factory import db
with app.app_context():
    db.create_all()
    print('資料表建立成功！')
"

# 建立管理員帳號
docker exec -it polaris_backend flask --app sites.Polaris_Parent.backend.app create-admin
```

---

## 方法二：透過 SSH 命令列部署

```bash
ssh user@192.168.30.65
cd /volume1/docker/OWS_PJs/deploy

# 設定環境變數
cp .env.production.example .env.production
nano .env.production  # 填入實際值

# 建置與啟動
docker compose build
docker compose up -d

# 查看狀態
docker compose ps
docker compose logs -f
```

---

## 存取方式

| 方式 | URL |
|------|-----|
| 外部前端 | `https://frontend.polaris-parent.com` |
| 外部 API | `https://api.polaris-parent.com/api/v1` |
| 內網前端 | `http://192.168.30.65:3000` |
| 內網 API | `http://192.168.30.65:5001/api/v1` |

---

## 日常維護

### 更新部署

```bash
cd /volume1/docker/OWS_PJs

# 拉取最新程式碼
git pull

# 重新建置並啟動
cd deploy
docker compose build
docker compose up -d
```

或在 Container Manager 中：專案 → 停止 → 建置 → 啟動

### 查看日誌

```bash
docker compose logs -f              # 全部
docker compose logs -f backend      # 只看後端
docker compose logs -f frontend     # 只看前端
docker compose logs -f db           # 只看資料庫
```

### 備份資料庫

```bash
cd /volume1/docker/OWS_PJs/deploy
docker exec polaris_db pg_dump -U polaris polaris_db > backup_$(date +%Y%m%d).sql
```

### 還原資料庫

```bash
docker exec -i polaris_db psql -U polaris polaris_db < backup_20260211.sql
```

### 重啟服務

```bash
docker compose restart              # 重啟全部
docker compose restart backend      # 只重啟後端
```

---

## 資料目錄

部署後會在 `deploy/` 下自動建立（已加入 .gitignore）：

```
deploy/
├── db_data/          # PostgreSQL 資料（持久化）
├── redis_data/       # Redis 持久化資料
├── uploads/          # 上傳的媒體檔案
└── logs/backend/     # Flask 應用日誌
```

---

## Cloudflare Tunnel 設定參考

你的 Tunnel 應設定如下（在 Cloudflare Zero Trust Dashboard）：

| Public Hostname | Service |
|-----------------|---------|
| `frontend.polaris-parent.com` | `http://192.168.30.65:3000` |
| `api.polaris-parent.com` | `http://192.168.30.65:5001` |

---

## 疑難排解

### 容器啟動失敗

```bash
docker compose logs backend      # 查看錯誤訊息
docker exec -it polaris_backend sh   # 進入容器除錯
```

### 資料庫連線失敗

```bash
docker exec polaris_db pg_isready -U polaris
docker exec -it polaris_db psql -U polaris -d polaris_db
```

### 前端 build 失敗

常見原因：`@ows/ui` workspace 解析問題。確認 `packages/ui/` 目錄已完整上傳。

### Port 被佔用

```bash
# 檢查 port 使用狀況
netstat -tlnp | grep -E '3000|5001|5432'
```
