"""本機假的 Graph。只聽 localhost，用 ?fail=190|timeout|500 注入錯誤。

不連真的 Meta，也不把收到的 token 寫進 log。
"""
import os
import time
from datetime import datetime, timezone

from flask import Flask, jsonify, request


def create_app():
    app = Flask('fake_graph')
    state = {'n': 0, 'posts': [], 'calls': []}
    app.extensions['fake_graph'] = state

    def fail():
        kind = request.args.get('fail')
        if kind == 'timeout':
            time.sleep(30)
            return jsonify({'error': {'message': 'timeout'}}), 504
        if kind == '500':
            return jsonify({'error': {'message': 'server'}}), 500
        if kind and kind.isdigit():
            return jsonify({'error': {
                'message': 'graph rejected the call',
                'code': int(kind),
                'error_subcode': 463,
                'fbtrace_id': 'fake-trace',
            }}), 400
        return None

    def next_id(page_id):
        state['n'] += 1
        return f'{page_id}_{state["n"]}'

    @app.post('/<version>/<page_id>/feed')
    def post_feed(version, page_id):
        failed = fail()
        if failed:
            return failed
        body = request.get_json(silent=True) or {}
        state['calls'].append({'path': request.path, 'body': {
            key: value for key, value in body.items() if key not in ('access_token', 'appsecret_proof')
        }})
        post_id = next_id(page_id)
        post = {
            'id': post_id,
            'message': body.get('message') or '',
            'created_time': datetime.now(timezone.utc).replace(tzinfo=None).isoformat() + 'Z',
            'is_published': True,
            'permalink_url': f'https://facebook.test/{post_id}',
        }
        state['posts'].append(post)
        return jsonify({'id': post_id, 'permalink_url': post['permalink_url']})

    @app.post('/<version>/<page_id>/photos')
    def post_photo(version, page_id):
        failed = fail()
        if failed:
            return failed
        body = request.get_json(silent=True) or {}
        state['calls'].append({'path': request.path, 'body': {
            key: value for key, value in body.items() if key not in ('access_token', 'appsecret_proof')
        }})
        published = body.get('published', True)
        photo_id = next_id(page_id)
        if published in (False, 'false', '0', 0):
            return jsonify({'id': photo_id})
        post_id = next_id(page_id)
        post = {
            'id': post_id,
            'message': body.get('message') or '',
            'created_time': datetime.now(timezone.utc).replace(tzinfo=None).isoformat() + 'Z',
            'is_published': True,
            'permalink_url': f'https://facebook.test/{post_id}',
        }
        state['posts'].append(post)
        return jsonify({'id': photo_id, 'post_id': post_id, 'permalink_url': post['permalink_url']})

    @app.get('/<version>/<page_id>/feed')
    def get_feed(version, page_id):
        failed = fail()
        if failed:
            return failed
        rows = [row for row in state['posts'] if str(row['id']).startswith(f'{page_id}_')]
        return jsonify({'data': rows})

    @app.get('/<version>/me')
    def me(version):
        failed = fail()
        if failed:
            return failed
        return jsonify({'id': request.args.get('page_id') or os.environ.get('FAKE_GRAPH_PAGE_ID') or '4242'})

    @app.get('/<version>/<object_id>')
    def get_object(version, object_id):
        failed = fail()
        if failed:
            return failed
        for row in state['posts']:
            if row['id'] == object_id:
                return jsonify({'id': row['id'], 'permalink_url': row['permalink_url']})
        return jsonify({'id': object_id, 'permalink_url': f'https://facebook.test/{object_id}'})

    return app


if __name__ == '__main__':
    create_app().run(host='127.0.0.1', port=int(os.environ.get('PORT') or 8765))
