'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AdminLayout } from '@ows/admin-app';
import { Merge, Pencil, Plus, Tag as TagIcon, Trash2 } from 'lucide-react';
import { tagApi } from '../api';
import { STUDIO_ROUTES } from '../constants';
import type { Card, Document, InboxItem, Project, StudioTag } from '../types';
import { Empty, EmptyState, KindBadge, PageHeader, PlatformBadge, Section, SidebarSearch, StageBadge, StudioPage, StudioSplit, btnDanger, btnGhost, btnPrimary, inputCls } from '../components/ui';

const TYPE_LABEL: Record<string, string> = { project: '專案', document: '文件', card: '卡片', inbox_item: '收集' };

function TagsPageContent() {
  const router = useRouter();
  const params = useSearchParams();
  const selectedId = params.get('id') ? Number(params.get('id')) : null;

  const [tags, setTags] = useState<StudioTag[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<number[]>([]);
  const [newName, setNewName] = useState('');
  const [items, setItems] = useState<{ tag: StudioTag; projects: Project[]; documents: Document[]; cards: Card[]; inbox_items: InboxItem[] } | null>(null);

  const load = useCallback(() => {
    tagApi.list({ with_counts: 1, search: search || undefined }).then((r) => setTags(r.tags));
  }, [search]);
  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [load]);

  useEffect(() => {
    if (!selectedId) { setItems(null); return; }
    tagApi.items(selectedId).then(setItems).catch(() => setItems(null));
  }, [selectedId]);

  const create = async () => {
    if (!newName.trim()) return;
    await tagApi.create(newName.trim());
    setNewName('');
    load();
  };
  const rename = async (tag: StudioTag) => {
    const next = prompt('新名稱', tag.name);
    if (!next?.trim() || next.trim() === tag.name) return;
    try { await tagApi.rename(tag.id, next.trim()); load(); if (selectedId === tag.id) tagApi.items(tag.id).then(setItems); }
    catch (e: any) { alert(e.message || '重新命名失敗'); }
  };
  const remove = async (tag: StudioTag) => {
    if (!confirm(`刪除標籤「${tag.name}」？相關內容不會刪除，只會移除標籤。`)) return;
    await tagApi.delete(tag.id);
    if (selectedId === tag.id) router.push(STUDIO_ROUTES.tags);
    load();
  };
  const merge = async () => {
    if (selected.length < 2) return;
    const chosen = tags.filter((t) => selected.includes(t.id));
    const names = chosen.map((t, i) => `${i + 1}. ${t.name}`).join('\n');
    const pick = prompt(`合併成哪一個？輸入編號：\n${names}`, '1');
    const idx = Number(pick) - 1;
    if (!chosen[idx]) return;
    const target = chosen[idx];
    await tagApi.merge(chosen.filter((t) => t.id !== target.id).map((t) => t.id), target.id);
    setSelected([]);
    load();
    router.push(STUDIO_ROUTES.tag(target.id));
  };

  return (
    <AdminLayout>
      <StudioSplit
        sidebarWidth={320}
        sidebar={
          <div className="flex flex-col h-full">
            <div className="p-3 border-b border-border/60 flex gap-1.5">
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="新標籤" className={`${inputCls} py-1.5`} onKeyDown={(e) => e.key === 'Enter' && create()} />
              <button type="button" onClick={create} disabled={!newName.trim()} className={btnPrimary}><Plus size={14} /></button>
            </div>
            <SidebarSearch value={search} onChange={setSearch} placeholder="搜尋標籤…" />
            <div className="flex items-center gap-2 px-3 pt-2 pb-1 text-xs text-muted-foreground">
              <span>{tags.length} 個標籤</span>
              {selected.length >= 2 && <button type="button" onClick={merge} className="ml-auto inline-flex items-center gap-1 text-admin-accent-600 dark:text-admin-accent-200 hover:underline"><Merge size={12} /> 合併 {selected.length} 個</button>}
              {selected.length === 1 && <span className="ml-auto text-muted-foreground">再勾一個可合併</span>}
            </div>
            <div className="flex-1 overflow-y-auto border-t border-border/60 mt-1">
              {tags.length === 0 ? <Empty text="沒有標籤" /> : tags.map((t) => (
                <div key={t.id} className={`group flex items-center gap-2 px-3 py-2 border-b border-border/40 hover:bg-muted ${selectedId === t.id ? 'bg-admin-accent-50 dark:bg-admin-accent-800/30' : ''}`}>
                  <input type="checkbox" checked={selected.includes(t.id)} onChange={(e) => setSelected((s) => e.target.checked ? [...s, t.id] : s.filter((x) => x !== t.id))} className="rounded border-border" />
                  <button type="button" onClick={() => router.push(STUDIO_ROUTES.tag(t.id))} className="flex-1 text-left text-sm text-foreground truncate">#{t.name}</button>
                  <span className="text-[11px] text-muted-foreground">{t.total ?? 0}</span>
                  <button type="button" onClick={() => rename(t)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground p-0.5" title="重新命名"><Pencil size={12} /></button>
                  <button type="button" onClick={() => remove(t)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-0.5" title="刪除"><Trash2 size={12} /></button>
                </div>
              ))}
            </div>
          </div>
        }
      >
        {items ? (
          <StudioPage width="narrow" className="space-y-4">
            <PageHeader title={`#${items.tag.name}`} description={Object.entries(items.tag.counts || {}).map(([k, n]) => `${TYPE_LABEL[k] || k} ${n}`).join(' · ') || '尚未使用'}
              actions={<><button type="button" onClick={() => rename(items.tag)} className={btnGhost}><Pencil size={14} /> 重新命名</button><button type="button" onClick={() => remove(items.tag)} className={btnDanger}><Trash2 size={14} /></button></>} />
            <Section title={`內容專案 (${items.projects.length})`}>
              {items.projects.length === 0 ? <Empty text="無" /> : <ul className="space-y-1">{items.projects.map((p) => <li key={p.id}><Link href={STUDIO_ROUTES.project(p.id)} className="flex items-center gap-2 text-sm px-2 py-1.5 rounded-lg hover:bg-muted"><span className="flex-1 truncate">{p.title}</span><StageBadge stage={p.stage} /></Link></li>)}</ul>}
            </Section>
            <Section title={`文件 (${items.documents.length})`}>
              {items.documents.length === 0 ? <Empty text="無" /> : <ul className="space-y-1">{items.documents.map((d) => <li key={d.id}><Link href={STUDIO_ROUTES.workspace(d.id)} className="flex items-center gap-2 text-sm px-2 py-1.5 rounded-lg hover:bg-muted"><PlatformBadge platform={d.platform} /><span className="flex-1 truncate">{d.title || '（無標題）'}</span><StageBadge stage={d.stage} /></Link></li>)}</ul>}
            </Section>
            <Section title={`知識卡片 (${items.cards.length})`}>
              {items.cards.length === 0 ? <Empty text="無" /> : <ul className="space-y-1">{items.cards.map((c) => <li key={c.id}><Link href={STUDIO_ROUTES.card(c.id)} className="flex items-center gap-2 text-sm px-2 py-1.5 rounded-lg hover:bg-muted"><KindBadge kind={c.kind} /><span className="flex-1 truncate">{c.title}</span></Link></li>)}</ul>}
            </Section>
            <Section title={`收集箱 (${items.inbox_items.length})`}>
              {items.inbox_items.length === 0 ? <Empty text="無" /> : <ul className="space-y-1">{items.inbox_items.map((i) => <li key={i.id} className="text-sm px-2 py-1.5 text-foreground/80 truncate">{i.title || i.body || i.url}</li>)}</ul>}
            </Section>
          </StudioPage>
        ) : (
          <div className="flex items-center justify-center h-full">
            <EmptyState icon={<TagIcon size={48} />} title="扁平標籤" description="沒有樹狀分類。選一個標籤查看相關內容，勾選多個可合併。" />
          </div>
        )}
      </StudioSplit>
    </AdminLayout>
  );
}

export default function TagsPage() {
  return <Suspense fallback={<div className="p-6">載入中...</div>}><TagsPageContent /></Suspense>;
}
