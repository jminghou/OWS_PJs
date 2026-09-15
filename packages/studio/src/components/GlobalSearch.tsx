'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { searchApi } from '../api';
import { PLATFORM_META, STAGE_META, STUDIO_ROUTES } from '../constants';
import { kindMeta, useCardKinds } from '../cardKinds';
import type { CardKindDef } from '../cardKinds';
import type { SearchResults } from '../types';

interface Hit { key: string; group: string; title: string; meta?: string; snippet?: string; href: string }

const GROUP_LABEL: Record<string, string> = {
  projects: '內容專案', documents: '文件', articles: '文章', revisions: '草稿版本', cards: '知識卡片',
  tags: '標籤', sources: '來源', inbox: '收集箱', files: '附件',
};

function flatten(res: SearchResults | null, kinds: CardKindDef[]): Hit[] {
  if (!res) return [];
  const r = res.results;
  const hits: Hit[] = [];
  r.projects?.forEach((p) => hits.push({ key: `p${p.id}`, group: 'projects', title: p.title, meta: STAGE_META[p.stage]?.label, snippet: p.snippet, href: STUDIO_ROUTES.project(p.id) }));
  r.documents?.forEach((d) => hits.push({ key: `d${d.id}`, group: 'documents', title: d.title || '（無標題）', meta: `${PLATFORM_META[d.platform]?.short} · ${d.project_title}`, snippet: d.snippet, href: STUDIO_ROUTES.workspace(d.id) }));
  r.articles?.forEach((a) => hits.push({ key: `a${a.id}`, group: 'articles', title: a.title, meta: a.status, snippet: a.snippet, href: a.document_id ? STUDIO_ROUTES.workspace(a.document_id) : STUDIO_ROUTES.article(a.id) }));
  r.revisions?.forEach((v) => hits.push({ key: `v${v.id}`, group: 'revisions', title: v.label || v.title || '（未命名版本）', meta: `${v.kind} · ${PLATFORM_META[v.platform]?.short}`, snippet: v.snippet, href: STUDIO_ROUTES.workspace(v.document_id) }));
  r.cards?.forEach((c) => hits.push({ key: `c${c.id}`, group: 'cards', title: c.title, meta: kindMeta(kinds, c.kind).label, snippet: c.snippet, href: STUDIO_ROUTES.card(c.id) }));
  r.tags?.forEach((t) => hits.push({ key: `t${t.id}`, group: 'tags', title: `#${t.name}`, href: STUDIO_ROUTES.tag(t.id) }));
  r.sources?.forEach((s) => hits.push({ key: `s${s.id}`, group: 'sources', title: s.title || s.url || '（來源）', meta: s.project_title, snippet: s.snippet, href: STUDIO_ROUTES.project(s.project_id) }));
  r.inbox?.forEach((i) => hits.push({ key: `i${i.id}`, group: 'inbox', title: i.title || i.snippet || '（收集）', meta: i.status, href: STUDIO_ROUTES.inbox }));
  r.files?.forEach((f) => hits.push({ key: `f${f.id}`, group: 'files', title: f.filename, meta: f.mime_type || undefined, snippet: f.snippet, href: f.public_url }));
  return hits;
}

export function GlobalSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [res, setRes] = useState<SearchResults | null>(null);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) { setTimeout(() => inputRef.current?.focus(), 30); }
    else { setQ(''); setRes(null); setActive(0); }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!q.trim()) { setRes(null); return; }
    setLoading(true);
    const t = setTimeout(() => {
      searchApi.search(q.trim()).then((r) => { setRes(r); setActive(0); }).catch(() => setRes(null)).finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(t);
  }, [q, open]);

  const kinds = useCardKinds();
  const hits = useMemo(() => flatten(res, kinds), [res, kinds]);

  const go = useCallback((hit: Hit) => {
    onClose();
    if (hit.href.startsWith('http')) window.open(hit.href, '_blank');
    else router.push(hit.href);
  }, [onClose, router]);

  if (!open) return null;

  let lastGroup = '';
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[12vh] bg-black/40" onClick={onClose}>
      <div className="w-full max-w-xl bg-card text-card-foreground border border-border rounded-xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-4 border-b border-border/60">
          <Search size={16} className="text-muted-foreground" />
          <input
            ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="搜尋文章、草稿版本、知識卡片、標籤、來源、附件…"
            className="flex-1 py-3 text-sm outline-none bg-transparent placeholder:text-muted-foreground"
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
              if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, hits.length - 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
              if (e.key === 'Enter' && hits[active]) go(hits[active]);
            }}
          />
          <kbd className="text-[10px] text-muted-foreground border border-border rounded px-1">Esc</kbd>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {q && !loading && hits.length === 0 && <p className="p-6 text-sm text-muted-foreground text-center">沒有結果</p>}
          {!q && <p className="p-6 text-xs text-muted-foreground text-center">輸入關鍵字。↑↓ 選擇，Enter 開啟。</p>}
          {hits.map((h, idx) => {
            const showGroup = h.group !== lastGroup;
            lastGroup = h.group;
            return (
              <div key={h.key}>
                {showGroup && <div className="px-4 pt-3 pb-1 text-[11px] font-medium text-muted-foreground">{GROUP_LABEL[h.group]}</div>}
                <button type="button" onMouseEnter={() => setActive(idx)} onClick={() => go(h)}
                  className={`w-full text-left px-4 py-2 ${idx === active ? 'bg-admin-accent-50 dark:bg-admin-accent-800/30' : 'hover:bg-muted'}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-foreground truncate flex-1">{h.title}</span>
                    {h.meta && <span className="text-[11px] text-muted-foreground flex-shrink-0">{h.meta}</span>}
                  </div>
                  {h.snippet && <p className="text-xs text-muted-foreground truncate">{h.snippet}</p>}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** 放進 configureAdminApp({ globalSearch }) 的頂列按鈕，並綁 ⌘K / Ctrl+K。 */
export function StudioSearchButton() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen((o) => !o); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className="group relative flex items-center justify-center w-12 h-12 rounded-lg text-muted-foreground hover:bg-[#32324d] hover:text-white transition-all" title="搜尋 (⌘K)">
        <Search className="w-5 h-5" />
        <span className="absolute left-full ml-3 px-2 py-1 text-sm font-medium text-white bg-gray-900 rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">搜尋 ⌘K</span>
      </button>
      <GlobalSearch open={open} onClose={() => setOpen(false)} />
    </>
  );
}

/** labeled 外殼頂列用：看起來是輸入框，點擊或 ⌘K 開全域搜尋對話框。 */
export function StudioSearchBar() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen((o) => !o); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-2 h-9 px-3 rounded-lg bg-muted text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition text-left"
      >
        <Search size={15} />
        <span className="flex-1 truncate">搜尋文章、知識卡片、舊版本…</span>
        <kbd className="hidden md:inline text-[10px] border border-border rounded px-1 py-0.5 bg-card">⌘K</kbd>
      </button>
      <GlobalSearch open={open} onClose={() => setOpen(false)} />
    </>
  );
}
