"""Actual migration and registration SQL on disposable PostgreSQL; no app/.env import."""
import ast
import importlib.util
import json
import os
import tempfile
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
import check_commerce_postgres as harness


def verify(url):
    from sqlalchemy import create_engine, text
    from alembic.migration import MigrationContext
    from alembic.operations import Operations
    engine = create_engine(url)
    root = Path('D:/P_Polaris_Parent/1_run')
    with engine.begin() as c:
        c.execute(text('CREATE SCHEMA account'))
        c.execute(text('''CREATE TABLE account.report_requests (id serial PRIMARY KEY, request_no varchar(32) UNIQUE,
            order_no varchar(40), status text, assigned_to text, updated_at timestamptz NOT NULL DEFAULT now(),
            member_id bigint, chart_id bigint, env text, language text, product_code text, variant text)'''))
        for name in ('20261029_0100_fulfilment_controls_0030.py', '20261029_0200_report_artifacts_0031.py'):
            spec = importlib.util.spec_from_file_location('migration', root / 'P_Union/p12_sql/migrations/versions' / name)
            mod = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(mod)
            with Operations.context(MigrationContext.configure(c)):
                mod.upgrade()
    def execute(sql, params=None):
        with engine.begin() as c:
            result = c.execute(text(sql), params or {})
            return SimpleNamespace(affected_rows=result.rowcount,
                data=[dict(r) for r in result.mappings()] if result.returns_rows else [])
    class HTTPException(Exception):
        def __init__(self, status_code, detail):
            super().__init__(detail)
            self.status_code = status_code
    def get(n):
        return execute('SELECT * FROM account.report_requests WHERE request_no=:n', {'n': n}).data[0]
    def editable(r, u):
        if r['assigned_to'] != u['username'] and u['role'] != 'admin':
            raise HTTPException(403, 'not editor')
    scope = dict(_query=execute, _write=execute, _require_row=get, _require_editable=editable,
                 _lang_ok=lambda u, lang: True, _is_admin=lambda u: u['role'] == 'admin',
                 _json_field=lambda v: json.loads(v) if isinstance(v, str) else v,
                 json=json, HTTPException=HTTPException,
                 Response=lambda **kw: kw)
    tree = ast.parse((root / 'PolarisUI/backend/routes/report_requests.py').read_text(encoding='utf-8'))
    names = ('_artifact_root', '_artifact_manifest', '_register_artifact', 'get_report_artifact_file')
    funcs = [n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name in names]
    for f in funcs:
        f.decorator_list = []
    exec(compile(ast.Module(body=funcs, type_ignores=[]), '<artifact receiver>', 'exec'), scope)
    execute("""INSERT INTO account.report_requests
        (request_no, order_no, status, assigned_to, member_id, chart_id, env, language, product_code, variant)
        VALUES ('R1','O1','completed','editor',1,2,'test','zh-TW','BOOK','digital')""")
    execute("INSERT INTO account.report_request_controls VALUES ('R1','O1',0,'active','',now())")
    user = {'username': 'editor', 'role': 'editor'}
    stamp = get('R1')['updated_at'].isoformat()
    pdf = b'%PDF-1.4\nfixture\n%%EOF'
    def register(expected):
        return scope['_register_artifact']('R1', expected, stamp, 'final.pdf', pdf, user)
    def denied(fn, status=409):
        try:
            fn()
            raise AssertionError('expected refusal')
        except HTTPException as e:
            assert e.status_code == status, str(e)
    with tempfile.TemporaryDirectory(dir=harness.SITE / '.test-tmp') as directory:
        with patch.dict(os.environ, {'REPORT_ARTIFACT_DIR': directory}):
            denied(lambda: scope['_register_artifact']('R1', 0, stamp, 'x.pdf', pdf, {'username': 'other', 'role': 'editor'}), 403)
            m = register(0)['artifact']
            assert m['version'] == 1
            assert scope['get_report_artifact_file']('R1', 1)['content'] == pdf
            denied(lambda: register(0))
            from concurrent.futures import ThreadPoolExecutor
            def concurrent(_):
                try:
                    register(1)
                    return True
                except HTTPException as e:
                    assert e.status_code == 409
                    return False
            with ThreadPoolExecutor(max_workers=2) as pool:
                assert sorted(pool.map(concurrent, range(2))) == [False, True]
            denied(lambda: scope['get_report_artifact_file']('R1', 1))
            execute("UPDATE account.report_request_controls SET desired='paused'")
            denied(lambda: register(2))
            denied(lambda: scope['_artifact_manifest']('R1'))
            execute("UPDATE account.report_request_controls SET desired='active'")
            execute("UPDATE account.report_requests SET updated_at=now(), status='in_progress'")
            denied(lambda: scope['_artifact_manifest']('R1'))
            execute("UPDATE account.report_requests SET status='completed'")
            denied(lambda: scope['_artifact_manifest']('R1'))
            denied(lambda: register(2))
            stamp = get('R1')['updated_at'].isoformat()
            m = register(2)['artifact']
            (Path(directory) / (m['sha256'] + '.pdf')).write_bytes(b'corrupt')
            denied(lambda: scope['get_report_artifact_file']('R1', 3), 503)
    with engine.begin() as c:
        with Operations.context(MigrationContext.configure(c)):
            try:
                mod.downgrade()
                raise AssertionError('populated manifest table dropped')
            except RuntimeError:
                pass
    engine.dispose()
    print('PASS: migrations, immutable revisions, concurrent registration, pause/reopen gates, stale source, integrity, downgrade protection')


if __name__ == '__main__':
    harness.verify = verify
    harness.main()
