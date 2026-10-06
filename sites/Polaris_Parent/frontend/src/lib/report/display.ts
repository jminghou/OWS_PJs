/**
 * 客製報告的前台顯示文字：程式內的預設值（catalog.ts）＋後台「產品管理」的設定。
 *
 * 後台對應（ReportProduct.displayProductId 那筆商品，通常是數位版）：
 *   產品名稱        → name
 *   簡短描述        → cardDescription
 *   attributes.report_display → tagline / badge / audienceLabel / cover（含封面圖）/ 圖庫內頁圖 / 特色區塊圖
 * 後台留空的欄位沿用預設值；後台沒建商品或 API 失敗時整份都用預設值。
 * 編輯介面在 components/admin/ReportDisplaySection.tsx。
 */
import { productApi } from '@/lib/api';
import { REPORT_PRODUCTS, type CoverPalette, type ReportProduct } from './catalog';

/** attributes 裡的頂層鍵；後端依頂層鍵合併，不會動到其他鍵 */
export const REPORT_DISPLAY_KEY = 'report_display';

export const COVER_PALETTES: { value: CoverPalette; label: string }[] = [
  { value: 'purple', label: '墨色' },
  { value: 'indigo', label: '品牌藍' },
  { value: 'rose', label: '淡粉' },
  { value: 'teal', label: '淡藍' },
];

/** 存在 attributes.report_display 的欄位；只存後台有填的值 */
export interface ReportDisplayAttributes {
  tagline?: string;
  badge?: string;
  /** true：目錄卡片與商品頁都不顯示標籤 */
  badge_hidden?: boolean;
  audience_label?: string;
  cover_eyebrow?: string;
  cover_title?: string;
  cover_subtitle?: string;
  cover_palette?: CoverPalette;
  /** 圖片皆存媒體庫的 file_path */
  cover_image?: string;
  /** 商品頁圖庫的內頁圖（依序，第一張書封不算在內） */
  gallery_images?: string[];
  /** 圖文特色區塊的圖片，索引對應 catalog 的 features；'' 表示該塊沒放圖 */
  feature_images?: string[];
}

type RemoteProduct = { name?: string; short_description?: string; attributes?: Record<string, any> };

const text = (v: unknown, fallback: string) => (typeof v === 'string' && v.trim() ? v.trim() : fallback);
const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!x.trim()) : []);

export function applyReportDisplay(base: ReportProduct, remote: RemoteProduct | null): ReportProduct {
  if (!remote) return base;
  const d: ReportDisplayAttributes = remote.attributes?.[REPORT_DISPLAY_KEY] ?? {};
  const palette = COVER_PALETTES.some((p) => p.value === d.cover_palette) ? d.cover_palette! : base.cover.palette;
  return {
    ...base,
    name: text(remote.name, base.name),
    cardDescription: text(remote.short_description, base.cardDescription),
    tagline: text(d.tagline, base.tagline),
    badge: d.badge_hidden ? undefined : text(d.badge, base.badge ?? '') || undefined,
    audienceLabel: text(d.audience_label, base.audienceLabel),
    cover: {
      eyebrow: text(d.cover_eyebrow, base.cover.eyebrow),
      title: text(d.cover_title, base.cover.title),
      subtitle: text(d.cover_subtitle, base.cover.subtitle),
      palette,
      image: text(d.cover_image, '') || undefined,
    },
    galleryImages: strings(d.gallery_images),
    features: base.features.map((f, i) => ({ ...f, imageUrl: text(d.feature_images?.[i], '') || undefined })),
  };
}

/** 單一報告的顯示資料；與 loadReportPrices 用同一組參數，伺服器端同一次渲染只會打一次 API */
export async function loadReportProduct(base: ReportProduct): Promise<ReportProduct> {
  try {
    const remote = await productApi.getById(base.displayProductId, 'zh-TW', 'TWD');
    return applyReportDisplay(base, remote);
  } catch {
    return base; // 後台尚未建立此商品
  }
}

export const loadReportProducts = () => Promise.all(REPORT_PRODUCTS.map(loadReportProduct));
