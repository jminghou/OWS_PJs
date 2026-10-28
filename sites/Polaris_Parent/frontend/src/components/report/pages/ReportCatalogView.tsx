/**
 * 報告目錄頁（依語言）：/report 是繁中，/{locale}/report 讀該語言的商品與目錄文字。
 */
import Link from 'next/link';
import { ArrowRight, ChevronDown } from 'lucide-react';
import ReportBookCover from '@/components/report/ReportBookCover';
import ReportUnavailable from '@/components/report/ReportUnavailable';
import Tag from '@/components/ui/Tag';
import { loadReportCatalog, loadReportProducts } from '@/lib/report/display';
import { REPORT_DEFAULT_LOCALE, reportBase, reportUi } from '@/lib/report/locale';
import { loadReportPrices } from '@/lib/report/prices';

/** 所有客製報告的目錄頁：每份報告以書封呈現，點進去是該報告的商品頁。 */
export default async function ReportCatalogView({ locale = REPORT_DEFAULT_LOCALE }: { locale?: string }) {
  // 目前所有報告共用同一組商品代碼；之後報告各自定價時改成依報告讀取
  const [prices, products, catalog] = await Promise.all([
    loadReportPrices(locale), loadReportProducts(locale), loadReportCatalog(locale),
  ]);
  const { faq } = catalog;
  const ui = reportUi(locale);
  // 其他語言：一款都還沒上架 → 說明目前只有中文版
  if (!products.length) return <ReportUnavailable locale={locale} chineseHref="/report" />;

  return (
    <div>
      {catalog.promo && <p className="bg-ink px-4 py-2.5 text-center text-sm text-white">{catalog.promo}</p>}

      <div className="mx-auto max-w-content px-4 pt-8 pb-12 md:px-6 md:pt-10 md:pb-16">
        <section className="max-w-2xl">
          <h1 className="font-heading text-[32px] font-normal text-ink md:text-h1">{catalog.title}</h1>
          {catalog.subtitle && <p className="mt-2 text-[17px] text-text md:text-lead">{catalog.subtitle}</p>}
        </section>

        <section id="reports" aria-label="報告列表" className="mt-8 scroll-mt-24">
          <p className="text-caption text-muted">
            {ui.catalogCount(products.length)}
          </p>
          <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-10 md:gap-x-6">
            {products.map((p) => (
              <li key={p.slug}>
                <Link
                  href={`${reportBase(locale)}/${p.slug}`}
                  className="group block rounded-card focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100"
                >
                  <div className="relative flex aspect-square items-center rounded-card bg-white p-5 transition-shadow duration-300 ease-out group-hover:shadow-md sm:p-7">
                    {p.badge && (
                      <Tag tone="status" className="absolute left-3 top-3 z-10">
                        {p.badge}
                      </Tag>
                    )}
                    <div className="w-full transition-transform duration-300 ease-out group-hover:-translate-y-1">
                      <ReportBookCover product={p} size="sm" />
                    </div>
                  </div>
                  <h2 className="mt-4 font-heading text-[18px] font-normal text-ink transition-colors duration-150 group-hover:text-blue-500 md:text-h4">
                    {p.name}
                  </h2>
                  <p className="mt-1 text-small text-text">{p.cardDescription}</p>
                  <p className="mt-1 text-caption text-muted">{p.audienceLabel}</p>
                  <p className="mt-2 text-sm">
                    {prices.digital.available ? (
                      <>
                        <span className="font-latin font-extrabold text-ink">{prices.digital.text}</span>
                        <span className="text-muted">・{ui.cardDigital}</span>
                      </>
                    ) : (
                      <span className="text-muted">{ui.priceSoon}</span>
                    )}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {catalog.audiences.length > 0 && <section aria-labelledby="catalog-audience" className="mt-12 md:mt-20">
          <h2 id="catalog-audience" className="font-heading text-[26px] font-normal text-ink md:text-h2">
            {catalog.audienceTitle}
          </h2>
          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
            {catalog.audiences.map((a) => (
              <Link
                key={a.label}
                href="#reports"
                className="group flex flex-col rounded-card bg-white p-3 pb-5 transition-shadow duration-300 ease-out hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100"
              >
                <div className="px-3 pt-4">
                  <p className="font-heading text-[18px] text-ink md:text-h4">{a.label}</p>
                  <p className="mt-1 text-small text-text">{a.note}</p>
                  <p className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-blue-500 transition-colors duration-150 group-hover:text-pink-600">
                    {ui.viewReports} <ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                  </p>
                </div>
              </Link>
            ))}
          </div>
          {catalog.audienceConsent && <p className="mt-5 max-w-2xl text-small text-muted">{catalog.audienceConsent}</p>}
        </section>}

        {faq.length > 0 && <section aria-labelledby="catalog-faq" className="mt-16 max-w-[720px] md:mt-24">
          <h2 id="catalog-faq" className="font-heading text-[26px] font-normal text-ink md:text-h2">
            {catalog.faqTitle}
          </h2>
          <div className="mt-6 space-y-3">
            {faq.map((f) => (
              <details key={f.q} className="group rounded-inner bg-white">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-inner px-6 py-5 font-medium text-ink transition-colors duration-150 hover:text-blue-500 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <ChevronDown
                    className="h-5 w-5 shrink-0 text-muted transition-transform duration-200 ease-out group-open:rotate-180"
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                </summary>
                <p className="px-6 pb-5 text-small text-text">{f.a}</p>
              </details>
            ))}
          </div>
        </section>}
      </div>
    </div>
  );
}
