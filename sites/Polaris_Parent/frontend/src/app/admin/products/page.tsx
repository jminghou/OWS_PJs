'use client';

import { ProductsAdmin, type ProductLanguage } from '@ows/commerce/pages/products/index';
import { reportAttributeTabs } from '@/components/admin/ReportDisplaySection';
import { reportModulesTab } from '@/components/admin/ReportModulesTab';
import { REPORT_ADDON_HIDDEN_IDS, ReportAddonTab, isAddonOwner, syncReportAddon } from '@/components/admin/ReportAddonSection';
import { REPORT_PRODUCTS } from '@/lib/report/catalog';
import { SALES_LANGUAGES } from '@/lib/report/locale';

/**
 * 共用的商品後台，加掛客製報告的「前台文字」「前台圖片」「頁面模組」「實體書設定」分頁。
 * 商品頁價格卡以下的內容與目錄頁改用「行銷管理 › 模組管理」的模組（2026-10-28），這裡只選用。
 * 實體書是數位版的加購選項：不在產品清單出現，改在數位版的「實體書設定」分頁設定。
 * 報告商品的代碼由程式決定（catalog.ts），新增時從「產品類型」選，不用自己填。
 */
const [textTab, imagesTab] = reportAttributeTabs;
const tabs = [
  textTab,
  imagesTab,
  reportModulesTab,
  { key: 'report-physical', label: '實體書設定', Component: ReportAddonTab, appliesTo: isAddonOwner },
];

const presets = REPORT_PRODUCTS.map((p) => ({
  productId: p.displayProductId,
  label: `報告商品：${p.name}`,
  description: `前台 /report/${p.slug} 讀這筆的名稱、價格與圖片；建立後重新打開，會多出「前台文字」「前台圖片」「實體書設定」分頁。`,
}));

/** 販售語言：一種語言是一筆獨立商品（同一個產品 ID），各自的文案、售價與上架狀態；清單在 lib/report/locale.ts */
const LANGUAGES: ProductLanguage[] = SALES_LANGUAGES;

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
