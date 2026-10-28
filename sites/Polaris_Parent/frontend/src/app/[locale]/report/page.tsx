import { notFound } from 'next/navigation';
import ReportCatalogView from '@/components/report/pages/ReportCatalogView';
import { isReportLocale } from '@/lib/report/locale';

export const revalidate = 600;

/** 某個語言的報告目錄：只列出該語言已上架的報告；一款都沒有就顯示「目前只有中文版」 */
export default async function LocaleReportCatalogPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isReportLocale(locale)) notFound();
  return <ReportCatalogView locale={locale} />;
}
