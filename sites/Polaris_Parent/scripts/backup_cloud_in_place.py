"""Keep affected-table backup inside the same production database; no data export."""
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from inspect_cloud_release import variables

def main():
    url = make_url(variables('Postgres')['DATABASE_PUBLIC_URL']).set(drivername='postgresql+psycopg')
    engine = create_engine(url, connect_args={'connect_timeout':20})
    with engine.begin() as conn:
        conn.execute(text("SET LOCAL lock_timeout = '5s'"))
        assert conn.execute(text('SELECT version_num FROM public.alembic_version')).scalar_one() == '0029_ziwei_terms'
        conn.execute(text('LOCK TABLE account.report_requests IN SHARE MODE'))
        conn.execute(text('CREATE SCHEMA deployment_backup_20261029'))
        conn.execute(text('REVOKE ALL ON SCHEMA deployment_backup_20261029 FROM PUBLIC'))
        conn.execute(text('CREATE TABLE deployment_backup_20261029.report_requests AS TABLE account.report_requests'))
        conn.execute(text('CREATE TABLE deployment_backup_20261029.alembic_version AS TABLE public.alembic_version'))
        a = conn.execute(text('SELECT count(*) FROM account.report_requests')).scalar_one()
        b = conn.execute(text('SELECT count(*) FROM deployment_backup_20261029.report_requests')).scalar_one()
        assert a == b
    print('Cloud in-place affected-table backup verified. No customer data exported.')
if __name__ == '__main__':
    try: main()
    except Exception as e:
        print('In-place backup failed:',type(e).__name__)
        raise SystemExit(1)
