# Claire Project - NAS 部署指南

## 架構概覽

```
Cloudflare Tunnel
├── clairelab.tw       → http://192.168.30.65:3002 (Next.js)
└── api.clairelab.tw   → http://192.168.30.65:5056 (Flask)

NAS Docker (192.168.30.65)
├── claire_db        (PostgreSQL 15)     internal
├── claire_redis     (Redis 7)           internal
├── claire_backend   (Flask/Gunicorn)    :5056 → container :5000
└── claire_frontend  (Next.js)           :3002 → container :3000
```

## 首次部署

### 步驟 1：同步程式碼到 NAS

```bash
ssh Jermaine@192.168.30.65
cd /volume1/docker/OWS_PJs
sudo git pull origin main
```

### 步驟 2：設定環境變數

```bash
cd /volume1/docker/OWS_PJs/deploy_claire
cp .env.production.example .env.production
nano .env.production
```

**必須修改的項目：**

```env
DB_PASSWORD=你的資料庫密碼
SECRET_KEY=你產生的金鑰
JWT_SECRET_KEY=你產生的金鑰
```

### 步驟 3：建置與啟動

**方法一：透過 Container Manager**

1. DSM → Container Manager → 專案 → 建立
2. 專案名稱：`claire`
3. 路徑：`/volume1/docker/OWS_PJs/deploy_claire`
4. 建置 → 啟動

**方法二：SSH 命令列**

```bash
cd /volume1/docker/OWS_PJs/deploy_claire
sudo docker compose build
sudo docker compose up -d
```

### 步驟 4：初始化資料庫（首次部署）

```bash
# 建立資料表
sudo docker exec claire_backend python -c "
from sites.Claire_Project.backend.app import app
from core.backend_engine.factory import db
with app.app_context():
    db.create_all()
    print('資料表建立成功！')
"

# 建立管理員帳號
sudo docker exec -it claire_backend flask --app sites.Claire_Project.backend.app create-admin
```

---

## 存取方式

| 方式 | URL |
|------|-----|
| 外部前端 | `https://clairelab.tw` |
| 外部 API | `https://api.clairelab.tw/api/v1` |
| 內網前端 | `http://192.168.30.65:3002` |
| 內網 API | `http://192.168.30.65:5056/api/v1` |

---

## 日常維護：更新部署 SOP

### 1. 同步原始碼
```bash
ssh Jermaine@192.168.30.65
cd /volume1/docker/OWS_PJs
sudo git pull origin main
```

### 2. 重啟並建置容器
```bash
cd deploy_claire
sudo docker compose down
sudo docker compose up -d --build
```

### 3. 強制更新（破除 Docker 快取）
```bash
sudo docker compose down --rmi all
sudo docker compose build --no-cache
sudo docker compose up -d
```

### 4. 清除快取
1. **Cloudflare**：進入 `clairelab.tw` 後台 → Caching → Purge Everything
2. **瀏覽器**：`Ctrl + F5` 或無痕模式

---

## 查看日誌

```bash
sudo docker logs -f claire_backend      # 後端
sudo docker logs -f claire_frontend     # 前端
sudo docker compose -f /volume1/docker/OWS_PJs/deploy_claire/docker-compose.yml logs -f
```

## 備份資料庫

```bash
cd /volume1/docker/OWS_PJs/deploy_claire
docker exec claire_db pg_dump -U claire claire_db > backup_$(date +%Y%m%d).sql
```

## 還原資料庫

```bash
docker exec -i claire_db psql -U claire claire_db < backup_20260315.sql
```

---

## 資料目錄

部署後會在 `deploy_claire/` 下自動建立：

```
deploy_claire/
├── db_data/          # PostgreSQL 資料（持久化）
├── redis_data/       # Redis 持久化資料
├── uploads/          # 上傳的媒體檔案（Local 模式）
└── logs/backend/     # Flask 應用日誌
```
