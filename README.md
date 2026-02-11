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
├── docker-compose.yml
├── package.json                # npm workspaces 根配置
└── .gitignore
```

## 目前開發環境狀態

> **重要：目前以本機開發為主。**
> 先前使用的 Railway、Vercel 及雲端資料庫已全數移除，避免本機與雲端同步造成混亂。
> Docker 環境可能需要重新整理，目前建議使用原生模式開發。

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
npm run dev:polaris     # 啟動 Polaris 前端開發伺服器
npm run build:polaris   # 建置 Polaris 前端
npm run install:all     # 安裝所有 workspace 依賴
```

## Docker（待整理）

> Docker 環境目前可能存在配置混亂的情況，之後將重新整理。
> 目前僅建議使用 `docker-compose up -d redis` 啟動 Redis。

`docker-compose.yml` 中定義了以下服務供未來使用：

| 服務 | Container | Port |
|------|-----------|------|
| PostgreSQL | `ows_postgres` | 5432 |
| Redis | `ows_redis` | 6379 |
| Polaris Backend | `ows_polaris_backend` | 5001 |
| Polaris Frontend | `ows_polaris_frontend` | 3001 |
| Claire Backend | `ows_claire_backend` | 5002 |
| Claire Frontend | `ows_claire_frontend` | 3002 |

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
