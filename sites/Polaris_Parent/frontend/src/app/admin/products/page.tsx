'use client';

import { ProductsAdmin } from '@ows/commerce/pages/products/index';
import { reportAttributeTabs } from '@/components/admin/ReportDisplaySection';

/** 共用的商品後台，加掛客製報告的「前台文字」「前台圖片」兩個分頁 */
export default function AdminProductsPage() {
  return <ProductsAdmin attributeTabs={reportAttributeTabs} />;
}
