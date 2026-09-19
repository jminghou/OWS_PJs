"""Read-only source audit; writes inventories beside this script, never to the vault."""
from pathlib import Path
from collections import Counter
import csv
import hashlib
import json
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')
SOURCE = Path(r'D:\Obsidian\wu_blog\職場媽媽崩潰啥')
OUT = Path(__file__).parent
rows = []
keys = Counter()
for path in sorted(SOURCE.rglob('*.md')):
    raw = path.read_bytes()
    text = raw.decode('utf-8-sig').replace('\r\n', '\n')
    match = re.match(r'^---\s*\n(.*?)\n---\s*\n', text, re.S)
    # Inventory only: current metadata consists of scalar lines; importer must use YAML.
    meta = dict(re.findall(r'^([^:\n]+):[ \t]*(.*)$', match[1], re.M)) if match else {}
    body = text[match.end():] if match else text
    keys.update(meta.keys())
    headings = re.findall(r'^# (.+)$', body, re.M)
    rows.append(dict(
        path=str(path.relative_to(SOURCE)), episode=path.parent.name.split('_')[0],
        filename=path.name, metadata=meta, title=headings[0] if headings else '',
        h1_count=len(headings), status=meta.get('status'), sha256=hashlib.sha256(raw).hexdigest(),
        chars=len(text), placeholders=re.findall(r'\{\{[^}]+\}\}', text),
        tags=re.findall(r'^(?:標籤|tags)[：:][ \t]*(.+)$', body, re.M),
        description=re.findall(r'^description[：:][ \t]*(.+)$', body, re.M),
        table=bool(re.search(r'^\|', body, re.M)),
        deep_headings=bool(re.search(r'^#{4,6} ', body, re.M)),
        wiki_links=bool(re.search(r'!?\[\[', body)),
        image=bool(re.search(r'!\[', body)), urls=re.findall(r'https?://[^\s)>]+', body),
    ))
blogs = [r for r in rows if r['filename'].startswith('01_')]
summary = dict(
    source=str(SOURCE), episode_count=len({r['episode'] for r in rows}),
    ep_count=len({r['episode'] for r in rows if r['episode'].startswith('EP')}),
    mini_count=len({r['episode'] for r in rows if r['episode'].startswith('MINI')}),
    file_count=len(rows), filenames=dict(Counter(r['filename'] for r in rows)),
    metadata_keys=dict(keys), statuses=dict(Counter(r['status'] or '(missing)' for r in rows)),
    placeholders=dict(Counter(p for r in rows for p in r['placeholders'])),
    placeholder_files=sum(bool(r['placeholders']) for r in rows),
    blog_count=len(blogs), blog_tables=[r['path'] for r in blogs if r['table']],
    all_table_files=[r['path'] for r in rows if r['table']],
    blog_missing_title=[r['path'] for r in blogs if r['h1_count'] != 1],
    blog_missing_tags=[r['path'] for r in blogs if not r['tags']],
    blog_descriptions=sum(bool(r['description']) for r in blogs),
    blog_placeholders=dict(Counter(p for r in blogs for p in r['placeholders'])),
    files_with_urls=sum(bool(r['urls']) for r in rows),
    files_with_images=sum(r['image'] for r in rows),
    files_with_wiki_links=sum(r['wiki_links'] for r in rows),
    deep_headings=[r['path'] for r in rows if r['deep_headings']],
    duplicate_hashes=[h for h,n in Counter(r['sha256'] for r in rows).items() if n > 1],
)
(OUT / 'source-inventory.json').write_text(json.dumps({'summary': summary, 'files': rows}, ensure_ascii=False, indent=2), encoding='utf-8')
with (OUT / 'episode-manifest.csv').open('w', encoding='utf-8-sig', newline='') as stream:
    writer = csv.writer(stream)
    writer.writerow(['episode_key','source_folder','article_title','proposed_slug','tags','podcast_url','article_publish_at','author_id','category_code','cover_url','status'])
    for row in blogs:
        writer.writerow([row['episode'],str(Path(row['path']).parent),row['title'],'podcast-'+row['episode'].lower(),' / '.join(row['tags']),'','','','','','draft'])
print(json.dumps(summary,ensure_ascii=False,indent=2))
