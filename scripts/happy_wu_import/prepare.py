"""Build a deterministic, reviewable plan; no database access."""
from __future__ import annotations

import argparse
import hashlib
import html
import json
import re
import zipfile
from pathlib import Path
from html.parser import HTMLParser

import markdown
import yaml

VERSION = 'happy-wu-import-v1'
PLATFORMS = ['blog', 'facebook', 'instagram', 'threads', 'newsletter']
FILENAMES = ['00_來源對照.md', '01_部落格長文.md', '02_FB長貼文.md',
             '03_IG短貼文.md', '04_Threads超短文.md', '05_電子報.md']
PILOT = {'EP03', 'EP14', 'MINI02', 'MINI38A', 'MINI38B'}


def digest(value):
    if not isinstance(value, bytes):
        value = json.dumps(value, ensure_ascii=False, sort_keys=True, default=str).encode('utf-8')
    return hashlib.sha256(value).hexdigest()


def dump(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2, default=str), encoding='utf-8')


class SafeHTML(HTMLParser):
    """Fail closed on unsupported markup instead of silently losing source content."""
    allowed = {'p', 'br', 'hr', 'h1', 'h2', 'h3', 'strong', 'em', 'blockquote',
               'ul', 'ol', 'li', 'a', 'code', 'pre', 'table', 'thead', 'tbody', 'tr', 'th', 'td'}

    def handle_starttag(self, tag, attrs):
        if tag not in self.allowed:
            raise ValueError(f'Unsupported HTML tag: {tag}')
        for key, value in attrs:
            if key not in {'href', 'title', 'align', 'style', 'start'}:
                raise ValueError(f'Unsupported HTML attribute: {key}')
            if key == 'href' and not re.match(r'^(https?://|mailto:|/|#)', value or ''):
                raise ValueError('Unsupported link protocol')
            if key == 'style' and not re.fullmatch(r'text-align: (left|center|right);?', value or ''):
                raise ValueError('Unsupported inline style')
            if key == 'start' and (tag != 'ol' or not re.fullmatch(r'\d+', value or '')):
                raise ValueError('Invalid ordered list start')


def to_html(body):
    rendered = markdown.markdown(body, extensions=['tables', 'sane_lists'])
    SafeHTML().feed(rendered)
    return rendered


def read_source(path, root):
    raw = path.read_bytes()
    text = raw.decode('utf-8-sig').replace('\r\n', '\n')
    match = re.match(r'^---[ \t]*\n(.*?)\n---[ \t]*\n', text, re.S)
    if not match:
        raise ValueError(f'Missing frontmatter: {path.name}')
    meta = yaml.safe_load(match[1])
    if not isinstance(meta, dict):
        raise ValueError('Frontmatter must be a mapping')
    # Dates must survive JSON round trips identically.
    meta = json.loads(json.dumps(meta, ensure_ascii=False, default=str))
    return {'path': path.relative_to(root).as_posix(), 'sha256': digest(raw),
            'metadata': meta, 'raw': text, 'body': text[match.end():].strip()}


def plain(text):
    return re.sub(r'[*_`]', '', text).strip()


def parse_episode(folder, root):
    key = folder.name.split('_')[0]
    if not re.fullmatch(r'(EP|MINI)\d+[A-Z]?', key):
        raise ValueError(f'Invalid episode key: {key}')
    if set(p.name for p in folder.iterdir()) != set(FILENAMES):
        raise ValueError('Expected exactly the six known source files')
    sources = [read_source(folder / name, root) for name in FILENAMES]
    warnings = ['author_pending', 'category_pending', 'cover_pending', 'podcast_url_pending', 'publication_date_pending']
    docs = []
    content = None
    for platform, source in zip(PLATFORMS, sources[1:]):
        meta, body = source['metadata'], source['body']
        if meta.get('status') != 'draft':
            raise ValueError('Expected draft source; review changed publication intent')
        title = str(meta.get('認領選題') or f'{meta["來源集"]}｜{platform}').strip('〈〉')
        if platform == 'blog':
            h1 = re.findall(r'^# (.+)$', body, re.M)
            if len(h1) != 1:
                raise ValueError('Blog requires exactly one H1')
            title = h1[0].strip()
            body = re.sub(r'^# .+\n*', '', body, count=1, flags=re.M)
            tags_match = re.search(r'^(?:標籤|tags)[：:][ \t]*(.+)$', body, re.M)
            desc_match = re.search(r'^description[：:][ \t]*(.+)$', body, re.M)
            if not tags_match:
                raise ValueError('Missing blog tags')
            tags = list(dict.fromkeys(t.strip() for t in re.split('[、,，]', tags_match[1]) if t.strip()))
            body = re.sub(r'^(?:標籤|tags|description)[：:][ \t]*.+$', '', body, flags=re.M).strip()
            body = re.sub(r'\n+---\s*$', '', body).strip()
            if desc_match:
                summary = desc_match[1].strip()
            else:
                first = re.split(r'\n\s*\n', body)[0]
                summary = plain(first)
                warnings.append('summary_from_opening_review')
            content = {'title': title, 'slug': f'podcast-{key.lower()}', 'summary': summary,
                       'meta_title': title, 'meta_description': summary,
                       'language': 'zh-TW', 'content_type': 'article', 'status': 'draft',
                       'published_at': None, 'tag_names': tags}
        if len(title) > 200:
            raise ValueError('Title exceeds 200 characters')
        rendered = to_html(body) if platform in {'blog', 'newsletter'} else body
        if '{{BLOG_URL}}' in body:
            warnings.append(f'{platform}:blog_url_pending')
        if '<table>' in rendered:
            warnings.append(f'{platform}:table_roundtrip_required')
        docs.append({'platform': platform, 'title': title, 'body': rendered, 'stage': 'write',
                     'source_key': f'happy-wu/{key}/{platform}', 'source': source})
    content['content'] = docs[0]['body']
    return {'episode_key': key, 'source_key': f'happy-wu/{key}',
            'project_title': sources[0]['metadata']['來源集'],
            'project_slug': f'happy-wu-{key.lower()}', 'documents': docs,
            'source': sources[0], 'content': content, 'warnings': warnings,
            'source_hash': digest([s['sha256'] for s in sources])}


def build(root):
    episodes, errors = [], []
    for folder in sorted(root.iterdir()):
        if not folder.is_dir():
            errors.append({'path': folder.name, 'error': 'Unexpected root file'})
            continue
        try:
            episodes.append(parse_episode(folder, root))
        except Exception as exc:
            errors.append({'path': folder.name, 'error': str(exc)})
    keys = [e['source_key'] for e in episodes]
    if len(keys) != len(set(keys)):
        errors.append({'error': 'Duplicate episode keys'})
    return {'version': VERSION, 'source_root': str(root.resolve()), 'episodes': episodes,
            'errors': errors, 'plan_hash': digest(episodes)}


def preview(plan, output):
    esc = html.escape
    nav, pages = [], []
    for episode in plan['episodes']:
        key = episode['episode_key']
        nav.append(f'<a href="#{key}">{key}</a>')
        docs = []
        for doc in episode['documents']:
            body = doc['body'] if doc['platform'] in {'blog', 'newsletter'} else f'<pre>{esc(doc["body"])}</pre>'
            docs.append(f'<details><summary>{esc(doc["platform"])} · {esc(doc["title"])}</summary>{body}</details>')
        pages.append(f'<section id="{key}"><h2>{esc(key)} · {esc(episode["content"]["title"])}</h2>'
                     f'<p>草稿 · /posts/{esc(episode["content"]["slug"])}</p>'
                     f'<p class="notice">待補：正式作者、分類、節目網址、封面與發布日期。</p>'+''.join(docs)+'</section>')
    html_text = '''<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>職場媽媽崩潰啥 · 匯入預覽</title><style>
body{margin:0;background:#faf7f3;color:#302b27;font:17px/1.8 system-ui,sans-serif}main{max-width:960px;margin:auto;padding:32px 24px}
h1{font-size:32px}h2{font-size:25px}nav{display:flex;flex-wrap:wrap;gap:8px}nav a{padding:4px 10px;background:white;border-radius:8px;color:#75513c}
section{background:white;margin:28px 0;padding:28px;border-radius:16px;border:1px solid #e9dfd5}summary{cursor:pointer;padding:15px 0;font-weight:bold}
details{border-top:1px solid #e9dfd5}table{border-collapse:collapse;width:100%;font-size:15px}td,th{border:1px solid #d8cabb;padding:8px;text-align:left}blockquote{border-left:4px solid #bc9568;margin-left:0;padding-left:18px;color:#655344}
pre{white-space:pre-wrap;font:inherit}.notice{color:#8b5a25;font-size:14px}p{overflow-wrap:anywhere}</style><main>
<h1>職場媽媽崩潰啥 · 匯入預覽</h1><p>五種平台文稿均保留為草稿。展開各平台，檢查內容與排版。</p>'''
    output.write_text(html_text+'<nav>'+''.join(nav)+'</nav>'+''.join(pages)+'</main></html>',encoding='utf-8')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', type=Path, default=Path(r'D:\Obsidian\wu_blog\職場媽媽崩潰啥'))
    parser.add_argument('--output', type=Path, default=Path('docs/happy-wu-import/generated'))
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    plan = build(args.source)
    dump(args.output/'import-plan.json', plan)
    dump(args.output/'errors.json', plan['errors'])
    preview(plan, args.output/'all-episodes.html')
    preview({'episodes':[e for e in plan['episodes'] if e['episode_key'] in PILOT]}, args.output/'pilot-preview.html')
    with zipfile.ZipFile(args.output/'source-snapshot.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
        for path in sorted(args.source.rglob('*.md')):
            archive.write(path, path.relative_to(args.source).as_posix())
    print(json.dumps({'episodes':len(plan['episodes']), 'documents':len(plan['episodes'])*5,
                      'errors':len(plan['errors']), 'plan_hash':plan['plan_hash']}))
    return bool(plan['errors'])


if __name__ == '__main__':
    raise SystemExit(main())
