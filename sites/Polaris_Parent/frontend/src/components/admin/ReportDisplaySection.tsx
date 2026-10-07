'use client';

/**
 * 產品管理裡客製報告專用的兩個分頁：「前台文字」與「前台圖片」。
 * 對應前台的報告目錄卡片（/report）與商品頁（/report/{slug}）；留空沿用前台預設（輸入框的灰字即預設值）。
 * 只存在 ReportProduct.displayProductId 那筆商品的 attributes.report_display；前台套用規則見 lib/report/display.ts。
 */
import { useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Plus, RefreshCw, X } from 'lucide-react';
import Input from '@ows/ui/ui/Input';
import MediaBrowser from '@ows/admin-app/components/MediaBrowser';
import type { ProductAttributeTab, ProductAttributesSectionProps } from '@ows/commerce';
import { getImageUrl } from '@/lib/utils';
import { REPORT_PRODUCTS, REPORT_VARIANTS, type ReportProduct } from '@/lib/report/catalog';
import { COVER_PALETTES, REPORT_DISPLAY_KEY, type ReportDisplayAttributes } from '@/lib/report/display';

const labelCls = 'mb-1 block text-sm font-medium text-foreground';
const hintCls = 'mt-1 text-xs text-muted-foreground';

function Group({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description && <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}

const reportFor = (productId: string) => REPORT_PRODUCTS.find((p) => p.displayProductId === productId);
const isVariant = (productId: string) => REPORT_VARIANTS.some((v) => v.productId === productId);

/** 讀寫 attributes.report_display；只存有填的欄位，留空即回到前台預設 */
function useReportDisplay({ attributes, onChange }: ProductAttributesSectionProps) {
  const d: ReportDisplayAttributes = attributes[REPORT_DISPLAY_KEY] ?? {};
  const set = (patch: Partial<ReportDisplayAttributes>) => {
    const next: Record<string, unknown> = { ...d, ...patch };
    for (const k of Object.keys(next)) {
      const v = next[k];
      const emptyList = Array.isArray(v) && v.every((x) => !x);
      if (v === '' || v === false || v == null || emptyList) delete next[k];
    }
    onChange({ ...attributes, [REPORT_DISPLAY_KEY]: next });
  };
  return { d, set };
}

// ─────────────────────────────────────────────────────────
// 前台文字
// ─────────────────────────────────────────────────────────

function ReportTextTab(props: ProductAttributesSectionProps) {
  const report = reportFor(props.productId);
  const { d, set } = useReportDisplay(props);

  if (!report) {
    // 加購版本（例如實體書）只提示到哪裡改，不重複存一份
    const owner = REPORT_PRODUCTS[0];
    return (
      <p className="rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
        這是客製報告的加購版本，只影響價格。前台的報告名稱、書封與圖片請到「
        <code>{owner?.displayProductId}</code>」設定。
      </p>
    );
  }

  const field = (key: keyof ReportDisplayAttributes, label: string, fallback: string, hint?: string) => (
    <div>
      <label className={labelCls}>{label}</label>
      <Input
        type="text"
        value={(d[key] as string | undefined) ?? ''}
        onChange={(e) => set({ [key]: e.target.value })}
        placeholder={fallback}
      />
      {hint && <p className={hintCls}>{hint}</p>}
    </div>
  );

  return (
    <>
      <p className="rounded-lg bg-muted px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        對應前台「{report.name}」的目錄卡片與商品頁。報告名稱、卡片描述、價格分別取自「基本資料」的產品名稱、
        簡短描述與「價格與庫存」的售價。以下留空就用灰字的預設；儲存後約 10 分鐘更新到前台。
      </p>

      <Group title="卡片與商品頁">
        {field('tagline', '標語', report.tagline, '商品頁標題下方的一句話')}
        <div>
          <label className={labelCls}>角標</label>
          <Input
            type="text"
            value={d.badge ?? ''}
            onChange={(e) => set({ badge: e.target.value })}
            placeholder={report.badge ?? '例如：新上市'}
            disabled={d.badge_hidden}
          />
          <label className="mt-2 inline-flex items-center gap-2 text-sm text-foreground">
            <input type="checkbox" checked={!!d.badge_hidden} onChange={(e) => set({ badge_hidden: e.target.checked })} />
            不顯示角標
          </label>
        </div>
        {field('audience_label', '適用對象', report.audienceLabel, '目錄卡片描述下方的灰字')}
      </Group>

      <Group title="書封文字" description="沒上傳封面圖時，前台用這些文字和配色畫出書封。">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {field('cover_eyebrow', '書封小標', report.cover.eyebrow)}
          {field('cover_title', '書封標題', report.cover.title)}
        </div>
        {field('cover_subtitle', '書封副標', report.cover.subtitle)}
        <div className="max-w-xs">
          <label className={labelCls}>書封配色</label>
          <select
            value={d.cover_palette ?? ''}
            onChange={(e) => set({ cover_palette: (e.target.value || undefined) as ReportDisplayAttributes['cover_palette'] })}
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-admin-accent-500"
          >
            <option value="">預設（{COVER_PALETTES.find((p) => p.value === report.cover.palette)?.label}）</option>
            {COVER_PALETTES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      </Group>
    </>
  );
}

// ─────────────────────────────────────────────────────────
// 前台圖片
// ─────────────────────────────────────────────────────────

/** 單張圖片格：空的是虛線框「選擇圖片」，有圖時滑過出現「更換／移除」 */
function ImageSlot({
  value,
  ratio,
  label,
  onBrowse,
  onRemove,
  className = '',
}: {
  value?: string;
  ratio: 'aspect-square' | 'aspect-[4/3]';
  label: string;
  onBrowse: () => void;
  onRemove: () => void;
  className?: string;
}) {
  if (!value) {
    return (
      <button
        type="button"
        onClick={onBrowse}
        className={`flex ${ratio} w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border text-xs text-muted-foreground transition-colors hover:border-admin-accent-500 hover:text-admin-accent-600 ${className}`}
      >
        <Plus className="h-5 w-5" />
        選擇圖片
      </button>
    );
  }
  return (
    <div className={`group relative ${ratio} w-full overflow-hidden rounded-lg border border-border bg-muted ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={getImageUrl(value, 'small')} alt={label} className="h-full w-full object-cover" />
      <div className="absolute inset-x-0 bottom-0 flex justify-center gap-1 bg-black/50 p-1.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
        <button type="button" onClick={onBrowse} className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-white hover:bg-white/20">
          <RefreshCw className="h-3.5 w-3.5" /> 更換
        </button>
        <button type="button" onClick={onRemove} className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-white hover:bg-white/20">
          <X className="h-3.5 w-3.5" /> 移除
        </button>
      </div>
    </div>
  );
}

// 媒體庫選圖的目標：封面、圖庫（可一次選多張）、第 n 個特色區塊
type ImageTarget = { kind: 'cover' } | { kind: 'gallery' } | { kind: 'feature'; index: number };

function ReportImagesTab(props: ProductAttributesSectionProps) {
  const report = reportFor(props.productId) as ReportProduct; // appliesTo 保證有值
  const { d, set } = useReportDisplay(props);
  const [browseTarget, setBrowseTarget] = useState<ImageTarget | null>(null);
  // 媒體庫多選時會逐張呼叫 onSelect；先收集起來，同一輪結束再一次寫入
  const pendingGallery = useRef<string[]>([]);

  const gallery = d.gallery_images ?? [];
  const featureImages = report.features.map((_, i) => d.feature_images?.[i] ?? '');

  const moveGallery = (from: number, to: number) => {
    if (to < 0 || to >= gallery.length) return;
    const next = [...gallery];
    [next[from], next[to]] = [next[to], next[from]];
    set({ gallery_images: next });
  };

  const setFeatureImage = (index: number, path: string) => {
    const next = [...featureImages];
    next[index] = path;
    set({ feature_images: next });
  };

  const handleSelect = (media: { file_path: string }) => {
    if (!browseTarget) return;
    if (browseTarget.kind === 'cover') {
      set({ cover_image: media.file_path });
      setBrowseTarget(null);
    } else if (browseTarget.kind === 'feature') {
      setFeatureImage(browseTarget.index, media.file_path);
      setBrowseTarget(null);
    } else {
      pendingGallery.current.push(media.file_path);
      if (pendingGallery.current.length === 1) {
        queueMicrotask(() => {
          set({ gallery_images: [...gallery, ...pendingGallery.current] });
          pendingGallery.current = [];
          setBrowseTarget(null);
        });
      }
    }
  };

  return (
    <>
      <p className="rounded-lg bg-muted px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        沒上傳的位置，前台維持現在的樣子：書封用程式繪製、內頁與特色區塊顯示佔位框。
        預覽頁的書封會印上主角姓名，所以那裡一律用程式繪製的書封。
      </p>

      <Group title="封面" description="正方形 1:1，建議 1200×1200。用在報告目錄卡片與商品頁圖庫第一張。">
        <ImageSlot
          value={d.cover_image}
          ratio="aspect-square"
          label="封面"
          className="max-w-[10rem]"
          onBrowse={() => setBrowseTarget({ kind: 'cover' })}
          onRemove={() => set({ cover_image: '' })}
        />
      </Group>

      <Group
        title="商品頁圖庫：內頁"
        description={<>正方形 1:1，依序排在封面之後；放了任何一張就取代全部佔位框，可一次選多張。目前佔位：{report.gallery.join('、')}</>}
      >
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {gallery.map((path, i) => (
            <div key={`${path}-${i}`} className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={getImageUrl(path, 'small')} alt={`內頁 ${i + 1}`} className="h-full w-full object-cover" />
              <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 text-[11px] text-white">{i + 1}</span>
              <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/50 p-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                <button type="button" onClick={() => moveGallery(i, i - 1)} disabled={i === 0} aria-label="往前移" className="rounded p-1 text-white hover:bg-white/20 disabled:opacity-30">
                  <ArrowLeft className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => set({ gallery_images: gallery.filter((_, j) => j !== i) })} aria-label="移除" className="rounded p-1 text-white hover:bg-white/20">
                  <X className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => moveGallery(i, i + 1)} disabled={i === gallery.length - 1} aria-label="往後移" className="rounded p-1 text-white hover:bg-white/20 disabled:opacity-30">
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setBrowseTarget({ kind: 'gallery' })}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border text-xs text-muted-foreground transition-colors hover:border-admin-accent-500 hover:text-admin-accent-600"
          >
            <Plus className="h-5 w-5" />
            新增內頁
          </button>
        </div>
      </Group>

      <Group title="特色區塊" description="橫式 4:3，顯示在商品頁的圖文介紹。">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {report.features.map((f, i) => (
            <div key={f.title}>
              <p className={labelCls}>{f.title}</p>
              <ImageSlot
                value={featureImages[i] || undefined}
                ratio="aspect-[4/3]"
                label={f.title}
                onBrowse={() => setBrowseTarget({ kind: 'feature', index: i })}
                onRemove={() => setFeatureImage(i, '')}
              />
            </div>
          ))}
        </div>
      </Group>

      <MediaBrowser
        isOpen={browseTarget !== null}
        onClose={() => setBrowseTarget(null)}
        onSelect={handleSelect}
        multiple={browseTarget?.kind === 'gallery'}
      />
    </>
  );
}

/** 掛到產品管理的分頁：文字頁也出現在加購版本上（只顯示提示），圖片頁只出現在主商品 */
export const reportAttributeTabs: ProductAttributeTab[] = [
  {
    key: 'report-text',
    label: '前台文字',
    Component: ReportTextTab,
    appliesTo: (id) => !!reportFor(id) || isVariant(id),
  },
  {
    key: 'report-images',
    label: '前台圖片',
    Component: ReportImagesTab,
    appliesTo: (id) => !!reportFor(id),
  },
];
