"""後台「會員管理」：/members 名冊（搜尋、篩選、排序、分頁、模組欄位、匯出）與 /users?scope=staff。"""
import csv
import io
from datetime import datetime, timedelta
from unittest.mock import patch

from core.backend_engine.factory import db
from core.backend_engine.models import Content, User
from core.backend_engine.services.rbac import RBACService
from packages.commerce.models import Order
from packages.social_auth.models import SocialIdentity

from tests.test_report_orders import _Base, _make_app

READ = {'users.read'}
MANAGE = {'users.read', 'users.update'}


class MembersApiTests(_Base):
    @classmethod
    def setUpClass(cls):
        cls.app = _make_app()
        from core.backend_engine.blueprints.api import bp as core_api
        from packages.commerce import members as commerce_members
        from packages.social_auth import members as social_members
        cls.app.register_blueprint(core_api, url_prefix='/api/v1', name='core_api_members')
        commerce_members.register()
        social_members.register()
        # Polaris 的「信箱驗證」欄位在 member_account 匯入時登記（_Base 已匯入）

    def setUp(self):
        super().setUp()
        for t in (SocialIdentity.__table__, Content.__table__):  # /users 會算每人的文章數
            t.create(db.engine, checkfirst=True)
            self.tables.append(t)
        self.admin = User(username='admin', email='admin@polaris.local', role='admin', is_active=True)
        self.admin.set_password('Secret123')
        self.editor = User(username='writer', email='writer@example.test', role='editor', is_active=True)
        self.editor.set_password('Secret123')
        db.session.add_all([self.admin, self.editor])
        db.session.commit()
        self.perms = {self.admin.id: MANAGE}
        p = patch.object(RBACService, 'get_user_permissions', side_effect=lambda uid: self.perms.get(int(uid), set()))
        p.start()
        self.addCleanup(p.stop)

    # helpers
    def member(self, email, *, days_ago=0, verified=False, active=True, last_login=None):
        u = self.make_user(email, verified=verified)
        u.created_at = datetime.utcnow() - timedelta(days=days_ago)
        u.is_active = active
        u.last_login = last_login
        db.session.commit()
        return u

    def order(self, user, n=1):
        for i in range(n):
            db.session.add(Order(order_no=f'T-{user.id}-{i}', user_id=user.id, amount=100))
        db.session.commit()

    def get(self, query='', user=None):
        return self.client.get(f'/api/v1/members{query}', headers=self.headers(user or self.admin))

    def emails(self, res):
        self.assertEqual(res.status_code, 200, res.get_json())
        return [m['email'] for m in res.get_json()['members']]

    # ── 範圍 ──────────────────────────────────────────────────────────────
    def test_lists_only_members_newest_first(self):
        # _Base 已建 buyer@example.com（member）
        self.member('old@example.com', days_ago=40)
        self.member('new@example.com', days_ago=1)
        self.assertEqual(self.emails(self.get()), ['buyer@example.com', 'new@example.com', 'old@example.com'])  # buyer 剛建立

    def test_staff_scope_excludes_members(self):
        res = self.client.get('/api/v1/users?scope=staff', headers=self.headers(self.admin))
        self.assertEqual(sorted(u['username'] for u in res.get_json()['users']), ['admin', 'writer'])
        res = self.client.get('/api/v1/users', headers=self.headers(self.admin))  # 不帶 scope 行為不變
        self.assertEqual(res.get_json()['pagination']['total'], 3)

    def test_requires_users_read(self):
        self.assertEqual(self.get(user=self.editor).status_code, 403)

    # ── 搜尋、篩選 ─────────────────────────────────────────────────────────
    def test_search_is_case_insensitive_partial(self):
        self.member('Lin.Family@Example.com')
        self.assertEqual(self.emails(self.get('?q=LIN.fam')), ['Lin.Family@Example.com'])

    def test_status_and_joined_filters(self):
        self.member('off@example.com', active=False)
        self.member('old@example.com', days_ago=100)
        self.assertEqual(self.emails(self.get('?status=disabled')), ['off@example.com'])
        self.assertNotIn('old@example.com', self.emails(self.get('?joined=30d')))
        self.assertIn('old@example.com', self.emails(self.get('?joined=365d')))

    def test_module_filters(self):
        g = self.member('g@gmail.com')
        db.session.add(SocialIdentity(user_id=g.id, provider='google', subject='s1', created_at=datetime.utcnow()))
        self.order(g, 2)
        self.member('plain@example.com')
        self.assertEqual(self.emails(self.get('?login_method=google')), ['g@gmail.com'])
        self.assertNotIn('g@gmail.com', self.emails(self.get('?login_method=none')))
        self.assertEqual(self.emails(self.get('?has_orders=yes')), ['g@gmail.com'])
        self.assertIn('buyer@example.com', self.emails(self.get('?email_verified=yes')))
        self.assertNotIn('plain@example.com', self.emails(self.get('?email_verified=yes')))

    def test_unknown_filter_value_is_ignored(self):
        self.assertEqual(len(self.emails(self.get('?has_orders=maybe'))), 1)

    # ── 欄位、摘要 ─────────────────────────────────────────────────────────
    def test_row_extras_and_metadata(self):
        g = self.member('g@gmail.com', verified=True)
        db.session.add(SocialIdentity(user_id=g.id, provider='google', subject='s1', created_at=datetime.utcnow()))
        db.session.commit()
        self.order(g, 3)
        body = self.get('?q=g@gmail').get_json()
        row = body['members'][0]
        self.assertEqual(row['extras'], {'login_methods': ['Google'], 'email_verified': True, 'order_count': 3})
        self.assertTrue(row['password_set'])
        keys = [c['key'] for c in body['columns']]
        self.assertEqual(keys, ['login_methods', 'email_verified', 'order_count'])
        self.assertEqual({f['key'] for f in body['filters']}, {'login_method', 'email_verified', 'has_orders'})
        self.assertEqual(body['summary']['total'], 2)  # buyer + g，不含 admin、editor

    # ── 排序、分頁 ─────────────────────────────────────────────────────────
    def test_sort_by_last_login_puts_never_logged_in_last(self):
        now = datetime.utcnow()
        self.member('a@example.com', last_login=now - timedelta(days=2))
        self.member('b@example.com', last_login=now)
        emails = self.emails(self.get('?sort=last_login'))
        self.assertEqual(emails[:2], ['b@example.com', 'a@example.com'])
        self.assertEqual(emails[-1], 'buyer@example.com')

    def test_pagination_and_per_page_whitelist(self):
        for i in range(25):
            self.member(f'm{i:02d}@example.com')
        body = self.get('?per_page=20&page=2').get_json()
        self.assertEqual(body['pagination'], {'page': 2, 'pages': 2, 'total': 26, 'per_page': 20})
        self.assertEqual(len(body['members']), 6)
        self.assertEqual(self.get('?per_page=5000').get_json()['pagination']['per_page'], 20)

    # ── 匯出 ──────────────────────────────────────────────────────────────
    def test_export_csv_follows_filters_and_needs_update_permission(self):
        self.member('off@example.com', active=False)
        res = self.client.get('/api/v1/members/export.csv?status=disabled', headers=self.headers(self.admin))
        self.assertEqual(res.status_code, 200)
        rows = list(csv.reader(io.StringIO(res.get_data(as_text=True).lstrip('﻿'))))
        self.assertEqual(rows[0][:2], ['ID', 'Email'])
        self.assertEqual([r[1] for r in rows[1:]], ['off@example.com'])
        self.perms[self.admin.id] = READ
        self.assertEqual(self.client.get('/api/v1/members/export.csv', headers=self.headers(self.admin)).status_code, 403)
