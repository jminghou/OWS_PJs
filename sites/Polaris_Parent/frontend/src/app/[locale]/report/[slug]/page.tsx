import { notFound } from 'next/navigation';
import ReportProductView from '@/components/report/pages/ReportProductView';
import { REPORT_PRODUCTS } from '@/lib/report/catalog';
import { isReportLocale } from '@/lib/report/locale';

export const revalidate = 600;
export const dynamicParams = false;

export function generateStaticParams() {
  return REPORT_PRODUCTS.map((p) => ({ slug: p.slug }));
}

/** 某個語言的報告商品頁：讀該語言那一筆商品；沒上架就顯示「目前只有中文版」 */
export default async function LocaleReportProductPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  if (!isReportLocale(locale)) notFound();
  return <ReportProductView slug={slug} locale={locale} />;
}
