'use client';

/**
 * 文章設定（右側抽屜）。
 *
 * 分成四組，由上到下是「發文時最常要動的」到「幾乎不用動的」：
 *   圖片 → 基本資料 → 網站標籤 → SEO（預設收合）。
 *
 * 兩張圖的實際用途（以前台程式為準，別再標反）：
 *   featured_image  文章主圖 16:9 —— 單篇文章頁頂端大圖、社群分享預覽圖（Open Graph）。
 *   cover_image     列表縮圖 3:4 —— 文章卡片優先用它；沒設就退回 featured_image（見 site-kit PostCard）。
 *                   比例是強制的：選到不是 3:4 的圖會先進裁切對話框，裁好另存新圖才會套用。
 * 所以只想設一張圖時，設「文章主圖」就三個地方都有。
 */
import { useMemo, useState, type ReactNode } from 'react';
import { ChevronDown, Image as ImageIcon, Search, X } from 'lucide-react';
import { getAdminConfig } from '@ows/admin-app';
import MediaBrowser from '@ows/admin-app/components/MediaBrowser';
import ImageCropDialog from '@ows/admin-app/components/ImageCropDialog';
import type { MediaItem } from '@ows/platform-api/strapi';
import { COVER_ASPECT } from '../constants';
import type { ArticleSettings, EditorOptions } from '../types';
import { inputCls, selectCls } from './ui';

type ImageKey = 'featured_image' | 'cover_image';

interface Props {
  value: ArticleSettings;
  options: EditorOptions;
  onChange: (value: ArticleSettings) => void;
  onClose: () => void;
  /** 有尚未「儲存草稿」的設定變更 */
  dirty?: boolean;
}

const labelCls = 'block text-xs font-medium text-foreground mb-1';
const hintCls = 'text-[11px] leading-4 text-muted-foreground';
const miniBtn = 'text-xs px-2 py-1 rounded-md border border-border bg-card hover:bg-muted transition';

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="px-4 py-4 border-b border-border/60 space-y-3">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

function Counter({ text, max }: { text: string; max: number }) {
  const n = text.length;
  return <span className={`${hintCls} ${n > max ? 'text-amber-600' : ''}`}>{n} / {max}</span>;
}

function ImageField({ label, hint, ratio, path, fallbackPath, onPick, onClear }: {
  label: string; hint: string; ratio: '16 / 9' | '3 / 4';
  path: string | null; fallbackPath?: string | null; onPick: () => void; onClear: () => void;
}) {
  const { getImageUrl } = getAdminConfig();
  const shown = path || fallbackPath || null;
  const inherited = !path && !!fallbackPath;
  return (
    <div className="flex gap-3">
      <button type="button" onClick={onPick} title={path ? '更換圖片' : '從媒體庫選擇'}
        style={{ aspectRatio: ratio }}
        className={`relative flex-shrink-0 overflow-hidden rounded-lg border border-dashed border-border bg-muted/50 hover:border-admin-accent-500 transition ${ratio === '3 / 4' ? 'w-20' : 'w-32'}`}>
        {shown
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={getImageUrl(shown)} alt="" className={`absolute inset-0 w-full h-full object-cover ${inherited ? 'opacity-40' : ''}`} />
          : <span className="absolute inset-0 flex items-center justify-center text-muted-foreground"><ImageIcon size={18} /></span>}
        {inherited && <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 text-[10px] text-white">沿用主圖</span>}
      </button>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-foreground">{label}</p>
        <p className={`${hintCls} mt-0.5`}>{hint}</p>
        <div className="mt-2 flex gap-1.5">
          <button type="button" className={miniBtn} onClick={onPick}>{path ? '更換' : '選擇圖片'}</button>
          {path && <button type="button" className={`${miniBtn} text-destructive`} onClick={onClear}>移除</button>}
        </div>
      </div>
    </div>
  );
}

function TagPicker({ all, selected, onChange }: {
  all: { id: number; name: string }[]; selected: number[]; onChange: (ids: number[]) => void;
}) {
  const [query, setQuery] = useState('');
  const chosen = useMemo(
    () => selected.map((id) => all.find((t) => t.id === id)).filter(Boolean) as { id: number; name: string }[],
    [all, selected],
  );
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return all.filter((t) => !selected.includes(t.id) && t.name.toLowerCase().includes(q)).slice(0, 8);
  }, [all, selected, query]);

  const add = (id: number) => { onChange([...selected, id]); setQuery(''); };

  return (
    <div className="space-y-2">
      {chosen.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {chosen.map((t) => (
            <span key={t.id} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs text-foreground">
              {t.name}
              <button type="button" aria-label={`移除 ${t.name}`} onClick={() => onChange(selected.filter((id) => id !== t.id))}
                className="text-muted-foreground hover:text-foreground"><X size={11} /></button>
            </span>
          ))}
        </div>
      ) : <p className={hintCls}>尚未選擇標籤。</p>}
      <div className="relative">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input className={`${inputCls} pl-8`} value={query} placeholder={`搜尋 ${all.length} 個網站標籤…`}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && matches[0]) { e.preventDefault(); add(matches[0].id); } }} />
      </div>
      {query.trim() && (
        matches.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {matches.map((t) => (
              <button key={t.id} type="button" onClick={() => add(t.id)}
                className="rounded-md border border-border px-2 py-1 text-xs hover:border-admin-accent-500 hover:bg-muted transition">+ {t.name}</button>
            ))}
          </div>
        ) : <p className={hintCls}>找不到符合的標籤。新標籤請到「網站管理 › 分類標籤」建立。</p>
      )}
    </div>
  );
}

export function ArticleSettingsPanel({ value, options, onChange, onClose, dirty }: Props) {
  const [picking, setPicking] = useState<ImageKey | null>(null);
  const [cropping, setCropping] = useState<MediaItem | null>(null);
  const [seoOpen, setSeoOpen] = useState(!!(value.meta_title || value.meta_description));
  const set = <K extends keyof ArticleSettings>(key: K, v: ArticleSettings[K]) => onChange({ ...value, [key]: v });

  return (
    <aside className="w-[360px] flex-shrink-0 border-l border-border bg-card flex flex-col h-full">
      <header className="flex items-center gap-2 px-4 h-12 border-b border-border/60 flex-shrink-0">
        <h2 className="text-sm font-semibold text-foreground">文章設定</h2>
        {dirty && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">未儲存</span>}
        <button type="button" onClick={onClose} title="關閉" className="ml-auto p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted"><X size={15} /></button>
      </header>

      <div className="flex-1 overflow-y-auto">
        <Group title="圖片">
          <ImageField label="文章主圖" ratio="16 / 9" hint="16:9 橫圖。用在文章頁頂端與社群分享預覽。"
            path={value.featured_image} onPick={() => setPicking('featured_image')} onClear={() => set('featured_image', null)} />
          <ImageField label="列表縮圖（選填）" ratio="3 / 4" hint={`固定 ${COVER_ASPECT.w}:${COVER_ASPECT.h} 直式，用在首頁與文章列表的卡片。比例不符的圖會先請你裁切；不設定就沿用主圖。`}
            path={value.cover_image} fallbackPath={value.featured_image} onPick={() => setPicking('cover_image')} onClear={() => set('cover_image', null)} />
        </Group>

        <Group title="基本資料">
          <div>
            <div className="flex items-baseline justify-between">
              <label className={labelCls} htmlFor="as-summary">摘要</label><Counter text={value.summary || ''} max={160} />
            </div>
            <textarea id="as-summary" rows={3} className={`${inputCls} resize-y`} value={value.summary || ''}
              placeholder="顯示在文章卡片與搜尋結果的一兩句話" onChange={(e) => set('summary', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls} htmlFor="as-category">分類</label>
              <select id="as-category" className={`${selectCls} w-full py-2`} value={value.category_id ?? ''}
                onChange={(e) => set('category_id', e.target.value ? Number(e.target.value) : null)}>
                <option value="">未指定</option>{options.categories.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls} htmlFor="as-author">作者</label>
              <select id="as-author" className={`${selectCls} w-full py-2`} value={value.author_id ?? ''}
                onChange={(e) => set('author_id', e.target.value ? Number(e.target.value) : null)}>
                <option value="">未指定</option>{options.authors.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls} htmlFor="as-slug">網址代稱</label>
            <div className="flex items-center rounded-lg border border-border bg-card focus-within:ring-2 focus-within:ring-admin-accent-500">
              <span className="pl-3 text-xs text-muted-foreground select-none">/posts/</span>
              <input id="as-slug" className="w-full bg-transparent px-1 py-2 text-sm font-mono text-foreground focus:outline-none"
                value={value.slug || ''} onChange={(e) => set('slug', e.target.value)} />
            </div>
            <p className={`${hintCls} mt-1`}>已發布後再改，舊連結會失效。</p>
          </div>
        </Group>

        <Group title="網站標籤">
          <TagPicker all={options.tags} selected={value.tag_ids} onChange={(ids) => set('tag_ids', ids)} />
        </Group>

        <section className="border-b border-border/60">
          <button type="button" onClick={() => setSeoOpen((o) => !o)} aria-expanded={seoOpen}
            className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-muted/50">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">SEO（選填）</span>
            <span className={`${hintCls} truncate`}>{value.meta_title || value.meta_description ? '已自訂' : '沿用標題與摘要'}</span>
            <ChevronDown size={14} className={`ml-auto text-muted-foreground transition-transform ${seoOpen ? 'rotate-180' : ''}`} />
          </button>
          {seoOpen && (
            <div className="px-4 pb-4 space-y-3">
              <div>
                <div className="flex items-baseline justify-between">
                  <label className={labelCls} htmlFor="as-meta-title">SEO 標題</label><Counter text={value.meta_title || ''} max={60} />
                </div>
                <input id="as-meta-title" className={inputCls} value={value.meta_title || ''} placeholder="留空則使用文章標題"
                  onChange={(e) => set('meta_title', e.target.value)} />
              </div>
              <div>
                <div className="flex items-baseline justify-between">
                  <label className={labelCls} htmlFor="as-meta-desc">SEO 描述</label><Counter text={value.meta_description || ''} max={160} />
                </div>
                <textarea id="as-meta-desc" rows={3} className={`${inputCls} resize-y`} value={value.meta_description || ''}
                  placeholder="留空則使用摘要" onChange={(e) => set('meta_description', e.target.value)} />
              </div>
            </div>
          )}
        </section>
      </div>

      <footer className="px-4 py-2.5 border-t border-border/60 flex-shrink-0">
        <p className={hintCls}>變更會在按「儲存草稿」時保存；按「發布」後才會更新網站。</p>
      </footer>

      <MediaBrowser isOpen={!!picking} onClose={() => setPicking(null)}
        onSelect={(media) => {
          const key = picking;
          setPicking(null);
          if (!key) return;
          if (key === 'cover_image') {
            // 列表縮圖強制 3:4：比例已符合（誤差 1% 內）直接用，否則一律先裁切
            const target = COVER_ASPECT.w / COVER_ASPECT.h;
            const fits = !!media.width && !!media.height && Math.abs(media.width / media.height - target) / target <= 0.01;
            if (!fits) { setCropping(media); return; }
          }
          set(key, media.file_path);
        }} />
      {cropping && (
        <ImageCropDialog media={cropping} aspect={COVER_ASPECT} title="裁切列表縮圖"
          onCancel={() => setCropping(null)}
          onDone={(cropped) => { set('cover_image', cropped.file_path); setCropping(null); }} />
      )}
    </aside>
  );
}
