"""Back up and test Studio language migration on a new local clone only.

--apply-local upgrades Happy_Wu after the clone suite passes, preserving all old fields.
"""
import sys
import json
from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from scripts.happy_wu_import.database import connection_config, backup, pg_run, load_app, OUT
from sqlalchemy import create_engine, text


def snapshot(engine):
    result = {}
    with engine.connect() as c:
        for table in ['studio_projects','studio_documents','studio_revisions','studio_sources','contents','content_tags']:
            rows = c.execute(text(f'SELECT * FROM blog.{table}')).mappings().all()
            result[table] = sorted([json.dumps({k:v for k,v in r.items() if k not in
                {'work_id','language','translation_source_id','source_fingerprint'} or table != 'studio_documents'},
                default=str,sort_keys=True,ensure_ascii=False) for r in rows])
    return result


def main():
    _, url = connection_config('ows_happy_wu')
    archive = backup(url)
    target = f'ows_happy_wu_import_test_languages_{datetime.now():%Y%m%d%H%M%S}'
    with create_engine(url.set(database='postgres')).connect().execution_options(isolation_level='AUTOCOMMIT') as c:
        c.execute(text(f'CREATE DATABASE "{target}"'))
    pg_run('pg_restore.exe',url.set(database=target),'--exit-on-error','--no-owner',archive)
    engine = create_engine(url.set(database=target))
    before = snapshot(engine)
    app,db,_ = load_app(target)
    app.config['JWT_COOKIE_CSRF_PROTECT'] = False
    from flask_migrate import upgrade
    from flask_jwt_extended import create_access_token
    from core.backend_engine.models import Content, Setting
    from core.backend_engine.factory import cache
    from packages.studio.models import StudioDocument
    with app.app_context():
        upgrade(directory=str(ROOT/'packages/studio/migrations'))
        assert snapshot(engine)==before, 'Migration modified pre-existing data'
        token=create_access_token(identity='1')
        for key,value in [('i18n_enabled','true'),('i18n_languages','zh-TW,en,ja')]:
            setting=Setting.query.filter_by(key=key).first()
            if setting: setting.value=value
            else: db.session.add(Setting(key=key,value=value))
        db.session.commit()
    client=app.test_client(); client.set_cookie(app.config['JWT_ACCESS_COOKIE_NAME'],token)
    checks=[]
    def call(method,path,data=None,expected=200):
        r=getattr(client,method)('/api/v1/studio'+path,json=data)
        assert r.status_code==expected,(method,path,r.status_code,r.json)
        return r.json
    options=call('get','/editor-options');assert 'en' in options['languages']
    p=call('post','/projects',{'title':'Language integration fixture'},201)['id']
    source=call('post',f'/projects/{p}/documents',{'platform':'blog','title':'Original','body':'<p>Original</p>'},201)['document']
    sid=source['id']
    other=call('post',f'/projects/{p}/documents',{'platform':'blog','title':'Another work'},201)['document']
    assert other['work_id']!=source['work_id']
    tr=call('post',f'/documents/{sid}/translations',{'language':'en','mode':'copy'},201)['document'];tid=tr['id']
    assert tr['work_id']==source['work_id'] and tr['language']=='en'
    call('post',f'/documents/{sid}/translations',{'language':'en'},409)
    call('post',f'/documents/{sid}/translations',{'language':'de'},422)
    ja=call('post',f'/documents/{tid}/translations',{'language':'ja','mode':'blank'},201)['document']
    assert not ja['body']
    with app.app_context():
        assert db.session.get(Content,ja['content_id']).original_id==source['content_id']
    call('post',f'/documents/{tid}/sync-to-content',{'mode':'publish'},422)
    call('post',f'/documents/{tid}/autosave',{'title':'English','body':'<p>Translation</p>'})
    call('post',f'/documents/{tid}/translation-reviewed')
    call('post',f'/documents/{sid}/sync-to-content',{'mode':'publish'})
    call('post',f'/documents/{tid}/sync-to-content',{'mode':'publish'})
    checks.append('independent_works_languages_canonical_root_duplicates_review')
    settings=call('get',f'/documents/{tid}')['article_settings'];settings['summary']='Changed draft summary'
    call('put',f'/documents/{tid}/article-settings',settings)
    call('post',f'/documents/{tid}/autosave',{'body':'<p>Unpublished edit</p>'})
    with app.app_context():
        c=db.session.get(Content,tr['content_id']);assert c.content=='<p>Translation</p>' and c.summary!='Changed draft summary'
    call('post',f'/documents/{tid}/sync-to-content',{'mode':'save'},409)
    call('put',f'/documents/{tid}/publishing',{'stage':'published'},409)
    call('put',f'/documents/{tid}',{'stage':'published'},422)
    call('post',f'/documents/{sid}/autosave',{'body':'<p>Source changed</p>'})
    assert call('get',f'/documents/{tid}')['source_changed']
    call('post',f'/documents/{tid}/translation-reviewed')
    assert not call('get',f'/documents/{tid}')['source_changed']
    call('post',f'/documents/{tid}/sync-to-content',{'mode':'schedule','published_at':(datetime.utcnow()+timedelta(days=1)).isoformat()+'Z'})
    anon=app.test_client()
    with app.app_context(): cache.clear()
    public=anon.get(f'/api/v1/contents/{source["content_id"]}');assert public.status_code==200,public.json
    payload=public.json
    if 'content' in payload and isinstance(payload['content'],dict): payload=payload['content']
    assert 'en' not in payload.get('available_languages',[]) and not payload.get('translations'),payload
    assert anon.get(f'/api/v1/contents/{tr["content_id"]}?preview=true').status_code==404
    call('post',f'/documents/{tid}/sync-to-content',{'mode':'unpublish'})
    with app.app_context(): assert db.session.get(Content,source['content_id']).status=='published'
    checks.append('draft_settings_isolation_source_changes_schedule_public_visibility_unpublish')
    with patch('core.backend_engine.services.rbac.RBACService.has_any_permission',side_effect=lambda uid,perms:'studio.write' in perms):
        call('post',f'/documents/{tid}/sync-to-content',{'mode':'publish'},403)
    checks.append('publication_permission')
    with app.app_context():
        legacy=Content(title='Legacy',content='<p>Legacy</p>',slug='studio-legacy-test',language='zh-TW',status='draft',author_id=1)
        db.session.add(legacy);db.session.flush()
        legacy_id=legacy.id
        child=Content(title='Legacy EN',content='EN',slug='studio-legacy-test-en',language='en',original_id=legacy.id,status='draft',author_id=1)
        db.session.add(child);db.session.flush()
        third=Content(title='Legacy JA',content='JA',slug='studio-legacy-test-ja',language='ja',original_id=child.id,status='draft',author_id=1)
        db.session.add(third);db.session.commit();third_id=third.id
    adopted=call('post',f'/articles/{third_id}/adopt')['document']
    assert len(adopted['language_versions'])==3
    assert call('post',f'/articles/{third_id}/adopt')['id']==adopted['id']
    with app.app_context():
        assert db.session.get(Content,third_id).original_id==legacy_id
        assert db.session.get(Content,legacy_id).slug=='studio-legacy-test'
    checks.append('legacy_adoption_idempotence_and_nested_family')
    social=call('post',f'/projects/{p}/documents',{'platform':'facebook','language':'en','title':'Social','body':'Social draft'},201)['document']
    social_ja=call('post',f'/documents/{social["id"]}/translations',{'language':'ja','mode':'copy'},201)['document']
    assert social_ja['content_id'] is None and social_ja['language']=='ja'
    revision=call('post',f'/documents/{social_ja["id"]}/revisions',{'label':'Japanese checkpoint','body':'JA version'},201)['revision']
    call('post',f'/documents/{social_ja["id"]}/autosave',{'body':'Later JA'})
    call('post',f'/revisions/{revision["id"]}/restore')
    assert call('get',f'/documents/{social["id"]}')['body']=='Social draft'
    assert call('get',f'/documents/{social_ja["id"]}')['body']=='JA version'
    with app.app_context():
        Setting.query.filter_by(key='i18n_enabled').one().value='false';db.session.commit()
    call('post',f'/documents/{other["id"]}/translations',{'language':'en'},422)
    assert call('get',f'/documents/{tid}')['language']=='en'
    with app.app_context():
        from core.backend_engine.models import User
        inactive=User(username='studio-inactive',email='studio-inactive@example.invalid',password_hash='not-a-login',role='admin',is_active=False)
        db.session.add(inactive);db.session.commit();inactive_token=create_access_token(identity=str(inactive.id))
    inactive_client=app.test_client();inactive_client.set_cookie(app.config['JWT_ACCESS_COOKIE_NAME'],inactive_token)
    assert inactive_client.get('/api/v1/studio/editor-options').status_code==403
    checks.append('social_translation_revision_isolation_disabled_language_inactive_account')
    report={'database':target,'backup':str(archive),'preserved_rows':{k:len(v) for k,v in before.items()},'checks':checks}
    (OUT/'studio-language-tests.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps(report))
    if '--apply-local' in sys.argv:
        # Separate process is required: model/schema and app config are site-bound.
        import subprocess
        result=subprocess.run([sys.executable,str(Path(__file__)),'--migrate-local-only'],check=True)


def migrate_local():
    from flask_migrate import upgrade
    _,url=connection_config('ows_happy_wu')
    archive=backup(url);engine=create_engine(url);before=snapshot(engine)
    app,db,_=load_app('ows_happy_wu')
    with app.app_context(): upgrade(directory=str(ROOT/'packages/studio/migrations'))
    assert snapshot(engine)==before,'Existing data changed'
    report={'backup':str(archive),'preserved_rows':{k:len(v) for k,v in before.items()},'migration':'0003_studio_languages'}
    (OUT/'studio-language-migration.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps(report))


if __name__=='__main__':
    if '--migrate-local-only' in sys.argv: migrate_local()
    else: main()
