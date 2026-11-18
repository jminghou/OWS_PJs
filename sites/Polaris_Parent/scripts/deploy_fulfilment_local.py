"""Deploy additive production integration changes to the configured LOCAL database only.
No credentials are printed. Run before restarting the two local applications.
"""
import json
import os
from pathlib import Path
import subprocess
from datetime import datetime
from dotenv import dotenv_values, set_key
from sqlalchemy import create_engine, text, URL
from alembic import command
from alembic.config import Config

SITE = Path(__file__).resolve().parents[1]
REMOTE = Path('D:/P_Polaris_Parent/1_run')
remote_env = REMOTE / 'PolarisUI/backend/.env'
cfg = dotenv_values(remote_env)
assert cfg['DB_HOST'] in ('localhost', '127.0.0.1'), 'Local deployment only'
assert cfg['DB_NAME'] == 'db_pcount_v3', 'Unexpected database'
site_cfg = dotenv_values(SITE / '.env')
assert cfg.get('PUBLIC_SERVICE_TOKEN') and cfg['PUBLIC_SERVICE_TOKEN'] == site_cfg.get('PUBLIC_SERVICE_TOKEN')
url = URL.create('postgresql+psycopg', username=cfg['DB_USER'], password=cfg['DB_PASSWORD'],
                 host=cfg['DB_HOST'], port=int(cfg.get('DB_PORT', '5432')), database=cfg['DB_NAME'])
engine = create_engine(url)
with engine.connect() as c:
    version = c.execute(text('SELECT version_num FROM public.alembic_version')).scalar_one()
    assert version in ('0029_ziwei_terms', '0030_fulfilment_controls', '0031_report_artifacts'), version
    website_version = c.execute(text('SELECT version_num FROM blog.alembic_version')).scalar_one()
    assert website_version == '0019_page_modules', website_version

out = SITE / '.test-tmp' / ('deploy-' + datetime.now().strftime('%Y%m%d-%H%M%S'))
out.mkdir(parents=True)
if version != '0031_report_artifacts':
    env = {**os.environ, 'PGPASSWORD': cfg['DB_PASSWORD']}
    result = subprocess.run([r'C:\Program Files\PostgreSQL\18\bin\pg_dump.exe',
        '-h', cfg['DB_HOST'], '-p', cfg.get('DB_PORT', '5432'), '-U', cfg['DB_USER'],
        '-d', cfg['DB_NAME'], '-Fc', '-t', 'account.report_requests', '-t', 'public.alembic_version',
        '-f', str(out / 'affected-tables.dump')], env=env, capture_output=True)
    if result.returncode:
        raise RuntimeError('Local affected-table backup failed; migrations not run')
    assert (out / 'affected-tables.dump').stat().st_size > 0
    for k, v in cfg.items():
        if k.startswith('DB_') and v is not None:
            os.environ[k] = v
    migration_root = REMOTE / 'P_Union/p12_sql'
    alembic = Config(str(REMOTE / 'P_Union/alembic.ini'))
    alembic.set_main_option('script_location', str(migration_root / 'migrations'))
    command.upgrade(alembic, '0031_report_artifacts')
with engine.connect() as c:
    assert c.execute(text('SELECT version_num FROM public.alembic_version')).scalar_one() == '0031_report_artifacts'
    assert c.execute(text("SELECT count(*) FROM account.report_requests r LEFT JOIN account.report_request_controls c USING(request_no) WHERE c.request_no IS NULL")).scalar_one() == 0
set_key(str(SITE / '.env'), 'ZIWEI_API_URL', 'http://127.0.0.1:9000')
storage = SITE / '.local-private/report-artifacts'
storage.mkdir(parents=True, exist_ok=True)
set_key(str(remote_env), 'REPORT_ARTIFACT_DIR', storage.as_posix())
record = {'scope': 'local integration', 'database': 'localhost/db_pcount_v3', 'before': version,
          'after': '0031_report_artifacts', 'website_revision': website_version,
          'artifact_storage': str(storage), 'backup_scope': 'affected existing tables only'}
(out / 'deployment.json').write_text(json.dumps(record, indent=2), encoding='utf-8')
print(json.dumps(record))
print('Deployment record:', out)
