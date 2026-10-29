/**
 * 頁面模組（產品管理「模組管理」，2026-10-28）。
 *
 * 商品頁與目錄頁的內容區塊各自是一個模組（後端 extensions/page_modules，表 shop.page_modules）：
 * - 商品在 attributes.report_modules 依「位置」引用模組代碼：{ intro: 'natal-report-intro', faq: 'faq-1a2b3c', … }；
 *   位置沒選（或模組沒有該語言的已啟用版本）就不顯示那一段。
 * - 目錄頁設定是 type=catalog_page、代碼 report-catalog 的模組；它的 audiences / faq 也是模組代碼。
 * - 一個模組一種語言一筆，前台取該語言那一筆，不會拿中文頂替。
 * 商品還沒有 report_modules（尚未改用模組）時，前台照舊讀 attributes.report_display（lib/report/display.ts）。
 */
import { request } from '@ows/platform-api/client';
import type { HighlightIcon } from './catalog';

export const PRODUCT_MODULES_KEY = 'report_modules';
export const CATALOG_MODULE_KEY = 'report-catalog';

export type ModuleType =
  | 'intro' | 'highlights' | 'testimonial' | 'details' | 'features' | 'process' | 'reviews' | 'faq' | 'audiences'
  | 'catalog_page';

/** 各類型的內容格式（存在 page_modules.data） */
export interface ModuleData {
  intro: { paragraphs: string[] };
  highlights: { items: { icon: HighlightIcon; text: string }[] };
  testimonial: { quote: string; author: string };
  details: { items: { title: string; body: string[] }[] };
  /** image：沒上傳圖片時佔位框裡的說明；image_url：媒體庫的 file_path */
  features: { items: { title: string; body: string; image?: string; image_url?: string }[] };
  process: { title?: string; items: { title: string; body: string }[] };
  reviews: { title?: string; items: { quote: string; author: string }[] };
  faq: { title?: string; items: { q: string; a: string }[] };
  /** note：目錄頁區塊下方的提醒 */
  audiences: { title?: string; note?: string; items: { label: string; note: string }[] };
  catalog_page: { promo?: string; title?: string; subtitle?: string; audiences?: string; faq?: string };
}

export interface ModuleTypeInfo {
  type: ModuleType;
  label: string;
  /** 在頁面上的位置說明 */
  where: string;
  /** 前台標題可自訂（留空用頁面預設） */
  titled?: boolean;
}

export const MODULE_TYPES: ModuleTypeInfo[] = [
  { type: 'highlights', label: '亮點', where: '商品頁：標題下方、價格卡上方的短句' },
  { type: 'testimonial', label: '推薦語', where: '商品頁：價格卡下方的藍底引言' },
  { type: 'intro', label: '介紹段落', where: '商品頁：詳細說明上方的幾段文字' },
  { type: 'details', label: '詳細說明', where: '商品頁：可展開的說明（第一項預設展開）' },
  { type: 'features', label: '圖文特色', where: '商品頁：圖文交錯的介紹（含圖片）' },
  { type: 'process', label: '製作流程', where: '商品頁：編號步驟卡片', titled: true },
  { type: 'reviews', label: '讀者評價', where: '商品頁：五顆星評價卡片', titled: true },
  { type: 'faq', label: '常見問題', where: '商品頁或目錄頁的問答', titled: true },
  { type: 'audiences', label: '送禮對象', where: '商品頁與目錄頁的「你想送給誰」卡片', titled: true },
];

export const moduleTypeInfo = (type: string) => MODULE_TYPES.find((t) => t.type === type);

/** 商品頁的固定位置，依頁面由上到下 */
export const PRODUCT_SLOTS: { slot: string; type: ModuleType; label: string }[] = [
  { slot: 'highlights', type: 'highlights', label: '亮點' },
  { slot: 'testimonial', type: 'testimonial', label: '推薦語' },
  { slot: 'intro', type: 'intro', label: '介紹段落' },
  { slot: 'details', type: 'details', label: '詳細說明' },
  { slot: 'features', type: 'features', label: '圖文特色' },
  { slot: 'process', type: 'process', label: '製作流程' },
  { slot: 'reviews', type: 'reviews', label: '讀者評價' },
  { slot: 'faq', type: 'faq', label: '常見問題' },
  { slot: 'audiences', type: 'audiences', label: '你想送給誰' },
];

export const CATALOG_SLOTS: { slot: 'audiences' | 'faq'; type: ModuleType; label: string }[] = [
  { slot: 'audiences', type: 'audiences', label: '你想送給誰' },
  { slot: 'faq', type: 'faq', label: '常見問題' },
];

export function emptyModuleData(type: ModuleType): Record<string, unknown> {
  switch (type) {
    case 'intro': return { paragraphs: [] };
    case 'testimonial': return { quote: '', author: '' };
    case 'catalog_page': return {};
    default: return { items: [] };
  }
}

export type ModuleRefs = Record<string, string>;
export type ResolvedModules = Record<string, { type: ModuleType; data: any }>;

/** 商品的 attributes.report_modules；沒有＝商品還沒改用模組 */
export function productModuleRefs(attributes: Record<string, any> | null | undefined): ModuleRefs | null {
  const refs = attributes?.[PRODUCT_MODULES_KEY];
  if (!refs || typeof refs !== 'object' || Array.isArray(refs)) return null;
  return Object.fromEntries(Object.entries(refs).filter(([, v]) => typeof v === 'string')) as ModuleRefs;
}

/** 前台讀模組（只回已啟用、該語言的版本）；API 失敗回空物件 → 那幾段不顯示 */
export async function fetchModules(keys: string[], language: string): Promise<ResolvedModules> {
  const wanted = [...new Set(keys.filter(Boolean))];
  if (!wanted.length) return {};
  try {
    const res = await request<{ modules: ResolvedModules }>('/page-modules', {
      cache: 'no-store',
      params: { keys: wanted.join(','), language },
    });
    return res.modules ?? {};
  } catch {
    return {};
  }
}

const filled = (v: unknown) => typeof v === 'string' && !!v.trim();
const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => filled(x)) : []);
const items = <T,>(v: unknown, ok: (x: any) => boolean): T[] =>
  Array.isArray(v) ? (v.filter((x) => !!x && typeof x === 'object' && ok(x)) as T[]) : [];

/** 取某個位置的模組資料（類型不符就當作沒選） */
export function moduleAt<T extends ModuleType>(mods: ResolvedModules, key: string | undefined, type: T): Partial<ModuleData[T]> | null {
  const m = key ? mods[key] : undefined;
  return m && m.type === type ? (m.data as Partial<ModuleData[T]>) : null;
}

export const cleanTitle = (v: unknown) => (filled(v) ? (v as string).trim() : undefined);

export const readModule = {
  intro: (d: Partial<ModuleData['intro']> | null) => strings(d?.paragraphs),
  highlights: (d: Partial<ModuleData['highlights']> | null) =>
    items<{ icon: HighlightIcon; text: string }>(d?.items, (h) => filled(h.text)),
  testimonial: (d: Partial<ModuleData['testimonial']> | null) =>
    d && filled(d.quote) ? { quote: d.quote as string, author: d.author ?? '' } : undefined,
  details: (d: Partial<ModuleData['details']> | null) =>
    items<{ title: string; body: unknown }>(d?.items, (x) => filled(x.title) && strings(x.body).length > 0)
      .map((x) => ({ title: x.title, body: strings(x.body) })),
  features: (d: Partial<ModuleData['features']> | null) =>
    items<{ title: string; body?: string; image?: string; image_url?: string }>(d?.items, (x) => filled(x.title))
      .map((f) => ({ title: f.title, body: f.body ?? '', image: filled(f.image) ? f.image! : '［佔位］圖片', imageUrl: filled(f.image_url) ? f.image_url : undefined })),
  process: (d: Partial<ModuleData['process']> | null) => items<{ title: string; body: string }>(d?.items, (x) => filled(x.title)),
  reviews: (d: Partial<ModuleData['reviews']> | null) => items<{ quote: string; author: string }>(d?.items, (x) => filled(x.quote)),
  faq: (d: Partial<ModuleData['faq']> | null) => items<{ q: string; a: string }>(d?.items, (x) => filled(x.q) && filled(x.a)),
  audiences: (d: Partial<ModuleData['audiences']> | null) => items<{ label: string; note: string }>(d?.items, (x) => filled(x.label)),
};
