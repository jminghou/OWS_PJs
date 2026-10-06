'use client';

import { ProductsAdmin } from '@ows/commerce/pages/products/index';
import ReportDisplaySection from '@/components/admin/ReportDisplaySection';

/** 共用的商品後台，加掛客製報告的「前台顯示設定」區塊 */
export default function AdminProductsPage() {
  return <ProductsAdmin AttributesSection={ReportDisplaySection} />;
}
