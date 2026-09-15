'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { AdminLayout } from '@ows/admin-app';
import MediaBrowser from '@ows/admin-app/components/MediaBrowser';
import { Archive, BookOpen, FolderPlus, FolderInput, Image as ImageIcon, Link2, RotateCcw, Trash2 } from 'lucide-react';
import { inboxApi, projectApi } from '../api';
import { useActiveCardKinds } from '../cardKinds';
import type { CardKind, InboxItem, InboxStatus, Project } from '../types';
import { TagChips } from '../components/TagChips';
import { Empty, PageHeader, Pill, StudioPage, btnGhost, btnPrimary, dialogCls, inputCls, relativeTime } from '../components/ui';
import { notifyInboxChanged } from '../components/QuickCollect';

const STATUS_TABS: Array<{ key: InboxStatus | 'all'; label: string }> = [
  { key: 'new', label: '待整理' }, { key: 'organized', label: '已整理' }, { key: 'archived', label: '封存' }, { key: 'all', label: '全部' },
];

function InboxPageContent() {
  const [status, setStatus] = useState<InboxStatus | 'all'>('new');
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [action, setAction] = useState<{ item: InboxItem; kind: 'card' | 'project' | 'new' } | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    inboxApi.list({ status, per_page: 100 }).then((r) => setItems(r.items)).finally(() => setLoading(false));
    notifyInboxChanged();
  }, [status]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { projectApi.list({ per_page: 200 }).then((r) => setProjects(r.projects)).catch(() => {}); }, []);

  const quickSave = async () => {
    if (!text.trim()) return;
    setSaving(true);
    try {
      await inboxApi.create({ body: text.trim(), title: title.trim() || undefined });
      setText(''); setTitle('');
      if (status === 'new' || status === 'all') load();
    } catch (e: any) { alert(e.message || '儲存失敗'); }
    finally { setSaving(false); }
  };

  const saveImage = async (media: { id: number; original_filename?: string }) => {
    setMediaOpen(false);
    await inboxApi.create({ kind: 'image', file_id: media.id, title: media.original_filename });
    load();
  };

  const run = async (fn: () => Promise<unknown>) => {
    try { await fn(); setAction(null); load(); } catch (e: any) { alert(e.message || '操作失敗'); }
  };

  return (
    <AdminLayout>
      <StudioPage>
        <PageHeader title="收集箱" description="先丟進來，之後再整理成知識卡片、加入專案或建新專案。" />

        {/* 快速輸入 */}
        <div className="bg-card border border-border rounded-xl p-3 mb-5">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="標題（選填）"
            className="w-full px-2 py-1 text-sm font-medium outline-none placeholder:text-muted-foreground bg-transparent" />
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3}
            placeholder="貼上靈感、文字或連結…（Ctrl+Enter 儲存）"
            onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') quickSave(); }}
            className="w-full px-2 py-1 text-sm outline-none resize-none placeholder:text-muted-foreground bg-transparent" />
          <div className="flex items-center gap-2 pt-2 border-t border-border/60">
            <button type="button" onClick={() => setMediaOpen(true)} className={`${btnGhost} text-xs py-1`}><ImageIcon size={13} /> 圖片</button>
            <span className="text-[11px] text-muted-foreground">網址會自動辨識為連結</span>
            <button type="button" onClick={quickSave} disabled={saving || !text.trim()} className={`${btnPrimary} ml-auto`}>儲存到收集箱</button>
          </div>
        </div>

        <div className="flex gap-1 mb-3">
          {STATUS_TABS.map((t) => <Pill key={t.key} active={status === t.key} onClick={() => setStatus(t.key)}>{t.label}</Pill>)}
        </div>

        {loading ? <Empty text="載入中…" /> : items.length === 0 ? <Empty text="這裡沒有東西。" /> : (
          <ul className="space-y-2">
            {items.map((item) => (
              <li key={item.id} className="bg-card border border-border rounded-xl p-3">
                <div className="flex items-start gap-3">
                  {item.kind === 'image' && item.file_url && (
                    <img src={item.file_url} alt="" className="w-16 h-16 object-cover rounded-lg flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{item.kind}</span>
                      <span className="text-xs text-muted-foreground">{relativeTime(item.created_at)}</span>
                      {item.status !== 'new' && <span className="text-[10px] px-1.5 rounded bg-muted text-muted-foreground">{item.status === 'organized' ? '已整理' : '封存'}</span>}
                    </div>
                    {item.title && <p className="text-sm font-medium text-foreground mt-0.5">{item.title}</p>}
                    {item.body && <p className="text-sm text-foreground/80 whitespace-pre-wrap mt-0.5">{item.body}</p>}
                    {item.url && (
                      <a href={item.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-admin-accent-600 dark:text-admin-accent-200 hover:underline mt-1 break-all">
                        <Link2 size={11} /> {item.url}
                      </a>
                    )}
                    <div className="mt-2">
                      <TagChips targetType="inbox_item" targetId={item.id} tags={item.tags || []}
                        onChange={(tags) => setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, tags } : i))} />
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1 mt-2 pt-2 border-t border-border/40">
                  {item.status === 'new' ? (
                    <>
                      <button type="button" onClick={() => setAction({ item, kind: 'card' })} className={`${btnGhost} text-xs py-1`}><BookOpen size={12} /> 成為知識卡片</button>
                      <button type="button" onClick={() => setAction({ item, kind: 'project' })} className={`${btnGhost} text-xs py-1`}><FolderInput size={12} /> 加入專案</button>
                      <button type="button" onClick={() => setAction({ item, kind: 'new' })} className={`${btnGhost} text-xs py-1`}><FolderPlus size={12} /> 建立新專案</button>
                      <button type="button" onClick={() => run(() => inboxApi.archive(item.id))} className={`${btnGhost} text-xs py-1`}><Archive size={12} /> 封存</button>
                    </>
                  ) : (
                    <button type="button" onClick={() => run(() => inboxApi.restore(item.id))} className={`${btnGhost} text-xs py-1`}><RotateCcw size={12} /> 回到待整理</button>
                  )}
                  <button type="button" onClick={() => confirm('刪除這則收集？') && run(() => inboxApi.delete(item.id))} className="ml-auto p-1.5 text-muted-foreground hover:text-destructive" title="刪除"><Trash2 size={13} /></button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </StudioPage>

      {mediaOpen && <MediaBrowser isOpen={mediaOpen} onClose={() => setMediaOpen(false)} onSelect={(m) => saveImage(m)} />}

      {action && (
        <ActionDialog action={action} projects={projects} onClose={() => setAction(null)} onDone={() => { setAction(null); load(); }} />
      )}
    </AdminLayout>
  );
}

function ActionDialog({ action, projects, onClose, onDone }: {
  action: { item: InboxItem; kind: 'card' | 'project' | 'new' }; projects: Project[]; onClose: () => void; onDone: () => void;
}) {
  const { item, kind } = action;
  const kinds = useActiveCardKinds();
  const [title, setTitle] = useState(item.title || (item.body || item.url || '').slice(0, 60));
  const [cardKind, setCardKind] = useState<CardKind>(kinds[0]?.key || 'viewpoint');
  const [projectId, setProjectId] = useState<number | ''>(projects[0]?.id ?? '');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      if (kind === 'card') await inboxApi.toCard(item.id, { kind: cardKind, title });
      if (kind === 'project' && projectId) await inboxApi.toProject(item.id, Number(projectId));
      if (kind === 'new') await inboxApi.newProject(item.id, { title });
      onDone();
    } catch (e: any) { alert(e.message || '操作失敗'); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className={`w-full max-w-md ${dialogCls} p-5 space-y-3`} onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-semibold">
          {kind === 'card' ? '整理成知識卡片' : kind === 'project' ? '加入內容專案' : '建立新專案'}
        </h3>
        {kind !== 'project' && (
          <label className="block text-sm">
            <span className="text-muted-foreground">{kind === 'card' ? '卡片標題' : '專案標題'}</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={`${inputCls} mt-1`} autoFocus />
          </label>
        )}
        {kind === 'card' && (
          <label className="block text-sm">
            <span className="text-muted-foreground">類型</span>
            <select value={cardKind} onChange={(e) => setCardKind(e.target.value as CardKind)} className={`${inputCls} mt-1`}>
              {kinds.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
            </select>
          </label>
        )}
        {kind === 'project' && (
          <label className="block text-sm">
            <span className="text-muted-foreground">選擇專案</span>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value ? Number(e.target.value) : '')} className={`${inputCls} mt-1`}>
              {projects.length === 0 && <option value="">（還沒有專案）</option>}
              {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </label>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className={btnGhost}>取消</button>
          <button type="button" onClick={submit} disabled={busy || (kind === 'project' && !projectId) || (kind !== 'project' && !title.trim())} className={btnPrimary}>確定</button>
        </div>
      </div>
    </div>
  );
}

export default function InboxPage() {
  return <Suspense fallback={<div className="p-6">載入中...</div>}><InboxPageContent /></Suspense>;
}
