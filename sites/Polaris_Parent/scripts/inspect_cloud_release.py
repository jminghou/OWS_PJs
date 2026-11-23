"""Read-only cloud preflight; never emit connection strings or tokens."""
import json, subprocess
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

PROJECT = 'f5e08927-ea0c-4abe-a0dc-71139324e2ef'
def variables(service):
    p = subprocess.run(['node', r'C:\Users\jerma\AppData\Roaming\npm\node_modules\@railway\cli\bin\railway.js',
        'variable', 'list', '-s', service, '-e', 'production', '-p', PROJECT, '--json'], capture_output=True, check=True)
    return json.loads(p.stdout)

def main():
    pg, web, remote = (variables(s) for s in ('Postgres', 'polaris-backend', 'Polaris_run'))
    url = make_url(pg['DATABASE_PUBLIC_URL']).set(drivername='postgresql+psycopg')
    engine = create_engine(url, connect_args={'connect_timeout': 20})
    report = {'website_config': web.get('FLASK_CONFIG'), 'jobs_explicit': web.get('REPORT_JOBS_ENABLED'),
        'private_bucket_configured': bool(web.get('PRIVATE_GCS_BUCKET_NAME')),
        'service_tokens_match': bool(web.get('PUBLIC_SERVICE_TOKEN')) and web.get('PUBLIC_SERVICE_TOKEN') == remote.get('PUBLIC_SERVICE_TOKEN'),
        'artifact_dir': remote.get('REPORT_ARTIFACT_DIR'), 'volume': remote.get('RAILWAY_VOLUME_MOUNT_PATH')}
    with engine.connect() as conn:
        conn.execute(text('SET TRANSACTION READ ONLY'))
        for schema in ('public','blog'):
            report[schema+'_revision'] = conn.execute(text(f'SELECT version_num FROM {schema}.alembic_version')).scalar_one()
        report['jobs'] = [dict(r) for r in conn.execute(text('SELECT job,last_started_at,last_finished_at,last_status FROM shop.report_job_runs ORDER BY job')).mappings()]
        report['orders_by_status'] = [dict(r) for r in conn.execute(text('SELECT status,count(*) FROM shop.orders GROUP BY status')).mappings()]
        report['requests_by_status'] = [dict(r) for r in conn.execute(text('SELECT status,count(*) FROM account.report_requests GROUP BY status')).mappings()]
    print(json.dumps(report, default=str, ensure_ascii=False, indent=2))

if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print('Preflight failed:', type(e).__name__)
        raise SystemExit(1)
