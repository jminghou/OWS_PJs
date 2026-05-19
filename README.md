# OWS Multi-Site Platform

多站點核心分離架構，採用類似 WordPress 的「核心 (Core) 與 內容 (Sites) 分離」模式，目前包含 **Polaris Parent**（北極星親子）與 **Claire Project** 兩個站點。

部署方式：**Backend → Railway**，**Frontend → Vercel**，push 到 GitHub `main` 分支即自動部署。

---

## 🚀 本機啟動

啟動任一個 Site 需要 **3 個終端機**（Redis + Backend + Frontend）。

### Polaris Parent

```powershell
# 終端機 1：Redis
docker-compose up -d redis

# 終端機 2：後端（先啟動 venv）
flask --app "sites.Polaris_Parent.backend.app:app" run --port 5000

# 終端機 3：前端
npm run dev:polaris
```

→ 前端 `http://localhost:3000`、API `http://localhost:5000/api/v1`

### Claire Project

```powershell
# 終端機 1：Redis（若尚未啟動）
docker-compose up -d redis

# 終端機 2：後端
flask --app "sites.Claire_Project.backend.app:app" run --port 5002

# 終端機 3：前端
npm run dev:claire
```

→ 前端 `http://localhost:3002`、API `http://localhost:5002/api/v1`

> 兩個 Site 可同時運作，Port 不會衝突。首次使用請先參考下方「[初次設定](#初次設定)」。

---

## 🌐 部署網址

| Site | Frontend (Vercel) | Backend (Railway) |
|------|-------------------|-------------------|
| Polaris Parent | https://polaris-parent.com | https://api.polaris-parent.com |
| Claire Project | https://clairelab.tw | https://api.clairelab.tw |

**Push 到 GitHub `main` 分支會自動觸發部署。**

---

## 🏗️ 架構概覽

```
OWS_PJs/
├── core/                       # 核心引擎（共用，不為特定站點修改）
│   ├── backend_engine/         # Flask 工廠模式、ORM、共用服務
│   └── scripts/                # 資料庫初始化腳本
├── packages/
│   ├── ui/                     # 共用 UI 元件庫（@ows/ui）
│   └── media_lib/              # 自建媒體庫模組
├── sites/
│   ├── Polaris_Parent/         # Site A — 北極星親子（含 astrology extension）
│   │   ├── backend/            # Flask + Dockerfile（部署 Railway）
│   │   └── frontend/           # Next.js 15（部署 Vercel）
│   └── Claire_Project/         # Site B — Claire Project（乾淨基底）
│       ├── backend/            # Flask + Dockerfile（部署 Railway）
│       └── frontend/           # Next.js 15（部署 Vercel）
└── docker-compose.yml          # 本機開發用 compose（僅 Redis）
```

| Site | 資料庫 | 本機 Backend Port | 本機 Frontend Port |
|------|--------|--------------------|---------------------|
| Polaris Parent | `ows_polaris` | 5000 | 3000 |
| Claire Project | `ows_claire` | 5002 | 3002 |

每個 Site 擁有獨立的資料庫、`.env` 配置與前後端，可透過 Extensions 擴展 Core 功能。

---
---

# 📚 技術文件

以下為詳細的技術細節、初次設定、部署流程與開發指南。

## 技術棧

| 層級 | 技術 |
|------|------|
| 前端 | Next.js 15 (App Router, Turbopack)、React 18、TypeScript、Tailwind CSS |
| 後端 | Python / Flask、SQLAlchemy ORM |
| 資料庫 | PostgreSQL 14+ |
| 快取 | Redis 7+ |
| 媒體庫 | 自建模組 (`packages/media_lib`)，支援本機存儲與 GCS |
| 富文本編輯 | TipTap |
| 狀態管理 | Zustand |
| 套件管理 | npm workspaces (monorepo) |
| 部署 | Railway (Backend) + Vercel (Frontend) |

---

## 初次設定

### 1. 環境需求

- Python 3.11+
- Node.js 18+
- PostgreSQL 14+（原生安裝）
- Redis 7+（可用 Docker 或原生）

### 2. 克隆專案與安裝依賴

```bash
git clone <repo-url>
cd OWS_PJs
npm install          # 安裝所有 workspace 依賴
```

### 3. 設定環境變數

```bash
cp sites/Polaris_Parent/.env.example sites/Polaris_Parent/.env
cp sites/Claire_Project/.env.example sites/Claire_Project/.env
```

### 4. 資料庫初始化（本機）

#### Polaris Parent

```powershell
psql -U postgres -c "CREATE DATABASE ows_polaris;"
flask --app "sites.Polaris_Parent.backend.app:app" db upgrade
flask --app "sites.Polaris_Parent.backend.app:app" init-site
flask --app "sites.Polaris_Parent.backend.app:app" create-admin
```

#### Claire Project

```powershell
psql -U postgres -c "CREATE DATABASE ows_claire;"
flask --app "sites.Claire_Project.backend.app:app" db upgrade
flask --app "sites.Claire_Project.backend.app:app" init-site
flask --app "sites.Claire_Project.backend.app:app" create-admin
```

> 密碼規則：至少 8 個字元，需包含大寫字母、小寫字母與數字。

---

## 同時啟動兩個 Site

兩個 Site 可同時運作，需要 **5 個終端機**：

```
終端機 1：Redis（共用）
終端機 2：Polaris 後端  → port 5000
終端機 3：Polaris 前端  → port 3000
終端機 4：Claire 後端   → port 5002
終端機 5：Claire 前端   → port 3002
```

### Port 與 Redis 分配總覽

| 服務 | Polaris Parent | Claire Project |
|------|---------------|----------------|
| Backend API | `5000` | `5002` |
| Frontend | `3000` | `3002` |
| 資料庫 | `ows_polaris` | `ows_claire` |
| Redis DB | `redis://localhost:6379/0` | `redis://localhost:6379/1` |

> **注意**：每個 Site 的前端 `.env.local` 中 `NEXT_PUBLIC_API_URL` 必須指向對應的後端 Port。

---

## npm Scripts

```bash
npm run dev:polaris       # 啟動 Polaris 前端（port 3000）
npm run dev:claire        # 啟動 Claire 前端（port 3002）
npm run build:polaris     # 建置 Polaris 前端
npm run build:claire      # 建置 Claire 前端
npm run install:all       # 安裝所有 workspace 依賴
```

---

## 專案結構說明

### Core（核心引擎） — `core/backend_engine/`

核心功能是共用的，不應為特定站點修改：

- `factory.py` — Flask 應用工廠，支援動態 Blueprint 掛載
- `models.py` — 通用 ORM 模型（User, Content, Product 等）
- `services/storage.py` — 檔案存儲服務（LOCAL / GCS）
- `services/rbac.py` — 角色權限控制服務
- `blueprints/main/` — 共用 `/health` 健康檢查端點

### Packages（共用套件）

- `packages/ui/` — 共用 UI 元件庫（`@ows/ui`），包含 Admin 共用元件
- `packages/media_lib/` — 自建媒體庫模組，取代原先的 Strapi 媒體管理

### Sites（站點）

```python
# 範例：sites/Polaris_Parent/backend/app.py
from core.backend_engine.factory import create_app, BlueprintConfig

SITE_EXTENSIONS = [
    BlueprintConfig('sites.Polaris_Parent.backend.extensions.astrology', '/api/v1/astrology'),
]

app = create_app(
    config_class=ProductionConfig,
    site_extensions=SITE_EXTENSIONS,
)
```

---

## 資料庫表結構

- **RBAC**：`roles`, `permissions`, `role_permissions`, `user_roles`
- **使用者**：`users`（含 JSONB `attributes` 擴展欄位）
- **內容**：`contents`, `categories`, `tags`, `comments`
- **媒體**：`media`, `media_folders`
- **電商**：`products`, `orders`, `payment_methods`
- **設定**：`settings`, `homepage_slides`

## API 端點

所有 API 端點都有 `/api/v1` 前綴（健康檢查除外）：

- `GET  /health` — 健康檢查（無前綴，給 Docker/Railway 用）
- `POST /api/v1/auth/login` — 登入
- `POST /api/v1/auth/logout` — 登出
- `GET  /api/v1/contents` — 內容列表
- `GET  /api/v1/products` — 產品列表
- `POST /api/v1/orders` — 建立訂單

---

## 雲端部署：Railway + Vercel

### 自動部署流程

```
本地修改 → git push main
              ↓
        ┌─────┴─────┐
        ↓           ↓
    Railway     Vercel
    (Backend)   (Frontend)
        ↓           ↓
    自動 build → 自動上線
```

### Railway（Backend × 2）

兩個 service 連到同一個 GitHub repo（`jminghou/OWS_PJs`），分別用不同的 Dockerfile：

| Service | Dockerfile Path | Custom Domain |
|---------|-----------------|---------------|
| polaris-backend | `/sites/Polaris_Parent/backend/Dockerfile` | `api.polaris-parent.com` |
| claire-backend | `/sites/Claire_Project/backend/Dockerfile` | `api.clairelab.tw` |

**設定要點**：
- Source → Branch: `main`，Auto deploys: **ON**
- Build → Builder: **Dockerfile**
- Build context 為專案根目錄（`/`），Dockerfile 內以 `COPY` 取得 `core/`、`packages/`、對應 `sites/`
- Container `CMD` 啟動 Gunicorn（`${PORT}` 由 Railway 注入）
- 健康檢查端點：`GET /health`（在 `core/backend_engine/blueprints/main/` 內實作）

**必要環境變數**（在 Railway Dashboard → Variables 設定）：

```
DATABASE_URL          # Railway 內建 Postgres（用 ${{Postgres.DATABASE_URL}} 引用）
REDIS_URL             # Redis 連線（若用 Railway 內建 Redis 同上引用方式）
SECRET_KEY            # Flask session key
JWT_SECRET_KEY        # JWT 簽章 key
JWT_COOKIE_DOMAIN     # 跨域 cookie 設定（例如 .polaris-parent.com）
ADMIN_EMAIL           # 初次建立 admin 用
ADMIN_PASSWORD
ADMIN_USERNAME        # 預設 admin
```

### Vercel（Frontend × 2）

兩個 Vercel project 各自連到 GitHub repo，根目錄分別指到對應的 frontend 資料夾。

| Project | Root Directory | Custom Domain |
|---------|---------------|---------------|
| polaris-frontend | `sites/Polaris_Parent/frontend` | `polaris-parent.com` |
| claire-frontend | `sites/Claire_Project/frontend` | `clairelab.tw` |

**設定要點**：
- Framework Preset: **Next.js**
- `vercel.json` 已存在於各 frontend，會自動套用
- `next.config.js` 透過 `process.env.VERCEL` 判斷，**Vercel 時不啟用 `standalone` 輸出**

**必要環境變數**：

```
NEXT_PUBLIC_API_URL       # 對應後端 API（如 https://api.polaris-parent.com/api/v1）
NEXT_PUBLIC_BACKEND_URL   # 後端 base URL（給 SSR rewrites 用）
```

### 避免雙重部署（可選優化）

兩個 Railway service 共享同一個 repo，預設情況下**任何 commit 都會觸發兩邊重新部署**。可在 Railway Service → Settings → Build → **Watch Paths** 設定觸發條件：

```
# polaris-backend Watch Paths
sites/Polaris_Parent/**
core/**
packages/**

# claire-backend Watch Paths
sites/Claire_Project/**
core/**
packages/**
```

Vercel 同樣可在 Project → Settings → Git → **Ignored Build Step** 用 `git diff` 判斷是否需要 build。

### 部署後操作

#### 首次部署 — 初始化資料庫

Railway 容器內執行（Dashboard → 該 service → 右上角 `⋯` → **Open Shell**）：

```bash
# 建立資料表
python -c "
from sites.Polaris_Parent.backend.app import app
from core.backend_engine.factory import db
with app.app_context():
    db.create_all()
    print('Tables created')
"

# 建立 admin
flask --app sites.Polaris_Parent.backend.app:app create-admin
```

#### Schema 變更時

修改後端 `models.py` 後（新增/修改欄位），需要在 Railway shell 內補資料庫欄位：

```bash
# 連到資料庫
railway connect Postgres   # 或在 Dashboard 直接打開 SQL Editor

# 在 SQL Editor 執行
# ALTER TABLE homepage_settings ADD COLUMN IF NOT EXISTS about_section TEXT;
```

或在本地連到 Railway Postgres 跑 migration：

```powershell
# 取得 DATABASE_URL 後
$env:DATABASE_URL="postgresql://..."
flask --app "sites.Polaris_Parent.backend.app:app" db upgrade
```

### 常見問題

- **Build 失敗**：先查看 Railway / Vercel 的 build log，常見是缺環境變數或 `requirements.txt` 沒鎖版本。
- **500 錯誤**：到 Railway 該 service 的 Logs，若看到 `UndefinedColumn`，代表 `models.py` 跟資料庫 schema 不一致，需手動 ALTER TABLE。
- **CORS 錯誤**：確認 backend `config.py` 的 `CORS_ORIGINS` 有包含對應的 Vercel domain；以及 `JWT_COOKIE_DOMAIN` 設成兩邊共用的根域。
- **健康檢查失敗**：兩個 Dockerfile 都打 `/health`，由 `core/backend_engine/blueprints/main/` 提供。

---

## 開發指南

### 新增 Site Extension

1. 建立 Blueprint 模組：

```python
# sites/Polaris_Parent/backend/extensions/custom/__init__.py
from flask import Blueprint, jsonify

bp = Blueprint('custom', __name__)

@bp.route('/hello')
def hello():
    return jsonify({'message': 'Hello from custom extension!'})
```

2. 在 `app.py` 註冊：

```python
SITE_EXTENSIONS = [
    BlueprintConfig('sites.Polaris_Parent.backend.extensions.custom', '/api/v1/custom'),
]
```

### 權限控制

使用 RBAC 裝飾器：

```python
from core.backend_engine.services.rbac import require_permission

@bp.route('/admin/contents', methods=['POST'])
@jwt_required()
@require_permission('contents.create')
def create_content():
    pass
```

---

## 授權

MIT License
