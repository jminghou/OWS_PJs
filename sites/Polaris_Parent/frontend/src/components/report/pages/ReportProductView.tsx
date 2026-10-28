import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, BookOpen, Check, ChevronDown, Clock, Eye, PenLine, Star, Users, type LucideIcon } from 'lucide-react';
import ReportGallery from '@/components/report/ReportGallery';
import Tag from '@/components/ui/Tag';
import { brandButton } from '@/components/ui/BrandButton';
import {
  PHYSICAL_ADDON,
  productBySlug,
  type HighlightIcon,
} from '@/lib/report/catalog';
import { loadReportCatalog, loadReportProductIn } from '@/lib/report/display';
import { REPORT_DEFAULT_LOCALE, reportBase, reportUi, withLang, type ReportUi } from '@/lib/report/locale';
import ReportUnavailable from '@/components/report/ReportUnavailable';
import { addonPrice, loadReportPrices } from '@/lib/report/prices';
import { getImageUrl } from '@/lib/utils';
import { OFFER_HREFS } from '@/lib/report/offers';

const ICONS: Record<HighlightIcon, LucideIcon> = { users: Users, eye: Eye, clock: Clock, book: BookOpen, pen: PenLine };

const sectionTitle = 'font-heading text-[26px] font-normal text-ink md:text-h2';

/**
 * 兩個獨立的購買入口（2026-10-28）：數位報告直接進填寫精靈；實體書先選「全新實體書／用我的報告做成書」。
 * 精靈目前只服務一種報告；報告變多時改為 /report/{slug}/create。
 */
function StartButtons({ book, locale, ui, onDark = false, className = '' }: {
  book: boolean; locale: string; ui: ReportUi; onDark?: boolean; className?: string;
}) {
  // 其他語言：語言帶進下單草稿；實體書直接走「全新實體書」（「用我的報告做成書」從會員中心進）
  const zh = locale === REPORT_DEFAULT_LOCALE;
  return (
    <div className={`flex flex-col gap-3 ${onDark ? '' : 'sm:flex-row sm:justify-center'} ${className}`}>
      <Link href={withLang(OFFER_HREFS.digital, locale)} className={brandButton({ variant: 'primary', size: 'L', className: onDark ? 'w-full' : '' })}>
        {ui.buy(ui.digital)}
        <ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
      </Link>
      {book && (
        <Link href={zh ? OFFER_HREFS.book : withLang(OFFER_HREFS.newBook, locale)}
          className={brandButton({ variant: onDark ? 'soft' : 'secondary', size: 'L', className: onDark ? 'w-full' : '' })}>
          {ui.buy(ui.book)}
          <ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
        </Link>
      )}
    </div>
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

/** 單一報告的商品頁（版型參考 Wonderbly 商品頁）；/report/{slug} 是繁中，/{locale}/report/{slug} 讀該語言的商品。 */
export default async function ReportProductView({ slug, locale = REPORT_DEFAULT_LOCALE }: { slug: string; locale?: string }) {
  const base = productBySlug(slug);
  if (!base) notFound();
  const [product, prices, catalog] = await Promise.all([
    loadReportProductIn(base, locale), loadReportPrices(locale), loadReportCatalog(locale),
  ]);
  if (!product) return <ReportUnavailable locale={locale} chineseHref={`/report/${slug}`} />;
  const addon = addonPrice(prices);
  const ui = reportUi(locale);
  const home = reportBase(locale);
  const audiences = product.audiences ?? catalog.audiences;

  return (
    <div className="mx-auto max-w-content px-4 py-8 md:px-6 md:py-12">
      <nav aria-label="麵包屑" className="text-sm text-muted">
        <Link href={home} className="text-text transition-colors duration-150 hover:text-blue-500">{ui.breadcrumb}</Link>
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

          {product.highlights.length > 0 && <ul className="mt-6 space-y-3">
            {product.highlights.map((h) => {
              const Icon = ICONS[h.icon];
              return (
                <li key={h.text} className="flex items-center gap-3 text-sm text-text">
                  <Icon className="h-5 w-5 shrink-0 text-blue-500" strokeWidth={2} aria-hidden="true" />
                  {h.text}
                </li>
              );
            })}
          </ul>}

          {/* 主推方案：墨底報告卡（規範 §6.5，一頁最多一張） */}
          <div className="mt-8 rounded-card bg-ink p-7 text-white">
            <p className="text-sm text-[#D5D7E0]">{ui.digital}</p>
            <p
              className={`mt-1 font-latin text-[30px] font-extrabold leading-tight ${
                prices.digital.available ? 'text-white' : 'text-[#A9ADBD]'
              }`}
            >
              {prices.digital.available ? prices.digital.text : ui.priceSoon}
              {prices.digital.available && (
                <span className="ml-1 font-body text-base font-normal text-[#D5D7E0]">{ui.from}</span>
              )}
            </p>
            {/* 後台「開放實體書」關閉時不顯示 */}
            {addon.available && (
              <p className="mt-2 text-sm text-[#D5D7E0]">
                {ui.book}{ui.bookIncludesDigital}
                <span className="ml-2 font-latin font-semibold text-white">{addon.text}</span>
              </p>
            )}
            <StartButtons book={addon.available} locale={locale} ui={ui} onDark className="mt-6" />
            <p className="mt-3 text-center text-caption text-[#D5D7E0]">{ui.startNote}</p>
            {ui.wizardNote && <p className="mt-1 text-center text-caption text-[#A9ADBD]">{ui.wizardNote}</p>}
          </div>

          {product.testimonial && (
            <figure className="mt-6 rounded-inner bg-blue-50 px-6 py-5">
              <blockquote className="font-heading text-blue-800">「{product.testimonial.quote}」</blockquote>
              {product.testimonial.author && <figcaption className="mt-2 text-caption text-blue-800">— {product.testimonial.author}</figcaption>}
            </figure>
          )}
        </div>
      </section>

      {/* 詳細說明（可展開）；後台模組沒選的區塊不顯示 */}
      {(product.intro.length > 0 || product.details.length > 0) && <section aria-label="報告說明" className="mt-16 max-w-[760px] md:mt-24">
        {product.intro.length > 0 && <div className="mb-8 space-y-4 text-text">
          {product.intro.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>}
        {product.details.length > 0 && <div>
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
        </div>}
      </section>}

      {/* 圖文特色 */}
      {product.features.length > 0 && <section aria-label="特色" className="mt-16 space-y-12 md:mt-24 md:space-y-16">
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
      </section>}

      {/* 製作方式 */}
      {product.process.length > 0 && <section aria-labelledby="pd-process" className="mt-16 md:mt-24">
        <h2 id="pd-process" className={sectionTitle}>{product.titles?.process ?? ui.process}</h2>
        <ol className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4 md:gap-6">
          {product.process.map((s, i) => (
            <li key={s.title} className="rounded-card bg-white p-6 md:p-8">
              <span className="font-latin text-[30px] font-extrabold leading-none text-blue-500">{i + 1}</span>
              <p className="mt-3 font-heading text-[18px] text-ink md:text-h4">{s.title}</p>
              <p className="mt-1 text-small text-text">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>}

      {/* 評價 */}
      {product.reviews.length > 0 && <section aria-labelledby="pd-reviews" className="mt-16 md:mt-24">
        <h2 id="pd-reviews" className={sectionTitle}>{product.titles?.reviews ?? ui.reviews}</h2>
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
          {product.reviews.map((r, n) => (
            <figure key={n} className="rounded-card bg-white p-6 md:p-8">
              <p aria-label={ui.fiveStars} className="flex gap-0.5 text-star-500">
                {[0, 1, 2, 3, 4].map((s) => (
                  <Star key={s} className="h-4 w-4 fill-current" strokeWidth={2} aria-hidden="true" />
                ))}
              </p>
              <blockquote className="mt-3 text-small text-text">{r.quote}</blockquote>
              {r.author && <figcaption className="mt-2 text-caption text-muted">— {r.author}</figcaption>}
            </figure>
          ))}
        </div>
      </section>}

      {/* FAQ（交易政策連結一律顯示） */}
      <section aria-labelledby={product.faq.length ? 'pd-faq' : undefined} className="mt-16 max-w-[760px] md:mt-24">
        {product.faq.length > 0 && <>
          <h2 id="pd-faq" className={sectionTitle}>{product.titles?.faq ?? ui.faqOf(product.name)}</h2>
          <div className="mt-6">
            <Accordion items={product.faq.map((f) => ({ title: f.q, body: <p>{f.a}</p> }))} />
          </div>
        </>}
        <p className="mt-4 text-sm text-muted">
          {ui.policyPrefix}
          <Link
            href="/report/policy"
            className="text-blue-500 underline-offset-[3px] transition-colors duration-150 hover:text-pink-600 hover:underline"
          >
            {ui.policyLink}
          </Link>
          。
        </p>
      </section>

      <section className="mt-16 rounded-card bg-white p-8 text-center md:mt-24 md:p-12">
        <p className="font-heading text-[22px] text-ink md:text-h3">{ui.ready}</p>
        <StartButtons book={addon.available} locale={locale} ui={ui} className="mt-6" />
      </section>

      {/* 你想送給誰：商品選的模組；沒改用模組時用目錄頁的 */}
      {audiences.length > 0 && <section aria-labelledby="pd-audience" className="mt-16 md:mt-24">
        <h2 id="pd-audience" className={sectionTitle}>{product.titles?.audiences ?? ui.audience}</h2>
        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
          {audiences.map((a) => (
            <Link
              key={a.label}
              href={home}
              className="group rounded-card bg-white p-6 transition-shadow duration-300 ease-out hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100"
            >
              <p className="font-heading text-[18px] text-ink md:text-h4">{a.label}</p>
              <p className="mt-1 text-small text-text">{a.note}</p>
              <p className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-blue-500 transition-colors duration-150 group-hover:text-pink-600">
                {ui.seeAllReports} <ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              </p>
            </Link>
          ))}
        </div>
      </section>}
    </div>
  );
}
