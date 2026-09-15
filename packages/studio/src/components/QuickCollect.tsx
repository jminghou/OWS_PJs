'use client';

import { useEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { inboxApi } from '../api';
import { btnGhost, btnPrimary, inputCls } from './ui';

export const INBOX_CHANGED_EVENT = 'studio:inbox-changed';

export function notifyInboxChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(INBOX_CHANGED_EVENT));
}

/** 頂列常駐的「＋ 快速收集」：任何頁面都能把一段文字或連結丟進收集箱。 */
export function QuickCollectButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg bg-muted text-foreground hover:bg-accent transition whitespace-nowrap"
      >
        <Plus size={14} /> 快速收集
      </button>
      {open && <QuickCollectDialog onClose={() => setOpen(false)} />}
    </>
  );
}

export function QuickCollectDialog({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { ref.current?.focus(); }, []);

  const save = async () => {
    if (!body.trim()) return;
    setSaving(true);
    try {
      await inboxApi.create({ body: body.trim(), title: title.trim() || undefined });
      notifyInboxChanged();
      setDone(true);
      setTimeout(onClose, 500);
    } catch (e: any) {
      alert(e.message || '儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center pt-[14vh] bg-black/30" onClick={onClose}>
      <div className="w-full max-w-lg bg-card text-card-foreground rounded-xl shadow-xl border border-border p-4 space-y-2" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">快速收集</h3>
          <span className="text-[11px] text-muted-foreground">Ctrl+Enter 儲存 · Esc 關閉</span>
        </div>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="標題（選填）" className={inputCls} />
        <textarea
          ref={ref}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          placeholder="靈感、一句話、貼上的連結…"
          className={`${inputCls} resize-none`}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') save();
            if (e.key === 'Escape') onClose();
          }}
        />
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className={btnGhost}>取消</button>
          <button type="button" onClick={save} disabled={saving || !body.trim()} className={btnPrimary}>
            {done ? '已收進收集箱' : saving ? '儲存中…' : '存到收集箱'}
          </button>
        </div>
      </div>
    </div>
  );
}
