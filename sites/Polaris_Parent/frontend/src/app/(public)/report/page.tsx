import Link from 'next/link';
import { productApi } from '@/lib/api';
import { REPORT_PRODUCT, REPORT_VARIANTS, type ReportVariant } from '@/lib/report/catalog';

// 價格由商品後台設定；每 10 分鐘重新取得
export const revalidate = 600;

type PriceLabel = { text: string; available: boolean };

async function loadPrices(): Promise<Record<ReportVariant, PriceLabel>> {
  const entries = await Promise.all(
    REPORT_VARIANTS.map(async (v) => {
      try {
        const p: any = await productApi.getById(v.productId, 'zh-TW', 'TWD');
        if (typeof p?.price === 'number') {
          return [v.variant, { text: `${p.currency_symbol || 'NT$'}${p.price.toLocaleString('zh-TW')}`, available: true }];
        }
      } catch {
        /* 後台尚未建立此商品 */
      }
      return [v.variant, { text: '價格即將公布', available: false }];
    })
  );
  return Object.fromEntries(entries) as Record<ReportVariant, PriceLabel>;
}

export default async function ReportProductPage() {
  const prices = await loadPrices();

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 md:py-16">
      <section className="max-w-[680px]">
        <p className="mb-3 text-sm font-medium tracking-widest text-brand-purple-700">客製命理報告</p>
        <h1 className="text-[28px] font-bold leading-snug text-gray-900 md:text-[32px]">{REPORT_PRODUCT.name}</h1>
        <p className="mt-3 text-lg text-gray-700">{REPORT_PRODUCT.tagline}</p>
        <div className="mt-6 space-y-4 text-base leading-7 text-gray-700">
          {REPORT_PRODUCT.intro.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
      </section>

      <section aria-labelledby="report-samples" className="mt-12">
        <h2 id="report-samples" className="text-xl font-bold text-gray-900">內容預覽</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {REPORT_PRODUCT.samplePages.map((label) => (
            <div
              key={label}
              className="flex aspect-[3/4] items-center justify-center rounded-banner border border-dashed border-warm-300 bg-white text-sm text-gray-400"
            >
              {label}
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="report-editions" className="mt-12">
        <h2 id="report-editions" className="text-xl font-bold text-gray-900">選擇版本</h2>
        <div className="mt-4 grid grid-cols-1 gap-5 md:grid-cols-2">
          {REPORT_VARIANTS.map((v) => (
            <article
              key={v.variant}
              className="flex flex-col rounded-banner border border-warm-200/70 bg-white p-6 shadow-[0_8px_30px_rgba(139,92,246,0.06)]"
            >
              <h3 className="text-lg font-bold text-gray-900">{v.label}</h3>
              <p className="mt-1 text-sm text-gray-600">{v.summary}</p>
              <p className={`mt-4 text-2xl font-bold ${prices[v.variant].available ? 'text-gray-900' : 'text-gray-400'}`}>
                {prices[v.variant].text}
              </p>
              <ul className="mt-4 space-y-1.5 text-sm text-gray-700">
                {v.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span aria-hidden="true" className="text-brand-purple-600">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-gray-500">{v.deliveryNote}</p>
              <Link
                href={`/report/customize?variant=${v.variant}`}
                className="mt-6 inline-flex justify-center rounded-banner bg-brand-purple-600 px-4 py-3 text-sm font-medium text-white hover:bg-brand-purple-700"
              >
                開始客製{v.label}
              </Link>
            </article>
          ))}
        </div>
        <p className="mt-6 text-sm text-gray-500">
          報告依你提供的出生資料個別製作，屬客製化商品，付款後不受理取消或退款；下單前請確認資料正確。
        </p>
      </section>
    </div>
  );
}
