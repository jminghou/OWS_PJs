/**
 * 改用模組（2026-10-28）：把現有的商品頁內容與目錄文字轉成模組，並幫每個語言版本的報告商品選好。
 *
 * - 繁中：用前台目前實際顯示的內容（後台自訂過的＋程式預設），轉完前台看起來一樣。
 * - 其他語言：只轉後台自訂過的段落（程式預設是中文，不轉）；缺的模組在商品上架檢查會列出來。
 * 模組代碼固定（{slug}-{type}、gift-audiences、catalog-faq、report-catalog），重跑會略過已存在的。
 */
import { productApi } from '@/lib/api';
import { pageModuleApi, type BulkModule } from '@/lib/api/pageModules';
import { REPORT_CATALOG, REPORT_PRODUCTS, type ReportProduct } from './catalog';
import {
  REPORT_CATALOG_FAQ_KEY,
  REPORT_CATALOG_KEY,
  REPORT_DISPLAY_KEY,
  applyReportCatalog,
  applyReportContent,
  type ReportCatalogAttributes,
  type ReportDisplayAttributes,
} from './display';
import { CATALOG_MODULE_KEY, PRODUCT_MODULES_KEY, PRODUCT_SLOTS, moduleTypeInfo, type ModuleRefs, type ModuleType } from './modules';

export const AUDIENCES_MODULE_KEY = 'gift-audiences';
export const CATALOG_FAQ_MODULE_KEY = 'catalog-faq';

const ZH = 'zh-TW';
const productKey = (base: ReportProduct, type: ModuleType) => `${base.slug}-${type}`;

/** 一款報告的模組內容：zh=true 用前台目前生效的內容，否則只取後台自訂過的段落 */
function productModules(base: ReportProduct, d: ReportDisplayAttributes, language: string): BulkModule[] {
  const zh = language === ZH;
  const c = applyReportContent(base, d);
  const out: BulkModule[] = [];
  const add = (type: ModuleType, customised: boolean, data: Record<string, unknown>) => {
    if (zh || customised) out.push({ module_key: productKey(base, type), type, language, name: `${base.name}：${moduleTypeInfo(type)?.label}`, data });
  };
  add('highlights', !!d.highlights, { items: c.highlights });
  if (c.testimonial) add('testimonial', !!d.testimonial, { ...c.testimonial });
  add('intro', !!d.intro, { paragraphs: c.intro });
  add('details', !!d.details, { items: c.details });
  add('features', !!d.features, {
    items: c.features.map((f, i) => ({ title: f.title, body: f.body, image: f.image, image_url: d.feature_images?.[i] ?? '' })),
  });
  add('process', !!d.process, { items: c.process });
  add('reviews', !!d.reviews, { items: c.reviews });
  add('faq', !!d.faq, { items: c.faq });
  return out;
}

/** 目錄頁設定＋送禮對象＋目錄頁常見問題 */
function catalogModules(attributes: Record<string, any>, language: string): BulkModule[] {
  const zh = language === ZH;
  const c: ReportCatalogAttributes = attributes[REPORT_CATALOG_KEY] ?? {};
  const faqCustom = Array.isArray(attributes[REPORT_CATALOG_FAQ_KEY]) && attributes[REPORT_CATALOG_FAQ_KEY].length > 0;
  const view = applyReportCatalog(attributes);
  const out: BulkModule[] = [];
  // 標題只帶後台改過的；留空時前台用頁面預設（商品頁與目錄頁的預設標題不同）
  if (zh || c.audiences) {
    out.push({ module_key: AUDIENCES_MODULE_KEY, type: 'audiences', language, name: '送禮對象（共用）',
      data: { title: c.audience_title ?? '', note: zh ? view.audienceConsent : c.audience_consent ?? '', items: view.audiences } });
  }
  if (zh || faqCustom) {
    out.push({ module_key: CATALOG_FAQ_MODULE_KEY, type: 'faq', language, name: '目錄頁：常見問題',
      data: { title: c.faq_title ?? '', items: view.faq } });
  }
  if (zh || c.title || c.subtitle || c.promo) {
    out.push({ module_key: CATALOG_MODULE_KEY, type: 'catalog_page', language, name: '報告目錄頁',
      data: {
        promo: zh ? view.promo : c.promo ?? '', title: zh ? view.title : c.title ?? '', subtitle: zh ? view.subtitle : c.subtitle ?? '',
        audiences: AUDIENCES_MODULE_KEY, faq: CATALOG_FAQ_MODULE_KEY,
      } });
  }
  return out;
}

const refsFor = (base: ReportProduct): ModuleRefs =>
  Object.fromEntries(PRODUCT_SLOTS.map(({ slot, type }) => [slot, type === 'audiences' ? AUDIENCES_MODULE_KEY : productKey(base, type)]));

/** 報告商品的所有語言版本（含 attributes） */
async function reportVersions(base: ReportProduct) {
  const res = await productApi.adminGetList({ group: true, search: base.displayProductId, per_page: 50 } as any);
  const group = (res as any).products?.find((p: any) => p.product_id === base.displayProductId);
  const ids: number[] = group ? (group.languages?.length ? group.languages.map((l: any) => l.id) : [group.id]) : [];
  return Promise.all(ids.map((id) => productApi.adminGetById(id)));
}

export interface ImportResult {
  created: number;
  skipped: number;
  products: number;
}

export async function importReportModules(): Promise<ImportResult> {
  const modules: BulkModule[] = [];
  const assign: { id: number; refs: ModuleRefs; hasRefs: boolean }[] = [];
  for (const [i, base] of REPORT_PRODUCTS.entries()) {
    for (const v of await reportVersions(base)) {
      const attrs = (v as any).attributes ?? {};
      const language = (v as any).language ?? ZH;
      modules.push(...productModules(base, attrs[REPORT_DISPLAY_KEY] ?? {}, language));
      if (i === 0) modules.push(...catalogModules(attrs, language));
      assign.push({ id: v.id, refs: refsFor(base), hasRefs: !!attrs[PRODUCT_MODULES_KEY] });
    }
  }
  const res = await pageModuleApi.bulk(modules);
  // 已經選過模組的商品不動
  const todo = assign.filter((a) => !a.hasRefs);
  for (const a of todo) await productApi.adminUpdate(a.id, { attributes: { [PRODUCT_MODULES_KEY]: a.refs } } as any);
  return { created: res.created.length, skipped: res.skipped.length, products: todo.length };
}

/** 用來說明有哪些報告會轉換 */
export const IMPORT_SUMMARY = `${REPORT_PRODUCTS.map((p) => p.name).join('、')}的商品頁內容，以及報告目錄頁（${REPORT_CATALOG.title}）`;
