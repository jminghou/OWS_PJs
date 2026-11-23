'use client';

/**
 * 寫作工作區左欄（同一篇的各平台、各語言版本）的篩選：語言／平台各一排小鈕。
 * 只列這篇實際有的語言與平台，選項不到兩個就不顯示那一排；篩選記在瀏覽器，換篇回來還在。
 * 篩選是嚴格的；正在編輯的那份被篩掉時，在篩選列下方提示一行，避免以為它不見了。
 */
import { useEffect, useMemo, useState } from 'react';
import { PLATFORMS, PLATFORM_META } from '../constants';
import type { Document, Platform } from '../types';
import { PlatformIcon } from './PlatformIcon';
import { LanguageBadge } from './ui';

const FILTER_KEY = 'ows-studio-version-filter';
const LANGUAGE_ORDER = ['zh-TW', 'zh-CN', 'en', 'ja', 'ko', 'es', 'no'];

type Filter = { language: string; platform: string };

const langRank = (l?: string | null) => {
  const i = LANGUAGE_ORDER.indexOf(l || '');
  return i < 0 ? LANGUAGE_ORDER.length : i;
};

export function useVersionFilter(docs: Document[], currentId: number | null) {
  const [filter, setFilter] = useState<Filter>({ language: '', platform: '' });
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(FILTER_KEY) || 'null');
      if (saved) setFilter({ language: saved.language || '', platform: saved.platform || '' });
    } catch { /* 無痕模式等讀不到就用預設 */ }
  }, []);
  const update = (next: Partial<Filter>) => {
    setFilter((f) => {
      const merged = { ...f, ...next };
      try { localStorage.setItem(FILTER_KEY, JSON.stringify(merged)); } catch { /* 存不了就只在這次有效 */ }
      return merged;
    });
  };

  const languages = useMemo(
    () => [...new Set(docs.map((d) => d.language).filter(Boolean) as string[])].sort((a, b) => langRank(a) - langRank(b)),
    [docs],
  );
  const platforms = useMemo(() => PLATFORMS.filter((p) => docs.some((d) => d.platform === p)), [docs]);
  // 記住的篩選在這篇不存在（例如這篇沒有日文）就當作全部
  const language = languages.includes(filter.language) ? filter.language : '';
  const platform = platforms.includes(filter.platform as Platform) ? filter.platform : '';

  const shown = useMemo(
    () => docs
      .filter((d) => (!language || d.language === language) && (!platform || d.platform === platform))
      .sort((a, b) => PLATFORMS.indexOf(a.platform) - PLATFORMS.indexOf(b.platform) || langRank(a.language) - langRank(b.language)),
    [docs, currentId, language, platform],
  );

  const currentHidden = currentId != null && !shown.some((d) => d.id === currentId);

  return { shown, languages, platforms, language, platform, update, currentHidden };
}

const chip = (active: boolean) =>
  `inline-flex items-center justify-center rounded-md p-0.5 transition-colors ${active ? 'ring-2 ring-admin-accent-500' : 'opacity-60 hover:opacity-100'}`;
const allChip = (active: boolean) =>
  `rounded-md px-1.5 py-0.5 text-[11px] transition-colors ${active ? 'bg-admin-accent-600 text-white' : 'text-muted-foreground hover:bg-muted'}`;

export function VersionFilterBar({ total, f }: { total: number; f: ReturnType<typeof useVersionFilter> }) {
  const showLang = f.languages.length > 1;
  const showPlatform = f.platforms.length > 1;
  if (!showLang && !showPlatform) return null;
  return (
    <div className="space-y-1.5 border-b border-border/60 px-3 py-2">
      {showLang && (
        <div className="flex flex-wrap items-center gap-1">
          <span className="w-7 text-[11px] text-muted-foreground">語言</span>
          <button type="button" className={allChip(!f.language)} onClick={() => f.update({ language: '' })}>全部</button>
          {f.languages.map((l) => (
            <button key={l} type="button" className={chip(f.language === l)} onClick={() => f.update({ language: f.language === l ? '' : l })}>
              <LanguageBadge language={l} />
            </button>
          ))}
        </div>
      )}
      {showPlatform && (
        <div className="flex flex-wrap items-center gap-1">
          <span className="w-7 text-[11px] text-muted-foreground">平台</span>
          <button type="button" className={allChip(!f.platform)} onClick={() => f.update({ platform: '' })}>全部</button>
          {f.platforms.map((p) => (
            <button key={p} type="button" title={PLATFORM_META[p].label} aria-label={PLATFORM_META[p].label}
              className={chip(f.platform === p)} onClick={() => f.update({ platform: f.platform === p ? '' : p })}>
              <span className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-md border border-border bg-card">
                <PlatformIcon platform={p} size={13} />
              </span>
            </button>
          ))}
        </div>
      )}
      {(f.language || f.platform) && (
        <p className="text-[11px] text-muted-foreground">顯示 {f.shown.length}／{total} 個版本</p>
      )}
      {f.currentHidden && (
        <p className="text-[11px] text-amber-700 dark:text-amber-300">正在編輯的版本不在篩選結果中</p>
      )}
    </div>
  );
}
