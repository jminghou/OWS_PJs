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

#### 開發混合模式 A：原生 PostgreSQL + 最小 Docker (目前預設)
使用原生安裝的 PostgreSQL，只有 Redis 跑在 Docker，需要 **4 個終端機**。

此模式下 Strapi 以**開發模式**運行，可以在 Admin 介面修改 Content Types。

```powershell
# 終端機 1：啟動 Redis（確保原生 PostgreSQL 已在運行）
docker-compose up -d redis

# 終端機 2：啟動 Python 後端
cd sites/Polaris_Parent/backend
.\venv\Scripts\Activate.ps1
python app.py



# 終端機 4：啟動 Next.js 前端
npm run dev:polaris
```

| 服務 | 網址 |
|------|------|
| 資料庫 | `localhost:5432` (原生 PostgreSQL) |
| Redis | `localhost:6379` |
| Python API | `http://localhost:5000/api/v1` |
| Strapi | `http://localhost:1337` (開發模式) |
| 前端 | `http://localhost:3000` |

---

#### 模式切換說明：原生 PostgreSQL vs Docker PostgreSQL

目前 `.env` 預設使用**原生 PostgreSQL (port 5432)**。如果要切換到模式 B（全 Docker 後端），需要修改資料庫設定以避免端口衝突。

<details>
<summary><strong>切換到模式 B 的步驟</strong></summary>

1. **修改 `sites/Polaris_Parent/.env`**：
   ```bash
   # 將 DB_PORT 從 5432 改為 5433
   DB_PORT=5433

   # 將 DATABASE_URL 改為使用 5433 端口
   DATABASE_URL=postgresql://postgres:1234567@localhost:5433/ows_polaris
   ```

2. **停止原生 PostgreSQL**（選擇性，避免端口衝突）：
   ```powershell
   # Windows 服務
   net stop postgresql-x64-14
   ```

3. **啟動 Docker 資料庫**：
   ```powershell
   docker-compose up -d db redis
   ```

4. **如果是首次使用 Docker PostgreSQL，需要初始化資料庫**：
   ```powershell
   # 建立資料庫
   docker-compose exec db psql -U postgres -c "CREATE DATABASE ows_polaris;"

   # 建立資料表
   cd sites/Polaris_Parent/backend
   .\venv\Scripts\Activate.ps1
   python -c "from app import app; from core.backend_engine.factory import db; app.app_context().push(); db.create_all(); print('成功！')"

   # 建立管理員帳號
   flask --app app.py create-admin
   ```

</details>

<details>
<summary><strong>切換回模式 A 的步驟</strong></summary>

1. **修改 `sites/Polaris_Parent/.env`**：
   ```bash
   # 將 DB_PORT 改回 5432
   DB_PORT=5432

   # 將 DATABASE_URL 改回使用 5432 端口
   DATABASE_URL=postgresql://postgres:1234567@localhost:5432/ows_polaris
   ```

2. **停止 Docker 資料庫**：
   ```powershell
   docker-compose stop db
   ```

3. **啟動原生 PostgreSQL**：
   ```powershell
   net start postgresql-x64-14
   ```

</details>

---

#### 開發混合模式 B：後端 Docker + 前端原生
後端服務全部跑在 Docker，只有前端跑在原生環境保留熱更新，只需 **1 個終端機**。

> **重要**：此模式下 Strapi 以**生產模式**運行，無法在 Admin 修改 Content Types。
> 如需修改 Strapi 資料結構，請使用模式 A。

> **前置作業**：使用此模式前，請先參考上方「切換到模式 B 的步驟」修改 `.env` 設定。

```powershell
# 啟動所有後端服務（背景執行）
docker-compose up -d db redis polaris_backend strapi

# 啟動前端（前景執行，有熱更新）
npm run dev:polaris
```

| 服務 | 網址 |
|------|------|
| 資料庫 | `localhost:5433` (Docker PostgreSQL) |
| Redis | `localhost:6379` |
| Python API | `http://localhost:5000/api/v1` |
| Strapi | `http://localhost:1337` (生產模式) |
| 前端 | `http://localhost:3000` |

> **首次啟動 Strapi**：請訪問 `http://localhost:1337/admin` 建立管理員帳號。

---

#### Strapi 媒體管理

Strapi 用於管理媒體檔案（相片、影片等）的元資料。

> **詳細文件**：關於 Content Types 修改、Schema 編輯、資料表同步問題等，
> 請參閱 [packages/strapi-media/README.md](packages/strapi-media/README.md)

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

#### 之後若要新增管理員（Docker 模式）

當後端以 Docker 運行時，請在專案根目錄執行以下指令建立新管理員：

```powershell
docker exec -w /app ows_polaris_backend python -c "
from sites.Polaris_Parent.backend.app import app
with app.app_context():
    from core.backend_engine.models import User
    from core.backend_engine.factory import db
    user = User(username='新帳號', email='email@example.com', role='admin', is_active=True)
    user.set_password('您的密碼')  # 至少 8 字、含大小寫字母及數字
    db.session.add(user)
    db.session.commit()
    print('成功！')
"
```

> 密碼規則：至少 8 個字元，需包含大寫字母、小寫字母與數字。

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
