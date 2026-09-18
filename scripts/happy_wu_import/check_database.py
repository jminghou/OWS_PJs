"""Integration check against a new, restored LOCAL database; never writes Happy_Wu."""
import json
import sys
from datetime import datetime, timedelta
from pathlib import Path
from types import SimpleNamespace

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT))
from scripts.happy_wu_import.database import connection_config, backup, pg_run, load_app, run, OUT
from scripts.happy_wu_import.prepare import build, digest, dump


def main():
    from sqlalchemy import create_engine, text
    _,url=connection_config('ows_happy_wu')
    target=f'ows_happy_wu_import_test_{datetime.now():%Y%m%d%H%M%S}'
    archive=backup(url)
    engine=create_engine(url.set(database='postgres'))
    with engine.connect().execution_options(isolation_level='AUTOCOMMIT') as c:
        c.execute(text(f'CREATE DATABASE "{target}"'))
    pg_run('pg_restore.exe',url.set(database=target),'--exit-on-error','--no-owner',archive)
    # Start the fixture empty even when Happy_Wu already contains imported drafts.
    # This transaction runs ONLY in the newly created, verified test clone.
    test_engine=create_engine(url.set(database=target))
    with test_engine.begin() as c:
        assert c.execute(text('SELECT current_database()')).scalar()==target
        c.execute(text('TRUNCATE blog.studio_projects, blog.contents, blog.tags RESTART IDENTITY CASCADE'))
    report={'database':target,'backup_restore':'passed','checks':[]}
    # Call CLI in separate processes: models and env are intentionally site-bound.
    import subprocess
    def command(action, suffix, expected=0):
        result=subprocess.run([sys.executable,str(ROOT/'scripts/happy_wu_import/database.py'),action,
            '--database',target,'--episodes','EP03,EP14,MINI02,MINI38A,MINI38B',
            '--report',str(OUT/f'test-{suffix}.json')],capture_output=True,text=True)
        assert result.returncode==expected, result.stdout+'\n'+result.stderr
        report['checks'].append(suffix)
        return json.loads((OUT/f'test-{suffix}.json').read_text(encoding='utf-8'))
    first=command('apply','pilot')
    assert all(r['action']=='created' for r in first['results'])
    second=command('apply','repeat')
    assert all(r['action']=='skip' for r in second['results'])
    command('verify','verify')
    app,db,_=load_app(target)
    with app.app_context():
        from core.backend_engine.models import Content,User
        from core.backend_engine.factory import cache
        from flask_jwt_extended import create_access_token
        from packages.studio.models import StudioProject,StudioDocument,StudioSource,StudioRevision
        assert [m.query.count() for m in [StudioProject,StudioDocument,StudioSource,Content,StudioRevision]]==[5,25,5,5,25]
        blog=Content.query.filter_by(slug='podcast-ep03').one()
        original=blog.content
        blog.content += '<p>人工修改，匯入工具不得覆蓋。</p>'
        db.session.commit()
        command('apply','modified-conflict',1)
        command('rollback','modified-rollback-conflict',1)
        assert db.session.get(Content,blog.id).content.endswith('不得覆蓋。</p>')
        # Restore only the test mutation and its original timestamp for rollback check.
        db.session.rollback()
    # Separate clean second clone is unnecessary: restore original body AND timestamp from snapshot.
    with app.app_context():
        from scripts.happy_wu_import.database import state
        project=StudioProject.query.filter_by(slug='happy-wu-ep03').one()
        blog=Content.query.filter_by(slug='podcast-ep03').one()
        doc=StudioDocument.query.filter_by(content_id=blog.id).one()
        blog.content=original
        blog.updated_at=datetime.fromisoformat(doc.attributes['content_synced_at'])
        db.session.commit()
    command('rollback','rollback')
    with app.app_context():
        assert [m.query.count() for m in [StudioProject,StudioDocument,StudioSource,Content,StudioRevision]]==[0,0,0,0,0]
    command('apply','reapply')
    with app.app_context():
        member=User(username='import_test_member',email='import-test@example.invalid',password_hash='not-a-login',role='user',is_active=True)
        inactive=User(username='import_test_inactive',email='import-test-inactive@example.invalid',password_hash='not-a-login',role='editor',is_active=False)
        db.session.add_all([member,inactive]);db.session.flush()
        now=datetime.utcnow()
        past=Content(title='public test',content='public',slug='import-public-test',status='published',published_at=now-timedelta(days=1),author_id=1)
        future=Content(title='scheduled test',content='future',slug='import-future-test',status='published',published_at=now+timedelta(days=1),author_id=1)
        db.session.add_all([past,future]);db.session.commit()
        draft=Content.query.filter_by(slug='podcast-ep03').one()
        tokens={name:create_access_token(identity=str(uid)) for name,uid in [('admin',1),('member',member.id),('inactive',inactive.id)]}
        cache.clear()
        checks=0
        for role in ['admin','anonymous','member','inactive']:
            client=app.test_client()
            if role!='anonymous':
                client.set_cookie(app.config['JWT_ACCESS_COOKIE_NAME'],tokens[role])
            headers={}
            for item in [draft,future]:
                for route in [f'/api/v1/contents/{item.id}',f'/api/v1/contents/slug/{item.slug}']:
                    for query in ['', '?preview=true']:
                        r=client.get(route+query,headers=headers)
                        assert r.status_code==(200 if role=='admin' else 404),(role,route,query,r.status_code,r.json)
                        checks+=1
            for status in ['','draft','published']:
                r=client.get('/api/v1/contents?status='+status,headers=headers)
                assert r.status_code==200,(role,r.json)
                ids={c['id'] for c in r.json['contents']}
                if role!='admin': assert draft.id not in ids and future.id not in ids
                if role=='admin' and status in {'','draft'}: assert draft.id in ids
                checks+=1
            assert client.get('/api/v1/contents/slug/import-public-test',headers=headers).status_code==200
            checks+=1
        report['authorization_checks']=checks
        report['checks'].append('anonymous_member_inactive_preview_list_and_cache')
    dump(OUT/'integration-results.json',report)
    print(json.dumps(report))


if __name__=='__main__':main()
