'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bookmark, History, RotateCcw, Tag as TagIcon } from 'lucide-react';
import { documentApi } from '../api';
import type { Document, Revision } from '../types';
import { btnGhost, btnPrimary, formatDate, inputCls, relativeTime, stripHtml } from './ui';

interface Props {
  documentId: number;
  /** 立即快照命名版本時，要送最新編輯內容 */
  current: { title: string; body: string };
  onRestored: (doc: Document) => void;
  refreshKey?: number;
  beforeAction?: () => Promise<void>;
}

const KIND_LABEL: Record<Revision['kind'], string> = { autosave: '自動', named: '命名', published: '正式' };
const KIND_CLS: Record<Revision['kind'], string> = {
  autosave: 'bg-muted text-muted-foreground', named: 'bg-admin-accent-50 dark:bg-admin-accent-800/30 text-admin-accent-700 dark:text-admin-accent-200', published: 'bg-emerald-50 text-emerald-700',
};

export function VersionHistory({ documentId, current, onRestored, refreshKey, beforeAction }: Props) {
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [filter, setFilter] = useState<'all' | 'named'>('all');
  const [label, setLabel] = useState('');
  const [preview, setPreview] = useState<(Revision & { body: string | null }) | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    documentApi.listRevisions(documentId).then((r) => setRevisions(r.revisions)).catch(() => {});
  }, [documentId]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const saveNamed = async () => {
    if (!label.trim()) return;
    setBusy(true);
    try {
      await beforeAction?.();
      await documentApi.createRevision(documentId, { label: label.trim(), title: current.title, body: current.body });
      setLabel('');
      load();
    } catch(e: any) { alert(e.message || "版本操作失敗"); } finally { setBusy(false); }
  };

  const rename = async (rev: Revision) => {
    const next = prompt('版本名稱', rev.label || '');
    if (!next?.trim()) return;
    await documentApi.renameRevision(rev.id, next.trim());
    load();
  };

  const restore = async (rev: Revision) => {
    if (!confirm(`還原到「${rev.label || formatDate(rev.created_at, true)}」？目前內容會先自動備份成一個版本。`)) return;
    setBusy(true);
    try {
      await beforeAction?.();
      const res = await documentApi.restoreRevision(rev.id);
      onRestored(res.document);
      setPreview(null);
      load();
    } catch(e: any) { alert(e.message || "版本操作失敗"); } finally { setBusy(false); }
  };

  const open = async (rev: Revision) => {
    const full = await documentApi.getRevision(rev.id);
    setPreview(full);
  };

  const list = filter === 'all' ? revisions : revisions.filter((r) => r.kind !== 'autosave');

  return (
    <div className="space-y-3">
      <div className="flex gap-1.5">
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="為目前內容命名版本…"
          className={`${inputCls} py-1.5`} onKeyDown={(e) => e.key === 'Enter' && saveNamed()} />
        <button type="button" onClick={saveNamed} disabled={busy || !label.trim()} className={btnPrimary} title="建立命名版本">
          <Bookmark size={14} />
        </button>
      </div>

      <div className="flex gap-1 text-xs">
        {(['all', 'named'] as const).map((f) => (
          <button key={f} type="button" onClick={() => setFilter(f)}
            className={`px-2 py-0.5 rounded ${filter === f ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted'}`}>
            {f === 'all' ? '全部' : '命名與正式'}
          </button>
        ))}
        <span className="ml-auto text-muted-foreground self-center">{list.length} 筆</span>
      </div>

      {list.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">尚無版本。開始編輯後會自動儲存。</p>
      ) : (
        <ul className="space-y-1 max-h-[50vh] overflow-y-auto pr-1">
          {list.map((rev) => (
            <li key={rev.id}
              className={`group rounded-lg border px-2.5 py-2 text-xs cursor-pointer transition ${preview?.id === rev.id ? 'border-admin-accent-500 bg-admin-accent-50/70 dark:bg-admin-accent-800/20' : 'border-border/60 hover:border-border hover:bg-muted'}`}
              onClick={() => open(rev)}>
              <div className="flex items-center gap-1.5">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${KIND_CLS[rev.kind]}`}>{KIND_LABEL[rev.kind]}</span>
                <span className="font-medium text-foreground truncate flex-1">{rev.label || rev.title || '（未命名）'}</span>
                <span className="text-muted-foreground flex-shrink-0" title={formatDate(rev.created_at, true)}>{relativeTime(rev.created_at)}</span>
              </div>
              <div className="flex items-center gap-2 mt-1 text-muted-foreground">
                <span>{rev.body_length.toLocaleString()} 字元</span>
                <span className="ml-auto flex gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button type="button" onClick={(e) => { e.stopPropagation(); rename(rev); }} className="p-1 rounded hover:bg-card hover:text-foreground" title="命名">
                    <TagIcon size={12} />
                  </button>
                  <button type="button" onClick={(e) => { e.stopPropagation(); restore(rev); }} className="p-1 rounded hover:bg-card hover:text-foreground" title="還原">
                    <RotateCcw size={12} />
                  </button>
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {preview && (
        <div className="border border-border rounded-lg bg-card">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border/60 text-xs">
            <History size={12} className="text-muted-foreground" />
            <span className="font-medium text-foreground truncate">{preview.label || preview.title || '版本預覽'}</span>
            <span className="text-muted-foreground">{formatDate(preview.created_at, true)}</span>
            <button type="button" className="ml-auto text-muted-foreground hover:text-foreground" onClick={() => setPreview(null)}>關閉</button>
          </div>
          <div className="px-3 py-2 text-xs text-muted-foreground max-h-48 overflow-y-auto whitespace-pre-wrap">
            {stripHtml(preview.body, 2000) || '（空白）'}
          </div>
          <div className="px-3 py-2 border-t border-border/60">
            <button type="button" onClick={() => restore(preview)} disabled={busy} className={`${btnGhost} text-xs py-1`}>
              <RotateCcw size={12} /> 還原此版本
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
