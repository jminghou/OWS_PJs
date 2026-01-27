# OWS Multi-Site Platform

多站點核心分離架構，採用類似 WordPress 的「核心 (Core) 與 內容 (Sites) 分離」模式。

## 架構概覽

```
OWS_PJs/
├── core/                   # 核心引擎
│   ├── backend_engine/     # Flask 後端邏輯
│   ├── frontend_ui/        # Next.js 共用元件庫
│   └── scripts/            # 維護與遷移腳本
├── sites/
│   ├── Polaris_Parent/     # Site A
│   └── Claire_Project/     # Site B
├── docker-compose.yml
└── .gitignore
```

## 快速開始

### 1. 環境需求

- Python 3.11+
- Node.js 18+
- PostgreSQL 14+
- Redis 7+
- Docker & Docker Compose (選用)

### 2. 克隆專案

```bash
git clone <repo-url>
cd OWS_PJs
```

### 3. 設定環境變數

```bash
# 複製範例環境變數檔
cp sites/Polaris_Parent/.env.example sites/Polaris_Parent/.env

# 編輯 .env 並填入正確的值
```

### 4. 啟動服務

#### 開發混合模式 (推薦)
這是開發時最流暢的模式：**資料庫與 Redis 跑在 Docker，程式碼跑在原生 Windows**。

##### 1. 啟動 Docker 基礎設施 (DB, Redis)
在專案根目錄執行：
```powershell
# 啟動資料庫與快取
docker-compose up -d db redis
```
*   **資料庫位址**: `localhost:5433` (透過 Docker 映射)
*   **Redis 位址**: `localhost:6379`

##### 2. 啟動後端 (Flask)
開啟新的終端機，進入後端目錄：
```powershell
cd sites/Polaris_Parent/backend
# 啟動虛擬環境 (若已建立)
.\venv\Scripts\Activate.ps1
# 啟動後端
python app.py
```
*   **API 網址**: `http://localhost:5000/api/v1`

##### 3. 啟動前端 (Next.js)
開啟另一個新的終端機，進入前端目錄：
```powershell
cd sites/Polaris_Parent/frontend
npm run dev
```
*   **前端網址**: `http://localhost:3000`

---

#### 全 Docker 模式 (部署前測試)
如果您想測試完整的 Docker 打包環境：

```bash
# 啟動所有服務 (包含 App)
docker-compose up -d --build polaris_backend polaris_frontend

# 停止並移除容器 (保留資料)
docker-compose down

# 停止並移除容器與資料 (徹底重置)
docker-compose down -v
```
*   **前端網址**: `http://localhost:3001`
*   **後端網址**: `http://localhost:5001/api/v1`

---

### 5. 初始化與維護指令
如果資料庫是空的，請依序執行以下指令：

```powershell
# 1. 建立資料庫 (僅第一次需要)
docker-compose exec db psql -U postgres -c "CREATE DATABASE ows_polaris;"

# 2. 建立資料表 (混合模式下在 backend 目錄執行)
python -c "from app import app; from core.backend_engine.factory import db; app.app_context().push(); db.create_all(); print('成功！')"

# 3. 建立管理員帳號
flask --app app.py create-admin
```

## 專案結構說明

### Core (核心引擎)

核心功能是共用的，不應為特定站點修改：

- `factory.py`: Flask 應用工廠，支援動態 Blueprint 掛載
- `models.py`: 通用 ORM 模型 (User, Content, Product, etc.)
- `services/storage.py`: 檔案存儲服務 (LOCAL/GCS)
- `services/rbac.py`: 角色權限控制服務

### Sites (站點)

每個站點可以：

- 擁有獨立的 `.env` 配置
- 擴展 Core 功能 (透過 Extensions)
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

## 資料庫

### 初始化

```bash
# 使用 psql 執行初始化腳本
psql -U postgres -d your_database -f core/scripts/init_db.sql
```

### 表結構

- **RBAC**: `roles`, `permissions`, `role_permissions`, `user_roles`
- **使用者**: `users` (含 JSONB `attributes` 擴展欄位)
- **內容**: `contents`, `categories`, `tags`, `comments`
- **媒體**: `media`, `media_folders`
- **電商**: `products`, `orders`, `payment_methods`
- **設定**: `settings`, `homepage_slides`

## API 端點

所有 API 端點都有 `/api/v1` 前綴：

- `POST /api/v1/auth/login` - 登入
- `POST /api/v1/auth/logout` - 登出
- `GET /api/v1/contents` - 內容列表
- `GET /api/v1/products` - 產品列表
- `POST /api/v1/orders` - 建立訂單

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
    # Only users with 'contents.create' permission can access
    pass
```

## 授權

MIT License
