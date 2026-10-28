import Link from 'next/link';
import { ArrowRight, BookOpen, Sparkles } from 'lucide-react';
import { brandButton } from '@/components/ui/BrandButton';
import { REPORT_PRODUCT } from '@/lib/report/catalog';
import { addonPrice, loadReportPrices } from '@/lib/report/prices';
import { OFFER_HREFS, OFFER_NAMES } from '@/lib/report/offers';

// 價格由商品後台設定；每 10 分鐘重新取得
export const revalidate = 600;

/**
 * 購買實體書的第一步（2026-10-28）：要做一本全新的書，還是把已經買過的報告做成書？
 *   全新實體書——從主角資料開始填（含數位報告），結帳時選規格與收件資料
 *   用我的報告做成書——登入後選一份已購買的報告，再選規格、數量、客製，可在書裡改寫與加內容；
 *                       原本的報告不受影響，會員中心會多一個新的項目
 */
export default async function BookChooserPage() {
  const prices = await loadReportPrices();
  const addon = addonPrice(prices);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 md:px-6 md:py-16">
      <p className="text-sm font-medium tracking-widest text-blue-500">{OFFER_NAMES.book}</p>
      <h1 className="mt-2 font-heading text-[32px] font-normal text-ink md:text-h1">想做一本什麼樣的書？</h1>
      <p className="mt-3 text-text">
        {REPORT_PRODUCT.name}可以印成一本精裝的書，放在書架上，或送給長大後的他。
      </p>

      {!addon.available ? (
        <p className="mt-10 rounded-card bg-white p-8 text-text">
          {OFFER_NAMES.book}目前還沒有開放購買，敬請期待。你可以先購買
          <Link href={OFFER_HREFS.digital} className="mx-1 text-blue-700 underline-offset-2 hover:underline">{OFFER_NAMES.digital}</Link>
          ，之後再做成書。
        </p>
      ) : (
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <section className="flex flex-col rounded-card bg-white p-7">
            <Sparkles className="h-7 w-7 text-blue-500" strokeWidth={1.75} aria-hidden="true" />
            <h2 className="mt-4 font-heading text-[22px] text-ink md:text-h3">{OFFER_NAMES.newBook}</h2>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-text">
              還沒有為這位主角做過報告？從主角的資料開始填寫，我們製作報告並印成書；
              同時也會得到一份{OFFER_NAMES.digital}。
            </p>
            <p className="mt-4 text-sm text-muted">{OFFER_NAMES.digital}＋{OFFER_NAMES.book}・<span className="font-latin">{prices.physical.text}{prices.physical.available ? " 起" : ""}</span></p>
            <Link href={OFFER_HREFS.newBook} className={brandButton({ variant: 'primary', className: 'mt-5' })}>
              從頭開始做一本書
              <ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            </Link>
          </section>

          <section className="flex flex-col rounded-card bg-white p-7">
            <BookOpen className="h-7 w-7 text-blue-500" strokeWidth={1.75} aria-hidden="true" />
            <h2 className="mt-4 font-heading text-[22px] text-ink md:text-h3">{OFFER_NAMES.fromReport}</h2>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-text">
              已經買過{OFFER_NAMES.digital}？選一份報告，把它印成書。可以挑規格與數量，
              在書裡修改文字、放進照片；原本的報告不會被改動，會員中心會多一本新的書。
            </p>
            <p className="mt-4 text-sm text-muted">只收{OFFER_NAMES.book}的費用・<span className="font-latin">{addon.text.replace("+", "")}</span>・需要登入</p>
            <Link href={OFFER_HREFS.fromReport} className={brandButton({ variant: 'secondary', className: 'mt-5' })}>
              選我的報告
              <ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            </Link>
          </section>
        </div>
      )}
    </div>
  );
}
