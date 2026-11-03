# Studio Bot Playbook — Banana → Studio 草稿整合

讓外部 content bot（如 Banana）透過**既有 Studio API** 推送草稿到 Studio/官網 blog。

> **範圍**：Banana 文章 → Studio 草稿 → 官網 blog。不含 FB/IG/Threads 出站發文。

---

## 一、認證：服務帳號 + JWT

### 1.1 建立服務帳號（一次性）

在 Polaris 後台建立一個 bot 專用帳號：

| 欄位 | 值 |
|------|-----|
| username | `banana-bot` |
| email | `banana-bot@internal.example.com` |
| role | `editor`（自動有 `studio.write` + `contents.*`）|
| password | 由運維設定強密碼 |

或透過 CLI/SQL 建立（運維操作，密碼不 commit）：
```sql
-- 範例，實際密碼由運維設定
INSERT INTO blog.users (username, email, password_hash, role, is_active)
VALUES ('banana-bot', 'banana-bot@internal', '<bcrypt_hash>', 'editor', true);
```

### 1.2 登入取得 JWT

```http
POST /auth/login
Content-Type: application/json

{
  "username": "banana-bot",
  "password": "<password>"
}
```

回應：
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "token_type": "Bearer"
}
```

### 1.3 使用 JWT 呼叫 API

所有 `/api/v1/studio/*` 請求帶上：
```
Authorization: Bearer <access_token>
```

### 1.4 Token 過期處理

JWT 預設 15-60 分鐘過期。Bot 應：
1. 快取 token，重複使用
2. 收到 401 時重新登入
3. 或定期（如每 10 分鐘）refresh

---

## 二、API 欄位契約

### 2.1 建立專案

```http
POST /api/v1/studio/projects
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "親子教養系列：正向管教",  // 必須
  "slug": "positive-parenting",       // 可選，自動生成
  "stage": "write",                   // 可選，預設 collect
  "thesis": "核心觀點",               // 可選
  "description": "描述",              // 可選
  "cover_image": "https://...",       // 可選
  "tag_ids": [1, 2],                  // 可選，Studio 標籤 ID
  "attributes": {                     // 可選
    "external_id": "banana-proj-001"  // 建議：Banana 側 ID
  }
}
```

**stage 允許值**：`collect`, `organize`, `ideate`, `write`, `edit`, `scheduled`, `published`, `archived`

回應（201）：
```json
{
  "message": "Project created",
  "id": 42,
  "project": {
    "id": 42,
    "title": "...",
    "slug": "...",
    "stage": "write",
    ...
  }
}
```

### 2.2 建立文件（草稿）

```http
POST /api/v1/studio/projects/<project_id>/documents
Authorization: Bearer <token>
Content-Type: application/json

{
  "platform": "blog",                 // 必須：blog, facebook, instagram, threads, linkedin, newsletter, video_script
  "title": "如何建立孩子的安全感",     // 可選，預設用專案標題
  "body": "## 前言\n\nMarkdown...",   // 可選，Markdown 內文
  "language": "zh-TW",                // 可選，預設 zh-TW
  "stage": "write",                   // 可選，預設 write
  "summary": "SEO 摘要",              // 可選，blog 用
  "tag_ids": [],                      // 可選
  "attributes": {                     // 可選
    "external_id": "banana-doc-001"
  }
}
```

**重要**：`platform: "blog"` 會自動建立 `contents` 表的 draft 記錄（`content_id`）。

回應（201）：
```json
{
  "message": "Document created",
  "id": 123,
  "document": {
    "id": 123,
    "project_id": 42,
    "platform": "blog",
    "language": "zh-TW",
    "title": "...",
    "body": "...",
    "stage": "write",
    "content_id": 456,        // blog 平台才有
    "scheduled_at": null,
    "published_at": null,
    "published_url": null,
    "attributes": {...},
    ...
  }
}
```

### 2.3 更新文件

```http
PUT /api/v1/studio/documents/<document_id>
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "更新標題",        // 可選
  "body": "## 新內文...",     // 可選
  "stage": "edit",           // 可選
  "tag_ids": []              // 可選
}
```

### 2.4 自動儲存（可選）

```http
POST /api/v1/studio/documents/<document_id>/autosave
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "標題",
  "body": "內文"
}
```

自動儲存會：
- 更新工作草稿
- 建立 autosave 版本（保留最近 30 筆）
- **不會** 同步到 contents（公開站）

### 2.5 同步到文章（發布）

```http
POST /api/v1/studio/documents/<document_id>/sync-to-content
Authorization: Bearer <token>
Content-Type: application/json

{
  "mode": "save"          // save | publish | schedule | unpublish
}
```

| mode | 說明 | 需要權限 |
|------|------|----------|
| `save` | 儲存到 contents（仍為草稿） | `contents.update` |
| `publish` | 立即發布到公開站 | `contents.publish` |
| `schedule` | 排程發布（需帶 `published_at`） | `contents.publish` |
| `unpublish` | 下架 | `contents.publish` |

**注意**：`editor` 角色已有這些權限。

---

## 三、典型流程

### 流程 A：Banana 推送草稿 → 人工審核發布

```
Banana                          Studio API                    人工
  │                                │                           │
  ├─ POST /auth/login ────────────►│                           │
  │◄─ JWT token ───────────────────│                           │
  │                                │                           │
  ├─ POST /studio/projects ───────►│                           │
  │◄─ {id: 42} ────────────────────│                           │
  │                                │                           │
  ├─ POST /studio/projects/42/     │                           │
  │       documents ──────────────►│                           │
  │◄─ {id: 123, content_id: 456} ──│                           │
  │                                │                           │
  │    草稿已建立，等人工審核        │                           │
  │                                │◄──────── 編輯、預覽 ───────│
  │                                │◄──────── 點「發布」────────│
  │                                │                           │
```

### 流程 B：Banana 直接發布（不建議用於正式內容）

```python
# 建立專案 + 文件
project = api.post('/studio/projects', {'title': '...'})
doc = api.post(f'/studio/projects/{project.id}/documents', {
    'platform': 'blog',
    'title': '...',
    'body': '...',
})

# 直接發布
api.post(f'/studio/documents/{doc.id}/sync-to-content', {'mode': 'publish'})
```

---

## 四、冪等性與錯誤處理

### 4.1 用 external_id 追蹤

建議在 `attributes.external_id` 存 Banana 側 ID，便於查詢：

```python
def find_project_by_external_id(external_id):
    # 查詢所有專案，用 attributes 篩選
    projects = api.get('/studio/projects?include_archived=true')
    return next((p for p in projects['projects']
                 if (p.get('attributes') or {}).get('external_id') == external_id), None)
```

### 4.2 錯誤處理

| HTTP 狀態 | 意義 |
|-----------|------|
| 401 | Token 過期或無效 → 重新登入 |
| 403 | 無權限（檢查角色） |
| 404 | 資源不存在 |
| 422 | 請求格式錯誤（`message` 有詳情） |

---

## 五、範例腳本（Python）

```python
#!/usr/bin/env python3
"""Banana → Studio 草稿推送範例"""
import os
import json
import urllib.request
import urllib.error

BASE_URL = os.environ.get('STUDIO_API_URL', 'http://127.0.0.1:5000')
BOT_USERNAME = os.environ.get('STUDIO_BOT_USERNAME', 'banana-bot')
BOT_PASSWORD = os.environ.get('STUDIO_BOT_PASSWORD', '')

_token_cache = None

def _request(method, path, body=None, token=None):
    url = f'{BASE_URL}{path}'
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode()) if e.read() else {}

def get_token():
    global _token_cache
    if _token_cache:
        return _token_cache
    status, body = _request('POST', '/auth/login', {
        'username': BOT_USERNAME,
        'password': BOT_PASSWORD,
    })
    if status != 200:
        raise Exception(f'Login failed: {body}')
    _token_cache = body.get('access_token') or body.get('token')
    return _token_cache

def api(method, path, body=None):
    token = get_token()
    status, data = _request(method, path, body, token)
    if status == 401:
        global _token_cache
        _token_cache = None
        token = get_token()
        status, data = _request(method, path, body, token)
    return status, data

def push_draft(title, body_md, external_id=None):
    """推送一篇草稿到 Studio。"""
    # 1. 建立專案
    status, proj = api('POST', '/api/v1/studio/projects', {
        'title': title,
        'stage': 'write',
        'attributes': {'external_id': external_id} if external_id else {},
    })
    if status != 201:
        raise Exception(f'Create project failed: {proj}')
    project_id = proj['id']

    # 2. 建立 blog 文件
    status, doc = api('POST', f'/api/v1/studio/projects/{project_id}/documents', {
        'platform': 'blog',
        'title': title,
        'body': body_md,
        'stage': 'write',
        'attributes': {'external_id': external_id} if external_id else {},
    })
    if status != 201:
        raise Exception(f'Create document failed: {doc}')

    return {
        'project_id': project_id,
        'document_id': doc['document']['id'],
        'content_id': doc['document'].get('content_id'),
    }

if __name__ == '__main__':
    result = push_draft(
        title='[測試] Banana 推送草稿',
        body_md='## 標題\n\n這是測試內文。',
        external_id='banana-test-001',
    )
    print(json.dumps(result, indent=2))
```

---

## 六、環境變數清單

| 變數 | 說明 | 範例 |
|------|------|------|
| `STUDIO_API_URL` | 後端 base URL | `https://api.example.com` |
| `STUDIO_BOT_USERNAME` | Bot 帳號 | `banana-bot` |
| `STUDIO_BOT_PASSWORD` | Bot 密碼（Secret） | `********` |

**安全**：密碼存在 Banana 的 secrets manager，不 commit。

---

## 七、發布工作流程說明

| 階段 | 由誰操作 | API/UI |
|------|----------|--------|
| 建立草稿 | Banana (Bot) | `POST /studio/projects` + `/documents` |
| 編輯潤稿 | 人工（可選） | Studio UI |
| 預覽 | 人工 | Studio UI |
| 發布 | 人工（或 Bot） | `POST /sync-to-content {mode: publish}` 或 UI |

建議草稿階段用 `stage: write` 或 `edit`，讓人工審核後再發布。

---

## 八、已知限制

| 項目 | 狀態 | 備註 |
|------|------|------|
| 檔案上傳 | ❌ Bot 不支援 | 圖片需先透過媒體庫上傳，取得 URL |
| 批次操作 | ❌ 無批次 API | 一次一筆 |
| Webhook | ❌ 無主動通知 | Banana 需輪詢或依賴排程 |
| Token refresh | ⚠️ 需 Bot 處理 | 401 時重新登入 |
