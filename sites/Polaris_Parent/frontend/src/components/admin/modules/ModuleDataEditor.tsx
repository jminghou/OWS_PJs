'use client';

/**
 * 模組內容編輯器：依模組類型編輯 page_modules.data（格式見 lib/report/modules.ts 的 ModuleData）。
 * 目錄頁設定（catalog_page）另有 CatalogPageEditor，因為它要選用其他模組。
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import Input from '@ows/ui/ui/Input';
import MediaBrowser from '@ows/admin-app/components/MediaBrowser';
import { ImageSlot } from '@/components/admin/ReportDisplaySection';
import { HIGHLIGHT_ICONS, highlightIcon } from '@/lib/report/highlightIcons';
import { moduleTypeInfo, type ModuleType } from '@/lib/report/modules';

export const labelCls = 'mb-1 block text-sm font-medium text-foreground';
export const fieldCls =
  'w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-admin-accent-500';
const smallBtn =
  'inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted';
const iconBtn = 'rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30';

/** 段落：以空白行分段 */
const toParagraphs = (v: string) => v.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);
const fromParagraphs = (v: string[] | undefined) => (v ?? []).join('\n\n');

export function TextArea({ value, onChange, rows = 3, placeholder }: { value: string; onChange: (v: string) => void; rows?: number; placeholder?: string }) {
  return <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} placeholder={placeholder} className={fieldCls} />;
}

/** 亮點圖示：按鈕顯示目前的圖示，點開是圖示表 */
function IconPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const Current = highlightIcon(value);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-label="選擇圖示" aria-expanded={open}
        className="flex h-10 w-12 items-center justify-center rounded-lg border border-border bg-card text-blue-500 hover:bg-muted">
        <Current className="h-5 w-5" strokeWidth={2} />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-[17rem] rounded-lg border border-border bg-card p-2 shadow-lg sm:w-[22rem]">
          <div className="grid max-h-72 grid-cols-6 gap-1 overflow-y-auto sm:grid-cols-8">
            {HIGHLIGHT_ICONS.map(({ value: v, label, Icon }) => (
              <button key={v} type="button" title={label} aria-label={label}
                onClick={() => { onChange(v); setOpen(false); }}
                className={`flex aspect-square items-center justify-center rounded-md hover:bg-muted ${v === value ? 'bg-admin-accent-50 ring-1 ring-admin-accent-500 dark:bg-admin-accent-500/15' : ''}`}>
                <Icon className="h-5 w-5 text-blue-500" strokeWidth={2} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** 可新增、刪除、上下移的清單 */
function ListItems<T>({
  items,
  onChange,
  blank,
  addLabel,
  renderItem,
}: {
  items: T[];
  onChange: (next: T[]) => void;
  blank: () => T;
  addLabel: string;
  renderItem: (item: T, update: (patch: Partial<T>) => void, index: number) => ReactNode;
}) {
  const move = (from: number, to: number) => {
    const next = [...items];
    [next[from], next[to]] = [next[to], next[from]];
    onChange(next);
  };
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="flex gap-2 rounded-md bg-muted/50 p-3">
          <span className="mt-1.5 w-5 shrink-0 text-xs text-muted-foreground">{i + 1}</span>
          <div className="min-w-0 flex-1 space-y-2">
            {renderItem(item, (patch) => onChange(items.map((x, j) => (j === i ? { ...x, ...patch } : x))), i)}
          </div>
          <div className="flex shrink-0 flex-col">
            <button type="button" className={iconBtn} aria-label="往上移" disabled={i === 0} onClick={() => move(i, i - 1)}><ArrowUp className="h-3.5 w-3.5" /></button>
            <button type="button" className={iconBtn} aria-label="往下移" disabled={i === items.length - 1} onClick={() => move(i, i + 1)}><ArrowDown className="h-3.5 w-3.5" /></button>
            <button type="button" className={iconBtn} aria-label="刪除" onClick={() => onChange(items.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        </div>
      ))}
      <button type="button" className={smallBtn} onClick={() => onChange([...items, blank()])}>
        <Plus className="h-3.5 w-3.5" /> {addLabel}
      </button>
    </div>
  );
}

/** 特色區塊：每一項可放一張 4:3 圖片 */
function FeaturesEditor({ items, onChange }: { items: any[]; onChange: (v: any[]) => void }) {
  const [browse, setBrowse] = useState<number | null>(null);
  return (
    <>
      <ListItems
        items={items}
        onChange={onChange}
        blank={() => ({ title: '', body: '', image: '', image_url: '' })}
        addLabel="新增特色區塊"
        renderItem={(f, update, i) => (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_10rem]">
            <div className="space-y-2">
              <Input value={f.title ?? ''} onChange={(e) => update({ title: e.target.value })} placeholder="標題" />
              <TextArea value={f.body ?? ''} onChange={(body) => update({ body })} rows={3} placeholder="內容" />
              <Input value={f.image ?? ''} onChange={(e) => update({ image: e.target.value })} placeholder="沒上傳圖片時，佔位框裡的說明（可留空）" />
            </div>
            <ImageSlot
              value={f.image_url || undefined}
              ratio="aspect-[4/3]"
              label={f.title || `特色 ${i + 1}`}
              onBrowse={() => setBrowse(i)}
              onRemove={() => update({ image_url: '' })}
            />
          </div>
        )}
      />
      <p className="text-xs text-muted-foreground">圖片為橫式 4:3。</p>
      <MediaBrowser
        isOpen={browse !== null}
        onClose={() => setBrowse(null)}
        onSelect={(media: { file_path: string }) => {
          if (browse !== null) onChange(items.map((x, j) => (j === browse ? { ...x, image_url: media.file_path } : x)));
          setBrowse(null);
        }}
      />
    </>
  );
}

const titleHint: Partial<Record<ModuleType, string>> = {
  process: '留空用頁面預設「怎麼製作」',
  reviews: '留空用頁面預設「讀者怎麼說」',
  faq: '商品頁留空用「（報告名稱）常見問題」；目錄頁留空用「關於客製報告，你可能想知道」',
  audiences: '商品頁留空用「你想送給誰？」；目錄頁留空用「你想為誰製作一份報告？」',
};

export function ModuleDataEditor({ type, data, onChange }: { type: ModuleType; data: Record<string, any>; onChange: (d: Record<string, any>) => void }) {
  const set = (patch: Record<string, unknown>) => onChange({ ...data, ...patch });
  const list = (data.items ?? []) as any[];
  const setItems = (items: any[]) => set({ items });
  const info = moduleTypeInfo(type);

  const body = (() => {
    switch (type) {
      case 'intro':
        return (
          <>
            <TextArea value={fromParagraphs(data.paragraphs)} onChange={(x) => set({ paragraphs: x.trim() ? toParagraphs(x) : [] })} rows={8} />
            <p className="text-xs text-muted-foreground">段落之間空一行。</p>
          </>
        );
      case 'testimonial':
        return (
          <div className="space-y-2">
            <TextArea value={data.quote ?? ''} onChange={(quote) => set({ quote })} rows={2} placeholder="引言內容" />
            <Input value={data.author ?? ''} onChange={(e) => set({ author: e.target.value })} placeholder="署名，例如：讀者 A（可留空）" />
          </div>
        );
      case 'highlights':
        return (
          <ListItems items={list} onChange={setItems} blank={() => ({ icon: 'book', text: '' })} addLabel="新增亮點"
            renderItem={(h, update) => (
              <div className="flex gap-2">
                <IconPicker value={h.icon} onChange={(icon) => update({ icon })} />
                <Input value={h.text ?? ''} onChange={(e) => update({ text: e.target.value })} placeholder="例如：付款前先預覽主角的命盤與樣張" />
              </div>
            )} />
        );
      case 'details':
        return (
          <ListItems items={list} onChange={setItems} blank={() => ({ title: '', body: [] })} addLabel="新增一項說明"
            renderItem={(x, update) => (
              <>
                <Input value={x.title ?? ''} onChange={(e) => update({ title: e.target.value })} placeholder="標題，例如：規格與品質" />
                <TextArea value={fromParagraphs(x.body)} onChange={(b) => update({ body: b.trim() ? toParagraphs(b) : [] })} rows={3} placeholder="內容（段落之間空一行）" />
              </>
            )} />
        );
      case 'features':
        return <FeaturesEditor items={list} onChange={setItems} />;
      case 'process':
        return (
          <ListItems items={list} onChange={setItems} blank={() => ({ title: '', body: '' })} addLabel="新增步驟"
            renderItem={(x, update) => (
              <>
                <Input value={x.title ?? ''} onChange={(e) => update({ title: e.target.value })} placeholder="步驟名稱" />
                <TextArea value={x.body ?? ''} onChange={(b) => update({ body: b })} rows={2} placeholder="說明" />
              </>
            )} />
        );
      case 'reviews':
        return (
          <ListItems items={list} onChange={setItems} blank={() => ({ quote: '', author: '' })} addLabel="新增評價"
            renderItem={(x, update) => (
              <>
                <TextArea value={x.quote ?? ''} onChange={(quote) => update({ quote })} rows={2} placeholder="評價內容" />
                <Input value={x.author ?? ''} onChange={(e) => update({ author: e.target.value })} placeholder="署名（可留空）" />
              </>
            )} />
        );
      case 'faq':
        return (
          <ListItems items={list} onChange={setItems} blank={() => ({ q: '', a: '' })} addLabel="新增問題"
            renderItem={(x, update) => (
              <>
                <Input value={x.q ?? ''} onChange={(e) => update({ q: e.target.value })} placeholder="問題" />
                <TextArea value={x.a ?? ''} onChange={(a) => update({ a })} rows={3} placeholder="回答" />
              </>
            )} />
        );
      case 'audiences':
        return (
          <>
            <ListItems items={list} onChange={setItems} blank={() => ({ label: '', note: '' })} addLabel="新增對象"
              renderItem={(a, update) => (
                <>
                  <Input value={a.label ?? ''} onChange={(e) => update({ label: e.target.value })} placeholder="例如：給孩子" />
                  <TextArea value={a.note ?? ''} onChange={(note) => update({ note })} rows={2} placeholder="一兩句說明" />
                </>
              )} />
            <div>
              <label className={labelCls}>下方提醒（只在目錄頁顯示）</label>
              <TextArea value={data.note ?? ''} onChange={(note) => set({ note })} rows={2} placeholder="可留空" />
            </div>
          </>
        );
      default:
        return null;
    }
  })();

  return (
    <div className="space-y-4">
      {info?.titled && (
        <div>
          <label className={labelCls}>前台區塊標題</label>
          <Input value={data.title ?? ''} onChange={(e) => set({ title: e.target.value })} placeholder="可留空" />
          {titleHint[type] && <p className="mt-1 text-xs text-muted-foreground">{titleHint[type]}</p>}
        </div>
      )}
      {body}
    </div>
  );
}
