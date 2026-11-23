"""Exercise the real receiver SQL/migration on a disposable PostgreSQL cluster.
Extract only pure route functions: never import Polaris auth/db or load .env.
"""
import ast
import importlib.util
from pathlib import Path
from types import SimpleNamespace
import check_commerce_postgres as harness


def verify(url):
    from sqlalchemy import create_engine, text
    from alembic.migration import MigrationContext
    from alembic.operations import Operations
    class HTTPException(Exception):
        def __init__(self, status_code, detail):
            super().__init__(detail)
            self.status_code = status_code
    root = Path('D:/P_Polaris_Parent/1_run')
    engine = create_engine(url)
    with engine.begin() as c:
        c.execute(text('CREATE SCHEMA account'))
        c.execute(text('CREATE TABLE account.report_requests (id serial PRIMARY KEY, request_no varchar(32) UNIQUE, order_no varchar(40), status text, assigned_to text, updated_at timestamptz)'))
        c.execute(text('CREATE TABLE account.report_request_events (request_id int, actor text, action text, from_status text, to_status text, from_assignee text, to_assignee text, note text)'))
        spec = importlib.util.spec_from_file_location('control_migration', root / 'P_Union/p12_sql/migrations/versions/20261029_0100_fulfilment_controls_0030.py')
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        with Operations.context(MigrationContext.configure(c)):
            mod.upgrade()
    def execute(sql, params=None):
        with engine.begin() as c:
            result = c.execute(text(sql), params or {})
            return SimpleNamespace(affected_rows=result.rowcount,
                data=[dict(r) for r in result.mappings()] if result.returns_rows else [])
    tree = ast.parse((root / 'PolarisUI/backend/routes/report_requests.py').read_text(encoding='utf-8'))
    functions = [n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name in ('set_fulfilment_control', '_mutate')]
    for fn in functions:
        fn.decorator_list = []
    scope = {'_write': execute, '_query': execute, 'HTTPException': HTTPException, 'FulfilmentControl': object,
             'Optional': __import__('typing').Optional,
             'T': SimpleNamespace(REPORT_REQUESTS='account.report_requests', REPORT_REQUEST_EVENTS='account.report_request_events')}
    exec(compile(ast.Module(body=functions, type_ignores=[]), '<receiver>', 'exec'), scope)
    send, mutate = scope['set_fulfilment_control'], scope['_mutate']
    def body(revision, desired):
        return SimpleNamespace(revision=revision, desired=desired, reason='test', order_no='ORDER-1')
    assert send('R-1', body(1, 'paused'))['control']['revision'] == 1  # before work exists
    send('R-1', body(1, 'paused'))
    assert execute('SELECT count(*) AS n FROM account.report_request_control_events').data[0]['n'] == 1
    execute("INSERT INTO account.report_requests (request_no, order_no, status) VALUES ('R-1','ORDER-1','queued')")
    assert not mutate('R-1', 'editor', 'status', "status = 'in_progress'", 'true')
    send('R-1', body(2, 'active'))
    assert mutate('R-1', 'editor', 'status', "status = 'in_progress'", 'true')
    try:
        send('R-1', body(1, 'paused'))
        raise AssertionError('stale command accepted')
    except HTTPException as e:
        assert e.status_code == 409
    send('R-1', body(3, 'paused'))
    assert not mutate('R-1', 'editor', 'status', "status = 'completed'", 'true')
    from concurrent.futures import ThreadPoolExecutor
    def concurrent_command(pair):
        try:
            send('R-1', body(*pair))
        except HTTPException as exc:
            assert exc.status_code == 409
    with ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(concurrent_command, [(4, 'active'), (5, 'paused'), (4, 'active'), (5, 'paused')]))
    latest = execute("SELECT revision, desired FROM account.report_request_controls WHERE request_no='R-1'").data[0]
    assert (latest['revision'], latest['desired']) == (5, 'paused')
    assert not mutate('R-1', 'editor', 'status', "status = 'completed'", 'true')
    assert execute('SELECT status FROM account.report_requests').data[0]['status'] == 'in_progress'
    with engine.begin() as c:
        with Operations.context(MigrationContext.configure(c)):
            try:
                mod.downgrade()
                raise AssertionError('populated control log was dropped')
            except RuntimeError:
                pass
    engine.dispose()
    print('PASS: receiver migration, pre-create pause, concurrent duplicate/stale commands, paused mutation gate, resume, downgrade protection')


if __name__ == '__main__':
    harness.verify = verify
    harness.main()
