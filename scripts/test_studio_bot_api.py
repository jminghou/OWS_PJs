#!/usr/bin/env python3
"""
Studio API 冒煙測試 — 驗證 Bot（服務帳號）可用既有 API 推送草稿。

認證方式：Cookie + CSRF（與 main 一致）
- Login 回應透過 Set-Cookie 設定 JWT（httpOnly）+ CSRF token
- 後續請求帶 cookies + X-CSRF-TOKEN header

使用方式：
    # 設定環境變數
    export STUDIO_API_URL=http://127.0.0.1:5000
    export STUDIO_BOT_USERNAME=banana-bot
    export STUDIO_BOT_PASSWORD=<password>

    # 執行
    python scripts/test_studio_bot_api.py

    # mock 模式（驗證腳本邏輯，不測真實認證流程）
    python scripts/test_studio_bot_api.py --mock
"""
import argparse
import http.cookiejar
import json
import os
import sys
import urllib.request
import urllib.error
from datetime import datetime


def log(msg: str, level: str = 'INFO'):
    ts = datetime.now().strftime('%H:%M:%S')
    print(f'[{ts}] {level}: {msg}')


def log_ok(msg: str):
    log(f'✓ {msg}', 'OK')


def log_fail(msg: str):
    log(f'✗ {msg}', 'FAIL')


class MockClient:
    """
    Mock client for testing script logic without a real backend.

    注意：Mock 模式不驗證真實的 Cookie + CSRF 流程。
    真實測試請用 HTTPClient（不帶 --mock）。
    """

    def __init__(self):
        self._id = 100

    def login(self, username, password):
        log('  [mock] 模擬登入，不驗證真實 Cookie + CSRF 流程')
        return 200, {'user': {'id': 1, 'username': username, 'role': 'editor'}}

    def request(self, method, path, body=None):
        self._id += 1
        if '/projects' in path and method == 'POST' and '/documents' not in path:
            return 201, {
                'message': 'Project created',
                'id': self._id,
                'project': {'id': self._id, 'title': body.get('title'), 'stage': body.get('stage', 'collect')},
            }
        if '/documents' in path and method == 'POST':
            return 201, {
                'message': 'Document created',
                'id': self._id,
                'document': {
                    'id': self._id,
                    'platform': body.get('platform'),
                    'title': body.get('title'),
                    'stage': body.get('stage', 'write'),
                    'content_id': self._id + 100 if body.get('platform') == 'blog' else None,
                },
            }
        if '/documents/' in path and method == 'PUT':
            return 200, {'message': 'Document updated', 'document': {'id': int(path.split('/')[-1])}}
        return 404, {'message': 'Not found'}


class HTTPClient:
    """
    Real HTTP client using Cookie + CSRF authentication.

    認證流程：
    1. POST /api/v1/auth/login → Set-Cookie 設定 JWT + CSRF token
    2. 後續請求帶 cookies + X-CSRF-TOKEN header
    """

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

    def _http(self, method, path, body=None):
        url = f'{self.base_url}{path}'
        headers = {'Content-Type': 'application/json'}

        if method != 'GET' and self.csrf_token:
            headers['X-CSRF-TOKEN'] = self.csrf_token

        data = json.dumps(body).encode() if body else None
        req = urllib.request.Request(url, data=data, method=method, headers=headers)

        try:
            with self.opener.open(req, timeout=30) as r:
                self.csrf_token = self._get_csrf_token()
                return r.status, json.loads(r.read().decode())
        except urllib.error.HTTPError as e:
            raw = e.read()
            body_text = raw.decode() if raw else ''
            return e.code, json.loads(body_text) if body_text else {}
        except Exception as e:
            return 0, {'error': str(e)}

    def login(self, username, password):
        status, body = self._http('POST', '/api/v1/auth/login', {
            'username': username,
            'password': password,
        })
        if status == 200:
            self.csrf_token = self._get_csrf_token()
            if self.csrf_token:
                log(f'  CSRF token obtained: {self.csrf_token[:20]}...')
            else:
                log('  Warning: No csrf_access_token cookie found')
        return status, body

    def request(self, method, path, body=None):
        return self._http(method, path, body)


def run_tests(client, verbose=False):
    passed = failed = 0
    test_id = datetime.now().strftime('%Y%m%d%H%M%S')

    # Test 1: Login
    log('Testing login (POST /api/v1/auth/login)...')
    username = os.environ.get('STUDIO_BOT_USERNAME', 'banana-bot')
    password = os.environ.get('STUDIO_BOT_PASSWORD', 'test')
    status, body = client.login(username, password)

    if status == 200 and body.get('user'):
        log_ok(f'Login successful, user={body["user"].get("username")}')
        passed += 1
    else:
        log_fail(f'Login failed: {status} {body}')
        log('  Note: Login returns user info in body, JWT in Set-Cookie')
        failed += 1
        return passed, failed

    # Test 2: Create project
    log('Testing create project (POST /api/v1/studio/projects)...')
    status, body = client.request('POST', '/api/v1/studio/projects', {
        'title': f'[Bot Test] 測試專案 {test_id}',
        'stage': 'write',
        'thesis': '測試核心觀點',
        'attributes': {'external_id': f'smoke-test-{test_id}'},
    })
    if status == 201 and body.get('id'):
        project_id = body['id']
        log_ok(f'Created project id={project_id}')
        passed += 1
        if verbose:
            print(json.dumps(body, indent=2, ensure_ascii=False))
    else:
        log_fail(f'Create project failed: {status} {body}')
        failed += 1
        return passed, failed

    # Test 3: Create blog document
    log('Testing create blog document (POST /api/v1/studio/projects/<id>/documents)...')
    status, body = client.request('POST', f'/api/v1/studio/projects/{project_id}/documents', {
        'platform': 'blog',
        'title': f'[Bot Test] 部落格草稿 {test_id}',
        'body': '## 標題\n\n這是測試內文。\n\n### 小節\n\n更多內容...',
        'stage': 'write',
        'attributes': {'external_id': f'smoke-test-doc-{test_id}'},
    })
    if status == 201:
        doc = body.get('document', body)
        doc_id = doc.get('id') or body.get('id')
        content_id = doc.get('content_id')
        log_ok(f'Created blog document id={doc_id}, content_id={content_id}')
        passed += 1
        if verbose:
            print(json.dumps(body, indent=2, ensure_ascii=False))
    else:
        log_fail(f'Create blog document failed: {status} {body}')
        failed += 1
        doc_id = None

    # Test 4: Update document
    if doc_id:
        log('Testing update document (PUT /api/v1/studio/documents/<id>)...')
        status, body = client.request('PUT', f'/api/v1/studio/documents/{doc_id}', {
            'body': '## 更新後的標題\n\n這是更新後的內文。',
            'stage': 'edit',
        })
        if status == 200:
            log_ok('Updated document')
            passed += 1
        else:
            log_fail(f'Update document failed: {status} {body}')
            failed += 1

    return passed, failed


def main():
    parser = argparse.ArgumentParser(description='Studio API 冒煙測試（Cookie + CSRF 認證）')
    parser.add_argument('--base-url', default=os.environ.get('STUDIO_API_URL', 'http://127.0.0.1:5000'))
    parser.add_argument('--mock', action='store_true',
                        help='Use mock client (不驗證真實 Cookie + CSRF 流程)')
    parser.add_argument('--verbose', '-v', action='store_true')
    args = parser.parse_args()

    if args.mock:
        log('Using mock client (注意：不驗證真實 Cookie + CSRF 認證流程)')
        client = MockClient()
    else:
        log(f'Testing against {args.base_url}')
        log('Authentication: Cookie + CSRF (X-CSRF-TOKEN header)')
        client = HTTPClient(args.base_url)

    log('=' * 60)
    log('Studio API smoke test (Bot/Service Account)')
    log('=' * 60)

    passed, failed = run_tests(client, args.verbose)

    log('=' * 60)
    log(f'Results: {passed} passed, {failed} failed')
    log('=' * 60)

    sys.exit(1 if failed else 0)


if __name__ == '__main__':
    main()
