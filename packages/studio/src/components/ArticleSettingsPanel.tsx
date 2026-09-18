'use client';
import { useState } from 'react';
import MediaBrowser from '@ows/admin-app/components/MediaBrowser';
import type { ArticleSettings, EditorOptions } from '../types';
import { inputCls, selectCls, btnGhost } from './ui';

export function ArticleSettingsPanel({value, options, onChange}: {
  value: ArticleSettings; options: EditorOptions; onChange: (value: ArticleSettings) => void;
}) {
  const [picking, setPicking] = useState<'cover_image' | 'featured_image' | null>(null);
  const textFields = [['slug','網址代稱'],['summary','摘要'],['meta_title','SEO 標題'],['meta_description','SEO 描述'],['featured_image','列表圖片'],['cover_image','文章封面']] as const;
  return <section className="p-4 border-b space-y-3 bg-muted/30">
    <p className="text-sm">本語言的文章設定。儲存草稿後，按發布才會更新網站。</p>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {textFields.map(([key,label]) => <label key={key} className="text-xs space-y-1">{label}
        <input className={inputCls} value={value[key] || ''} onChange={e => onChange({...value,[key]:e.target.value})} />
        {(key==='cover_image' || key==='featured_image') && <button type="button" className={btnGhost} onClick={() => setPicking(key)}>從媒體庫選擇</button>}
      </label>)}
      {(['author_id','category_id'] as const).map(key => <label key={key} className="text-xs">{key==='author_id'?'作者':'分類'}
        <select className={`${selectCls} w-full`} value={value[key] ?? ''} onChange={e => onChange({...value,[key]:e.target.value?Number(e.target.value):null})}>
          <option value="">未指定</option>{(key==='author_id'?options.authors:options.categories).map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select></label>)}
    </div>
    <fieldset><legend className="text-xs mb-2">網站標籤</legend><div className="max-h-28 overflow-auto flex flex-wrap gap-3">{options.tags.map(t => <label key={t.id} className="text-xs"><input type="checkbox" checked={value.tag_ids.includes(t.id)} onChange={e => onChange({...value,tag_ids:e.target.checked?[...value.tag_ids,t.id]:value.tag_ids.filter(id=>id!==t.id)})} /> {t.name}</label>)}</div></fieldset>
    <MediaBrowser isOpen={!!picking} onClose={() => setPicking(null)} onSelect={media => { if(picking) onChange({...value,[picking]:media.file_path}); setPicking(null); }} />
  </section>;
}
