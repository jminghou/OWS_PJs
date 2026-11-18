"""Back up only existing tables affected by additive migrations 0030/0031."""
import os, json, subprocess
from pathlib import Path
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from inspect_cloud_release import variables

def main():
    out = Path(__file__).resolve().parents[1] / '.test-tmp/cloud-release-20261029'
    target = out / 'cloud-affected-tables.dump'
    assert not target.exists(), 'Backup already exists'
    url = make_url(variables('Postgres')['DATABASE_PUBLIC_URL'])
    engine = create_engine(url.set(drivername='postgresql+psycopg'))
    with engine.connect() as conn:
        version = conn.execute(text('SELECT version_num FROM public.alembic_version')).scalar_one()
        assert version == '0029_ziwei_terms', 'Unexpected schema'
    result = subprocess.run([r'C:\Program Files\PostgreSQL\18\bin\pg_dump.exe', '-h',url.host,
        '-p',str(url.port),'-U',url.username,'-d',url.database,'-Fc','-t','account.report_requests',
        '-t','public.alembic_version','-f',str(target)],
        env={**os.environ, 'PGPASSWORD':url.password,'PGSSLMODE':'require'},capture_output=True)
    assert result.returncode == 0 and target.stat().st_size > 0, 'Backup failed'
    verify = subprocess.run([r'C:\Program Files\PostgreSQL\18\bin\pg_restore.exe','--list',str(target)],capture_output=True)
    assert verify.returncode == 0 and b'report_requests' in verify.stdout
    print(json.dumps({'backup_verified':True,'bytes':target.stat().st_size,'schema_before':version}))
if __name__ == '__main__':
    try: main()
    except Exception as e:
        print('Backup failed:',type(e).__name__)
        raise SystemExit(1)
