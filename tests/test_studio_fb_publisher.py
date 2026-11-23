"""粉專送出與對帳。假 Graph，不連 Meta，不印 token。"""
import json
import logging
import os
import threading
import unittest
from types import SimpleNamespace
from datetime import datetime
from io import BytesIO
from unittest.mock import patch
from urllib.error import HTTPError

from flask import Flask
from sqlalchemy import event
from sqlalchemy.pool import StaticPool
from flask_jwt_extended import JWTManager, create_access_token
from sqlalchemy import BigInteger, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles
from werkzeug.serving import make_server

from core.backend_engine.factory import db
from core.backend_engine.models import User
from core.backend_engine.services.rbac import RBACService
from packages.media_lib.models import MLFile, MLFileVariant
from packages.studio.api import publish_requests  # noqa: F401
from packages.studio.blueprint import studio_bp
from packages.studio.models import (
    STUDIO_SCHEMA, StudioDocument, StudioDocumentMedia, StudioProject, StudioPublishEvent,
    StudioPublishRequest, StudioRevision,
)
from packages.studio.social.checks import FetchResult
from packages.studio.social.graph import HttpGraphClient
from packages.studio.social.publisher import publish
from packages.studio.social.service import APPROVER_ENV
from scripts.fake_graph_server import create_app as create_fake_graph

TOKEN = 'unit-test-token-9f3a'
SECRET = 'unit-test-secret-9f3a'
BRAND = '親紫之間 本週分享'


@compiles(JSONB, 'sqlite')
def _jsonb_on_sqlite(type_, compiler, **kw):
    return 'JSON'


@compiles(BigInteger, 'sqlite')
def _bigint_on_sqlite(type_, compiler, **kw):
    return 'INTEGER'


def _make_app():
    app = Flask(__name__)
    app.config.update(
        SQLALCHEMY_DATABASE_URI='sqlite://', TESTING=True,
        SQLALCHEMY_ENGINE_OPTIONS={
            'connect_args': {'check_same_thread': False},
            'poolclass': StaticPool,
        },
        JWT_SECRET_KEY='test-only-jwt-secret-key-32bytes!',
        JWT_TOKEN_LOCATION=['headers'], JWT_COOKIE_CSRF_PROTECT=False,
    )
    JWTManager(app)
    db.init_app(app)
    app.register_blueprint(studio_bp, url_prefix='/api/v1/studio')
    with app.app_context():
        engine = db.engine

    def _attach_schemas(dbapi_connection, _record):
        cursor = dbapi_connection.cursor()
        cursor.execute("ATTACH DATABASE ':memory:' AS media_lib")
        if STUDIO_SCHEMA:
            cursor.execute(f"ATTACH DATABASE ':memory:' AS {STUDIO_SCHEMA}")
        cursor.close()

    event.listen(engine, 'connect', _attach_schemas)
    return app


class _Capture(logging.Handler):
    def __init__(self):
        super().__init__()
        self.lines = []

    def emit(self, record):
        self.lines.append(record.getMessage())


class PublisherTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = _make_app()

    def setUp(self):
        self.ctx = self.app.app_context()
        self.ctx.push()
        with db.engine.begin() as conn:
            attached = set(conn.execute(text('PRAGMA database_list')).scalars(1).all())
            for schema in [name for name in (STUDIO_SCHEMA, 'media_lib') if name]:
                if schema not in attached:
                    conn.execute(text(f"ATTACH DATABASE ':memory:' AS {schema}"))
        self.tables = [
            User.__table__, StudioProject.__table__, StudioDocument.__table__, StudioRevision.__table__,
            MLFile.__table__, MLFileVariant.__table__, StudioDocumentMedia.__table__,
            StudioPublishRequest.__table__, StudioPublishEvent.__table__,
        ]
        for table in self.tables:
            table.create(db.engine)
        self.admin = User(
            username='chair', email='chair@example.com', role='admin', is_active=True, password_hash='x',
        )
        db.session.add(self.admin)
        db.session.commit()
        self.admin_id = self.admin.id
        self.actor = SimpleNamespace(id=self.admin_id, username='chair', role='admin', attributes={})
        self.keys = (
            'STUDIO_FB_PUBLISH_MODE', 'FB_PAGE_ID', 'FB_PAGE_ACCESS_TOKEN', 'FB_APP_SECRET',
            'FB_GRAPH_BASE_URL', 'STUDIO_FB_HTTP_TIMEOUT_SECONDS', APPROVER_ENV,
        )
        self.saved = {key: os.environ.get(key) for key in self.keys}
        for key in self.keys:
            os.environ.pop(key, None)
        os.environ[APPROVER_ENV] = str(self.admin_id)
        os.environ['FB_PAGE_ID'] = '4242'
        os.environ['FB_PAGE_ACCESS_TOKEN'] = TOKEN
        os.environ['FB_APP_SECRET'] = SECRET
        self.logs = _Capture()
        self.logs.setLevel(logging.INFO)
        logging.getLogger('packages.studio.social').addHandler(self.logs)
        logging.getLogger('packages.studio.social').setLevel(logging.INFO)
        def fetch(url, method='HEAD', timeout=5, **kwargs):
            if 'cdn.example.com' in url:
                return FetchResult(200, 'image/jpeg', url, 0, None)
            return FetchResult(200, 'text/html', url, 0, None)

        perm = patch.object(RBACService, 'get_user_permissions', return_value={
            'studio.read', 'studio.write', 'studio.publish_request', 'studio.publish_approve',
        })
        network = patch('packages.studio.social.checks.default_fetch', side_effect=fetch)
        perm.start()
        network.start()
        self.addCleanup(perm.stop)
        self.addCleanup(network.stop)
        self.addCleanup(self._restore_env)
        self.addCleanup(lambda: logging.getLogger('packages.studio.social').removeHandler(self.logs))
        self.client = self.app.test_client()

    def tearDown(self):
        db.session.remove()
        for table in reversed(self.tables):
            table.drop(db.engine, checkfirst=True)
        self.ctx.pop()

    def _restore_env(self):
        for key, value in self.saved.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value

    def headers(self):
        return {'Authorization': f'Bearer {create_access_token(identity=str(self.admin_id))}'}

    def make_doc(self, body=BRAND, link=None, files=0):
        project = StudioProject(title='專案', slug=f'p-{StudioProject.query.count()}', stage='write')
        db.session.add(project)
        db.session.flush()
        document = StudioDocument(
            project_id=project.id, platform='facebook', title='標題', body=body, stage='write', language='zh-TW',
            attributes={'link': link} if link else {},
        )
        db.session.add(document)
        db.session.flush()
        for index in range(files):
            media = MLFile(
                filename=f'{index}.jpg', original_filename=f'{index}.jpg', gcs_path=f'media/{index}.jpg',
                public_url=f'https://cdn.example.com/{index}.jpg', file_size=1000, mime_type='image/jpeg',
                width=1200, height=1200, updated_at=datetime(2026, 1, 2, 3, 4, 5),
            )
            db.session.add(media)
            db.session.flush()
            db.session.add(StudioDocumentMedia(document_id=document.id, file_id=media.id, position=index))
        db.session.commit()
        return document

    def approved(self, **doc):
        os.environ['STUDIO_FB_PUBLISH_MODE'] = 'off'
        document = self.make_doc(**doc)
        created = self.client.post(
            f'/api/v1/studio/documents/{document.id}/publish-requests',
            json={'target': 'facebook_page', 'link': doc.get('link')}, headers=self.headers(),
        )
        self.assertEqual(created.status_code, 201, created.get_json())
        approved = self.client.post(
            f"/api/v1/studio/publish-requests/{created.get_json()['id']}/approve",
            json={'content_hash': created.get_json()['content_hash']}, headers=self.headers(),
        )
        self.assertEqual(approved.status_code, 200, approved.get_json())
        os.environ['STUDIO_FB_PUBLISH_MODE'] = 'fake'
        return document, created.get_json()['id']

    def dumped(self):
        events = StudioPublishEvent.query.all()
        return '\n'.join(self.logs.lines) + json.dumps([event.detail for event in events], ensure_ascii=False)

    def assert_token_hidden(self):
        blob = self.dumped()
        self.assertNotIn(TOKEN, blob)
        self.assertNotIn(SECRET, blob)

    def test_off_and_dry_run_do_not_use_the_network(self):
        _document, request_id = self.approved()
        os.environ['STUDIO_FB_PUBLISH_MODE'] = 'off'

        def explode(*args, **kwargs):
            raise AssertionError('network')

        with patch('packages.studio.social.publisher.build_http_client', side_effect=explode):
            off = self.client.post(f'/api/v1/studio/publish-requests/{request_id}/publish', headers=self.headers())
        self.assertEqual(off.status_code, 409)
        self.assertEqual(off.get_json()['message'], 'publishing_disabled')
        self.assertEqual(StudioPublishRequest.query.get(request_id).state, 'approved')

        os.environ['STUDIO_FB_PUBLISH_MODE'] = 'dry_run'
        with patch('packages.studio.social.publisher.build_http_client', side_effect=explode):
            dry = self.client.post(f'/api/v1/studio/publish-requests/{request_id}/publish', headers=self.headers())
        self.assertEqual(dry.status_code, 200, dry.get_json())
        req = StudioPublishRequest.query.get(request_id)
        self.assertEqual(req.state, 'published')
        self.assertIsNone(req.external_post_id)
        self.assertEqual(req.document.stage, 'write')
        detail = [event.detail for event in req.events if event.event == 'published'][-1]
        self.assertEqual(detail['result'], 'published(dry_run)')
        self.assert_token_hidden()

    def test_hash_mismatch_does_not_send(self):
        document, request_id = self.approved()
        os.environ['FB_GRAPH_BASE_URL'] = 'http://127.0.0.1:9'
        document.body = '親紫之間 改過了'
        db.session.commit()
        calls = []
        with patch('packages.studio.social.publisher.build_http_client', side_effect=lambda: calls.append(1)):
            response = self.client.post(
                f'/api/v1/studio/publish-requests/{request_id}/publish', headers=self.headers(),
            )
        self.assertEqual(response.status_code, 409)
        self.assertEqual(calls, [])
        req = StudioPublishRequest.query.get(request_id)
        self.assertNotEqual(req.state, 'publishing')
        self.assertIsNone(req.approved_hash)
        self.assertIn('approval_voided', [event.event for event in req.events])

    def test_fake_mode_rejects_a_non_local_base_url(self):
        _document, request_id = self.approved()
        os.environ['FB_GRAPH_BASE_URL'] = 'https://graph.facebook.com'
        with patch('packages.studio.social.publisher.build_http_client', side_effect=AssertionError('network')):
            response = self.client.post(
                f'/api/v1/studio/publish-requests/{request_id}/publish', headers=self.headers(),
            )
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.get_json()['message'], 'fake_graph_host_rejected')
        self.assertEqual(StudioPublishRequest.query.get(request_id).state, 'approved')

    def test_graph_errors_are_terminal_and_not_retried(self):
        cases = [
            (190, 'failed'), (368, 'failed'), (100, 'failed'),
            ('timeout', 'unknown'), ('500', 'unknown'),
        ]
        for code, outcome in cases:
            with self.subTest(code=code):
                _document, request_id = self.approved(body=f'{BRAND} {code}')
                os.environ['FB_GRAPH_BASE_URL'] = 'http://127.0.0.1:9'
                client = HttpGraphClient(
                    base_url='http://127.0.0.1:9', version='v27.0', token=TOKEN,
                    app_secret_value=SECRET, timeout=1, opener=_Opener([_failure(code)]),
                )
                req = publish(request_id, self.actor, client=client)
                self.assertEqual(req.state, outcome)
                if outcome == 'failed':
                    self.assertEqual(req.error_code, str(code))
                    self.assertEqual(req.fbtrace_id, 'fake-trace')
                again = _Opener([])
                client.opener = again
                with self.assertRaises(Exception):
                    publish(request_id, self.actor, client=client)
                self.assertEqual(again.opened, [])
                self.assertEqual(StudioPublishRequest.query.get(request_id).state, outcome)
        self.assert_token_hidden()

    def test_a_second_click_while_publishing_does_not_call_graph_again(self):
        _document, request_id = self.approved()
        os.environ['FB_GRAPH_BASE_URL'] = 'http://127.0.0.1:9'
        gate = threading.Event()
        entered = threading.Event()

        class Blocking:
            def __init__(self):
                self.calls = 0

            def post(self, path, body):
                self.calls += 1
                entered.set()
                self.assert_waiting(gate)
                return {'id': '4242_1', 'permalink_url': 'https://facebook.test/4242_1'}

            def get(self, path, query=None):
                return {'permalink_url': 'https://facebook.test/4242_1'}

            def assert_waiting(self, event):
                event.wait(timeout=5)

        blocker = Blocking()
        holder = {}

        def first():
            with self.app.app_context():
                try:
                    holder['req'] = publish(request_id, self.actor, client=blocker)
                except Exception as exc:  # noqa: BLE001
                    holder['error'] = exc

        db.session.remove()
        worker = threading.Thread(target=first)
        worker.start()
        self.assertTrue(entered.wait(timeout=5), holder)
        with self.assertRaises(Exception) as caught:
            publish(request_id, self.actor, client=blocker)
        self.assertIn('no longer approved', str(caught.exception))
        gate.set()
        worker.join(timeout=5)
        self.assertFalse(worker.is_alive())
        self.assertNotIn('error', holder)
        self.assertEqual(blocker.calls, 1)
        self.assertEqual(holder['req'].state, 'published')

    def test_fake_server_publishes_text_link_one_photo_and_many_photos(self):
        fake = create_fake_graph()
        server = make_server('127.0.0.1', 0, fake)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        self.addCleanup(server.shutdown)
        port = server.server_address[1]
        os.environ['FB_GRAPH_BASE_URL'] = f'http://127.0.0.1:{port}'
        os.environ['STUDIO_FB_PUBLISH_MODE'] = 'fake'
        specs = [
            ({'body': BRAND + ' 文字'}, 'feed', None),
            ({'body': BRAND + ' 連結', 'link': 'https://polaris-parent.com/a'}, 'feed', 'link'),
            ({'body': BRAND + ' 單圖', 'files': 1}, 'photos', True),
            ({'body': BRAND + ' 多圖', 'files': 2}, 'photos', False),
        ]
        for doc, kind, published in specs:
            document, request_id = self.approved(**doc)
            document_id = document.id
            before = len(fake.extensions['fake_graph']['calls'])
            response = self.client.post(
                f'/api/v1/studio/publish-requests/{request_id}/publish', headers=self.headers(),
            )
            self.assertEqual(response.status_code, 200, response.get_json())
            req = db.session.get(StudioPublishRequest, request_id)
            document = db.session.get(StudioDocument, document_id)
            self.assertEqual(req.state, 'published')
            self.assertTrue(req.external_post_id)
            self.assertTrue(req.external_url.startswith('https://facebook.test/'))
            self.assertEqual(document.stage, 'published')
            self.assertEqual(document.published_url, req.external_url)
            revision = StudioRevision.query.filter_by(document_id=document_id, kind='published').one()
            self.assertEqual(revision.body, document.body)
            calls = fake.extensions['fake_graph']['calls'][before:]
            self.assertEqual(calls[0]['path'].split('/')[-1], kind)
            if kind == 'photos' and published is False:
                self.assertEqual([call['body'].get('published') for call in calls[:2]], [False, False])
                self.assertEqual(len(calls[-1]['body']['attached_media']), 2)
            if kind == 'feed' and published == 'link':
                self.assertIn('link', calls[0]['body'])
        health = self.client.get('/api/v1/studio/social/facebook/health', headers=self.headers())
        self.assertEqual(health.status_code, 200, health.get_json())
        body = health.get_json()
        self.assertEqual(body['mode'], 'fake')
        self.assertEqual(
            (body['page_id_configured'], body['token_configured'], body['page_id_matches']),
            (True, True, True),
        )
        self.assertNotIn(TOKEN, json.dumps(body))
        self.assert_token_hidden()
        blob = json.dumps(fake.extensions['fake_graph']['calls'])
        self.assertNotIn(TOKEN, blob)
        self.assertNotIn(SECRET, blob)


def _failure(code):
    if code == 'timeout':
        return TimeoutError()
    status = 500 if code == '500' else 400
    payload = {'error': {'message': 'server'}} if status == 500 else {
        'error': {'message': 'graph rejected the call', 'code': int(code), 'error_subcode': 463, 'fbtrace_id': 'fake-trace'},
    }
    return HTTPError('http://127.0.0.1/x', status, 'err', hdrs=None, fp=BytesIO(json.dumps(payload).encode()))


class _Opener:
    def __init__(self, responses):
        self.responses = list(responses)
        self.opened = []

    def open(self, request, timeout=None):
        self.opened.append(request.full_url)
        if TOKEN in request.full_url or 'access_token=' in request.full_url:
            raise AssertionError('token leaked into the url')
        item = self.responses.pop(0)
        if isinstance(item, Exception):
            raise item
        return item


if __name__ == '__main__':
    unittest.main()
