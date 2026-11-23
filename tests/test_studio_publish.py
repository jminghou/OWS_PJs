"""Facebook 粉專發文第一包。SQLite，不連 Meta、不寄信、不碰站台資料。"""
import importlib
import os
import re
import unittest
from datetime import datetime
from pathlib import Path
from unittest.mock import patch

from flask import Flask
from flask_jwt_extended import JWTManager, create_access_token
from sqlalchemy import BigInteger, inspect, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.compiler import compiles

from core.backend_engine.factory import db
from core.backend_engine.models import User
from core.backend_engine.services.rbac import RBACService, _EDITOR_PERMS
from core.backend_engine.services.rbac_seed import ROLE_DEFS
from packages.media_lib.models import MLFile, MLFileVariant
from packages.studio import STUDIO_PERMISSIONS
from packages.studio.api import publish_requests  # noqa: F401  註冊路由
from packages.studio.blueprint import studio_bp
from packages.studio.models import (
    STUDIO_SCHEMA,
    StudioCard,
    StudioCardRef,
    StudioDocument,
    StudioDocumentMedia,
    StudioProject,
    StudioPublishEvent,
    StudioPublishRequest,
    StudioRevision,
    StudioTag,
    StudioTagging,
)
from packages.studio.social.checks import FetchResult, default_fetch, run_checks
from packages.studio.social.hashing import canonical_json, content_hash_from_parts, hash_material
from packages.studio.social.rules import ANXIETY_MARKETING_TERMS, RULES
from packages.studio.social.service import APPROVER_ENV, claim_publishing, claim_statement
from packages.studio.social.state import (
    ALL_STATES,
    OPEN_STATE_SQL,
    OPEN_STATES,
    TRANSITIONS,
    InvalidTransition,
    next_state,
)

REPO = Path(__file__).resolve().parents[1]


@compiles(JSONB, 'sqlite')
def _jsonb_on_sqlite(type_, compiler, **kw):
    return 'JSON'


@compiles(BigInteger, 'sqlite')
def _bigint_on_sqlite(type_, compiler, **kw):
    return 'INTEGER'


BRAND = '親紫之間 本週分享'


def _levels(report, rule):
    return [item['level'] for item in report if item['rule'] == rule]


def _good_media(**over):
    item = {
        'file_id': 1,
        'public_url': 'https://cdn.example.com/a.jpg',
        'mime': 'image/jpeg',
        'size': 500_000,
        'w': 1200,
        'h': 1200,
    }
    item.update(over)
    return item


def _good_payload(**over):
    payload = {
        'message': BRAND,
        'link': 'https://polaris-parent.com/posts/1',
        'media': [_good_media()],
        'scheduled_for': None,
    }
    payload.update(over)
    return payload


def _ok_fetch(url, method='HEAD', timeout=5, **kwargs):
    if 'cdn.example.com' in url:
        return FetchResult(200, 'image/jpeg', url, 0, None)
    return FetchResult(200, 'text/html', url, 0, None)


def _hash(**over):
    base = dict(target='facebook_page', target_ref='42', message=BRAND, link='', media=[], scheduled_for='')
    base.update(over)
    return content_hash_from_parts(**base)


class HashTests(unittest.TestCase):
    def test_hash_is_stable_and_keeps_unicode(self):
        self.assertEqual(_hash(), _hash())
        self.assertEqual(len(_hash()), 64)
        raw = canonical_json(hash_material(
            target='facebook_page', target_ref='42', message=BRAND, link='', media=[], scheduled_for='',
        ))
        self.assertIn('親紫之間', raw)
        self.assertNotIn('\\u', raw)
        self.assertEqual(canonical_json({'b': 1, 'a': 2}), '{"a":2,"b":1}')

    def test_nfc_and_newlines_do_not_change_the_hash(self):
        self.assertEqual(_hash(message='親紫之間 café'), _hash(message='親紫之間 cafe\u0301'))
        self.assertNotEqual('親紫之間 café', '親紫之間 cafe\u0301')
        self.assertEqual(_hash(message='親紫之間\r\n下一行'), _hash(message='親紫之間\n下一行'))
        self.assertEqual(_hash(message='親紫之間\r下一行'), _hash(message='親紫之間\n下一行'))

    def test_hash_tracks_publish_fields_not_public_url(self):
        media = [
            {'file_id': 1, 'gcs_path': 'media/a.jpg', 'file_size': 10, 'updated_at': '2026-01-02T03:04:05'},
            {'file_id': 2, 'gcs_path': 'media/b.jpg', 'file_size': 10, 'updated_at': '2026-01-02T03:04:05'},
        ]
        self.assertNotEqual(_hash(media=media), _hash(media=list(reversed(media))))
        changed = [dict(media[0], file_size=11), media[1]]
        self.assertNotEqual(_hash(media=media), _hash(media=changed))
        self.assertNotEqual(_hash(link='https://polaris-parent.com/a'), _hash(link=''))
        self.assertNotEqual(_hash(scheduled_for='2026-12-01T02:00:00'), _hash(scheduled_for=''))
        self.assertNotEqual(_hash(target_ref='1'), _hash(target_ref='2'))
        blob = hash_material(
            target='facebook_page', target_ref='', message='x', link=None, media=media, scheduled_for=None,
        )
        self.assertEqual(set(blob), {'target', 'target_ref', 'message', 'link', 'media', 'scheduled_for'})
        self.assertEqual(set(blob['media'][0]), {'file_id', 'gcs_path', 'file_size', 'updated_at'})


class TransitionTests(unittest.TestCase):
    def test_transition_table_and_terminal_states(self):
        for event, table in TRANSITIONS.items():
            for src, dst in table.items():
                self.assertEqual(next_state(src, event), dst)
        for state in ALL_STATES:
            for event in TRANSITIONS:
                if state not in TRANSITIONS[event]:
                    with self.assertRaises(InvalidTransition):
                        next_state(state, event)
        sources = {src for table in TRANSITIONS.values() for src in table}
        entered = {dst for table in TRANSITIONS.values() for dst in table.values()}
        self.assertNotIn('failed', sources)
        self.assertNotIn('unknown', sources)
        self.assertNotIn('retry', TRANSITIONS)
        self.assertNotIn('scheduled', entered)
        self.assertNotIn('failed', entered)
        self.assertNotIn('unknown', entered)
        self.assertNotIn('published', entered)
        self.assertEqual(TRANSITIONS['claim'], {'approved': 'publishing'})
        names = set(re.findall(r"'([^']+)'", OPEN_STATE_SQL))
        self.assertEqual(names, set(OPEN_STATES))
        self.assertTrue({'failed', 'rejected', 'cancelled', 'published'}.isdisjoint(OPEN_STATES))

    def test_permissions_split_request_and_approve(self):
        codes = {item[0] for item in STUDIO_PERMISSIONS}
        self.assertIn('studio.publish_request', codes)
        self.assertIn('studio.publish_approve', codes)
        self.assertIn('studio.publish_request', _EDITOR_PERMS)
        self.assertNotIn('studio.publish_approve', _EDITOR_PERMS)
        self.assertIn('studio.publish_request', ROLE_DEFS['editor']['permissions'])
        self.assertNotIn('studio.publish_approve', ROLE_DEFS['editor']['permissions'])
        self.assertEqual(ROLE_DEFS['admin']['permissions'], '*')

    def test_this_package_does_not_call_meta(self):
        chunks = []
        for path in (REPO / 'packages' / 'studio').rglob('*.py'):
            if 'social' in path.parts or path.name == 'publish_requests.py':
                chunks.append(path.read_text(encoding='utf-8'))
        blob = '\n'.join(chunks)
        for needle in ('graph.facebook', 'graph.facebook.com', 'FB_ACCESS', 'access_token'):
            self.assertNotIn(needle, blob)


class CheckTests(unittest.TestCase):
    def test_clean_payload_passes_every_rule_without_using_the_network_default(self):
        with patch('packages.studio.social.checks.default_fetch', side_effect=AssertionError('network')):
            report = run_checks(_good_payload(), fetch=_ok_fetch)
        by_rule = {}
        for item in report:
            self.assertIn(item['level'], ('pass', 'warn', 'block'))
            self.assertTrue(item['message'])
            by_rule.setdefault(item['rule'], []).append(item['level'])
        self.assertEqual(set(by_rule), set(RULES))
        for rule, levels in by_rule.items():
            self.assertTrue(all(level == 'pass' for level in levels), rule)

    def test_each_rule_has_a_failure(self):
        cases = {
            'message_length': _good_payload(message='親' * 63207, media=[]),
            'message_or_link': _good_payload(message='   ', link='', media=[]),
            'image_format': _good_payload(media=[_good_media(mime='image/webp')]),
            'image_size': _good_payload(media=[_good_media(size=10 * 1024 * 1024 + 1)]),
            'png_size': _good_payload(media=[_good_media(mime='image/png', size=PNG)]),
            'image_dimensions': _good_payload(media=[_good_media(w=599, h=600)]),
            'image_count': _good_payload(media=[_good_media(file_id=i) for i in range(11)]),
            'image_reachable': _good_payload(media=[_good_media(public_url='https://cdn.example.com/missing.jpg')]),
            'link_reachable': _good_payload(link='http://polaris-parent.com/a', media=[]),
            'link_domain': _good_payload(link='https://example.com/a', media=[]),
            'brand_name': _good_payload(message='今天的分享', media=[]),
            'brand_typo': _good_payload(message='親紫之間，也寫成亲紫之间', media=[]),
            'anxiety_marketing': _good_payload(message=BRAND + ANXIETY_MARKETING_TERMS[0], media=[]),
            'pii_tw_id': _good_payload(message=BRAND + ' A123456789', media=[]),
            'pii_phone': _good_payload(message=BRAND + ' 0912345678', media=[]),
            'pii_email': _good_payload(message=BRAND + ' a@example.com', media=[]),
            'pii_order': _good_payload(message=BRAND + ' ORD-12345678-', media=[]),
            'pii_birthdate': _good_payload(message=BRAND + ' 2020-05-01', media=[]),
            'page_mention': _good_payload(message=BRAND + ' @[12345]', media=[]),
        }
        self.assertEqual(set(cases), set(RULES))
        expected = {
            'png_size': 'warn', 'image_dimensions': 'warn', 'link_domain': 'warn',
            'brand_name': 'warn', 'page_mention': 'warn',
        }
        for rule, payload in cases.items():
            fetch = _denied_image if rule == 'image_reachable' else _ok_fetch
            if rule == 'link_reachable':
                fetch = _no_fetch
            report = run_checks(payload, fetch=fetch)
            self.assertIn(expected.get(rule, 'block'), _levels(report, rule), rule)

    def test_boundary_values_pass(self):
        report = run_checks(_good_payload(
            message='親' * 63206,
            media=[_good_media(mime='image/png', size=1024 * 1024, w=1910, h=1000)],
        ), fetch=_ok_fetch)
        self.assertEqual(_levels(report, 'message_length'), ['pass'])
        self.assertEqual(_levels(report, 'png_size'), ['pass'])
        self.assertEqual(_levels(report, 'image_dimensions'), ['pass'])
        self.assertEqual(_levels(report, 'image_size'), ['pass'])
        narrow = run_checks(_good_payload(media=[_good_media(w=800, h=1000)]), fetch=_ok_fetch)
        self.assertEqual(_levels(narrow, 'image_dimensions'), ['pass'])

    def test_link_and_image_http_are_injectable(self):
        calls = []

        def fetch(url, method='HEAD', timeout=5, **kwargs):
            calls.append((url, method, timeout))
            if method == 'HEAD' and url.endswith('/need-get'):
                return FetchResult(405, None, url, 0, None)
            if 'cdn.example.com' in url:
                return FetchResult(404, 'text/html', url, 0, None)
            return FetchResult(200, 'text/html', url, 0, None)

        http_link = run_checks(_good_payload(link='http://example.com', media=[]), fetch=fetch)
        self.assertEqual(calls, [])
        self.assertIn('block', _levels(http_link, 'link_reachable'))

        calls.clear()
        ok = run_checks(_good_payload(link='https://polaris-parent.com/need-get', media=[]), fetch=fetch)
        self.assertEqual([call[1] for call in calls], ['HEAD', 'GET'])
        self.assertTrue(all(call[2] == 5 for call in calls))
        self.assertIn('pass', _levels(ok, 'link_reachable'))

        calls.clear()
        image = run_checks(_good_payload(link='', media=[_good_media()]), fetch=fetch)
        self.assertEqual([call[1] for call in calls], ['HEAD'])
        self.assertIn('block', _levels(image, 'image_reachable'))

    def test_known_image_types_and_redirect_host(self):
        for mime in ('image/jpeg', 'image/png', 'image/gif', 'image/bmp', 'image/tiff'):
            report = run_checks(_good_payload(media=[_good_media(mime=mime)]), fetch=_ok_fetch)
            self.assertEqual(_levels(report, 'image_format'), ['pass'], mime)
        wide = run_checks(_good_payload(media=[_good_media(w=2000, h=1000)]), fetch=_ok_fetch)
        self.assertEqual(_levels(wide, 'image_dimensions'), ['warn'])
        tall = run_checks(_good_payload(media=[_good_media(w=400, h=1000)]), fetch=_ok_fetch)
        self.assertEqual(_levels(tall, 'image_dimensions'), ['warn'])

        def redirect_fetch(url, method='HEAD', timeout=5, **kwargs):
            return FetchResult(200, 'text/html', 'https://evil.example/out', 1, None)

        report = run_checks(
            _good_payload(link='https://polaris-parent.com/go', media=[]), fetch=redirect_fetch,
        )
        self.assertEqual(_levels(report, 'link_domain'), ['warn'])
        self.assertEqual(_levels(report, 'link_reachable'), ['pass'])


def _denied_image(url, method='HEAD', timeout=5, **kwargs):
    if 'cdn.example.com' in url:
        return FetchResult(404, 'text/html', url, 0, None)
    return _ok_fetch(url, method=method, timeout=timeout)


def _no_fetch(*args, **kwargs):
    raise AssertionError('http link must not be fetched')


PNG = 1024 * 1024 + 1


class _Response:
    def __init__(self, status, headers, url):
        self.status = status
        self.headers = headers
        self._url = url

    def geturl(self):
        return self._url

    def close(self):
        return None


class _Opener:
    def __init__(self, responses):
        self.responses = list(responses)
        self.timeouts = []
        self.methods = []

    def open(self, request, timeout=None):
        self.timeouts.append(timeout)
        self.methods.append(request.method)
        return self.responses.pop(0)


class FetchPolicyTests(unittest.TestCase):
    def test_default_fetch_stops_after_three_redirects_and_uses_the_timeout(self):
        responses = [
            _Response(302, {'Location': 'https://polaris-parent.com/b'}, 'https://polaris-parent.com/a'),
            _Response(302, {'Location': 'https://polaris-parent.com/c'}, 'https://polaris-parent.com/b'),
            _Response(302, {'Location': 'https://polaris-parent.com/d'}, 'https://polaris-parent.com/c'),
            _Response(302, {'Location': 'https://polaris-parent.com/e'}, 'https://polaris-parent.com/d'),
            _Response(200, {'Content-Type': 'text/html'}, 'https://polaris-parent.com/e'),
        ]
        opener = _Opener(responses)
        result = default_fetch('https://polaris-parent.com/a', opener=opener)
        self.assertEqual(opener.timeouts, [5, 5, 5, 5])
        self.assertEqual(opener.methods, ['HEAD', 'HEAD', 'HEAD', 'HEAD'])
        self.assertEqual((result.status, result.redirects), (302, 3))
        self.assertEqual(len(opener.responses), 1)


def _make_app():
    app = Flask(__name__)
    app.config.update(
        SQLALCHEMY_DATABASE_URI='sqlite://', TESTING=True, JWT_SECRET_KEY='test-only-jwt-secret-key-32bytes!',
        JWT_TOKEN_LOCATION=['headers'], JWT_COOKIE_CSRF_PROTECT=False,
    )
    JWTManager(app)
    db.init_app(app)
    app.register_blueprint(studio_bp, url_prefix='/api/v1/studio')
    return app


class PublishApiTests(unittest.TestCase):
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
            StudioCard.__table__, StudioCardRef.__table__, StudioTag.__table__, StudioTagging.__table__,
            MLFile.__table__, MLFileVariant.__table__,
            StudioDocumentMedia.__table__, StudioPublishRequest.__table__, StudioPublishEvent.__table__,
        ]
        for table in self.tables:
            table.create(db.engine)
        self.editor = self.make_user('banana-bot', 'editor', ['studio.publish_approve'])
        self.human_editor = self.make_user('editor', 'editor')
        self.admin = self.make_user('chair', 'admin')
        self.other_admin = self.make_user('outsider', 'admin')
        self.doc = self.make_doc()
        self.fetch_calls = []
        env_keys = (APPROVER_ENV, 'FB_PAGE_ID')
        self._saved_env = {key: os.environ.get(key) for key in env_keys}
        for key in env_keys:
            os.environ.pop(key, None)
        self.addCleanup(self._restore_env)
        perm = patch.object(RBACService, 'get_user_permissions', side_effect=self._perms)
        fetch = patch('packages.studio.social.checks.default_fetch', side_effect=self._fetch)
        perm.start()
        fetch.start()
        self.addCleanup(perm.stop)
        self.addCleanup(fetch.stop)
        self.client = self.app.test_client()

    def tearDown(self):
        db.session.remove()
        for table in reversed(self.tables):
            table.drop(db.engine)
        self.ctx.pop()

    def _restore_env(self):
        for key, value in self._saved_env.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value

    def _perms(self, user_id, use_cache=True):
        user = db.session.get(User, int(user_id))
        if user is None:
            return set()
        codes = set()
        if user.role == 'admin':
            codes.update({'studio.read', 'studio.write', 'studio.publish_request', 'studio.publish_approve'})
        elif user.role == 'editor':
            codes.update({'studio.read', 'studio.write', 'studio.publish_request'})
        codes.update((user.attributes or {}).get('extra_permissions') or [])
        return codes

    def _fetch(self, url, method='HEAD', timeout=5, **kwargs):
        self.fetch_calls.append((url, method))
        if 'cdn.example.com' in url:
            return FetchResult(200, 'image/jpeg', url, 0, None)
        return FetchResult(200, 'text/html', url, 0, None)

    def make_user(self, username, role, extra=None):
        user = User(
            username=username, email=f'{username}@example.com', role=role, is_active=True,
            password_hash='not-a-secret', attributes={'extra_permissions': extra or []},
        )
        db.session.add(user)
        db.session.commit()
        return user

    def make_doc(self, platform='facebook', body=BRAND):
        project = StudioProject(title='專案', slug=f'p-{platform}-{StudioProject.query.count()}', stage='write')
        db.session.add(project)
        db.session.flush()
        document = StudioDocument(
            project_id=project.id, platform=platform, title='標題', body=body, stage='write', language='zh-TW',
        )
        db.session.add(document)
        db.session.commit()
        return document

    def make_file(self, **over):
        row = MLFile(
            filename='a.jpg', original_filename='a.jpg',
            gcs_path=over.get('gcs_path', 'media/a.jpg'),
            public_url=over.get('public_url', 'https://cdn.example.com/a.jpg'),
            file_size=over.get('file_size', 500_000), mime_type='image/jpeg', width=1200, height=1200,
            updated_at=over.get('updated_at', datetime(2026, 1, 2, 3, 4, 5)),
        )
        db.session.add(row)
        db.session.commit()
        return row

    def headers(self, user):
        return {'Authorization': f'Bearer {create_access_token(identity=str(user.id))}'}

    def submit(self, doc=None, user=None, **body):
        payload = {'target': 'facebook_page'}
        payload.update(body)
        return self.client.post(
            f'/api/v1/studio/documents/{(doc or self.doc).id}/publish-requests',
            json=payload, headers=self.headers(user or self.editor),
        )

    def allow(self, *users):
        os.environ[APPROVER_ENV] = ','.join(str(user.id) for user in users)

    def approve(self, request_id, content_hash, user=None):
        return self.client.post(
            f'/api/v1/studio/publish-requests/{request_id}/approve',
            json={'content_hash': content_hash}, headers=self.headers(user or self.admin),
        )

    def test_submit_checks_and_approve_round_trip(self):
        os.environ['FB_PAGE_ID'] = '4242'
        created = self.submit(external_id='bot-1')
        self.assertEqual(created.status_code, 201, created.get_json())
        body = created.get_json()
        self.assertEqual(body['state'], 'pending_approval')
        self.assertTrue(all(item['level'] != 'block' for item in body['check_report']))
        self.assertEqual(len(body['content_hash']), 64)
        req = StudioPublishRequest.query.one()
        self.assertEqual((req.target_ref, req.submitted_via, req.mode), ('4242', 'bot', 'now'))
        events = [event.event for event in req.events.order_by(StudioPublishEvent.id)]
        self.assertEqual(events, ['submitted', 'checked'])

        self.assertEqual(self.approve(req.id, body['content_hash'], self.other_admin).status_code, 403)
        self.assertEqual(req.state, 'pending_approval')
        self.allow(self.admin)
        mismatch = self.approve(req.id, '0' * 64)
        self.assertEqual(mismatch.status_code, 409)
        self.assertIsNone(StudioPublishRequest.query.one().approved_hash)
        missing = self.client.post(
            f'/api/v1/studio/publish-requests/{req.id}/approve', json={}, headers=self.headers(self.admin),
        )
        self.assertEqual(missing.status_code, 422)
        ok = self.approve(req.id, body['content_hash'])
        self.assertEqual(ok.status_code, 200, ok.get_json())
        req = StudioPublishRequest.query.one()
        self.assertEqual((req.state, req.approved_hash, req.approved_by), ('approved', body['content_hash'], self.admin.id))

        listed = self.client.get(
            f'/api/v1/studio/publish-requests?state=approved&document_id={self.doc.id}&external_id=bot-1',
            headers=self.headers(self.editor),
        )
        self.assertEqual(listed.status_code, 200)
        self.assertEqual(listed.get_json()['pagination']['total'], 1)
        detail = self.client.get(f'/api/v1/studio/publish-requests/{req.id}', headers=self.headers(self.editor))
        self.assertEqual(
            [event['event'] for event in detail.get_json()['events']],
            ['submitted', 'checked', 'approved'],
        )

    def test_editor_bot_cannot_approve_even_on_the_allowlist(self):
        created = self.submit()
        digest = created.get_json()['content_hash']
        self.allow(self.editor, self.admin)
        denied = self.approve(created.get_json()['id'], digest, self.editor)
        self.assertEqual(denied.status_code, 403)
        self.assertIn('Bot', denied.get_json()['message'])
        self.assertEqual(StudioPublishRequest.query.one().state, 'pending_approval')
        human = self.approve(created.get_json()['id'], digest, self.human_editor)
        self.assertEqual(human.status_code, 403)
        self.assertIn('Permission denied', human.get_json()['message'])

    def test_content_change_voids_approval_and_newline_does_not(self):
        self.allow(self.admin)
        self.doc.body = BRAND + '\n'
        db.session.commit()
        created = self.submit()
        digest = created.get_json()['content_hash']
        request_id = created.get_json()['id']
        self.approve(request_id, digest)
        newline = self.client.post(
            f'/api/v1/studio/documents/{self.doc.id}/autosave',
            json={'body': BRAND + '\r\n'}, headers=self.headers(self.editor),
        )
        self.assertEqual(newline.status_code, 200, newline.get_json())
        self.assertEqual(StudioPublishRequest.query.one().state, 'approved')
        title = self.client.post(
            f'/api/v1/studio/documents/{self.doc.id}/autosave',
            json={'title': '只改標題', 'body': BRAND + '\r\n'}, headers=self.headers(self.editor),
        )
        self.assertEqual(title.status_code, 200, title.get_json())
        self.assertEqual(StudioPublishRequest.query.one().state, 'approved')

        edited = self.client.post(
            f'/api/v1/studio/documents/{self.doc.id}/autosave',
            json={'body': '親紫之間 晚安'}, headers=self.headers(self.editor),
        )
        self.assertEqual(edited.status_code, 200, edited.get_json())
        req = StudioPublishRequest.query.one()
        self.assertEqual(req.state, 'pending_approval')
        self.assertIsNone(req.approved_hash)
        self.assertNotEqual(req.content_hash, digest)
        self.assertIn('approval_voided', [event.event for event in req.events])
        self.assertEqual(self.approve(req.id, digest).status_code, 409)
        self.assertEqual(self.approve(req.id, req.content_hash).status_code, 200)

    def test_approve_rejects_a_stale_hash_and_keeps_the_new_check(self):
        self.allow(self.admin)
        created = self.submit()
        stale = created.get_json()['content_hash']
        self.doc.body = '親紫之間 被直接改掉'
        db.session.commit()
        response = self.approve(created.get_json()['id'], stale)
        self.assertEqual(response.status_code, 409, response.get_json())
        req = StudioPublishRequest.query.one()
        self.assertEqual(req.state, 'pending_approval')
        self.assertNotEqual(req.content_hash, stale)
        self.assertIsNone(req.approved_hash)
        self.assertNotIn('approved', [event.event for event in req.events])

    def test_link_and_media_changes_void_approval(self):
        self.allow(self.admin)
        created = self.submit()
        request_id = created.get_json()['id']
        self.approve(request_id, created.get_json()['content_hash'])
        linked = self.client.put(
            f'/api/v1/studio/documents/{self.doc.id}',
            json={'link': 'https://example.com/story'}, headers=self.headers(self.editor),
        )
        self.assertEqual(linked.status_code, 200, linked.get_json())
        req = StudioPublishRequest.query.one()
        self.assertEqual(req.state, 'pending_approval')
        self.assertIn('warn', _levels(req.check_report, 'link_domain'))
        self.approve(req.id, req.content_hash)
        media = self.make_file()
        replaced = self.client.put(
            f'/api/v1/studio/documents/{self.doc.id}/media',
            json={'items': [{'file_id': media.id, 'position': 0, 'alt_text': '封面'}]},
            headers=self.headers(self.editor),
        )
        self.assertEqual(replaced.status_code, 200, replaced.get_json())
        req = StudioPublishRequest.query.one()
        self.assertNotEqual(req.state, 'approved')
        self.assertEqual(req.payload['media'][0]['file_id'], media.id)
        self.assertIn('approval_voided', [event.event for event in req.events])

    def test_block_stays_in_review_and_warn_can_be_approved(self):
        self.doc.body = BRAND + ANXIETY_MARKETING_TERMS[0]
        db.session.commit()
        blocked = self.submit()
        self.assertEqual(blocked.get_json()['state'], 'pending_review')
        self.allow(self.admin)
        self.assertEqual(self.approve(blocked.get_json()['id'], blocked.get_json()['content_hash']).status_code, 409)

        self.doc.body = '今天的分享'
        db.session.commit()
        warned = self.submit()
        self.assertEqual(warned.status_code, 409)  # 前一筆還開著
        cancelled = self.client.post(
            f"/api/v1/studio/publish-requests/{blocked.get_json()['id']}/cancel",
            headers=self.headers(self.editor),
        )
        self.assertEqual(cancelled.status_code, 200)
        warned = self.submit()
        self.assertEqual(warned.get_json()['state'], 'pending_approval')
        self.assertIn('warn', _levels(warned.get_json()['check_report'], 'brand_name'))
        self.assertEqual(self.approve(warned.get_json()['id'], warned.get_json()['content_hash']).status_code, 200)

    def test_open_request_blocks_manual_facebook_stage(self):
        created = self.submit()
        instagram = self.make_doc('instagram', '別的平台')
        published = self.client.put(
            f'/api/v1/studio/documents/{self.doc.id}/publishing',
            json={'stage': 'published'}, headers=self.headers(self.editor),
        )
        self.assertEqual(published.status_code, 409)
        self.assertEqual(StudioDocument.query.get(self.doc.id).stage, 'write')
        other = self.client.put(
            f'/api/v1/studio/documents/{instagram.id}/publishing',
            json={'stage': 'published'}, headers=self.headers(self.editor),
        )
        self.assertEqual(other.status_code, 200, other.get_json())
        document_stage = self.client.put(
            f'/api/v1/studio/documents/{self.doc.id}',
            json={'stage': 'scheduled'}, headers=self.headers(self.editor),
        )
        self.assertEqual(document_stage.status_code, 409)
        self.client.post(
            f"/api/v1/studio/publish-requests/{created.get_json()['id']}/cancel",
            headers=self.headers(self.editor),
        )
        again = self.client.put(
            f'/api/v1/studio/documents/{self.doc.id}/publishing',
            json={'stage': 'published'}, headers=self.headers(self.editor),
        )
        self.assertEqual(again.status_code, 200, again.get_json())

    def test_publish_endpoint_is_a_fixed_409_and_reconcile_is_absent(self):
        self.allow(self.admin)
        created = self.submit()
        request_id = created.get_json()['id']
        self.approve(request_id, created.get_json()['content_hash'])
        with patch('packages.studio.social.service.claim_publishing', side_effect=AssertionError('publish')):
            response = self.client.post(
                f'/api/v1/studio/publish-requests/{request_id}/publish', headers=self.headers(self.editor),
            )
        self.assertEqual(response.status_code, 409)
        self.assertEqual(StudioPublishRequest.query.one().state, 'approved')
        missing = self.client.post(
            f'/api/v1/studio/publish-requests/{request_id}/reconcile', headers=self.headers(self.admin),
        )
        self.assertEqual(missing.status_code, 404)

    def test_reject_then_resubmit_external_id_stays_unique(self):
        created = self.submit(external_id='same')
        self.allow(self.admin)
        rejected = self.client.post(
            f"/api/v1/studio/publish-requests/{created.get_json()['id']}/reject",
            json={'reason': '語氣不對'}, headers=self.headers(self.admin),
        )
        self.assertEqual(rejected.status_code, 200)
        self.assertEqual(StudioPublishRequest.query.one().state, 'rejected')
        again = self.submit(external_id='same')
        self.assertEqual(again.status_code, 409)
        fresh = self.submit(external_id='next')
        self.assertEqual(fresh.status_code, 201)

    def test_partial_unique_index_allows_terminal_rows(self):
        def add(state, external_id=None, document=None, target='facebook_page'):
            db.session.add(StudioPublishRequest(
                document_id=(document or self.doc).id, target=target, state=state, payload={'message': ''},
                content_hash='a' * 64, submitted_via='ui', mode='now', external_id=external_id,
            ))

        add('pending_review')
        add('approved')
        with self.assertRaises(IntegrityError):
            db.session.commit()
        db.session.rollback()
        add('rejected')
        add('cancelled')
        add('published')
        add('failed')
        db.session.commit()
        other = self.make_doc()
        add('pending_review', document=other)
        add('unknown', external_id=None, document=other)
        with self.assertRaises(IntegrityError):
            db.session.commit()
        db.session.rollback()
        add('pending_review', 'ext-1')
        db.session.commit()
        add('rejected', 'ext-1')
        with self.assertRaises(IntegrityError):
            db.session.commit()
        db.session.rollback()
        add('rejected', 'ext-1', target='other_target')
        db.session.commit()

    def test_claim_succeeds_only_once_and_does_not_retry_failed(self):
        self.allow(self.admin)
        created = self.submit()
        request_id = created.get_json()['id']
        digest = created.get_json()['content_hash']
        self.approve(request_id, digest)
        self.assertFalse(claim_publishing(request_id, '0' * 64))
        db.session.expire_all()
        self.assertEqual(StudioPublishRequest.query.get(request_id).state, 'approved')
        self.assertTrue(claim_publishing(request_id, digest))
        self.assertFalse(claim_publishing(request_id, digest))
        db.session.expire_all()
        req = StudioPublishRequest.query.get(request_id)
        self.assertEqual(req.state, 'publishing')
        self.assertEqual([event.event for event in req.events if event.event == 'publish_started'], ['publish_started'])
        req.state = 'failed'
        db.session.commit()
        self.assertFalse(claim_publishing(request_id, digest))
        db.session.expire_all()
        self.assertEqual(StudioPublishRequest.query.get(request_id).state, 'failed')
        compiled = claim_statement(request_id, digest, datetime(2026, 1, 1)).compile()
        self.assertIn('approved_hash', str(compiled))
        self.assertIn('publishing', compiled.params.values())
        self.assertIn('approved', compiled.params.values())
        self.assertIn(digest, compiled.params.values())

    def test_recheck_after_body_edit_moves_back_to_review(self):
        created = self.submit()
        self.doc.body = BRAND + ' 0912345678'
        db.session.commit()
        response = self.client.post(
            f"/api/v1/studio/publish-requests/{created.get_json()['id']}/recheck",
            headers=self.headers(self.editor),
        )
        self.assertEqual(response.status_code, 200, response.get_json())
        self.assertEqual(response.get_json()['state'], 'pending_review')
        self.assertIn('block', _levels(response.get_json()['check_report'], 'pii_phone'))


class MigrationTests(unittest.TestCase):
    def test_upgrade_and_downgrade_on_an_empty_sqlite_database(self):
        engine = __import__('sqlalchemy').create_engine('sqlite://')
        from alembic.migration import MigrationContext
        from alembic.operations import Operations

        saved_schema = os.environ.pop('OWS_BLOG_SCHEMA', None)
        self.addCleanup(lambda: os.environ.__setitem__('OWS_BLOG_SCHEMA', saved_schema) if saved_schema is not None else os.environ.pop('OWS_BLOG_SCHEMA', None))
        module = importlib.import_module('packages.studio.migrations.versions.0005_studio_publish_requests')
        with engine.begin() as conn:
            ctx = MigrationContext.configure(conn)
            with Operations.context(ctx):
                module.upgrade()
            names = set(inspect(conn).get_table_names())
            self.assertTrue({'studio_document_media', 'studio_publish_requests', 'studio_publish_events'} <= names)
            indexes = {item['name'] for item in inspect(conn).get_indexes('studio_publish_requests')}
            self.assertIn('uq_studio_publish_requests_open_document', indexes)
            self.assertIn('uq_studio_publish_requests_target_external', indexes)

            def insert(state, external_id=None):
                conn.execute(text(
                    "INSERT INTO studio_publish_requests "
                    "(document_id, target, state, payload, content_hash, submitted_via, mode, external_id) "
                    "VALUES (1, 'facebook_page', :state, '{}', :content_hash, 'ui', 'now', :external_id)"
                ), {'state': state, 'content_hash': 'a' * 64, 'external_id': external_id})

            insert('rejected')
            insert('cancelled')
            insert('pending_review')
            with self.assertRaises(IntegrityError):
                insert('approved')
            insert('published', 'ext-1')
            with self.assertRaises(IntegrityError):
                insert('failed', 'ext-1')
            with Operations.context(ctx):
                module.downgrade()
            self.assertFalse(set(inspect(conn).get_table_names()) & {
                'studio_document_media', 'studio_publish_requests', 'studio_publish_events',
            })
            with Operations.context(ctx):
                module.upgrade()
            self.assertIn('studio_publish_requests', inspect(conn).get_table_names())


if __name__ == '__main__':
    unittest.main()
