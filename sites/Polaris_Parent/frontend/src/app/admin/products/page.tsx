'use client';

import { ProductsAdmin } from '@ows/commerce/pages/products/index';
import { reportAttributeTabs } from '@/components/admin/ReportDisplaySection';
import { REPORT_ADDON_HIDDEN_IDS, ReportAddonTab, isAddonOwner, syncReportAddon } from '@/components/admin/ReportAddonSection';

/**
 * 共用的商品後台，加掛客製報告的「前台文字」「前台圖片」「實體書設定」分頁。
 * 實體書是數位版的加購選項：不在產品清單出現，改在數位版的「實體書設定」分頁設定。
 */
const tabs = [
  ...reportAttributeTabs,
  { key: 'report-physical', label: '實體書設定', Component: ReportAddonTab, appliesTo: isAddonOwner },
];

export default function AdminProductsPage() {
  return <ProductsAdmin attributeTabs={tabs} hiddenProductIds={REPORT_ADDON_HIDDEN_IDS} onAfterSave={syncReportAddon} />;
}
