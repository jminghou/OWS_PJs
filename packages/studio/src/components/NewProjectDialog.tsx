'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { projectApi } from '../api';
import { STUDIO_ROUTES } from '../constants';
import { btnGhost, btnPrimary, inputCls } from './ui';

interface Props {
  onClose: () => void;
  /** 不給就直接導到新專案頁 */
  onCreated?: (id: number) => void;
}

export function NewProjectDialog({ onClose, onCreated }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [thesis, setThesis] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!title.trim() || busy) return;
    setBusy(true);
    try {
      const res = await projectApi.create({ title: title.trim(), thesis: thesis.trim() || undefined });
      onClose();
      if (onCreated) onCreated(res.id);
      else router.push(STUDIO_ROUTES.project(res.id));
    } catch (e: any) {
      alert(e.message || '建立失敗');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="w-full max-w-md bg-card text-card-foreground border border-border rounded-xl shadow-xl p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-semibold">新內容專案</h3>
        <input
          autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="主題名稱" className={inputCls}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onClose(); }}
        />
        <textarea value={thesis} onChange={(e) => setThesis(e.target.value)} rows={2} placeholder="核心觀點（選填）：這個主題想說的一句話" className={`${inputCls} resize-none`} />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btnGhost}>取消</button>
          <button type="button" disabled={busy || !title.trim()} onClick={submit} className={btnPrimary}>建立</button>
        </div>
      </div>
    </div>
  );
}
