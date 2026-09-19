'use client';

import type { ReactNode } from 'react';
import { PLATFORM_META, STAGE_META } from '../constants';
import { kindMeta, useCardKinds } from '../cardKinds';
import type { CardKind, Platform, Stage } from '../types';
import { PlatformIcon } from './PlatformIcon';

/*
 * Studio 共用骨架與樣式常數。
 * 一律用 token 類別（bg-card / border-border / text-muted-foreground …），
 * 深色模式由外殼在根節點加 `dark` 切換整組變數，這裡不需要寫 dark: 前綴。
 */

export function StageBadge({ stage, className = '' }: { stage: Stage; className?: string }) {
  const meta = STAGE_META[stage] ?? { label: stage, className: 'bg-muted text-muted-foreground' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${meta.className} ${className}`}>
      {meta.label}
    </span>
  );
}

export function PlatformBadge({ platform, className = '' }: { platform: Platform; className?: string }) {
  const meta = PLATFORM_META[platform] ?? { label: platform, short: platform };
  // 只顯示平台圖示；名稱放在 title / aria-label（滑鼠停留與報讀器都讀得到）
  return (
    <span role="img" aria-label={meta.label} title={meta.label}
      className={`inline-flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-md border border-border bg-card ${className}`}>
      <PlatformIcon platform={platform} size={13} />
    </span>
  );
}

/**
 * 語系徽章：用該語言自己的一個字標示（繁／简／EN／日…），一眼可辨、不佔寬度。
 * 刻意不用國旗 —— 語言不等於國家（zh-TW／zh-CN、en 都會有爭議或歧義），文字字形最不會誤會。
 * 完整語系代碼放在 title / aria-label。
 */
const LANGUAGE_GLYPH: Record<string, { glyph: string; name: string; className: string }> = {
  'zh-TW': { glyph: '繁', name: '繁體中文', className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200' },
  'zh-CN': { glyph: '简', name: '简体中文', className: 'bg-rose-50 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200' },
  en:      { glyph: 'EN', name: 'English', className: 'bg-sky-50 text-sky-700 dark:bg-sky-900/40 dark:text-sky-200' },
  ja:      { glyph: '日', name: '日本語', className: 'bg-violet-50 text-violet-700 dark:bg-violet-900/40 dark:text-violet-200' },
  ko:      { glyph: '한', name: '한국어', className: 'bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200' },
};

export function LanguageBadge({ language, className = '' }: { language?: string | null; className?: string }) {
  if (!language) return null;
  const meta = LANGUAGE_GLYPH[language] ?? LANGUAGE_GLYPH[language.split('-')[0]];
  const glyph = meta?.glyph ?? language.split('-')[0].slice(0, 2).toUpperCase();
  const label = meta ? `${meta.name}（${language}）` : language;
  return (
    <span role="img" aria-label={label} title={label}
      className={`inline-flex h-[22px] min-w-[22px] flex-shrink-0 items-center justify-center rounded-md px-1 text-[11px] font-semibold leading-none ${meta?.className ?? 'bg-muted text-muted-foreground'} ${className}`}>
      {glyph}
    </span>
  );
}

export function KindBadge({ kind, className = '' }: { kind: CardKind; className?: string }) {
  const meta = kindMeta(useCardKinds(), kind);
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${meta.className} ${className}`}>
      {meta.label}
    </span>
  );
}

export const selectCls = 'text-xs border border-border rounded-md px-2 py-1 bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-admin-accent-500';

export function StageSelect({ value, onChange, className = '' }: { value: Stage; onChange: (s: Stage) => void; className?: string }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as Stage)} className={`${selectCls} ${className}`}>
      {(Object.keys(STAGE_META) as Stage[]).map((s) => (
        <option key={s} value={s}>{STAGE_META[s].label}</option>
      ))}
    </select>
  );
}

/** 每頁外層：一致的邊距與最大寬度。 */
export function StudioPage({ children, width = 'default', className = '' }: { children: ReactNode; width?: 'default' | 'wide' | 'narrow'; className?: string }) {
  const max = width === 'wide' ? 'max-w-6xl' : width === 'narrow' ? 'max-w-3xl' : 'max-w-5xl';
  return <div className={`p-6 md:p-8 ${max} mx-auto ${className}`}>{children}</div>;
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
    </div>
  );
}

export function Section({ title, extra, children, className = '' }: { title: string; extra?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`bg-card text-card-foreground border border-border rounded-xl ${className}`}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-[15px] font-semibold">{title}</h2>
        {extra}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Empty({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground py-4 text-center">{text}</p>;
}

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-6">
      {icon && <div className="mb-4 text-muted-foreground/60">{icon}</div>}
      <h3 className="text-lg font-medium">{title}</h3>
      {description && <p className="text-sm text-muted-foreground mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** 左欄清單 + 右主區（取代 @ows/ui 的 AdminListLayout，用 token 色）。 */
export function StudioSplit({ sidebar, sidebarWidth = 300, children }: { sidebar: ReactNode; sidebarWidth?: number; children: ReactNode }) {
  return (
    <div className="flex h-full min-h-0">
      <div className="flex-shrink-0 bg-card border-r border-border overflow-hidden flex flex-col" style={{ width: sidebarWidth }}>
        {sidebar}
      </div>
      <div className="flex-1 min-w-0 overflow-y-auto">{children}</div>
    </div>
  );
}

/** 左欄清單上方的搜尋框。 */
export function SidebarSearch({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="px-3 pt-3">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || '搜尋…'}
        className="w-full px-3 py-1.5 text-sm rounded-md bg-muted text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-admin-accent-500"
      />
    </div>
  );
}

/** 左欄清單裡的一列。 */
export function SidebarItem({ active, onClick, children }: { active?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 border-b border-border/60 transition-colors ${active ? 'bg-admin-accent-50 dark:bg-admin-accent-800/30' : 'hover:bg-muted'}`}
    >
      {children}
    </button>
  );
}

export function Pill({ active, onClick, children, tone = 'dark' }: { active: boolean; onClick: () => void; children: ReactNode; tone?: 'dark' | 'accent' }) {
  const on = tone === 'accent' ? 'bg-admin-accent-600 text-white' : 'bg-foreground text-background';
  return (
    <button type="button" onClick={onClick} className={`px-2 py-0.5 rounded text-xs font-medium transition ${active ? on : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
      {children}
    </button>
  );
}

export function formatDate(value?: string | null, withTime = false): string {
  if (!value) return '';
  const d = new Date(value.endsWith('Z') || value.includes('+') ? value : value + 'Z');
  if (Number.isNaN(d.getTime())) return value;
  const date = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
  if (!withTime) return date;
  return `${date} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function relativeTime(value?: string | null): string {
  if (!value) return '';
  const d = new Date(value.endsWith('Z') || value.includes('+') ? value : value + 'Z');
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return '剛剛';
  if (diff < 3600) return `${Math.floor(diff / 60)} 分鐘前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小時前`;
  if (diff < 86400 * 2) return '昨天';
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} 天前`;
  return formatDate(value);
}

/** 後端存 naive UTC；datetime-local 要台灣時間字串。 */
export function toLocalInput(value?: string | null): string {
  if (!value) return '';
  const d = new Date(value.endsWith('Z') || value.includes('+') ? value : value + 'Z');
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInput(value: string): string | null {
  return value ? `${value}:00` : null;   // 後端 parse_tw_datetime 視無時區字串為台灣時間
}

export function stripHtml(html?: string | null, max = 160): string {
  if (!html) return '';
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return text.length > max ? text.slice(0, max) + '…' : text;
}

export function countChars(text?: string | null): number {
  return (text || '').replace(/<[^>]+>/g, '').replace(/\s/g, '').length;
}

export const inputCls = 'w-full px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-admin-accent-500/30 focus:border-admin-accent-500 transition';
export const btnPrimary = 'inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-admin-accent-600 text-white hover:bg-admin-accent-700 disabled:opacity-50 transition';
export const btnGhost = 'inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-muted text-foreground hover:bg-accent disabled:opacity-50 transition';
export const btnDanger = 'inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg text-destructive hover:bg-destructive/10 disabled:opacity-50 transition';
export const dialogCls = 'bg-card text-card-foreground border border-border rounded-xl shadow-xl';
