import Link from 'next/link';
import ReportBookCover from '@/components/report/ReportBookCover';
import { REPORT_CATALOG, REPORT_PRODUCTS, productHref } from '@/lib/report/catalog';
import { loadReportPrices } from '@/lib/report/prices';

// 價格由商品後台設定；每 10 分鐘重新取得
export const revalidate = 600;

/** 所有客製報告的目錄頁：每份報告以書封呈現，點進去是該報告的商品頁。 */
export default async function ReportCatalogPage() {
  // 目前所有報告共用同一組商品代碼；之後報告各自定價時改成依報告讀取
  const prices = await loadReportPrices();

  return (
    <div>
      <p className="bg-brand-purple-700 px-4 py-2 text-center text-sm text-white">{REPORT_CATALOG.promo}</p>

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 md:py-14">
        <section className="max-w-2xl">
          <h1 className="text-[28px] font-bold leading-snug text-gray-900 md:text-[34px]">{REPORT_CATALOG.title}</h1>
          <p className="mt-3 text-base leading-7 text-gray-700">{REPORT_CATALOG.subtitle}</p>
        </section>

        <section id="reports" aria-label="報告列表" className="mt-10">
          <p className="text-sm text-gray-500">共 {REPORT_PRODUCTS.length} 份報告</p>
          <ul className="mt-4 grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
            {REPORT_PRODUCTS.map((p) => (
              <li key={p.slug}>
                <Link href={productHref(p)} className="group block">
                  <div className="relative rounded-banner bg-warm-100 p-5 transition-colors group-hover:bg-warm-200/70 sm:p-7">
                    {p.badge && (
                      <span className="absolute left-3 top-3 z-10 rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-brand-purple-700 shadow-sm">
                        {p.badge}
                      </span>
                    )}
                    <div className="transition-transform duration-300 group-hover:-translate-y-1">
                      <ReportBookCover product={p} size="sm" />
                    </div>
                  </div>
                  <h2 className="mt-4 text-base font-bold text-gray-900 group-hover:text-brand-purple-700">{p.name}</h2>
                  <p className="mt-1 text-sm leading-6 text-gray-600">{p.cardDescription}</p>
                  <p className="mt-1 text-xs text-gray-500">{p.audienceLabel}</p>
                  <p className="mt-2 text-sm">
                    {prices.digital.available ? (
                      <>
                        <span className="font-bold text-gray-900">{prices.digital.text}</span>
                        <span className="text-gray-500"> 起・數位版</span>
                      </>
                    ) : (
                      <span className="text-gray-400">{prices.digital.text}</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500">可加購精裝實體書</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section aria-label="服務特色" className="mt-16 grid grid-cols-2 gap-3 rounded-banner bg-white p-5 text-center text-sm text-gray-700 md:grid-cols-4">
          {REPORT_CATALOG.usps.map((u) => (
            <p key={u} className="py-2">{u}</p>
          ))}
        </section>

        <section aria-labelledby="catalog-audience" className="mt-16">
          <h2 id="catalog-audience" className="text-xl font-bold text-gray-900">你想送給誰？</h2>
          <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
            {REPORT_CATALOG.audiences.map((a) => (
              <Link key={a.label} href="#reports"
                    className="rounded-banner border border-warm-200/70 bg-white p-5 transition-colors hover:border-brand-purple-300">
                <div className="flex aspect-[4/3] items-center justify-center rounded-banner bg-warm-100 text-xs text-gray-400">
                  ［佔位］情境照片
                </div>
                <p className="mt-3 font-medium text-gray-900">{a.label}</p>
                <p className="mt-1 text-sm text-gray-600">{a.note}</p>
                <p className="mt-2 text-sm text-brand-purple-700">看看報告 →</p>
              </Link>
            ))}
          </div>
        </section>

        <section aria-labelledby="catalog-faq" className="mt-16 max-w-[720px]">
          <h2 id="catalog-faq" className="text-xl font-bold text-gray-900">客製報告常見問題</h2>
          <div className="mt-4 divide-y divide-warm-200 rounded-banner border border-warm-200/70 bg-white">
            {REPORT_CATALOG.faq.map((f) => (
              <details key={f.q} className="p-5">
                <summary className="cursor-pointer font-medium text-gray-900">{f.q}</summary>
                <p className="mt-2 text-sm leading-6 text-gray-600">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
