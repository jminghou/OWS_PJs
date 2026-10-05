'use client';

import { useEffect, useState } from 'react';
import { contentApi } from '@ows/platform-api';
import type { Content, HomepageSettings } from '@ows/platform-api/types';
import { getImageUrl } from '../config';

type Wall = NonNullable<HomepageSettings['article_wall']>;
export default function HomepageArticleWall({ value, onChange }: { value: Wall; onChange: (value: Wall) => void }) {
  const [query, setQuery] = useState('');
  const [language, setLanguage] = useState('zh-TW');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [results, setResults] = useState<Content[]>([]);
  const [known, setKnown] = useState<Record<number, Content>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const selectedKey = value.article_ids.join(',');

  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const data = await contentApi.getList({ status: 'published', type: 'article', search: query, page, per_page: 10, language });
        if (!active) return;
        setResults(data.contents);
        setPages(data.pagination.pages);
        setKnown(previous => ({ ...previous, ...Object.fromEntries(data.contents.map(post => [post.id, post])) }));
      } catch {
        if (active) setError('文章載入失敗，請重新搜尋或稍後再試。');
      } finally { if (active) setLoading(false); }
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [query, page, language]);

  useEffect(() => {
    let active = true;
    Promise.allSettled(value.article_ids.map(id => contentApi.getById(id))).then(items => {
      if (!active) return;
      const posts = items.flatMap(item => item.status === 'fulfilled' ? [item.value] : []);
      setKnown(previous => ({ ...previous, ...Object.fromEntries(posts.map(post => [post.id, post])) }));
    });
    return () => { active = false; };
  }, [selectedKey]);

  const move = (index: number, direction: number) => {
    const ids = [...value.article_ids];
    [ids[index], ids[index + direction]] = [ids[index + direction], ids[index]];
    onChange({ ...value, article_ids: ids });
  };
  const control = 'border rounded px-3 py-2 text-sm disabled:opacity-40 disabled:cursor-not-allowed';
  return <div className="space-y-6">
    <fieldset className="flex flex-wrap gap-5"><legend className="font-medium mb-3">文章來源</legend>
      <label><input type="radio" name="wall-mode" checked={value.mode === 'latest'} onChange={() => onChange({ ...value, mode: 'latest' })} /> 最新文章（最多 12 篇）</label>
      <label><input type="radio" name="wall-mode" checked={value.mode === 'manual'} onChange={() => onChange({ ...value, mode: 'manual' })} /> 指定文章與順序</label>
    </fieldset>
    <p className="text-sm text-gray-600">直式縮圖為寬 3：高 4，優先使用文章封面。指定模式最多 24 篇；沒有選取文章時顯示空文章牆。各語系只顯示該語言已發佈、且已到發佈時間的文章。</p>
    {value.mode === 'manual' && <>
      <section className="border rounded-lg p-4 space-y-3"><h2 className="font-semibold">已指定文章（{value.article_ids.length} / 24）</h2>
        {!value.article_ids.length && <p className="text-gray-500 text-sm">請從下方搜尋並加入文章。</p>}
        <ol className="space-y-3">{value.article_ids.map((id, index) => {
          const post = known[id];
          const image = post?.cover_image || post?.featured_image;
          return <li key={id} className="flex flex-wrap items-center gap-3 border-b pb-3">
            <span className="text-gray-500">{index + 1}.</span>
            <div className="w-12 aspect-[3/4] bg-gray-100 overflow-hidden">{image && <img src={getImageUrl(image)} alt="" className="w-full h-full object-cover" />}</div>
            <div className="flex-1 min-w-40"><p>{post?.title || `文章 #${id}（載入中或已無法取得）`}</p><small className="text-gray-500">{post?.language} {post?.status !== 'published' && post ? '・目前不公開顯示' : ''}</small></div>
            <button type="button" className={control} aria-label={`上移文章 ${post?.title || id}`} disabled={index === 0} onClick={() => move(index, -1)}>↑</button>
            <button type="button" className={control} aria-label={`下移文章 ${post?.title || id}`} disabled={index === value.article_ids.length - 1} onClick={() => move(index, 1)}>↓</button>
            <button type="button" className={control} onClick={() => onChange({ ...value, article_ids: value.article_ids.filter(item => item !== id) })}>移除</button>
          </li>;
        })}</ol>
      </section>
      <section className="space-y-3"><label htmlFor="wall-search" className="font-medium block">搜尋已發佈文章</label>
        <label className="block text-sm">文章語言 <select className="border rounded p-2 ml-2" value={language} onChange={e => { setLanguage(e.target.value); setPage(1); }}><option value="zh-TW">繁體中文</option><option value="zh-CN">簡體中文</option><option value="en">English</option><option value="ja">日本語</option></select></label>
        <input id="wall-search" type="search" value={query} onChange={e => { setQuery(e.target.value); setPage(1); }} placeholder="輸入文章標題或關鍵字" className="border rounded px-3 py-2 w-full" />
        {error && <p role="alert" className="text-red-700">{error}</p>}
        {loading ? <p role="status">載入文章中…</p> : <ul className="divide-y">{results.map(post => <li key={post.id} className="flex items-center justify-between gap-4 py-3"><div>{post.title}<small className="block text-gray-500">{post.language}</small></div><button type="button" className={control} disabled={value.article_ids.includes(post.id) || value.article_ids.length >= 24} onClick={() => onChange({ mode: 'manual', article_ids: [...value.article_ids, post.id] })}>{value.article_ids.includes(post.id) ? '已加入' : '加入'}</button></li>)}</ul>}
        {!loading && !error && !results.length && <p>沒有符合的已發佈文章。</p>}
        <div className="flex items-center gap-4"><button type="button" className={control} disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}>上一頁</button><span>{page} / {Math.max(1, pages)}</span><button type="button" className={control} disabled={page >= pages || loading} onClick={() => setPage(page + 1)}>下一頁</button></div>
      </section>
    </>}
    <p className="text-sm text-gray-600">調整完成後，請按右上角「儲存設定」。</p>
  </div>;
}
