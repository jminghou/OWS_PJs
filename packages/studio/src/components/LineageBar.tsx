'use client';

/**
 * 工作區的血緣列：
 * - 衍生版本：顯示「衍生自 主體」，主體改過時提醒，可指定／更換／解除主體
 * - 主體：列出從它散出去的全部版本（平台 × 語言），過期的標示出來
 */

import { GitBranch } from 'lucide-react';
import { documentApi } from '../api';
import { PLATFORM_META, STAGE_META } from '../constants';
import type { Document } from '../types';
import { PlatformIcon } from './PlatformIcon';

export function LineageBar({ doc, disabled, onChanged, onOpen }: {
  doc: Document;
  disabled?: boolean;
  /** 後端回傳更新後的文件 */
  onChanged: (doc: Document) => void;
  /** 切到另一份文件（呼叫端負責先存草稿） */
  onOpen: (id: number) => void;
}) {
  const main = doc.main_document;
  const children = doc.derived_documents || [];
  const isTranslation = !!doc.translation_source_id;
  // 只有原始語言、本身沒有衍生版本的文件可以指定主體
  const canPickMain = !isTranslation && children.length === 0 && (doc.main_candidates?.length || 0) > 0;

  if (!main && children.length === 0 && !canPickMain) return null;

  const setMain = async (value: string) => {
    try {
      const r = await documentApi.setMain(doc.id, value ? Number(value) : null);
      onChanged(r.document);
    } catch (e: any) { alert(e.message || '更新失敗'); }
  };

  const reviewed = async () => {
    try { const r = await documentApi.derivedReviewed(doc.id); onChanged(r.document); }
    catch (e: any) { alert(e.message || '更新失敗'); }
  };

  const label = (d: { platform: Document['platform']; language: string; title: string | null }) =>
    `${PLATFORM_META[d.platform]?.label ?? d.platform}・${d.language}・${d.title || '（無標題）'}`;

  return (
    <div className="border-b text-xs">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-2 sm:px-4 py-2">
        <GitBranch size={13} className="text-muted-foreground" aria-hidden />
        {canPickMain ? (
          <label className="flex items-center gap-1.5">衍生自
            <select aria-label="衍生自哪篇主體" value={doc.derived_from_id ?? ''} disabled={disabled}
              onChange={(e) => setMain(e.target.value)} className="bg-card border rounded p-2 lg:p-1 max-w-[18rem]">
              <option value="">（獨立版本，沒有主體）</option>
              {doc.main_candidates!.map((m) => <option key={m.id} value={m.id}>{label(m)}</option>)}
            </select>
          </label>
        ) : main ? (
          <span>衍生自{isTranslation ? '（經翻譯來源）' : ''}</span>
        ) : null}
        {main && (
          <button type="button" onClick={() => onOpen(main.id)} disabled={disabled}
            className="inline-flex items-center gap-1 text-admin-accent-600 dark:text-admin-accent-200 hover:underline">
            <PlatformIcon platform={main.platform} size={12} />開啟主體：{main.title || '（無標題）'}
          </button>
        )}
        {children.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-muted-foreground">從這篇散出 {children.length} 個版本</span>
            {children.map((c) => (
              <button key={c.id} type="button" onClick={() => onOpen(c.id)} disabled={disabled}
                title={`${label(c)}（${STAGE_META[c.stage]?.label ?? c.stage}）${c.derived_changed ? '・主體已更新，待檢查' : ''}`}
                className={`inline-flex items-center gap-1 rounded border px-1.5 py-1 lg:py-0.5 hover:bg-muted ${c.derived_changed ? 'border-amber-400 text-amber-800 dark:text-amber-200' : 'border-border'}`}>
                <PlatformIcon platform={c.platform} size={11} />{c.language}
                {c.derived_changed && <span aria-label="主體已更新" className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
              </button>
            ))}
          </div>
        )}
      </div>
      {doc.derived_changed && main && (
        <div className="p-3 text-sm bg-amber-50 text-amber-900">
          主體「{main.title || '（無標題）'}」在這個版本上次更新之後又改過，請對照主體檢查內容；已發布的貼文不受影響。
          <button type="button" className="underline ml-2" onClick={() => onOpen(main.id)} disabled={disabled}>開啟主體</button>
          <button type="button" className="underline ml-2" onClick={reviewed} disabled={disabled}>已依主體更新</button>
        </div>
      )}
    </div>
  );
}
