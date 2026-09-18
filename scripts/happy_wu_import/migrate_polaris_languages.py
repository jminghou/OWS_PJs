"""Upgrade only the verified local Polaris Studio chain, with a blog-schema backup."""
import os
import sys
import json
import subprocess
from datetime import datetime
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT))
from dotenv import dotenv_values
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from scripts.happy_wu_import.database import pg_run, PG_BIN, OUT, connection_config
from scripts.happy_wu_import.check_studio_languages import snapshot


def main():
    values=dotenv_values(ROOT/'sites/Polaris_Parent/.env')
    url=make_url(values.get('DB_URL_OVERRIDE') or values['DATABASE_URL'])
    if url.host not in ('localhost','127.0.0.1') or url.database!='db_pcount_v3' or values.get('OWS_BLOG_SCHEMA')!='blog':
        raise RuntimeError('Unexpected migration target')
    if '--local-owner' in sys.argv:
        _, owner = connection_config('ows_happy_wu')
        if (owner.host, owner.port or 5432) != (url.host, url.port or 5432):
            raise RuntimeError('Owner connection must be on the same verified local server')
        url=url.set(username=owner.username,password=owner.password)
    engine=create_engine(url)
    with engine.connect() as c:
        version=c.execute(text('SELECT version_num FROM blog.alembic_version_studio')).scalar()
    if version=='0003_studio_languages':
        print('Polaris Studio already migrated');return
    if version!='0002_studio_trgm_search': raise RuntimeError('Unexpected Studio revision')
    archive=OUT/'backups'/f'polaris-blog-before-languages-{datetime.now():%Y%m%d-%H%M%S}.dump'
    archive.parent.mkdir(parents=True,exist_ok=True)
    pg_run('pg_dump.exe',url,'--format=custom','--schema=blog','--file',archive)
    checked=subprocess.run([str(PG_BIN/'pg_restore.exe'),'--list',str(archive)],capture_output=True)
    if checked.returncode or not archive.stat().st_size: raise RuntimeError('Invalid backup')
    before=snapshot(engine)
    for key,value in values.items():
        if value is not None: os.environ[key]=value
    # Migrate only the Studio chain; do not initialize astrology or other site services.
    from flask import Flask
    from flask_migrate import Migrate, upgrade
    from core.backend_engine.factory import db
    app=Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI']=url.render_as_string(hide_password=False)
    db.init_app(app);Migrate(app,db)
    with app.app_context(): upgrade(directory=str(ROOT/'packages/studio/migrations'))
    assert snapshot(engine)==before,'Existing data changed'
    report={'database':url.database,'schema':'blog','backup':str(archive),'backup_scope':'blog schema only; existing account identity schema is required for restore',
            'preserved_rows':{k:len(v) for k,v in before.items()},'migration':'0003_studio_languages'}
    (OUT/'polaris-language-migration.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps(report))


if __name__=='__main__': main()
