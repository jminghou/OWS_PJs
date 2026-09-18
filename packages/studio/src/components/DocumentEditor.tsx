'use client';

import { useMemo } from 'react';
import { TiptapEditor } from '@ows/admin-app/components/TiptapEditor';
import { NotionTitleInput } from '@ows/ui/admin';
import { PLATFORM_META } from '../constants';
import type { Platform } from '../types';
import { countChars } from './ui';

interface Props {
  platform: Platform;
  title: string;
  body: string;
  onTitleChange: (v: string) => void;
  onBodyChange: (v: string) => void;
}

const SCRIPT_SECTIONS = ['開場鉤子', '主體', '收尾 CTA'];

/**
 * 依平台切換編輯器：
 *   blog / newsletter → TipTap（HTML）
 *   facebook / instagram / threads / linkedin → 純文字 + 字數計
 *   video_script → 純文字，附分段提示
 */
export function DocumentEditor({ platform, title, body, onTitleChange, onBodyChange }: Props) {
  const meta = PLATFORM_META[platform];
  const chars = useMemo(() => countChars(body), [body]);
  const over = meta.maxChars ? chars > meta.maxChars : false;

  // 深色模式：TipTap 與 NotionTitleInput（packages/ui，凍結）是寫死的白底黑字，
  // 所以在深色下把整個編輯區當成一張「白紙」，而不是讓標題消失在深色背景裡。
  return (
    <div className="max-w-3xl mx-auto px-6 py-8 dark:my-6 dark:bg-white dark:text-gray-900 dark:rounded-2xl dark:shadow-lg">
      <NotionTitleInput value={title} onChange={onTitleChange} placeholder={platform === 'newsletter' ? '主旨行' : '無標題'} />
      {meta.hint && <p className="px-14 -mt-2 mb-4 text-xs text-muted-foreground">{meta.hint}</p>}

      {meta.editor === 'rich' ? (
        <TiptapEditor content={body} onChange={onBodyChange} placeholder="輸入 / 開啟指令選單…" />
      ) : (
        <div className="px-14">
          {meta.editor === 'script' && (
            <div className="flex gap-2 mb-2">
              {SCRIPT_SECTIONS.map((s) => (
                <button key={s} type="button"
                  onClick={() => onBodyChange((body ? body.trimEnd() + '\n\n' : '') + `## ${s}\n`)}
                  className="text-xs px-2 py-1 rounded-md bg-muted text-muted-foreground hover:bg-muted">
                  + {s}
                </button>
              ))}
            </div>
          )}
          <textarea
            value={body}
            onChange={(e) => onBodyChange(e.target.value)}
            className={`w-full min-h-[420px] p-4 text-[15px] leading-relaxed text-foreground bg-card border rounded-xl resize-y focus:outline-none focus:ring-2 focus:ring-brand-purple-500/20 ${over ? 'border-destructive' : 'border-border focus:border-brand-purple-300'}`}
            placeholder={meta.editor === 'script' ? '在此撰寫影片腳本…' : `在此撰寫 ${meta.label} 貼文…`}
          />
          <div className={`mt-1 text-xs text-right ${over ? 'text-destructive' : 'text-muted-foreground'}`}>
            {chars.toLocaleString()}{meta.maxChars ? ` / ${meta.maxChars.toLocaleString()}` : ''} 字
          </div>
        </div>
      )}
    </div>
  );
}
