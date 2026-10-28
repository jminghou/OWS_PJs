/**
 * 客製報告的前台顯示文字：程式內的預設值（catalog.ts）＋後台「產品管理」的設定。
 *
 * 後台對應（ReportProduct.displayProductId 那筆商品，通常是數位版）：
 *   產品名稱        → name
 *   簡短描述        → cardDescription
 *   attributes.report_display → tagline / badge / audienceLabel / cover（含封面圖）/ 圖庫內頁圖 / 特色區塊圖
 *                               ＋商品頁內容：介紹、亮點、推薦語、詳細說明、特色文字、怎麼製作、讀者怎麼說、常見問題
 *   attributes.report_catalog（＋report_catalog_faq）→ 目錄頁與「你想送給誰」等所有報告共用的文字
 * 後台留空的欄位沿用預設值；清單類（亮點、FAQ…）有任何一項就整段取代預設。後台沒建商品或 API 失敗時整份都用預設值。
 * 編輯介面在 components/admin/ReportDisplaySection.tsx 與 ReportContentSection.tsx。
 */
import { productApi } from '@/lib/api';
import { REPORT_CATALOG, REPORT_PRODUCTS, type CoverPalette, type HighlightIcon, type ReportProduct } from './catalog';

/** attributes 裡的頂層鍵；後端依頂層鍵合併，不會動到其他鍵 */
export const REPORT_DISPLAY_KEY = 'report_display';
/** 所有報告共用的目錄文字，存在第一款報告的商品上 */
export const REPORT_CATALOG_KEY = 'report_catalog';
export const REPORT_CATALOG_FAQ_KEY = 'report_catalog_faq';

export const HIGHLIGHT_ICONS: { value: HighlightIcon; label: string }[] = [
  { value: 'users', label: '人物' },
  { value: 'eye', label: '眼睛' },
  { value: 'clock', label: '時鐘' },
  { value: 'book', label: '書本' },
  { value: 'pen', label: '筆' },
];

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
  /** 圖文特色區塊的圖片，索引對應目前生效的 features；'' 表示該塊沒放圖 */
  feature_images?: string[];

  // ── 商品頁內容：有存就整段取代 catalog.ts 的預設 ──
  intro?: string[];
  highlights?: { icon: HighlightIcon; text: string }[];
  testimonial?: { quote: string; author: string };
  details?: { title: string; body: string[] }[];
  /** image 是沒上傳圖片時佔位框裡的說明 */
  features?: { title: string; body: string; image?: string }[];
  process?: { title: string; body: string }[];
  reviews?: { quote: string; author: string }[];
  faq?: { q: string; a: string }[];
}

/** attributes.report_catalog：所有報告共用的目錄文字 */
export interface ReportCatalogAttributes {
  title?: string;
  subtitle?: string;
  promo?: string;
  audience_title?: string;
  audience_consent?: string;
  faq_title?: string;
  audiences?: { label: string; note: string }[];
}

export type ReportCatalogView = Omit<typeof REPORT_CATALOG, 'audiences' | 'faq'> & {
  audiences: { label: string; note: string }[];
  faq: { q: string; a: string }[];
};

type RemoteProduct = { name?: string; short_description?: string; attributes?: Record<string, any> };

const text = (v: unknown, fallback: string) => (typeof v === 'string' && v.trim() ? v.trim() : fallback);
const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!x.trim()) : []);
const filled = (v: unknown) => typeof v === 'string' && !!v.trim();

/** 後台存的清單：過濾掉沒填完的項目；一項都不剩就用預設 */
function list<T>(v: unknown, ok: (x: any) => boolean, fallback: T[]): T[] {
  if (!Array.isArray(v)) return fallback;
  const items = v.filter((x) => !!x && typeof x === 'object' && ok(x));
  return items.length ? (items as T[]) : fallback;
}

const isIcon = (v: unknown): v is HighlightIcon => HIGHLIGHT_ICONS.some((i) => i.value === v);

/** 只套用商品頁內容（不含圖片）；後台的圖片分頁也用它找出目前生效的特色區塊 */
export function applyReportContent(base: ReportProduct, d: ReportDisplayAttributes): ReportProduct {
  return {
    ...base,
    intro: strings(d.intro).length ? strings(d.intro) : base.intro,
    highlights: list<{ icon: unknown; text: string }>(d.highlights, (h) => filled(h.text), base.highlights)
      .map((h) => ({ icon: isIcon(h.icon) ? h.icon : 'book', text: h.text })),
    testimonial: d.testimonial && filled(d.testimonial.quote)
      ? { quote: d.testimonial.quote, author: d.testimonial.author ?? '' }
      : base.testimonial,
    details: list<{ title: string; body: unknown }>(d.details, (x) => filled(x.title) && strings(x.body).length > 0, base.details)
      .map((x) => ({ title: x.title, body: strings(x.body) })),
    features: list<{ title: string; body?: string; image?: string }>(d.features, (x) => filled(x.title), base.features)
      .map((f) => ({ title: f.title, body: f.body ?? '', image: text(f.image, '［佔位］圖片') })),
    process: list(d.process, (x) => filled(x.title), base.process),
    reviews: list(d.reviews, (x) => filled(x.quote), base.reviews),
    faq: list(d.faq, (x) => filled(x.q) && filled(x.a), base.faq),
  };
}

export function applyReportDisplay(base: ReportProduct, remote: RemoteProduct | null): ReportProduct {
  if (!remote) return base;
  const d: ReportDisplayAttributes = remote.attributes?.[REPORT_DISPLAY_KEY] ?? {};
  const palette = COVER_PALETTES.some((p) => p.value === d.cover_palette) ? d.cover_palette! : base.cover.palette;
  const content = applyReportContent(base, d);
  return {
    ...content,
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
    features: content.features.map((f, i) => ({ ...f, imageUrl: text(d.feature_images?.[i], '') || undefined })),
  };
}

/**
 * 讀某個語言版本的商品（一種語言一筆商品）；沒有或未上架回 null。
 * preview 跳過後端公開回應快取，no-store 跳過 Next 資料快取。繁中帶 TWD；其他語言用該版本自己的幣別。
 */
async function fetchRemote(productId: string, language: string) {
  const zh = language === 'zh-TW';
  try {
    return await productApi.getById(productId, language, zh ? 'TWD' : undefined, {
      cache: 'no-store',
      params: { language, ...(zh ? { currency: 'TWD' } : {}), preview: 'true' },
    });
  } catch {
    return null;
  }
}

/** 繁中：後台沒建商品或 API 失敗時整份用程式預設 */
export async function loadReportProduct(base: ReportProduct, language = 'zh-TW'): Promise<ReportProduct> {
  return applyReportDisplay(base, await fetchRemote(base.displayProductId, language));
}

/** 其他語言：該語言版本沒上架就回 null（前台顯示「目前只有中文版」） */
export async function loadReportProductIn(base: ReportProduct, language: string): Promise<ReportProduct | null> {
  if (language === 'zh-TW') return loadReportProduct(base);
  const remote = await fetchRemote(base.displayProductId, language);
  return remote ? applyReportDisplay(base, remote) : null;
}

/** 目錄頁：繁中列出全部；其他語言只列出該語言已上架的報告 */
export async function loadReportProducts(language = 'zh-TW'): Promise<ReportProduct[]> {
  const all = await Promise.all(REPORT_PRODUCTS.map((p) => loadReportProductIn(p, language)));
  return all.filter((p): p is ReportProduct => p !== null);
}

/** 共用目錄文字：後台留空的欄位用 catalog.ts 的預設；FAQ 存在獨立屬性 report_catalog_faq */
export function applyReportCatalog(attributes: Record<string, any> | null | undefined): ReportCatalogView {
  const c: ReportCatalogAttributes = attributes?.[REPORT_CATALOG_KEY] ?? {};
  const base = REPORT_CATALOG;
  return {
    ...base,
    title: text(c.title, base.title),
    subtitle: text(c.subtitle, base.subtitle),
    promo: text(c.promo, base.promo),
    audienceTitle: text(c.audience_title, base.audienceTitle),
    audienceConsent: text(c.audience_consent, base.audienceConsent),
    faqTitle: text(c.faq_title, base.faqTitle),
    audiences: list(c.audiences, (a) => filled(a.label), base.audiences),
    faq: list(attributes?.[REPORT_CATALOG_FAQ_KEY], (f) => filled(f.q) && filled(f.a), base.faq),
  };
}

/** 目錄頁與商品頁「你想送給誰」共用；API 暫時無法使用時用程式內的定稿版本 */
export async function loadReportCatalog(language = 'zh-TW'): Promise<ReportCatalogView> {
  const remote = await fetchRemote(REPORT_PRODUCTS[0].displayProductId, language);
  return applyReportCatalog(remote?.attributes);
}
