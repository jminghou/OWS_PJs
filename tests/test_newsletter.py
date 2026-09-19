"""Newsletter module: subscribe / confirm / unsubscribe / export. In-memory SQLite; never touches site data."""
import csv
import inspect
import io
import unittest
from datetime import datetime, timedelta
from unittest.mock import patch

from flask import Flask
from flask_jwt_extended import JWTManager

from core.backend_engine.factory import db, limiter
from packages.newsletter.api import admin, public
from packages.newsletter.blueprint import newsletter_bp
from packages.newsletter.models import NewsletterSubscriber

BOM = chr(0xFEFF)


def _make_app():
    app = Flask(__name__)
    app.config.update(SQLALCHEMY_DATABASE_URI='sqlite://', RATELIMIT_ENABLED=False, TESTING=True,
                      JWT_SECRET_KEY='test-only', JWT_TOKEN_LOCATION=['cookies'])
    JWTManager(app)
    db.init_app(app)
    limiter.init_app(app)
    app.register_blueprint(newsletter_bp, url_prefix='/api/v1/newsletter')
    return app


class NewsletterTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = _make_app()

    def setUp(self):
        self.ctx = self.app.app_context()
        self.ctx.push()
        NewsletterSubscriber.__table__.create(db.engine)
        self.client = self.app.test_client()
        patcher = patch.object(public, 'send_confirmation')
        self.send = patcher.start()
        self.addCleanup(patcher.stop)

    def tearDown(self):
        db.session.remove()
        NewsletterSubscriber.__table__.drop(db.engine)
        self.ctx.pop()

    def subscribe(self, email='Reader@Example.com ', **extra):
        return self.client.post('/api/v1/newsletter/subscribe',
                                json={'email': email, 'locale': 'ja', 'source': 'home-hero', **extra},
                                headers={'X-Forwarded-For': '203.0.113.9, 10.0.0.1', 'User-Agent': 'pytest'})

    def post(self, path, token):
        return self.client.post(f'/api/v1/newsletter/{path}', json={'token': token})

    def only(self):
        return NewsletterSubscriber.query.one()

    def test_subscribe_normalises_and_records_consent(self):
        self.assertEqual(self.subscribe().status_code, 200)
        row = self.only()
        self.assertEqual((row.email, row.status, row.locale, row.source), ('reader@example.com', 'pending', 'ja', 'home-hero'))
        self.assertEqual((row.consent_ip, row.consent_user_agent), ('203.0.113.9', 'pytest'))
        self.assertIsNotNone(row.consent_at)
        self.assertGreaterEqual(len(row.token), 40)
        self.send.assert_called_once()

    def test_responses_do_not_reveal_list_membership(self):
        first = self.subscribe()
        repeat = self.subscribe()
        self.post('confirm', self.only().token)
        active = self.subscribe()
        bot = self.subscribe(email='bot@example.com', website='http://spam.example')
        bodies = {r.get_data() for r in (first, repeat, active, bot)}
        self.assertEqual(len(bodies), 1)
        self.assertEqual({r.status_code for r in (first, repeat, active, bot)}, {200})
        # honeypot 不入庫；冷卻時間內的重複訂閱、已 active 的訂閱都不重寄
        self.assertEqual(NewsletterSubscriber.query.count(), 1)
        self.send.assert_called_once()

    def test_invalid_email_is_rejected(self):
        for email in ['', 'nope', 'a@b', 'a b@c.com', 'x' * 250 + '@e.com', None]:
            with self.subTest(email=email):
                self.assertEqual(self.subscribe(email=email).status_code, 400)
        self.assertEqual(NewsletterSubscriber.query.count(), 0)

    def test_pending_resend_after_cooldown(self):
        self.subscribe()
        row = self.only()
        row.confirm_sent_at = datetime.utcnow() - public.RESEND_COOLDOWN - timedelta(seconds=1)
        db.session.commit()
        self.subscribe()
        self.assertEqual(self.send.call_count, 2)

    def test_confirm_is_idempotent_and_expires(self):
        self.subscribe()
        token = self.only().token
        self.assertEqual(self.post('confirm', token).status_code, 200)
        self.assertEqual(self.post('confirm', token).status_code, 200)
        self.assertEqual(self.only().status, 'active')
        self.assertEqual(self.post('confirm', 'unknown').status_code, 404)
        self.assertEqual(self.post('confirm', '').status_code, 404)

        self.subscribe(email='late@example.com')
        late = NewsletterSubscriber.query.filter_by(email='late@example.com').one()
        late.confirm_sent_at = datetime.utcnow() - public.CONFIRM_TTL - timedelta(seconds=1)
        db.session.commit()
        self.assertEqual(self.post('confirm', late.token).status_code, 410)
        self.assertEqual(late.status, 'pending')

    def test_unsubscribe_then_resubscribe_keeps_token_and_needs_new_consent(self):
        self.subscribe()
        token = self.only().token
        self.post('confirm', token)
        self.assertEqual(self.post('unsubscribe', token).status_code, 200)
        self.assertEqual(self.post('unsubscribe', token).status_code, 200)
        self.assertEqual(self.only().status, 'unsubscribed')
        # 退訂後舊的確認連結不能讓人復活
        self.assertEqual(self.post('confirm', token).status_code, 410)

        self.subscribe()
        row = self.only()
        self.assertEqual((row.status, row.token, row.confirmed_at, row.unsubscribed_at), ('pending', token, None, None))
        self.assertEqual(self.send.call_count, 2)
        self.assertEqual(self.post('confirm', token).status_code, 200)

    def test_export_defaults_to_active_with_bom_and_formula_escaping(self):
        now = datetime.utcnow()
        db.session.add_all([
            NewsletterSubscriber(email='=cmd|calc@evil.example', status='active', locale='en', source='+x', confirmed_at=now),
            NewsletterSubscriber(email='讀者@example.com', status='active', locale='zh-TW'),
            NewsletterSubscriber(email='pending@example.com', status='pending'),
            NewsletterSubscriber(email='gone@example.com', status='unsubscribed'),
        ])
        db.session.commit()
        with self.app.test_request_context('/'):
            response = inspect.unwrap(admin.export_subscribers)()
        text = response.get_data(as_text=True)
        self.assertTrue(text.startswith(BOM))
        self.assertIn('text/csv', response.headers['Content-Type'])
        self.assertIn('attachment; filename=subscribers-active-', response.headers['Content-Disposition'])
        rows = list(csv.DictReader(io.StringIO(text.lstrip(BOM))))
        self.assertEqual([r['email'] for r in rows], ["'=cmd|calc@evil.example", '讀者@example.com'])
        self.assertEqual(rows[0]['source'], "'+x")
        self.assertRegex(rows[0]['unsubscribe_url'], r'/en/newsletter/unsubscribe\?token=.{40,}$')
        self.assertRegex(rows[1]['unsubscribe_url'], r'/zh-TW/newsletter/unsubscribe\?token=')

    def test_admin_list_filters_and_counts(self):
        db.session.add_all([
            NewsletterSubscriber(email='a@example.com', status='active'),
            NewsletterSubscriber(email='b@example.com', status='pending'),
            NewsletterSubscriber(email='c@other.org', status='active'),
        ])
        db.session.commit()
        with self.app.test_request_context('/?status=active&q=EXAMPLE'):
            response, status = inspect.unwrap(admin.list_subscribers)()
        body = response.get_json()
        self.assertEqual(status, 200)
        self.assertEqual([s['email'] for s in body['subscribers']], ['a@example.com'])
        self.assertEqual(body['counts'], {'pending': 1, 'active': 2, 'unsubscribed': 0})
        self.assertEqual(body['pagination']['total'], 1)
        self.assertNotIn('token', body['subscribers'][0])

    def test_admin_routes_require_login(self):
        for method, path in [('get', 'admin/subscribers'), ('get', 'admin/subscribers/export'), ('delete', 'admin/subscribers/1')]:
            with self.subTest(path=path):
                response = getattr(self.client, method)(f'/api/v1/newsletter/{path}')
                self.assertEqual(response.status_code, 401)


if __name__ == '__main__':
    unittest.main()
