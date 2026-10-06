import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, BookOpen, Check, ChevronDown, Clock, Eye, PenLine, Star, Users, type LucideIcon } from 'lucide-react';
import ReportGallery from '@/components/report/ReportGallery';
import Tag from '@/components/ui/Tag';
import { brandButton } from '@/components/ui/BrandButton';
import {
  PHYSICAL_ADDON,
  REPORT_CATALOG,
  REPORT_PRODUCTS,
  productBySlug,
  type HighlightIcon,
} from '@/lib/report/catalog';
import { loadReportProduct } from '@/lib/report/display';
import { addonPrice, loadReportPrices } from '@/lib/report/prices';
import { getImageUrl } from '@/lib/utils';

// 價格與主區文字由商品後台設定；每 10 分鐘重新取得
export const revalidate = 600;
// 只接受目錄裡的報告；create / preview / checkout 等固定路徑不受影響
export const dynamicParams = false;

export function generateStaticParams() {
  return REPORT_PRODUCTS.map((p) => ({ slug: p.slug }));
}

const ICONS: Record<HighlightIcon, LucideIcon> = { users: Users, eye: Eye, clock: Clock, book: BookOpen, pen: PenLine };

// 精靈目前只服務一種報告；報告變多時改為 /report/{slug}/create
const START = '/report/create';

const sectionTitle = 'font-heading text-[26px] font-normal text-ink md:text-h2';

function StartButton({ className = '' }: { className?: string }) {
  return (
    <Link href={START} className={brandButton({ variant: 'primary', size: 'L', className })}>
      開始客製我的報告
      <ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
    </Link>
  );
}

/** FAQ／詳細說明的手風琴：每項一張白卡（規範 §7.3） */
function Accordion({ items }: { items: { title: string; body: React.ReactNode; open?: boolean }[] }) {
  return (
    <div className="space-y-3">
      {items.map((it) => (
        <details key={it.title} className="group rounded-inner bg-white" open={it.open}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-inner px-6 py-5 font-medium text-ink transition-colors duration-150 hover:text-blue-500 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 [&::-webkit-details-marker]:hidden">
            {it.title}
            <ChevronDown
              className="h-5 w-5 shrink-0 text-muted transition-transform duration-200 ease-out group-open:rotate-180"
              strokeWidth={2}
              aria-hidden="true"
            />
          </summary>
          <div className="px-6 pb-5 text-small text-text">{it.body}</div>
        </details>
      ))}
    </div>
  );
}

/** 單一報告的商品頁（版型參考 Wonderbly 商品頁）。預設數位版，實體書為加購選項。 */
export default async function ReportProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const base = productBySlug(slug);
  if (!base) notFound();
  const [product, prices] = await Promise.all([loadReportProduct(base), loadReportPrices()]);
  const addon = addonPrice(prices);

  return (
    <div className="mx-auto max-w-content px-4 py-8 md:px-6 md:py-12">
      <nav aria-label="麵包屑" className="text-sm text-muted">
        <Link href="/report" className="text-text transition-colors duration-150 hover:text-blue-500">客製報告</Link>
        <span className="mx-2">/</span>
        <span className="text-ink">{product.name}</span>
      </nav>

      {/* 主區：圖庫＋購買資訊 */}
      <section className="mt-6 grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-12">
        <ReportGallery product={product} />

        <div>
          {product.badge && <Tag tone="status">{product.badge}</Tag>}
          <h1 className="mt-3 font-heading text-[32px] font-normal text-ink md:text-h1">{product.name}</h1>
          <p className="mt-3 text-[17px] text-text md:text-lead">{product.tagline}</p>

          <ul className="mt-6 space-y-3">
            {product.highlights.map((h) => {
              const Icon = ICONS[h.icon];
              return (
                <li key={h.text} className="flex items-center gap-3 text-sm text-text">
                  <Icon className="h-5 w-5 shrink-0 text-blue-500" strokeWidth={2} aria-hidden="true" />
                  {h.text}
                </li>
              );
            })}
          </ul>

          {/* 主推方案：墨底報告卡（規範 §6.5，一頁最多一張） */}
          <div className="mt-8 rounded-card bg-ink p-7 text-white">
            <p className="text-sm text-[#D5D7E0]">數位版</p>
            <p
              className={`mt-1 font-latin text-[30px] font-extrabold leading-tight ${
                prices.digital.available ? 'text-white' : 'text-[#A9ADBD]'
              }`}
            >
              {prices.digital.text}
              {prices.digital.available && (
                <span className="ml-1 font-body text-base font-normal text-[#D5D7E0]">起</span>
              )}
            </p>
            <p className="mt-2 text-sm text-[#D5D7E0]">
              {PHYSICAL_ADDON.label}
              <span className="ml-2 font-latin font-semibold text-white">{addon.text}</span>
            </p>
            <StartButton className="mt-6 w-full" />
            <p className="mt-3 text-center text-caption text-[#D5D7E0]">約 3 分鐘填完資料，付款前可以先預覽。</p>
          </div>

          <figure className="mt-6 rounded-inner bg-blue-50 px-6 py-5">
            <blockquote className="font-heading text-blue-800">「{product.testimonial.quote}」</blockquote>
            <figcaption className="mt-2 text-caption text-blue-800">— {product.testimonial.author}</figcaption>
          </figure>
        </div>
      </section>

      {/* 詳細說明（可展開） */}
      <section aria-label="報告說明" className="mt-16 max-w-[760px] md:mt-24">
        <div className="space-y-4 text-text">
          {product.intro.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
        <div className="mt-8">
          <Accordion
            items={product.details.map((d, i) => ({
              title: d.title,
              open: i === 0,
              body: (
                <div className="space-y-2">
                  {d.body.map((b) => (
                    <p key={b}>{b}</p>
                  ))}
                </div>
              ),
            }))}
          />
        </div>
      </section>

      {/* 圖文特色 */}
      <section aria-label="特色" className="mt-16 space-y-12 md:mt-24 md:space-y-16">
        {product.features.map((f, i) => (
          <div key={f.title} className="grid grid-cols-1 items-center gap-6 md:grid-cols-2 md:gap-12">
            {f.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={getImageUrl(f.imageUrl, 'medium')}
                alt={f.title}
                loading="lazy"
                className={`aspect-[4/3] w-full rounded-[32px] object-cover ${i % 2 ? 'md:order-2' : ''}`}
              />
            ) : (
              <div
                className={`flex aspect-[4/3] items-center justify-center rounded-[32px] bg-tint text-sm text-muted ${
                  i % 2 ? 'md:order-2' : ''
                }`}
              >
                {f.image}
              </div>
            )}
            <div>
              <h2 className="font-heading text-[22px] font-normal text-ink md:text-h3">{f.title}</h2>
              <p className="mt-3 text-text">{f.body}</p>
              {f.title === PHYSICAL_ADDON.label && (
                <ul className="mt-4 space-y-1.5 text-sm text-text">
                  {PHYSICAL_ADDON.features.map((x) => (
                    <li key={x} className="flex gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" strokeWidth={2} aria-hidden="true" />
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
      <section aria-labelledby="pd-process" className="mt-16 md:mt-24">
        <h2 id="pd-process" className={sectionTitle}>怎麼製作</h2>
        <ol className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4 md:gap-6">
          {product.process.map((s, i) => (
            <li key={s.title} className="rounded-card bg-white p-6 md:p-8">
              <span className="font-latin text-[30px] font-extrabold leading-none text-blue-500">{i + 1}</span>
              <p className="mt-3 font-heading text-[18px] text-ink md:text-h4">{s.title}</p>
              <p className="mt-1 text-small text-text">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* 評價 */}
      <section aria-labelledby="pd-reviews" className="mt-16 md:mt-24">
        <h2 id="pd-reviews" className={sectionTitle}>讀者怎麼說</h2>
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
          {[1, 2, 3].map((n) => (
            <figure key={n} className="rounded-card bg-white p-6 md:p-8">
              <p aria-label="五顆星" className="flex gap-0.5 text-star-500">
                {[0, 1, 2, 3, 4].map((s) => (
                  <Star key={s} className="h-4 w-4 fill-current" strokeWidth={2} aria-hidden="true" />
                ))}
              </p>
              <blockquote className="mt-3 text-small text-text">［佔位］讀者評價 {n}</blockquote>
              <figcaption className="mt-2 text-caption text-muted">— ［佔位］讀者</figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section aria-labelledby="pd-faq" className="mt-16 max-w-[760px] md:mt-24">
        <h2 id="pd-faq" className={sectionTitle}>{product.name}常見問題</h2>
        <div className="mt-6">
          <Accordion items={product.faq.map((f) => ({ title: f.q, body: <p>{f.a}</p> }))} />
        </div>
        <p className="mt-4 text-sm text-muted">
          完整條款請見
          <Link
            href="/report/policy"
            className="text-blue-500 underline-offset-[3px] transition-colors duration-150 hover:text-pink-600 hover:underline"
          >
            《交易政策》
          </Link>
          。
        </p>
      </section>

      <section className="mt-16 rounded-card bg-white p-8 text-center md:mt-24 md:p-12">
        <p className="font-heading text-[22px] text-ink md:text-h3">準備好為重要的人製作一份報告了嗎？</p>
        <StartButton className="mt-6" />
      </section>

      {/* 你想送給誰 */}
      <section aria-labelledby="pd-audience" className="mt-16 md:mt-24">
        <h2 id="pd-audience" className={sectionTitle}>你想送給誰？</h2>
        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
          {REPORT_CATALOG.audiences.map((a) => (
            <Link
              key={a.label}
              href="/report"
              className="group rounded-card bg-white p-6 transition-shadow duration-300 ease-out hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100"
            >
              <p className="font-heading text-[18px] text-ink md:text-h4">{a.label}</p>
              <p className="mt-1 text-small text-text">{a.note}</p>
              <p className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-blue-500 transition-colors duration-150 group-hover:text-pink-600">
                看所有報告 <ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              </p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
