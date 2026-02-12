# OWS Multi-Site Platform

多站點核心分離架構，採用類似 WordPress 的「核心 (Core) 與 內容 (Sites) 分離」模式。

## 架構概覽

```
OWS_PJs/
├── core/                       # 核心引擎
│   ├── backend_engine/         # Flask 後端（工廠模式、ORM、服務）
│   ├── frontend_ui/            # 前端共用元件（已停用，改用 packages/ui）
│   └── scripts/                # 資料庫初始化腳本
├── packages/
│   ├── ui/                     # 共用 UI 元件庫（@ows/ui）
│   └── media_lib/              # 自建媒體庫模組
├── sites/
│   ├── Polaris_Parent/         # Site A — 北極星親子
│   │   ├── backend/            # Flask 後端 + Extensions
│   │   └── frontend/           # Next.js 15 前端（App Router）
│   └── Claire_Project/         # Site B — Claire（規劃中）
├── deploy/                     # NAS Docker 部署配置
│   ├── dockerfiles/            # 生產級 Dockerfile
│   ├── docker-compose.yml      # NAS 部署用 compose
│   └── .env.production.example # 環境變數範本
├── docker-compose.yml          # 本機開發用 compose
├── package.json                # npm workspaces 根配置
└── .gitignore
```

## 開發與部署模式

本專案支援兩種運作模式：

| 模式 | 用途 | 說明 |
|------|------|------|
| **本機開發** | 日常開發 | Windows 原生跑 Python + npm，熱更新 |
| **NAS 部署** | 生產環境 | Docker 打包部署到 Synology NAS，Cloudflare Tunnel 對外 |

> 先前使用的 Railway、Vercel 及雲端資料庫已全數移除。

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

## 快速開始

### 1. 環境需求

- Python 3.11+
- Node.js 18+
- PostgreSQL 14+（原生安裝）
- Redis 7+（可用 Docker 或原生）

### 2. 克隆專案

```bash
git clone <repo-url>
cd OWS_PJs
```

### 3. 設定環境變數

```bash
cp sites/Polaris_Parent/.env.example sites/Polaris_Parent/.env
# 編輯 .env 並填入正確的值
```

### 4. 啟動服務（本機開發模式）

需要 **3 個終端機**：

```powershell
# 終端機 1：啟動 Redis（若無原生 Redis，可用 Docker）
docker-compose up -d redis

# 終端機 2：啟動 Python 後端
cd sites/Polaris_Parent/backend
.\venv\Scripts\Activate.ps1
python app.py

# 終端機 3：啟動 Next.js 前端（回到專案根目錄）
npm run dev:polaris
```

| 服務 | 網址 |
|------|------|
| PostgreSQL | `localhost:5432`（原生） |
| Redis | `localhost:6379` |
| Python API | `http://localhost:5000/api/v1` |
| 前端 | `http://localhost:3000` |

### 5. 資料庫初始化

首次使用時，需初始化資料庫：

```powershell
# 1. 建立資料庫（使用 psql）
psql -U postgres -c "CREATE DATABASE ows_polaris;"

# 2. 建立資料表（在 backend 目錄、啟動 venv 後執行）
python -c "from app import app; from core.backend_engine.factory import db; app.app_context().push(); db.create_all(); print('成功！')"

# 3. 建立管理員帳號
flask --app app.py create-admin
```

> 密碼規則：至少 8 個字元，需包含大寫字母、小寫字母與數字。

## 專案結構說明

### Core（核心引擎） — `core/backend_engine/`

核心功能是共用的，不應為特定站點修改：

- `factory.py` — Flask 應用工廠，支援動態 Blueprint 掛載
- `models.py` — 通用 ORM 模型（User, Content, Product 等）
- `services/storage.py` — 檔案存儲服務（LOCAL / GCS）
- `services/rbac.py` — 角色權限控制服務

### Packages（共用套件）

- `packages/ui/` — 共用 UI 元件庫（`@ows/ui`），包含 Admin 共用元件
- `packages/media_lib/` — 自建媒體庫模組，取代原先的 Strapi 媒體管理

### Sites（站點） — `sites/Polaris_Parent/`

每個站點可以：

- 擁有獨立的 `.env` 配置
- 擴展 Core 功能（透過 Extensions）
- 自訂前端樣式和頁面

```python
# sites/Polaris_Parent/backend/app.py
from core.backend_engine.factory import create_app, BlueprintConfig

SITE_EXTENSIONS = [
    BlueprintConfig('sites.Polaris_Parent.backend.extensions.astrology', '/api/v1/astrology'),
]

app = create_app(
    config_class=ProductionConfig,
    site_extensions=SITE_EXTENSIONS,
)
```

## 資料庫表結構

- **RBAC**：`roles`, `permissions`, `role_permissions`, `user_roles`
- **使用者**：`users`（含 JSONB `attributes` 擴展欄位）
- **內容**：`contents`, `categories`, `tags`, `comments`
- **媒體**：`media`, `media_folders`
- **電商**：`products`, `orders`, `payment_methods`
- **設定**：`settings`, `homepage_slides`

## API 端點

所有 API 端點都有 `/api/v1` 前綴：

- `POST /api/v1/auth/login` — 登入
- `POST /api/v1/auth/logout` — 登出
- `GET /api/v1/contents` — 內容列表
- `GET /api/v1/products` — 產品列表
- `POST /api/v1/orders` — 建立訂單

## npm Scripts

```bash
# 本機開發
npm run dev:polaris       # 啟動 Polaris 前端開發伺服器
npm run build:polaris     # 建置 Polaris 前端
npm run install:all       # 安裝所有 workspace 依賴

# NAS 部署
npm run deploy:build      # 建置 Docker 映像
npm run deploy:up         # 啟動所有容器
npm run deploy:down       # 停止所有容器
npm run deploy:logs       # 查看即時日誌
```

## NAS 部署（Synology + Cloudflare Tunnel）

部署相關的所有檔案都在 `deploy/` 目錄中，與本機開發完全分離。

```
deploy/
├── docker-compose.yml            # 生產環境 compose
├── dockerfiles/
│   ├── backend.Dockerfile        # Flask（alpine, multi-stage, gunicorn）
│   └── frontend.Dockerfile       # Next.js（standalone, multi-stage）
├── .env.production.example       # 環境變數範本
└── README.md                     # 完整部署指南
```

### 快速部署

```bash
cd deploy
cp .env.production.example .env.production
# 編輯 .env.production 填入實際值

docker compose build
docker compose up -d
```

### 部署後的服務

| 服務 | Container | Port | 說明 |
|------|-----------|------|------|
| PostgreSQL 15 | `polaris_db` | 5432 | 資料持久化於 `./db_data` |
| Redis 7 | `polaris_redis` | — | 快取，maxmemory 128mb |
| Flask Backend | `polaris_backend` | 5055 | Gunicorn, 2 workers |
| Next.js Frontend | `polaris_frontend` | 3000 | Standalone 模式 |

### Cloudflare Tunnel 對應

| Public Hostname | 指向 |
|-----------------|------|
| `frontend.polaris-parent.com` | `http://192.168.30.65:3000` |
| `api.polaris-parent.com` | `http://192.168.30.65:5055` |

### 存取方式

| 方式 | URL |
|------|-----|
| 外部前端 | `https://frontend.polaris-parent.com` |
| 外部 API | `https://api.polaris-parent.com/api/v1` |
| 內網前端 | `http://192.168.30.65:3000` |
| 內網 API | `http://192.168.30.65:5055/api/v1` |

### 透過 Synology Container Manager 部署

1. 上傳專案到 NAS（建議路徑 `/volume1/docker/OWS_PJs/`）
2. 複製並編輯環境變數：`deploy/.env.production.example` → `.env.production`
3. DSM → Container Manager → 專案 → 建立 → 路徑選 `deploy/` → 建置 → 啟動

> 詳細部署步驟請參閱 [deploy/README.md](deploy/README.md)

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

## 授權

MIT License
