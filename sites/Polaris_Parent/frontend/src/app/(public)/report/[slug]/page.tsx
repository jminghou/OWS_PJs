import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BookOpen, Clock, Eye, PenLine, Users, type LucideIcon } from 'lucide-react';
import ReportGallery from '@/components/report/ReportGallery';
import {
  PHYSICAL_ADDON,
  REPORT_CATALOG,
  REPORT_PRODUCTS,
  productBySlug,
  type HighlightIcon,
} from '@/lib/report/catalog';
import { addonPrice, loadReportPrices } from '@/lib/report/prices';

// 價格由商品後台設定；每 10 分鐘重新取得
export const revalidate = 600;
// 只接受目錄裡的報告；create / preview / checkout 等固定路徑不受影響
export const dynamicParams = false;

export function generateStaticParams() {
  return REPORT_PRODUCTS.map((p) => ({ slug: p.slug }));
}

const ICONS: Record<HighlightIcon, LucideIcon> = { users: Users, eye: Eye, clock: Clock, book: BookOpen, pen: PenLine };

// 精靈目前只服務一種報告；報告變多時改為 /report/{slug}/create
const START = '/report/create';

function StartButton({ className = '' }: { className?: string }) {
  return (
    <Link href={START}
          className={`inline-flex justify-center rounded-banner bg-brand-purple-600 px-6 py-3.5 text-base font-medium text-white hover:bg-brand-purple-700 ${className}`}>
      開始客製我的報告
    </Link>
  );
}

/** 單一報告的商品頁（版型參考 Wonderbly 商品頁）。預設數位版，實體書為加購選項。 */
export default async function ReportProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = productBySlug(slug);
  if (!product) notFound();
  const prices = await loadReportPrices();
  const addon = addonPrice(prices);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 md:py-12">
      <nav aria-label="麵包屑" className="text-sm text-gray-500">
        <Link href="/report" className="hover:text-brand-purple-700">客製報告</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-700">{product.name}</span>
      </nav>

      {/* 主區：圖庫＋購買資訊 */}
      <section className="mt-6 grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-12">
        <ReportGallery product={product} />

        <div>
          {product.badge && (
            <span className="inline-block rounded-full bg-brand-purple-100 px-3 py-1 text-xs font-medium text-brand-purple-700">
              {product.badge}
            </span>
          )}
          <h1 className="mt-3 text-[28px] font-bold leading-snug text-gray-900 md:text-[34px]">{product.name}</h1>
          <p className="mt-3 text-base leading-7 text-gray-700">{product.tagline}</p>

          <ul className="mt-6 space-y-3">
            {product.highlights.map((h) => {
              const Icon = ICONS[h.icon];
              return (
                <li key={h.text} className="flex items-center gap-3 text-sm text-gray-700">
                  <Icon className="h-5 w-5 shrink-0 text-brand-purple-600" aria-hidden="true" />
                  {h.text}
                </li>
              );
            })}
          </ul>

          <div className="mt-8 rounded-banner border border-warm-200/70 bg-white p-5">
            <p className="text-sm text-gray-500">數位版</p>
            <p className={`mt-1 text-3xl font-bold ${prices.digital.available ? 'text-gray-900' : 'text-gray-400'}`}>
              {prices.digital.text}
              {prices.digital.available && <span className="ml-1 text-base font-normal text-gray-500">起</span>}
            </p>
            <p className="mt-2 text-sm text-gray-600">
              {PHYSICAL_ADDON.label}
              <span className="ml-2 font-medium text-gray-900">{addon.text}</span>
            </p>
            <StartButton className="mt-5 w-full" />
            <p className="mt-3 text-center text-xs text-gray-500">約 3 分鐘填完資料，付款前可以先預覽。</p>
          </div>

          <figure className="mt-6 border-l-4 border-brand-purple-200 pl-4">
            <blockquote className="text-sm italic leading-6 text-gray-700">「{product.testimonial.quote}」</blockquote>
            <figcaption className="mt-1 text-xs text-gray-500">— {product.testimonial.author}</figcaption>
          </figure>
        </div>
      </section>

      {/* 詳細說明（可展開） */}
      <section aria-label="報告說明" className="mt-14 max-w-[760px]">
        <div className="space-y-4 text-base leading-7 text-gray-700">
          {product.intro.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
        <div className="mt-8 divide-y divide-warm-200 rounded-banner border border-warm-200/70 bg-white">
          {product.details.map((d, i) => (
            <details key={d.title} className="p-5" open={i === 0}>
              <summary className="cursor-pointer font-medium text-gray-900">{d.title}</summary>
              <div className="mt-3 space-y-2 text-sm leading-6 text-gray-600">
                {d.body.map((b) => (
                  <p key={b}>{b}</p>
                ))}
              </div>
            </details>
          ))}
        </div>
      </section>

      {/* 圖文特色 */}
      <section aria-label="特色" className="mt-16 space-y-12">
        {product.features.map((f, i) => (
          <div key={f.title} className="grid grid-cols-1 items-center gap-6 md:grid-cols-2 md:gap-12">
            <div className={`flex aspect-[4/3] items-center justify-center rounded-banner bg-warm-100 text-sm text-gray-400 ${i % 2 ? 'md:order-2' : ''}`}>
              {f.image}
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{f.title}</h2>
              <p className="mt-3 text-base leading-7 text-gray-700">{f.body}</p>
              {f.title === PHYSICAL_ADDON.label && (
                <ul className="mt-4 space-y-1.5 text-sm text-gray-700">
                  {PHYSICAL_ADDON.features.map((x) => (
                    <li key={x} className="flex gap-2">
                      <span aria-hidden="true" className="text-brand-purple-600">✓</span>
                      {x}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ))}
      </section>

      {/* 製作方式 */}
      <section aria-labelledby="pd-process" className="mt-16">
        <h2 id="pd-process" className="text-xl font-bold text-gray-900">怎麼製作</h2>
        <ol className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
          {product.process.map((s, i) => (
            <li key={s.title} className="rounded-banner border border-warm-200/70 bg-white p-5">
              <span className="text-sm font-bold text-brand-purple-700">{i + 1}</span>
              <p className="mt-1 font-medium text-gray-900">{s.title}</p>
              <p className="mt-1 text-sm leading-6 text-gray-600">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* 評價 */}
      <section aria-labelledby="pd-reviews" className="mt-16">
        <h2 id="pd-reviews" className="text-xl font-bold text-gray-900">讀者怎麼說</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          {[1, 2, 3].map((n) => (
            <figure key={n} className="rounded-banner border border-warm-200/70 bg-white p-5">
              <p aria-label="五顆星" className="text-amber-500">★★★★★</p>
              <blockquote className="mt-2 text-sm leading-6 text-gray-700">［佔位］讀者評價 {n}</blockquote>
              <figcaption className="mt-2 text-xs text-gray-500">— ［佔位］讀者</figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section aria-labelledby="pd-faq" className="mt-16 max-w-[760px]">
        <h2 id="pd-faq" className="text-xl font-bold text-gray-900">{product.name}常見問題</h2>
        <div className="mt-4 divide-y divide-warm-200 rounded-banner border border-warm-200/70 bg-white">
          {product.faq.map((f) => (
            <details key={f.q} className="p-5">
              <summary className="cursor-pointer font-medium text-gray-900">{f.q}</summary>
              <p className="mt-2 text-sm leading-6 text-gray-600">{f.a}</p>
            </details>
          ))}
        </div>
        <p className="mt-4 text-sm text-gray-500">
          完整條款請見<Link href="/report/policy" className="text-brand-purple-700 hover:underline">《交易政策》</Link>。
        </p>
      </section>

      <section className="mt-16 rounded-banner bg-white p-8 text-center">
        <p className="text-lg font-bold text-gray-900">準備好為重要的人製作一份報告了嗎？</p>
        <StartButton className="mt-5" />
      </section>

      {/* 你想送給誰 */}
      <section aria-labelledby="pd-audience" className="mt-16">
        <h2 id="pd-audience" className="text-xl font-bold text-gray-900">你想送給誰？</h2>
        <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
          {REPORT_CATALOG.audiences.map((a) => (
            <Link key={a.label} href="/report"
                  className="rounded-banner border border-warm-200/70 bg-white p-5 transition-colors hover:border-brand-purple-300">
              <p className="font-medium text-gray-900">{a.label}</p>
              <p className="mt-1 text-sm text-gray-600">{a.note}</p>
              <p className="mt-2 text-sm text-brand-purple-700">看所有報告 →</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
