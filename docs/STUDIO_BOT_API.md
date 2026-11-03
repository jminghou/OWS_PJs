# Studio Bot Playbook — Banana → Studio 草稿整合

讓外部 content bot（如 Banana）透過**既有 Studio API** 推送草稿到 Studio/官網 blog。

> **範圍**：Banana 文章 → Studio 草稿 → 官網 blog。不含 FB/IG/Threads 出站發文。

---

## 一、認證：服務帳號 + Cookie + CSRF

### 1.1 建立服務帳號（一次性）

在 Polaris 後台建立一個 bot 專用帳號：

| 欄位 | 值 |
|------|-----|
| username | `banana-bot` |
| email | `banana-bot@internal.example.com` |
| role | `editor`（自動有 `studio.write` + `contents.*`）|
| password | 由運維設定強密碼 |

### 1.2 登入取得 Session

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "username": "banana-bot",
  "password": "<password>"
}
```

**回應（200）**：
```json
{
  "user": {
    "id": 1,
    "username": "banana-bot",
    "email": "...",
    "role": "editor"
  }
}
```

**重要**：JWT 不在 JSON body！而是透過 `Set-Cookie` 設定：

| Cookie 名稱 | 說明 |
|------------|------|
| `access_token_cookie` | JWT（httpOnly，不可讀取） |
| `csrf_access_token` | CSRF token（可讀取，需帶在後續請求 header） |

### 1.3 後續 API 呼叫

所有 `/api/v1/studio/*` 請求需要：

1. **帶上 cookies**（自動，使用 cookie jar / session）
2. **帶上 CSRF header**（從 `csrf_access_token` cookie 讀取）

```http
POST /api/v1/studio/projects
Cookie: access_token_cookie=...; csrf_access_token=...
X-CSRF-TOKEN: <csrf_access_token 的值>
Content-Type: application/json

{"title": "..."}
```

### 1.4 Token 過期處理

JWT 預設 1 小時過期。Bot 應：
1. 維護 session（cookie jar），重複使用
2. 收到 401 時重新登入
3. 或用 `POST /api/v1/auth/refresh` 更新 token

---

## 二、API 欄位契約

### 2.1 建立專案

```http
POST /api/v1/studio/projects
Cookie: access_token_cookie=...; csrf_access_token=...
X-CSRF-TOKEN: <csrf_token>
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
Cookie: ...
X-CSRF-TOKEN: <csrf_token>
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
Cookie: ...
X-CSRF-TOKEN: <csrf_token>
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
Cookie: ...
X-CSRF-TOKEN: <csrf_token>
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
Cookie: ...
X-CSRF-TOKEN: <csrf_token>
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
  ├─ POST /api/v1/auth/login ─────►│                           │
  │◄─ Set-Cookie (JWT+CSRF) ───────│                           │
  │                                │                           │
  ├─ POST /studio/projects ───────►│                           │
  │   (帶 Cookie + X-CSRF-TOKEN)   │                           │
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

---

## 四、冪等性與錯誤處理

### 4.1 用 external_id 追蹤

建議在 `attributes.external_id` 存 Banana 側 ID，便於查詢：

```python
def find_project_by_external_id(external_id):
    # 查詢所有專案，用 attributes 篩選
    projects = api.get('/api/v1/studio/projects?include_archived=true')
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
"""Banana → Studio 草稿推送範例（Cookie + CSRF 認證）"""
import http.cookiejar
import json
import os
import re
import urllib.request
import urllib.error

BASE_URL = os.environ.get('STUDIO_API_URL', 'http://127.0.0.1:5000')
BOT_USERNAME = os.environ.get('STUDIO_BOT_USERNAME', 'banana-bot')
BOT_PASSWORD = os.environ.get('STUDIO_BOT_PASSWORD', '')


class StudioClient:
    def __init__(self, base_url):
        self.base_url = base_url.rstrip('/')
        self.cookie_jar = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(
            urllib.request.HTTPCookieProcessor(self.cookie_jar)
        )
        self.csrf_token = None

    def _get_csrf_token(self):
        """從 cookie jar 讀取 csrf_access_token"""
        for cookie in self.cookie_jar:
            if cookie.name == 'csrf_access_token':
                return cookie.value
        return None

    def _request(self, method, path, body=None):
        url = f'{self.base_url}{path}'
        headers = {'Content-Type': 'application/json'}

        # 非 GET 請求需要帶 CSRF token
        if method != 'GET' and self.csrf_token:
            headers['X-CSRF-TOKEN'] = self.csrf_token

        data = json.dumps(body).encode() if body else None
        req = urllib.request.Request(url, data=data, method=method, headers=headers)

        try:
            with self.opener.open(req, timeout=30) as r:
                # 登入後更新 CSRF token
                self.csrf_token = self._get_csrf_token()
                return r.status, json.loads(r.read().decode())
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read().decode()) if e.read() else {}

    def login(self, username, password):
        status, body = self._request('POST', '/api/v1/auth/login', {
            'username': username,
            'password': password,
        })
        if status == 200:
            self.csrf_token = self._get_csrf_token()
        return status, body

    def create_project(self, title, **kwargs):
        return self._request('POST', '/api/v1/studio/projects', {
            'title': title,
            **kwargs,
        })

    def create_document(self, project_id, platform, title, body, **kwargs):
        return self._request('POST', f'/api/v1/studio/projects/{project_id}/documents', {
            'platform': platform,
            'title': title,
            'body': body,
            **kwargs,
        })


def push_draft(title, body_md, external_id=None):
    """推送一篇草稿到 Studio。"""
    client = StudioClient(BASE_URL)

    # 1. 登入
    status, resp = client.login(BOT_USERNAME, BOT_PASSWORD)
    if status != 200:
        raise Exception(f'Login failed: {resp}')

    # 2. 建立專案
    attrs = {'external_id': external_id} if external_id else {}
    status, proj = client.create_project(title, stage='write', attributes=attrs)
    if status != 201:
        raise Exception(f'Create project failed: {proj}')
    project_id = proj['id']

    # 3. 建立 blog 文件
    status, doc = client.create_document(
        project_id, 'blog', title, body_md,
        stage='write', attributes=attrs,
    )
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
| Token refresh | ⚠️ 需 Bot 處理 | 401 時重新登入，或呼叫 `/api/v1/auth/refresh` |
