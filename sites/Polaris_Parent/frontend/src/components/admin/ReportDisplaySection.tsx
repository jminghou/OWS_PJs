'use client';

import { useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Plus, X } from 'lucide-react';
import Input from '@ows/ui/ui/Input';
import { AdminImagePicker } from '@ows/ui/admin';
import MediaBrowser from '@ows/admin-app/components/MediaBrowser';
import { getImageUrl } from '@/lib/utils';
import type { ProductAttributesSectionProps } from '@ows/commerce';
import { REPORT_PRODUCTS, REPORT_VARIANTS } from '@/lib/report/catalog';
import { COVER_PALETTES, REPORT_DISPLAY_KEY, type ReportDisplayAttributes } from '@/lib/report/display';

/**
 * 產品管理 → 「前台顯示設定」：客製報告的目錄卡片（/report）與商品頁主區（/report/{slug}）。
 * 只出現在 ReportProduct.displayProductId 那筆商品；留空沿用前台預設（placeholder 即預設值）。
 * 前台套用規則見 lib/report/display.ts。
 */
// 媒體庫選圖的目標：封面、圖庫（可一次選多張）、第 n 個特色區塊
type ImageTarget = { kind: 'cover' } | { kind: 'gallery' } | { kind: 'feature'; index: number };

export default function ReportDisplaySection({ productId, attributes, onChange }: ProductAttributesSectionProps) {
  const report = REPORT_PRODUCTS.find((p) => p.displayProductId === productId);
  const [browseTarget, setBrowseTarget] = useState<ImageTarget | null>(null);
  // 媒體庫多選時會逐張呼叫 onSelect；先收集起來，同一輪結束再一次寫入
  const pendingGallery = useRef<string[]>([]);

  if (!report) {
    // 其他版本（例如加購實體書）只提示到哪裡改，不重複存一份
    const isReportVariant = REPORT_VARIANTS.some((v) => v.productId === productId);
    const owner = REPORT_PRODUCTS[0];
    if (!isReportVariant || !owner) return null;
    return (
      <section>
        <SectionHeader />
        <p className="text-sm text-gray-500">
          這是客製報告的加購版本，只影響價格。前台的報告名稱、書封與卡片文字請在「
          <span className="font-mono">{owner.displayProductId}</span>」設定。
        </p>
      </section>
    );
  }

  const d: ReportDisplayAttributes = attributes[REPORT_DISPLAY_KEY] ?? {};

  const set = (patch: Partial<ReportDisplayAttributes>) => {
    const next: Record<string, unknown> = { ...d, ...patch };
    // 只存有填的欄位，留空即回到前台預設
    for (const k of Object.keys(next)) {
      const v = next[k];
      const emptyList = Array.isArray(v) && v.every((x) => !x);
      if (v === '' || v === false || v == null || emptyList) delete next[k];
    }
    onChange({ ...attributes, [REPORT_DISPLAY_KEY]: next });
  };

  const field = (key: keyof ReportDisplayAttributes, label: string, fallback: string, hint?: string) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <Input
        type="text"
        value={(d[key] as string | undefined) ?? ''}
        onChange={(e) => set({ [key]: e.target.value })}
        placeholder={fallback}
      />
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  );

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
    <section>
      <SectionHeader />
      <div className="space-y-4">
        <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 leading-relaxed">
          對應前台「{report.name}」的目錄卡片（/report）與商品頁主區（/report/{report.slug}）。
          報告名稱取自上方「產品名稱」，卡片描述取自「簡短描述」，價格取自「售價」。
          以下欄位留空即顯示灰字的前台預設；儲存後約 10 分鐘內更新到前台。
        </p>

        <div>
          <h4 className="text-xs font-semibold text-gray-500 mb-2">卡片與商品頁</h4>
          <div className="space-y-4">
            {field('tagline', '標語', report.tagline, '商品頁標題下方的一句話')}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">角標</label>
              <Input
                type="text"
                value={d.badge ?? ''}
                onChange={(e) => set({ badge: e.target.value })}
                placeholder={report.badge ?? '例如：新上市'}
                disabled={d.badge_hidden}
                className={d.badge_hidden ? 'bg-gray-100' : ''}
              />
              <label className="mt-2 inline-flex items-center text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={!!d.badge_hidden}
                  onChange={(e) => set({ badge_hidden: e.target.checked })}
                  className="mr-2"
                />
                不顯示角標
              </label>
            </div>
            {field('audience_label', '適用對象', report.audienceLabel, '目錄卡片描述下方的灰字')}
          </div>
        </div>

        <div>
          <h4 className="text-xs font-semibold text-gray-500 mb-2">書封</h4>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {field('cover_eyebrow', '書封小標', report.cover.eyebrow)}
              {field('cover_title', '書封標題', report.cover.title)}
            </div>
            {field('cover_subtitle', '書封副標', report.cover.subtitle)}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">書封配色</label>
              <select
                value={d.cover_palette ?? ''}
                onChange={(e) => set({ cover_palette: (e.target.value || undefined) as ReportDisplayAttributes['cover_palette'] })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">
                  預設（{COVER_PALETTES.find((p) => p.value === report.cover.palette)?.label}）
                </option>
                {COVER_PALETTES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div>
          <h4 className="text-xs font-semibold text-gray-500 mb-2">圖片</h4>
          <p className="mb-4 text-xs text-gray-500 leading-relaxed">
            沒上傳的位置，前台維持現在的樣子：書封用程式繪製、內頁與特色區塊顯示佔位框。
            預覽頁的書封會印上主角姓名，所以一律用程式繪製的書封。
          </p>
          <div className="space-y-6">
            <div className="max-w-[220px]">
              <AdminImagePicker
                label="封面圖（直式 3:4，建議 900×1200）"
                value={d.cover_image}
                onRemove={() => set({ cover_image: '' })}
                onBrowse={() => setBrowseTarget({ kind: 'cover' })}
                getImageUrl={getImageUrl}
                aspectRatio="auto"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">商品頁圖庫：內頁圖（直式 3:4，依序顯示在書封之後）</label>
              <p className="mb-2 text-xs text-gray-500">
                有放任何一張就取代全部佔位框；可一次選多張。目前佔位說明：{report.gallery.join('、')}
              </p>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                {gallery.map((path, i) => (
                  <div key={`${path}-${i}`} className="group relative aspect-[3/4] overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={getImageUrl(path, 'small')} alt={`內頁 ${i + 1}`} className="h-full w-full object-cover" />
                    <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 text-[11px] text-white">{i + 1}</span>
                    <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/50 p-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
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
                  className="flex aspect-[3/4] flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-gray-300 text-xs text-gray-500 transition-colors hover:border-blue-500 hover:text-blue-600"
                >
                  <Plus className="h-5 w-5" />
                  新增內頁圖
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {report.features.map((f, i) => (
                <AdminImagePicker
                  key={f.title}
                  label={`特色區塊「${f.title}」（橫式 4:3）`}
                  value={featureImages[i] || undefined}
                  onRemove={() => setFeatureImage(i, '')}
                  onBrowse={() => setBrowseTarget({ kind: 'feature', index: i })}
                  getImageUrl={getImageUrl}
                  aspectRatio="4/3"
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <MediaBrowser
        isOpen={browseTarget !== null}
        onClose={() => setBrowseTarget(null)}
        onSelect={handleSelect}
        multiple={browseTarget?.kind === 'gallery'}
      />
    </section>
  );
}

function SectionHeader() {
  return <h3 className="text-sm font-semibold text-gray-800 pb-2 border-b border-gray-100 mb-4">前台顯示設定</h3>;
}
