import Link from 'next/link';
import { REPORT_PRODUCT, REPORT_VARIANTS } from '@/lib/report/catalog';
import { loadReportPrices } from '@/lib/report/prices';

// 價格由商品後台設定；每 10 分鐘重新取得
export const revalidate = 600;

const START = '/report/create';

function StartButton({ className = '' }: { className?: string }) {
  return (
    <Link
      href={START}
      className={`inline-flex justify-center rounded-banner bg-brand-purple-600 px-6 py-3 text-base font-medium text-white hover:bg-brand-purple-700 ${className}`}
    >
      開始客製我的報告
    </Link>
  );
}

/** 商品頁：價格與說明一眼看清楚，唯一的行動是開始填寫；版本在預覽後才選。 */
export default async function ReportProductPage() {
  const prices = await loadReportPrices();

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 md:py-16">
      <section className="grid grid-cols-1 gap-10 md:grid-cols-2 md:items-center">
        <div>
          <p className="mb-3 text-sm font-medium tracking-widest text-brand-purple-700">客製命理報告</p>
          <h1 className="text-[28px] font-bold leading-snug text-gray-900 md:text-[32px]">{REPORT_PRODUCT.name}</h1>
          <p className="mt-3 text-lg text-gray-700">{REPORT_PRODUCT.tagline}</p>

          <dl className="mt-6 grid grid-cols-2 gap-3">
            {REPORT_VARIANTS.map((v) => (
              <div key={v.variant} className="rounded-banner border border-warm-200/70 bg-white p-4">
                <dt className="text-sm text-gray-600">{v.label}</dt>
                <dd className={`mt-1 text-xl font-bold ${prices[v.variant].available ? 'text-gray-900' : 'text-gray-400'}`}>
                  {prices[v.variant].text}
                </dd>
              </div>
            ))}
          </dl>

          <StartButton className="mt-6 w-full sm:w-auto" />
          <p className="mt-3 text-xs text-gray-500">約 3 分鐘填完資料，先看命盤與樣張，再決定版本。</p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {REPORT_PRODUCT.samplePages.map((label) => (
            <div
              key={label}
              className="flex aspect-[3/4] items-center justify-center rounded-banner border border-dashed border-warm-300 bg-white text-xs text-gray-400"
            >
              {label}
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="report-about" className="mt-16 max-w-[680px]">
        <h2 id="report-about" className="text-xl font-bold text-gray-900">這份報告是什麼</h2>
        <div className="mt-4 space-y-4 text-base leading-7 text-gray-700">
          {REPORT_PRODUCT.intro.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
        <h3 className="mt-8 text-base font-bold text-gray-900">適合誰</h3>
        <ul className="mt-3 space-y-1.5 text-sm text-gray-700">
          {REPORT_PRODUCT.forWhom.map((f) => (
            <li key={f} className="flex gap-2">
              <span aria-hidden="true" className="text-brand-purple-600">✓</span>
              {f}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="report-editions" className="mt-16">
        <h2 id="report-editions" className="text-xl font-bold text-gray-900">兩種版本</h2>
        <div className="mt-4 grid grid-cols-1 gap-5 md:grid-cols-2">
          {REPORT_VARIANTS.map((v) => (
            <article key={v.variant} className="rounded-banner border border-warm-200/70 bg-white p-6">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-lg font-bold text-gray-900">{v.label}</h3>
                <p className={`text-lg font-bold ${prices[v.variant].available ? 'text-gray-900' : 'text-gray-400'}`}>
                  {prices[v.variant].text}
                </p>
              </div>
              <p className="mt-1 text-sm text-gray-600">{v.summary}</p>
              <ul className="mt-4 space-y-1.5 text-sm text-gray-700">
                {v.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span aria-hidden="true" className="text-brand-purple-600">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-gray-500">{v.deliveryNote}</p>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="report-process" className="mt-16">
        <h2 id="report-process" className="text-xl font-bold text-gray-900">怎麼製作</h2>
        <ol className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
          {REPORT_PRODUCT.process.map((s, i) => (
            <li key={s.title} className="rounded-banner border border-warm-200/70 bg-white p-5">
              <span className="text-sm font-bold text-brand-purple-700">{i + 1}</span>
              <p className="mt-1 font-medium text-gray-900">{s.title}</p>
              <p className="mt-1 text-sm leading-6 text-gray-600">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="report-faq" className="mt-16 max-w-[680px]">
        <h2 id="report-faq" className="text-xl font-bold text-gray-900">常見問題</h2>
        <div className="mt-4 divide-y divide-warm-200 rounded-banner border border-warm-200/70 bg-white">
          {REPORT_PRODUCT.faq.map((f) => (
            <details key={f.q} className="group p-5">
              <summary className="cursor-pointer list-none font-medium text-gray-900">{f.q}</summary>
              <p className="mt-2 text-sm leading-6 text-gray-600">{f.a}</p>
            </details>
          ))}
        </div>
        <p className="mt-4 text-sm text-gray-500">
          完整條款請見<Link href="/report/policy" className="text-brand-purple-700 hover:underline">《交易政策》</Link>。
        </p>
      </section>

      <section className="mt-16 text-center">
        <StartButton />
      </section>
    </div>
  );
}
