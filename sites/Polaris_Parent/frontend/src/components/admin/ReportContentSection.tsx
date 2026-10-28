'use client';

/**
 * 產品管理裡客製報告的長篇文案：
 * - 「商品頁內容」：介紹、亮點、推薦語、詳細說明、特色文字、怎麼製作、讀者怎麼說、常見問題（每款報告各一份，存 attributes.report_display）
 * - 「報告目錄」：目錄頁標題、你想送給誰、目錄頁常見問題（所有報告共用，存第一款報告的 attributes.report_catalog／report_catalog_faq）
 * 每一段預設顯示程式內建的文字（catalog.ts）；按「自訂這一段」以預設為起點編輯，「還原預設」刪掉後台的版本。
 * 前台套用規則見 lib/report/display.ts。
 */
import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, Plus, RotateCcw, Trash2 } from 'lucide-react';
import Input from '@ows/ui/ui/Input';
import type { ProductAttributeTab, ProductAttributesSectionProps } from '@ows/commerce';
import { REPORT_CATALOG, REPORT_PRODUCTS } from '@/lib/report/catalog';
import {
  HIGHLIGHT_ICONS,
  REPORT_CATALOG_FAQ_KEY,
  REPORT_CATALOG_KEY,
  REPORT_DISPLAY_KEY,
  applyReportCatalog,
  type ReportCatalogAttributes,
  type ReportDisplayAttributes,
} from '@/lib/report/display';

const labelCls = 'mb-1 block text-sm font-medium text-foreground';
const textareaCls =
  'w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-admin-accent-500';
const selectCls = textareaCls;
const smallBtn =
  'inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted';
const iconBtn = 'rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30';

const reportFor = (productId: string) => REPORT_PRODUCTS.find((p) => p.displayProductId === productId);
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

/** 段落：以空白行分段 */
const toParagraphs = (v: string) => v.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);
const fromParagraphs = (v: string[]) => v.join('\n\n');

function TextArea({ value, onChange, rows = 3, placeholder }: { value: string; onChange: (v: string) => void; rows?: number; placeholder?: string }) {
  return <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} placeholder={placeholder} className={textareaCls} />;
}

/**
 * 一段可自訂的內容。value 為 undefined＝用預設：顯示預設摘要＋「自訂這一段」；
 * 有值＝顯示編輯器＋「還原預設」。
 */
function Customizable<T>({
  title,
  description,
  value,
  fallback,
  onChange,
  summary,
  children,
}: {
  title: string;
  description?: string;
  value: T | undefined;
  fallback: T;
  onChange: (v: T | undefined) => void;
  summary: (v: T) => ReactNode;
  children: (v: T, set: (v: T) => void) => ReactNode;
}) {
  const custom = value !== undefined;
  return (
    <section className="space-y-3 rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">
            {title}
            <span className={`ml-2 rounded px-1.5 py-0.5 text-[11px] font-medium ${custom ? 'bg-admin-accent-50 text-admin-accent-700 dark:bg-admin-accent-500/15 dark:text-admin-accent-200' : 'bg-muted text-muted-foreground'}`}>
              {custom ? '已自訂' : '使用預設'}
            </span>
          </h3>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
        {custom ? (
          <button type="button" className={smallBtn} onClick={() => { if (confirm(`把「${title}」還原成程式預設？目前自訂的內容會被清掉。`)) onChange(undefined); }}>
            <RotateCcw className="h-3.5 w-3.5" /> 還原預設
          </button>
        ) : (
          <button type="button" className={smallBtn} onClick={() => onChange(clone(fallback))}>
            自訂這一段
          </button>
        )}
      </div>
      {custom ? children(value as T, (v) => onChange(v)) : <div className="rounded-md bg-muted px-3 py-2 text-xs leading-relaxed text-muted-foreground">{summary(fallback)}</div>}
    </section>
  );
}

/**
 * 可新增、刪除、上下移的清單。onChange 第二個參數是「新位置 → 舊位置」（新增的項目為 -1），
 * 讓呼叫端可以同步搬動對應的資料（例如特色區塊的圖片）。
 */
function ListItems<T>({
  items,
  onChange,
  blank,
  addLabel,
  renderItem,
}: {
  items: T[];
  onChange: (next: T[], order: number[]) => void;
  blank: () => T;
  addLabel: string;
  renderItem: (item: T, update: (patch: Partial<T>) => void, index: number) => ReactNode;
}) {
  const order = items.map((_, i) => i);
  const move = (from: number, to: number) => {
    const next = [...items];
    const o = [...order];
    [next[from], next[to]] = [next[to], next[from]];
    [o[from], o[to]] = [o[to], o[from]];
    onChange(next, o);
  };
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="flex gap-2 rounded-md bg-muted/50 p-3">
          <span className="mt-1.5 w-5 shrink-0 text-xs text-muted-foreground">{i + 1}</span>
          <div className="min-w-0 flex-1 space-y-2">
            {renderItem(item, (patch) => onChange(items.map((x, j) => (j === i ? { ...x, ...patch } : x)), order), i)}
          </div>
          <div className="flex shrink-0 flex-col">
            <button type="button" className={iconBtn} aria-label="往上移" disabled={i === 0} onClick={() => move(i, i - 1)}><ArrowUp className="h-3.5 w-3.5" /></button>
            <button type="button" className={iconBtn} aria-label="往下移" disabled={i === items.length - 1} onClick={() => move(i, i + 1)}><ArrowDown className="h-3.5 w-3.5" /></button>
            <button type="button" className={iconBtn} aria-label="刪除" onClick={() => onChange(items.filter((_, j) => j !== i), order.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        </div>
      ))}
      <button type="button" className={smallBtn} onClick={() => onChange([...items, blank()], [...order, -1])}>
        <Plus className="h-3.5 w-3.5" /> {addLabel}
      </button>
      <p className="text-xs text-muted-foreground">全部刪光或都沒填，前台會回到預設內容。</p>
    </div>
  );
}

const Hint = ({ children }: { children: ReactNode }) => (
  <p className="rounded-lg bg-muted px-4 py-3 text-xs leading-relaxed text-muted-foreground">{children}</p>
);

const pairs = (items: { a: string; b?: string }[]) => (
  <ol className="list-decimal space-y-1 pl-4">
    {items.map((x, i) => (
      <li key={i}><span className="text-foreground">{x.a}</span>{x.b ? `：${x.b}` : ''}</li>
    ))}
  </ol>
);

// ─────────────────────────────────────────────────────────
// 商品頁內容（每款報告各一份）
// ─────────────────────────────────────────────────────────

function ReportContentTab({ productId, attributes, onChange, language = 'zh-TW' }: ProductAttributesSectionProps) {
  const report = reportFor(productId)!; // appliesTo 保證有值
  const d: ReportDisplayAttributes = attributes[REPORT_DISPLAY_KEY] ?? {};
  const set = (patch: Partial<ReportDisplayAttributes>) => {
    const next: Record<string, unknown> = { ...d, ...patch };
    for (const k of Object.keys(next)) if (next[k] === undefined) delete next[k];
    onChange({ ...attributes, [REPORT_DISPLAY_KEY]: next });
  };

  return (
    <>
      <Hint>
        對應前台 /report/{report.slug} 商品頁的各段文字。每段預設顯示程式內建的內容；按「自訂這一段」會以預設內容為起點讓你修改，
        儲存後前台改用你的版本。「還原預設」會清掉你的版本。標記「［佔位］」的是暫定文字，正式開賣前記得換掉。
      </Hint>
      {language !== 'zh-TW' && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800">
          這是非繁中的語言版本：程式預設的內容是中文，沒有自訂的段落在前台會顯示中文。請每一段都按「自訂這一段」改寫成這個語言。
        </p>
      )}

      <Customizable
        title="亮點"
        description="標題下方、價格卡上方的幾行短句，每行前面有一個小圖示"
        value={d.highlights}
        fallback={report.highlights}
        onChange={(v) => set({ highlights: v })}
        summary={(v) => pairs(v.map((h) => ({ a: h.text })))}
      >
        {(v, setV) => (
          <ListItems
            items={v}
            onChange={(next) => setV(next)}
            blank={() => ({ icon: 'book' as const, text: '' })}
            addLabel="新增亮點"
            renderItem={(h, update) => (
              <div className="flex gap-2">
                <select value={h.icon} onChange={(e) => update({ icon: e.target.value as typeof h.icon })} className={`${selectCls} w-24 shrink-0`} aria-label="圖示">
                  {HIGHLIGHT_ICONS.map((i) => <option key={i.value} value={i.value}>{i.label}</option>)}
                </select>
                <Input value={h.text} onChange={(e) => update({ text: e.target.value })} placeholder="例如：付款前先預覽主角的命盤與樣張" />
              </div>
            )}
          />
        )}
      </Customizable>

      <Customizable
        title="推薦語"
        description="價格卡下方的藍底引言"
        value={d.testimonial}
        fallback={report.testimonial}
        onChange={(v) => set({ testimonial: v })}
        summary={(v) => `「${v.quote}」— ${v.author}`}
      >
        {(v, setV) => (
          <div className="space-y-2">
            <TextArea value={v.quote} onChange={(quote) => setV({ ...v, quote })} rows={2} placeholder="引言內容" />
            <Input value={v.author} onChange={(e) => setV({ ...v, author: e.target.value })} placeholder="署名，例如：讀者 A" />
          </div>
        )}
      </Customizable>

      <Customizable
        title="介紹段落"
        description="詳細說明上方的幾段文字"
        value={d.intro}
        fallback={report.intro}
        onChange={(v) => set({ intro: v })}
        summary={(v) => v.map((p, i) => <p key={i} className={i ? 'mt-1' : ''}>{p}</p>)}
      >
        {(v, setV) => (
          <>
            <TextArea value={fromParagraphs(v)} onChange={(x) => setV(x.trim() ? toParagraphs(x) : [])} rows={6} />
            <p className="text-xs text-muted-foreground">段落之間空一行。</p>
          </>
        )}
      </Customizable>

      <Customizable
        title="詳細說明"
        description="可展開的說明（第一項預設展開），例如「報告如何客製？」「規格與品質」"
        value={d.details}
        fallback={report.details}
        onChange={(v) => set({ details: v })}
        summary={(v) => pairs(v.map((x) => ({ a: x.title })))}
      >
        {(v, setV) => (
          <ListItems
            items={v}
            onChange={(next) => setV(next)}
            blank={() => ({ title: '', body: [] })}
            addLabel="新增一項說明"
            renderItem={(x, update) => (
              <>
                <Input value={x.title} onChange={(e) => update({ title: e.target.value })} placeholder="標題" />
                <TextArea value={fromParagraphs(x.body)} onChange={(b) => update({ body: b.trim() ? toParagraphs(b) : [] })} rows={3} placeholder="內容（段落之間空一行）" />
              </>
            )}
          />
        )}
      </Customizable>

      <Customizable
        title="特色區塊"
        description="圖文交錯的介紹；圖片在「前台圖片」分頁上傳，調整順序或刪除時圖片會跟著走"
        value={d.features}
        fallback={report.features.map(({ title, body, image }) => ({ title, body, image }))}
        onChange={(v) => set(v === undefined ? { features: undefined } : { features: v })}
        summary={(v) => pairs(v.map((f) => ({ a: f.title })))}
      >
        {(v) => (
          <ListItems
            items={v}
            onChange={(next, order) => {
              const images = d.feature_images ?? [];
              set({ features: next, feature_images: order.map((o) => (o >= 0 ? images[o] ?? '' : '')) });
            }}
            blank={() => ({ title: '', body: '', image: '' })}
            addLabel="新增特色區塊"
            renderItem={(f, update) => (
              <>
                <Input value={f.title} onChange={(e) => update({ title: e.target.value })} placeholder="標題" />
                <TextArea value={f.body} onChange={(body) => update({ body })} rows={2} placeholder="內容" />
                <Input value={f.image ?? ''} onChange={(e) => update({ image: e.target.value })} placeholder="沒上傳圖片時，佔位框裡的說明（可留空）" />
              </>
            )}
          />
        )}
      </Customizable>

      <Customizable
        title="怎麼製作"
        description="編號步驟卡片，建議 3–4 步"
        value={d.process}
        fallback={report.process}
        onChange={(v) => set({ process: v })}
        summary={(v) => pairs(v.map((x) => ({ a: x.title, b: x.body })))}
      >
        {(v, setV) => (
          <ListItems
            items={v}
            onChange={(next) => setV(next)}
            blank={() => ({ title: '', body: '' })}
            addLabel="新增步驟"
            renderItem={(x, update) => (
              <>
                <Input value={x.title} onChange={(e) => update({ title: e.target.value })} placeholder="步驟名稱" />
                <TextArea value={x.body} onChange={(body) => update({ body })} rows={2} placeholder="說明" />
              </>
            )}
          />
        )}
      </Customizable>

      <Customizable
        title="讀者怎麼說"
        description="五顆星評價卡片，建議 3 則"
        value={d.reviews}
        fallback={report.reviews}
        onChange={(v) => set({ reviews: v })}
        summary={(v) => pairs(v.map((x) => ({ a: x.quote, b: x.author })))}
      >
        {(v, setV) => (
          <ListItems
            items={v}
            onChange={(next) => setV(next)}
            blank={() => ({ quote: '', author: '' })}
            addLabel="新增評價"
            renderItem={(x, update) => (
              <>
                <TextArea value={x.quote} onChange={(quote) => update({ quote })} rows={2} placeholder="評價內容" />
                <Input value={x.author} onChange={(e) => update({ author: e.target.value })} placeholder="署名（可留空）" />
              </>
            )}
          />
        )}
      </Customizable>

      <Customizable
        title="常見問題"
        description={`商品頁下方的「${report.name}常見問題」`}
        value={d.faq}
        fallback={report.faq}
        onChange={(v) => set({ faq: v })}
        summary={(v) => pairs(v.map((x) => ({ a: x.q })))}
      >
        {(v, setV) => (
          <ListItems
            items={v}
            onChange={(next) => setV(next)}
            blank={() => ({ q: '', a: '' })}
            addLabel="新增問題"
            renderItem={(x, update) => (
              <>
                <Input value={x.q} onChange={(e) => update({ q: e.target.value })} placeholder="問題" />
                <TextArea value={x.a} onChange={(a) => update({ a })} rows={3} placeholder="回答" />
              </>
            )}
          />
        )}
      </Customizable>
    </>
  );
}

// ─────────────────────────────────────────────────────────
// 報告目錄（所有報告共用）
// ─────────────────────────────────────────────────────────

function ReportCatalogTab({ attributes, onChange }: ProductAttributesSectionProps) {
  const c: ReportCatalogAttributes = attributes[REPORT_CATALOG_KEY] ?? {};
  const faq: { q: string; a: string }[] | undefined = attributes[REPORT_CATALOG_FAQ_KEY];
  const setC = (patch: Partial<ReportCatalogAttributes>) => {
    const next: Record<string, unknown> = { ...c, ...patch };
    for (const k of Object.keys(next)) if (next[k] === undefined || next[k] === '') delete next[k];
    onChange({ ...attributes, [REPORT_CATALOG_KEY]: next });
  };
  // 後端依頂層鍵合併：「還原預設」存空陣列（前台把空清單視為用預設）
  const setFaq = (v: { q: string; a: string }[] | undefined) => onChange({ ...attributes, [REPORT_CATALOG_FAQ_KEY]: v ?? [] });

  const field = (key: 'title' | 'subtitle' | 'promo' | 'audience_title' | 'audience_consent' | 'faq_title', label: string, fallback: string, multiline = false) => (
    <div>
      <label className={labelCls}>{label}</label>
      {multiline ? (
        <TextArea value={c[key] ?? ''} onChange={(v) => setC({ [key]: v })} rows={2} placeholder={fallback} />
      ) : (
        <Input value={c[key] ?? ''} onChange={(e) => setC({ [key]: e.target.value })} placeholder={fallback} />
      )}
    </div>
  );

  return (
    <>
      <Hint>
        這一頁的內容所有報告共用：報告目錄頁（/report），以及每個商品頁下方的「你想送給誰？」。文字欄留空就用灰字的預設。
      </Hint>

      <section className="space-y-4 rounded-lg border border-border p-4">
        <h3 className="text-sm font-semibold text-foreground">目錄頁標題</h3>
        {field('promo', '頂端橫幅', REPORT_CATALOG.promo)}
        {field('title', '標題', REPORT_CATALOG.title)}
        {field('subtitle', '副標', REPORT_CATALOG.subtitle)}
      </section>

      <section className="space-y-4 rounded-lg border border-border p-4">
        <h3 className="text-sm font-semibold text-foreground">你想送給誰</h3>
        {field('audience_title', '區塊標題（目錄頁）', REPORT_CATALOG.audienceTitle)}
        {field('audience_consent', '下方提醒（目錄頁）', REPORT_CATALOG.audienceConsent, true)}
      </section>

      <Customizable
        title="送禮對象卡片"
        description="目錄頁與每個商品頁都會顯示，建議 4 張"
        value={c.audiences}
        fallback={REPORT_CATALOG.audiences}
        onChange={(v) => setC({ audiences: v })}
        summary={(v) => pairs(v.map((a) => ({ a: a.label, b: a.note })))}
      >
        {(v, setV) => (
          <ListItems
            items={v}
            onChange={(next) => setV(next)}
            blank={() => ({ label: '', note: '' })}
            addLabel="新增對象"
            renderItem={(a, update) => (
              <>
                <Input value={a.label} onChange={(e) => update({ label: e.target.value })} placeholder="例如：給孩子" />
                <TextArea value={a.note} onChange={(note) => update({ note })} rows={2} placeholder="一兩句說明" />
              </>
            )}
          />
        )}
      </Customizable>

      <section className="space-y-4 rounded-lg border border-border p-4">
        <h3 className="text-sm font-semibold text-foreground">目錄頁常見問題</h3>
        {field('faq_title', '區塊標題', REPORT_CATALOG.faqTitle)}
      </section>

      <Customizable
        title="目錄頁常見問題"
        value={Array.isArray(faq) && faq.length ? faq : undefined}
        fallback={applyReportCatalog(null).faq}
        onChange={setFaq}
        summary={(v) => pairs(v.map((x) => ({ a: x.q })))}
      >
        {(v, setV) => (
          <ListItems
            items={v}
            onChange={(next) => setV(next)}
            blank={() => ({ q: '', a: '' })}
            addLabel="新增問題"
            renderItem={(x, update) => (
              <>
                <Input value={x.q} onChange={(e) => update({ q: e.target.value })} placeholder="問題" />
                <TextArea value={x.a} onChange={(a) => update({ a })} rows={3} placeholder="回答" />
              </>
            )}
          />
        )}
      </Customizable>
    </>
  );
}

export const reportContentTabs: ProductAttributeTab[] = [
  { key: 'report-content', label: '商品頁內容', Component: ReportContentTab, appliesTo: (id) => !!reportFor(id) },
  { key: 'report-catalog', label: '報告目錄', Component: ReportCatalogTab, appliesTo: (id) => id === REPORT_PRODUCTS[0]?.displayProductId },
];
