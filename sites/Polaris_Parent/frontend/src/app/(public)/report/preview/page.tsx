import ReportPreview from '@/components/report/preview/ReportPreview';
import { loadReportPrices } from '@/lib/report/prices';

// 價格由商品後台設定；每 10 分鐘重新取得
export const revalidate = 600;

export default async function ReportPreviewPage() {
  const prices = await loadReportPrices();
  return <ReportPreview prices={prices} />;
}
