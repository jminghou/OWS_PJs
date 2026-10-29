'use client';

/**
 * 模組管理的左欄：篩選（出版品／語言／類型／搜尋）＋兩種檢視。
 *   選了某個出版品（或報告目錄頁）→ 照前台頁面由上到下的位置列出，沒選模組的位置也列出
 *   全部模組／共用中／未使用 → 依類型分組的一行清單
 * 每列的四個小點是繁簡英日各語言版本的狀態。篩選記在瀏覽器（localStorage），換頁回來還在。
 */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Link2, Search } from 'lucide-react';
import type { ModulePage, PageModuleGroup } from '@/lib/api/pageModules';
import { SALES_LANGUAGES } from '@/lib/report/locale';
import { CATALOG_MODULE_KEY, CATALOG_SLOTS, MODULE_TYPES, PRODUCT_SLOTS, type ModuleType } from '@/lib/report/modules';

const FILTER_KEY = 'ows-page-modules-filter';
const DEFAULT_LANGUAGE = 'zh-TW';

type Status = 'active' | 'inactive' | 'stale' | 'missing';
const STATUS_TEXT: Record<Status, string> = { active: '已上線', inactive: '未啟用', stale: '原文已更新', missing: '沒有這個語言' };
const DOT_CLS: Record<Status, string> = {
  active: 'bg-emerald-500',
  inactive: 'bg-muted-foreground/30',
  stale: 'bg-amber-500',
  missing: 'border border-dashed border-muted-foreground/50',
};

const langShort = (code: string) => SALES_LANGUAGES.find((l) => l.code === code)?.short ?? code;

export function moduleStatus(g: PageModuleGroup | undefined, language: string): Status {
  const v = g?.versions.find((x) => x.language === language);
  if (!v) return 'missing';
  if (!v.is_active) return 'inactive';
  return v.translation?.stale ? 'stale' : 'active';
}

/** 被幾個不同的頁面（出版品或目錄頁）使用；超過一個就是共用 */
const pageCount = (g: PageModuleGroup) =>
  new Set(g.used_by.map((u) => (u.kind === 'catalog' ? 'catalog' : u.product_id ?? u.id))).size;

function LangDots({ g }: { g: PageModuleGroup }) {
  return (
    <span className="flex shrink-0 items-center gap-1">
      {SALES_LANGUAGES.map((l) => {
        const s = moduleStatus(g, l.code);
        return <span key={l.code} title={`${l.short}：${STATUS_TEXT[s]}`} className={`h-2 w-2 rounded-full ${DOT_CLS[s]}`} />;
      })}
    </span>
  );
}

type Filter = { pub: string; lang: string; type: ModuleType | '' };

interface Props {
  groups: PageModuleGroup[];
  pages: ModulePage[];
  selectedKey: string | null;
  onSelect: (key: string, language: string) => void;
  /** 語言篩選改了：右邊正在編輯的模組跟著切到那個語言 */
  onLanguageChange: (language: string) => void;
  /** 從出版商品「編輯模組」連過來時，篩選自動帶到那個出版品與語言 */
  deepLink?: { key: string; language: string } | null;
}

export default function ModuleBrowser({ groups, pages, selectedKey, onSelect, onLanguageChange, deepLink }: Props) {
  const [filter, setFilter] = useState<Filter>({ pub: '', lang: '', type: '' });
  const [search, setSearch] = useState('');
  const [closed, setClosed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(FILTER_KEY) || 'null');
      if (saved && typeof saved === 'object') setFilter((f) => ({ ...f, ...saved }));
    } catch { /* 沒有或讀不到就用預設 */ }
  }, []);

  useEffect(() => {
    if (!deepLink) return;
    const g = groups.find((x) => x.module_key === deepLink.key);
    const use = g?.used_by.find((u) => u.language === deepLink.language) ?? g?.used_by[0];
    const pub = deepLink.key === CATALOG_MODULE_KEY || use?.kind === 'catalog' ? 'catalog' : use?.product_id ? `p:${use.product_id}` : '';
    setFilter((f) => ({ ...f, pub, lang: deepLink.language }));
  }, [deepLink, groups]);

  const update = (patch: Partial<Filter>) => {
    const next = { ...filter, ...patch };
    setFilter(next);
    try { window.localStorage.setItem(FILTER_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    if (patch.lang !== undefined) onLanguageChange(patch.lang || DEFAULT_LANGUAGE);
  };

  // 出版品：同一個 product_id 的各語言商品算一個，名稱取繁中版
  const publications = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of pages) {
      if (p.kind !== 'product' || !p.product_id) continue;
      if (!m.has(p.product_id) || p.language === DEFAULT_LANGUAGE) m.set(p.product_id, p.name);
    }
    return [...m.entries()].map(([id, name]) => ({ id, name }));
  }, [pages]);

  const lang = filter.lang || DEFAULT_LANGUAGE;
  const byKey = (key?: string) => (key ? groups.find((g) => g.module_key === key) : undefined);
  const outline = filter.pub === 'catalog' || filter.pub.startsWith('p:');
  // 存著的出版品已經不存在（例如商品被刪）就回到全部
  const pubMissing = filter.pub.startsWith('p:') && !publications.some((p) => `p:${p.id}` === filter.pub);

  const selectCls = 'w-full rounded-md border border-border bg-card px-2 py-1.5 text-xs text-foreground';
  const rowCls = (active: boolean) =>
    `flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors ${
      active ? 'bg-admin-accent-50 text-admin-accent-700 dark:bg-admin-accent-500/15 dark:text-admin-accent-200' : 'text-foreground hover:bg-muted'
    }`;

  const labelText = 'mb-0.5 block text-[11px] text-muted-foreground';
  const typeSelect = (
    <label className="block">
      <span className={labelText}>類型</span>
      <select className={selectCls} value={filter.type} onChange={(e) => update({ type: e.target.value as ModuleType | '' })}>
        <option value="">全部類型</option>
        {MODULE_TYPES.filter((t) => t.type !== 'catalog_page').map((t) => <option key={t.type} value={t.type}>{t.label}</option>)}
      </select>
    </label>
  );
  const pubSelect = (
    <label className="block">
      <span className={labelText}>出版品</span>
      <select className={selectCls} value={pubMissing ? '' : filter.pub} onChange={(e) => update({ pub: e.target.value })}>
        <option value="">全部</option>
        <optgroup label="依頁面檢視">
          {publications.map((p) => <option key={p.id} value={`p:${p.id}`}>{p.name}</option>)}
          <option value="catalog">報告目錄頁</option>
        </optgroup>
        <optgroup label="其他">
          <option value="shared">共用中</option>
          <option value="unused">未使用</option>
        </optgroup>
      </select>
    </label>
  );
  const langSelect = (
    <label className="block">
      <span className={labelText}>語言</span>
      <select className={selectCls} value={filter.lang || (outline ? DEFAULT_LANGUAGE : '')} onChange={(e) => update({ lang: e.target.value })}>
        {!outline && <option value="">全部語言</option>}
        {SALES_LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.short}</option>)}
      </select>
    </label>
  );

  const filters = (
    <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-2">
      {typeSelect}
      <div className="grid grid-cols-2 gap-2">
        {langSelect}
        {pubSelect}
      </div>
      {!outline && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜尋模組名稱"
            className={`${selectCls} pl-7`} />
        </div>
      )}
    </div>
  );

  // ---- 依頁面檢視 ----
  const renderOutline = () => {
    const isCatalog = filter.pub === 'catalog';
    const candidates = pages.filter((p) => (isCatalog ? p.kind === 'catalog' : p.product_id === filter.pub.slice(2)));
    const page = candidates.find((p) => p.language === lang);
    const source = page ?? candidates.find((p) => p.language === DEFAULT_LANGUAGE) ?? candidates[0];
    const refs = source?.refs ?? {};
    const rows = [
      ...(isCatalog ? [{ slot: 'page', type: 'catalog_page' as ModuleType, label: '頁面文字', key: CATALOG_MODULE_KEY }] : []),
      ...(isCatalog ? CATALOG_SLOTS : PRODUCT_SLOTS).map((s) => ({ slot: s.slot, type: s.type, label: s.label, key: refs[s.slot] })),
    ];
    const done = rows.filter((r) => r.key && moduleStatus(byKey(r.key), lang) === 'active').length;
    // 選了類型就只列那個類型的位置（完成數仍算整頁）
    const shown = filter.type ? rows.filter((r) => r.type === filter.type) : rows;

    return (
      <div>
        <div className="flex items-baseline justify-between px-2 pb-1">
          <p className="text-xs font-semibold text-foreground">{isCatalog ? '報告目錄頁' : source?.name ?? '出版品'}・{langShort(lang)}</p>
          <p className={`text-[11px] ${done === rows.length ? 'text-emerald-600' : 'text-muted-foreground'}`}>完成 {done}/{rows.length}</p>
        </div>
        {!page && source && (
          <p className="mx-2 mb-2 rounded bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
            還沒有{langShort(lang)}版{isCatalog ? '目錄頁設定' : '商品'}，以下照{langShort(source.language)}版的選用列出。
          </p>
        )}
        <ol className="space-y-0.5">
          {shown.map((r) => {
            const i = rows.indexOf(r);
            const g = byKey(r.key);
            const s = moduleStatus(g, lang);
            return (
              <li key={r.slot}>
                {g ? (
                  <button type="button" className={rowCls(selectedKey === g.module_key)} onClick={() => onSelect(g.module_key, lang)}>
                    <span className="w-4 shrink-0 text-right text-[11px] text-muted-foreground">{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11px] text-muted-foreground">{r.label}</span>
                      <span className="block truncate">{g.name}</span>
                    </span>
                    {pageCount(g) > 1 && <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label={`共用：${pageCount(g)} 個頁面`} />}
                    <span title={`${langShort(lang)}：${STATUS_TEXT[s]}`} className={`h-2 w-2 shrink-0 rounded-full ${DOT_CLS[s]}`} />
                  </button>
                ) : (
                  <div className="flex items-center gap-2 px-2 py-1.5 text-[13px]">
                    <span className="w-4 shrink-0 text-right text-[11px] text-muted-foreground">{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11px] text-muted-foreground">{r.label}</span>
                      <span className="block text-muted-foreground/70">{r.key ? '（模組已刪除）' : '— 未指定 —'}</span>
                    </span>
                    {!isCatalog && <Link href="/admin/products" className="shrink-0 text-[11px] text-admin-accent-600 hover:underline">去選用</Link>}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
        {!shown.length && <p className="px-2 py-3 text-xs text-muted-foreground">這一頁沒有這個類型的位置</p>}
      </div>
    );
  };

  // ---- 全部模組：依類型分組的一行清單 ----
  const renderLibrary = () => {
    const q = search.trim().toLowerCase();
    const pub = pubMissing ? '' : filter.pub;
    const items = groups.filter((g) =>
      g.type !== 'catalog_page'
      && (!filter.type || g.type === filter.type)
      && (!filter.lang || g.versions.some((v) => v.language === filter.lang))
      && (pub !== 'shared' || pageCount(g) > 1)
      && (pub !== 'unused' || g.used_by.length === 0)
      && (!q || g.name.toLowerCase().includes(q) || g.module_key.includes(q)));
    const catalog = byKey(CATALOG_MODULE_KEY);
    const showCatalog = catalog && !pub && !filter.type && (!q || '報告目錄頁'.includes(q));

    return (
      <div className="space-y-1">
        {showCatalog && (
          <button type="button" className={rowCls(selectedKey === CATALOG_MODULE_KEY)} onClick={() => onSelect(CATALOG_MODULE_KEY, lang)}>
            <span className="min-w-0 flex-1 truncate font-medium">報告目錄頁</span>
            <LangDots g={catalog} />
          </button>
        )}
        {MODULE_TYPES.map((t) => {
          const list = items.filter((g) => g.type === t.type);
          if (!list.length) return null;
          const isClosed = !!closed[t.type];
          return (
            <div key={t.type}>
              <button type="button" onClick={() => setClosed({ ...closed, [t.type]: !isClosed })}
                className="flex w-full items-center gap-1 px-1 pb-0.5 pt-2 text-[11px] font-medium text-muted-foreground hover:text-foreground">
                <ChevronRight className={`h-3 w-3 transition-transform ${isClosed ? '' : 'rotate-90'}`} />
                {t.label}<span className="font-normal">（{list.length}）</span>
              </button>
              {!isClosed && list.map((g) => (
                <button key={g.module_key} type="button" className={rowCls(selectedKey === g.module_key)}
                  onClick={() => onSelect(g.module_key, filter.lang || (g.versions.some((v) => v.language === lang) ? lang : g.versions[0].language))}>
                  <span className="min-w-0 flex-1 truncate">{g.name}</span>
                  <LangDots g={g} />
                  <span className="w-4 shrink-0 text-right text-[11px] text-muted-foreground" title={`${g.used_by.length} 處使用`}>{g.used_by.length || ''}</span>
                </button>
              ))}
            </div>
          );
        })}
        {!items.length && !showCatalog && <p className="px-2 py-3 text-xs text-muted-foreground">沒有符合的模組</p>}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {filters}
      {outline && !pubMissing ? renderOutline() : renderLibrary()}
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border px-1 pt-2 text-[10px] text-muted-foreground">
        {(['active', 'inactive', 'stale', 'missing'] as Status[]).map((s) => (
          <span key={s} className="inline-flex items-center gap-1"><span className={`h-2 w-2 rounded-full ${DOT_CLS[s]}`} />{STATUS_TEXT[s]}</span>
        ))}
        {!outline && <span>點的順序：{SALES_LANGUAGES.map((l) => l.short).join('、')}</span>}
      </p>
    </div>
  );
}
