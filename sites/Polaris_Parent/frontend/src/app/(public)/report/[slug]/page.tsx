import ReportProductView from '@/components/report/pages/ReportProductView';
import { REPORT_PRODUCTS } from '@/lib/report/catalog';

// 價格與主區文字由商品後台設定；每 10 分鐘重新取得
export const revalidate = 600;
// 只接受目錄裡的報告；create / preview / checkout 等固定路徑不受影響
export const dynamicParams = false;

export function generateStaticParams() {
  return REPORT_PRODUCTS.map((p) => ({ slug: p.slug }));
}

/** 單一報告的商品頁（繁中）；其他語言在 app/[locale]/report/[slug] */
export default async function ReportProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <ReportProductView slug={slug} />;
}
