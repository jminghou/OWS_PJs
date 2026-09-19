"""Local Happy_Wu importer: inspect, apply, verify and conservative rollback.

Only the named local database is accepted. No publishing or remote writes.
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from scripts.happy_wu_import.prepare import digest, dump, VERSION

PG_BIN = Path(r'C:\Program Files\PostgreSQL\18\bin')
OUT = ROOT/'docs/happy-wu-import/generated'


def connection_config(database):
    from dotenv import dotenv_values
    from sqlalchemy.engine import make_url
    values = dotenv_values(ROOT/'sites/Happy_Wu/.env')
    url = make_url(values['DATABASE_URL'])
    if url.host not in {'localhost', '127.0.0.1', '::1'} or url.database != 'ows_happy_wu':
        raise ValueError('This importer only accepts the verified local Happy_Wu database')
    if database != 'ows_happy_wu' and not database.startswith('ows_happy_wu_import_test_'):
        raise ValueError('Database must be Happy_Wu or an isolated import test database')
    return values, url.set(database=database)


def pg_run(tool, url, *args):
    env = os.environ.copy()
    env['PGPASSWORD'] = url.password or ''
    command = [str(PG_BIN/tool), '-h', url.host, '-p', str(url.port or 5432),
               '-U', url.username, '-d', url.database, *map(str, args)]
    result = subprocess.run(command, env=env, capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError(f'{tool} failed (exit {result.returncode}); no database mutation will follow')


def backup(url):
    folder = OUT/'backups'
    folder.mkdir(parents=True, exist_ok=True)
    path = folder/f'{url.database}-{datetime.now():%Y%m%d-%H%M%S-%f}.dump'
    pg_run('pg_dump.exe', url, '--format=custom', '--file', path)
    # Verify the archive can at least be read before any write.
    result = subprocess.run([str(PG_BIN/'pg_restore.exe'), '--list', str(path)], capture_output=True)
    if result.returncode or path.stat().st_size == 0:
        raise RuntimeError('Backup archive validation failed')
    return path


def load_app(database):
    values, url = connection_config(database)
    for key, value in values.items():
        if value is not None:
            os.environ[key] = value
    os.environ['DATABASE_URL'] = url.render_as_string(hide_password=False)
    os.environ['FLASK_CONFIG'] = 'development'
    from sites.Happy_Wu.backend.app import app
    from core.backend_engine.factory import db, cache
    app.config['TESTING'] = True
    # Tests and local imports must never hit production revalidation endpoints.
    app.config['FRONTEND_REVALIDATE_URL'] = ''
    app.config['RATELIMIT_ENABLED'] = False
    if database != 'ows_happy_wu':
        # A cloned database must never invalidate the live site's Redis cache.
        app.config['CACHE_TYPE'] = 'SimpleCache'
        cache.init_app(app, config={'CACHE_TYPE': 'SimpleCache'})
    if app.config['SITE_NAME'] != 'Happy_Wu' or not app.config['STUDIO_ENABLED']:
        raise ValueError('Unexpected site configuration')
    from core.backend_engine.models import Content
    if Content.__table__.schema != 'blog':
        raise ValueError('Expected blog schema')
    return app, db, url


def models():
    from core.backend_engine.models import Content, Tag, User
    from packages.studio.models import StudioProject, StudioDocument, StudioSource, StudioRevision
    return Content, Tag, User, StudioProject, StudioDocument, StudioSource, StudioRevision


def find_project(episode):
    _, _, _, Project, *_ = models()
    project = Project.query.filter(Project.attributes['_import']['source_key'].astext == episode['source_key']).all()
    if len(project) > 1:
        raise ValueError('Duplicate source keys already in database')
    return project[0] if project else None


def state(project):
    """Fingerprint persisted rows, including timestamps: edits must not be overwritten."""
    def row(obj):
        data = {c.name:getattr(obj,c.name) for c in obj.__table__.columns}
        if 'attributes' in data:
            data['attributes'] = {k:v for k,v in (data['attributes'] or {}).items() if k != '_import'}
        return data
    docs = project.documents.order_by(models()[4].id).all()
    contents = [d.content for d in docs if d.content]
    # Project updated_at changes when the fingerprint itself is saved.
    p = row(project)
    p.pop('updated_at',None)
    return {'project':p,'documents':[row(d) for d in docs],
            'contents':[dict(row(c),tag_ids=sorted(t.id for t in c.tags)) for c in contents],
            'sources':[row(s) for s in project.sources.order_by(models()[5].id).all()],
            'revisions':[row(r) for d in docs for r in d.revisions.order_by(models()[6].id).all()]}


def classification(episode):
    Content, _, _, Project, *_ = models()
    p = find_project(episode)
    if p:
        info = p.attributes['_import']
        if info.get('episode_plan_hash') != digest(episode) or info.get('version') != VERSION:
            return 'conflict',p,'Source or conversion plan changed'
        if info.get('fingerprint') != digest(state(p)):
            return 'conflict',p,'Imported rows were modified'
        return 'skip',p,''
    if Project.query.filter_by(slug=episode['project_slug']).first() or Content.query.filter_by(slug=episode['content']['slug']).first():
        return 'conflict',None,'Existing slug belongs to another source'
    return 'create',None,''


def create_episode(db, episode, author_id, batch):
    Content, Tag, _, Project, Document, Source, Revision = models()
    info = {'version':VERSION,'batch_id':batch,'source_key':episode['source_key'],
            'source_hash':episode['source_hash'],'episode_plan_hash':digest(episode)}
    project = Project(title=episode['project_title'],slug=episode['project_slug'],stage='write',
                      owner_id=author_id,attributes={'_import':info,'review_pending':episode['warnings']})
    db.session.add(project)
    db.session.flush()
    tag_objects, created_tags = [], []
    for name in episode['content']['tag_names']:
        if len(name)>50:
            raise ValueError('Tag exceeds model limit')
        tag=Tag.query.filter_by(code=name).first()
        if tag is None:
            tag=Tag(code=name,slugs={'zh-TW':name})
            db.session.add(tag)
            db.session.flush()
            created_tags.append(tag.id)
        tag_objects.append(tag)
    values={k:v for k,v in episode['content'].items() if k!='tag_names'}
    content=Content(**values,author_id=author_id,attributes={'_import':info})
    content.tags=tag_objects
    db.session.add(content)
    db.session.flush()
    documents=[]
    for doc in episode['documents']:
        attrs={'source_key':doc['source_key'],'source_path':doc['source']['path'],
               'source_hash':doc['source']['sha256'],'original_metadata':doc['source']['metadata']}
        if doc['platform']=='blog':
            attrs.update(content_synced_at=content.updated_at.isoformat(),content_synced_title=content.title)
        document=Document(project_id=project.id,platform=doc['platform'],title=doc['title'],
                          body=doc['body'],stage='write',attributes=attrs,
                          content_id=content.id if doc['platform']=='blog' else None)
        db.session.add(document)
        db.session.flush()
        revision=Revision(document_id=document.id,kind='named',label='初次匯入',
                          title=document.title,body=document.body,created_by=author_id)
        db.session.add(revision)
        db.session.flush()
        document.current_revision_id=revision.id
        documents.append(document)
    source=Source(project_id=project.id,title=f'{episode["episode_key"]} 來源對照',note=episode['source']['raw'])
    db.session.add(source)
    db.session.flush()
    info.update(created_tag_ids=created_tags,source_id=source.id,source_note_hash=episode['source']['sha256'],
                content_id=content.id,document_ids=[d.id for d in documents])
    # Persist before fingerprinting, then hash exactly what verification reads.
    project.attributes={**project.attributes,'_import':dict(info)}
    db.session.flush()
    info['fingerprint']=digest(state(project))
    project.attributes={**project.attributes,'_import':dict(info)}
    db.session.commit()
    return project


def rollback_episode(db, project):
    Content, Tag, _, _, _, _, _ = models()
    from packages.studio.models import StudioCardRef, StudioTagging
    info=project.attributes['_import']
    if info['fingerprint']!=digest(state(project)):
        raise ValueError('Rollback refused: data changed since import')
    doc_ids=[d.id for d in project.documents.all()]
    related=StudioCardRef.query.filter(
        ((StudioCardRef.target_type=='project') & (StudioCardRef.target_id==project.id)) |
        ((StudioCardRef.target_type=='document') & StudioCardRef.target_id.in_(doc_ids))
    ).count()
    tagged=StudioTagging.query.filter(
        ((StudioTagging.target_type=='project') & (StudioTagging.target_id==project.id)) |
        ((StudioTagging.target_type=='document') & StudioTagging.target_id.in_(doc_ids))
    ).count()
    content=db.session.get(Content,info['content_id'])
    if related or tagged or content.comments.count() or content.translations.count():
        raise ValueError('Rollback refused: new relationships exist')
    tags=info.get('created_tag_ids',[])
    db.session.delete(project)
    db.session.flush()
    db.session.delete(content)
    db.session.flush()
    # Preserve shared tags; leave unused tags for a separately reviewed cleanup.
    db.session.commit()
    return tags


def run(args):
    plan=json.loads(args.plan.read_text(encoding='utf-8'))
    if plan['version']!=VERSION or plan['errors'] or plan['plan_hash']!=digest(plan['episodes']):
        raise ValueError('Invalid or modified plan: run prepare again')
    if any(e['content']['status'] != 'draft' or e['content']['published_at'] is not None
           or any(d['stage'] != 'write' for d in e['documents']) for e in plan['episodes']):
        raise ValueError('This importer only creates unpublished drafts')
    episodes=plan['episodes']
    if args.episodes:
        wanted=set(args.episodes.split(','))
        episodes=[e for e in episodes if e['episode_key'] in wanted]
        if {e['episode_key'] for e in episodes}!=wanted:
            raise ValueError('Unknown episode selection')
    app,db,url=load_app(args.database)
    report={'database':url.database,'plan_hash':plan['plan_hash'],'command':args.command,'results':[]}
    batch=f'{VERSION}-{plan["plan_hash"][:12]}'
    with app.app_context(),db.engine.connect().execution_options(isolation_level='AUTOCOMMIT') as lock:
        from sqlalchemy import text
        if not lock.execute(text('SELECT pg_try_advisory_lock(718043, 6917)')).scalar():
            raise ValueError('Another Happy_Wu import is running')
        try:
            actual=db.session.execute(text('SELECT current_database()')).scalar()
            if actual!=args.database:
                raise ValueError('Database identity mismatch')
            author=db.session.get(models()[2],args.author_id)
            if not author or not author.is_active:
                raise ValueError('Author does not exist or is inactive')
            items=[(e,*classification(e)) for e in episodes]
            conflicts=[{'episode':e['episode_key'],'reason':reason} for e,status,p,reason in items if status=='conflict']
            if conflicts:
                report['conflicts']=conflicts
                dump(args.report,report)
                raise ValueError(f'{len(conflicts)} conflicts; no changes made')
            db.session.rollback()
            if args.command in {'apply','rollback'}:
                report['backup']=str(backup(url))
            for episode,status,project,reason in items:
                if args.command=='apply' and status=='create':
                    project=create_episode(db,episode,args.author_id,batch)
                    action='created'
                elif args.command=='rollback' and status=='skip':
                    rollback_episode(db,project)
                    action='removed'
                elif args.command=='verify' and status!='skip':
                    raise ValueError(f'Missing episode: {episode["episode_key"]}')
                else:
                    action=status
                report['results'].append({'episode':episode['episode_key'],'action':action,
                                           'project_id':project.id if project else None,
                                           'content_id':project.attributes['_import']['content_id'] if project else None})
                dump(args.report,report)
            if args.command in {'apply','rollback'}:
                from core.backend_engine.blueprints.api.utils import invalidate_public_cache
                invalidate_public_cache()
            report['complete']=True
            dump(args.report,report)
        finally:
            db.session.rollback()
            lock.execute(text('SELECT pg_advisory_unlock(718043, 6917)'))
    from collections import Counter
    print(json.dumps({'database':args.database,'command':args.command,'counts':dict(Counter(r['action'] for r in report['results']))}))


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command',choices=['plan','apply','verify','rollback'])
    parser.add_argument('--plan',type=Path,default=OUT/'import-plan.json')
    parser.add_argument('--database',default='ows_happy_wu')
    parser.add_argument('--author-id',type=int,default=1)
    parser.add_argument('--episodes')
    parser.add_argument('--report',type=Path,required=True)
    args=parser.parse_args()
    args.report.parent.mkdir(parents=True,exist_ok=True)
    try:
        run(args)
    except Exception as exc:
        print(f'Import stopped: {type(exc).__name__}: {exc}',file=sys.stderr)
        return 1
    return 0


if __name__=='__main__':
    raise SystemExit(main())
