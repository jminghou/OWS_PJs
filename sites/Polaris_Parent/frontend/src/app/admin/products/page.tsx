'use client';

import { ProductsAdmin, type ProductLanguage } from '@ows/commerce/pages/products/index';
import { reportAttributeTabs } from '@/components/admin/ReportDisplaySection';
import { reportContentTabs } from '@/components/admin/ReportContentSection';
import { REPORT_ADDON_HIDDEN_IDS, ReportAddonTab, isAddonOwner, syncReportAddon } from '@/components/admin/ReportAddonSection';
import { REPORT_PRODUCTS } from '@/lib/report/catalog';

/**
 * 共用的商品後台，加掛客製報告的「前台文字」「商品頁內容」「前台圖片」「報告目錄」「實體書設定」分頁。
 * 實體書是數位版的加購選項：不在產品清單出現，改在數位版的「實體書設定」分頁設定。
 * 報告商品的代碼由程式決定（catalog.ts），新增時從「產品類型」選，不用自己填。
 */
const [textTab, imagesTab] = reportAttributeTabs;
const [contentTab, catalogTab] = reportContentTabs;
const tabs = [
  textTab,
  contentTab,
  imagesTab,
  catalogTab,
  { key: 'report-physical', label: '實體書設定', Component: ReportAddonTab, appliesTo: isAddonOwner },
];

const presets = REPORT_PRODUCTS.map((p) => ({
  productId: p.displayProductId,
  label: `報告商品：${p.name}`,
  description: `前台 /report/${p.slug} 讀這筆的名稱、價格與圖片；建立後重新打開，會多出「前台文字」「前台圖片」「實體書設定」分頁。`,
}));

/**
 * 販售語言：一種語言是一筆獨立商品（同一個產品 ID），各自的文案、售價與上架狀態。
 * 預設幣別＝該國幣別。要加語言：在這裡加一列，並同步 i18n/config.ts 的 locales（前台語系）。
 */
const LANGUAGES: ProductLanguage[] = [
  { code: 'zh-TW', label: '繁體中文', short: '繁中', currency: 'TWD' },
  { code: 'zh-CN', label: '簡體中文', short: '簡中', currency: 'CNY' },
  { code: 'en', label: '英文', short: '英文', currency: 'USD' },
  { code: 'ja', label: '日文', short: '日文', currency: 'JPY' },
];

export default function AdminProductsPage() {
  return (
    <ProductsAdmin
      attributeTabs={tabs}
      hiddenProductIds={REPORT_ADDON_HIDDEN_IDS}
      onAfterSave={syncReportAddon}
      presetProducts={presets}
      languages={LANGUAGES}
    />
  );
}
