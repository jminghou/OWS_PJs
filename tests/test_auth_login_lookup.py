"""core /auth/login 的帳號比對：先完全相符，找不到才不分大小寫（且只在恰好一筆時）。In-memory SQLite。"""
import unittest

from flask import Flask
from sqlalchemy import BigInteger, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles

from core.backend_engine.blueprints.api.auth import _find_login_user
from core.backend_engine.factory import db
from core.backend_engine.models import User


@compiles(JSONB, 'sqlite')
def _jsonb_on_sqlite(type_, compiler, **kw):
    return 'JSON'


@compiles(BigInteger, 'sqlite')
def _bigint_on_sqlite(type_, compiler, **kw):
    return 'INTEGER'


class LoginLookupTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = Flask(__name__)
        cls.app.config.update(SQLALCHEMY_DATABASE_URI='sqlite://', TESTING=True)
        db.init_app(cls.app)

    def setUp(self):
        self.ctx = self.app.app_context()
        self.ctx.push()
        with db.engine.begin() as conn:
            for schema in ('blog', 'account'):
                if schema not in conn.execute(text('PRAGMA database_list')).scalars(1).all():
                    conn.execute(text(f"ATTACH DATABASE ':memory:' AS {schema}"))
        User.__table__.create(db.engine)

    def tearDown(self):
        db.session.remove()
        User.__table__.drop(db.engine)
        self.ctx.pop()

    def add(self, username):
        u = User(username=username, email=f'{username}@example.com')  # SQLite 的 unique 分大小寫
        u.set_password('Secret123')
        db.session.add(u)
        db.session.commit()
        return u

    def test_exact_match(self):
        u = self.add('admin')
        self.assertEqual(_find_login_user('admin').id, u.id)

    def test_autofilled_capital_and_spaces_still_find_lowercase_account(self):
        u = self.add('admin')
        self.assertEqual(_find_login_user('Admin').id, u.id)
        self.assertEqual(_find_login_user('  ADMIN ').id, u.id)

    def test_exact_match_wins_when_case_variants_coexist(self):
        upper = self.add('Claire')
        lower = self.add('claire')
        self.assertEqual(_find_login_user('Claire').id, upper.id)
        self.assertEqual(_find_login_user('claire').id, lower.id)

    def test_ambiguous_case_insensitive_match_is_refused(self):
        self.add('Claire')
        self.add('claire')
        self.assertIsNone(_find_login_user('CLAIRE'))

    def test_unknown_and_non_string(self):
        self.add('admin')
        self.assertIsNone(_find_login_user('nobody'))
        self.assertIsNone(_find_login_user(None))


if __name__ == '__main__':
    unittest.main()
