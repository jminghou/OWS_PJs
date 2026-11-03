#!/usr/bin/env python3
"""
Studio API 冒煙測試 — 驗證 Bot（服務帳號）可用既有 API 推送草稿。

使用方式：
    # 設定環境變數
    export STUDIO_API_URL=http://127.0.0.1:5000
    export STUDIO_BOT_USERNAME=banana-bot
    export STUDIO_BOT_PASSWORD=<password>

    # 執行
    python scripts/test_studio_bot_api.py

    # mock 模式（不需後端）
    python scripts/test_studio_bot_api.py --mock
"""
import argparse
import json
import os
import sys
from datetime import datetime


def log(msg: str, level: str = 'INFO'):
    ts = datetime.now().strftime('%H:%M:%S')
    print(f'[{ts}] {level}: {msg}')


def log_ok(msg: str):
    log(f'✓ {msg}', 'OK')


def log_fail(msg: str):
    log(f'✗ {msg}', 'FAIL')


class MockClient:
    """Mock client for testing without a real backend."""

    def __init__(self):
        self._id = 100
        self._token = 'mock-token-12345'

    def login(self, username, password):
        return 200, {'access_token': self._token}

    def request(self, method, path, body=None, token=None):
        self._id += 1
        if '/projects' in path and method == 'POST':
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
    """Real HTTP client."""

    def __init__(self, base_url):
        self.base_url = base_url.rstrip('/')
        self._token = None

    def _http(self, method, url, body=None, headers=None):
        import urllib.request
        import urllib.error
        headers = headers or {}
        headers['Content-Type'] = 'application/json'
        data = json.dumps(body).encode() if body else None
        req = urllib.request.Request(url, data=data, method=method, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return r.status, json.loads(r.read().decode())
        except urllib.error.HTTPError as e:
            body = e.read().decode()
            return e.code, json.loads(body) if body else {}
        except Exception as e:
            return 0, {'error': str(e)}

    def login(self, username, password):
        status, body = self._http('POST', f'{self.base_url}/auth/login', {'username': username, 'password': password})
        if status == 200:
            self._token = body.get('access_token') or body.get('token')
        return status, body

    def request(self, method, path, body=None, token=None):
        headers = {}
        t = token or self._token
        if t:
            headers['Authorization'] = f'Bearer {t}'
        return self._http(method, f'{self.base_url}{path}', body, headers)


def run_tests(client, verbose=False):
    passed = failed = 0
    test_id = datetime.now().strftime('%Y%m%d%H%M%S')

    # Test 1: Login
    log('Testing login...')
    username = os.environ.get('STUDIO_BOT_USERNAME', 'banana-bot')
    password = os.environ.get('STUDIO_BOT_PASSWORD', 'test')
    status, body = client.login(username, password)
    if status == 200 and (body.get('access_token') or body.get('token')):
        log_ok('Login successful')
        passed += 1
    else:
        log_fail(f'Login failed: {status} {body}')
        failed += 1
        return passed, failed

    # Test 2: Create project
    log('Testing create project...')
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
    log('Testing create blog document...')
    status, body = client.request('POST', f'/api/v1/studio/projects/{project_id}/documents', {
        'platform': 'blog',
        'title': f'[Bot Test] 部落格草稿 {test_id}',
        'body': '## 標題\n\n這是測試內文。\n\n### 小節\n\n更多內容...',
        'stage': 'write',
        'attributes': {'external_id': f'smoke-test-doc-{test_id}'},
    })
    if status == 201 and body.get('id'):
        doc_id = body['id'] if isinstance(body.get('id'), int) else body.get('document', {}).get('id')
        content_id = body.get('document', {}).get('content_id')
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
        log('Testing update document...')
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
    parser = argparse.ArgumentParser(description='Studio API 冒煙測試')
    parser.add_argument('--base-url', default=os.environ.get('STUDIO_API_URL', 'http://127.0.0.1:5000'))
    parser.add_argument('--mock', action='store_true', help='Use mock client')
    parser.add_argument('--verbose', '-v', action='store_true')
    args = parser.parse_args()

    if args.mock:
        log('Using mock client')
        client = MockClient()
    else:
        log(f'Testing against {args.base_url}')
        client = HTTPClient(args.base_url)

    log('=' * 50)
    log('Studio API smoke test (Bot/Service Account)')
    log('=' * 50)

    passed, failed = run_tests(client, args.verbose)

    log('=' * 50)
    log(f'Results: {passed} passed, {failed} failed')
    log('=' * 50)

    sys.exit(1 if failed else 0)


if __name__ == '__main__':
    main()
