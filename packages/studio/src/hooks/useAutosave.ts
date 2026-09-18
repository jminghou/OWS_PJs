'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { documentApi } from '../api';
import type { Revision } from '../types';

export type AutosaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

interface Options {
  documentId: number | null;
  title: string;
  body: string;
  /** 停止輸入後多久送出（ms） */
  debounceMs?: number;
  /** 有未儲存變更時的心跳上限（ms） */
  heartbeatMs?: number;
  enabled?: boolean;
  onSaved?: (revision: Revision | null, savedAt: string) => void;
}

/**
 * 自動儲存：內容變動 → debounce 2s 送 /autosave；就算一直在打字，最多 30s 也會送一次。
 * 只寫工作草稿與 autosave 版本，不碰 contents（部落格正式版由使用者明確按「儲存到文章」）。
 */
export function useAutosave({
  documentId, title, body, debounceMs = 2000, heartbeatMs = 30000, enabled = true, onSaved,
}: Options) {
  const [status, setStatus] = useState<AutosaveStatus>('idle');
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const lastSavedRef = useRef<string>('');           // JSON 快照，比對是否真的變了
  const pendingRef = useRef<{ title: string; body: string } | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef<Promise<void> | null>(null);
  const onSavedRef = useRef(onSaved);
  onSavedRef.current = onSaved;

  /** 換文件時重置基準，避免把上一份文件的內容送到新文件。 */
  const markClean = useCallback((t: string, b: string) => {
    lastSavedRef.current = JSON.stringify({ t, b });
    pendingRef.current = null;
    setStatus('idle');
    setError(null);
  }, []);

  const flush = useCallback(async () => {
    if (inFlight.current) await inFlight.current;
    if (!documentId) return;
    while (pendingRef.current) {
      const payload = pendingRef.current;
      pendingRef.current = null;
      if (heartbeatTimer.current) { clearTimeout(heartbeatTimer.current); heartbeatTimer.current = null; }
      setStatus('saving');
      const saving = (async () => {
        try {
          const res = await documentApi.autosave(documentId, payload);
          lastSavedRef.current = JSON.stringify({ t: payload.title, b: payload.body });
          setSavedAt(res.saved_at);
          setStatus(pendingRef.current ? 'dirty' : 'saved');
          setError(null);
          onSavedRef.current?.(res.revision, res.saved_at);
        } catch (e: any) {
          pendingRef.current = pendingRef.current ?? payload;
          setStatus('error'); setError(e?.message || '自動儲存失敗');
          throw e;
        }
      })();
      inFlight.current = saving;
      try { await saving; } finally { if (inFlight.current === saving) inFlight.current = null; }
    }
  }, [documentId]);

  useEffect(() => {
    if (!enabled || !documentId) return;
    const snapshot = JSON.stringify({ t: title, b: body });
    if (snapshot === lastSavedRef.current && !inFlight.current) { pendingRef.current = null; return; }
    pendingRef.current = { title, body };
    setStatus('dirty');
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => { void flush().catch(() => {}); }, debounceMs);
    if (!heartbeatTimer.current) {
      heartbeatTimer.current = setTimeout(() => { void flush().catch(() => {}); }, heartbeatMs);
    }
    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
  }, [title, body, documentId, enabled, debounceMs, heartbeatMs, flush]);

  // 離開頁面前提醒（沿用 articles/index.tsx 的做法）
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (pendingRef.current || inFlight.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  useEffect(() => () => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (heartbeatTimer.current) clearTimeout(heartbeatTimer.current);
  }, []);

  return { status, savedAt, error, flush, markClean, isDirty: status === 'dirty' || status === 'saving' };
}
