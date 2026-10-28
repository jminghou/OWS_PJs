'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Check } from 'lucide-react';
import BrandButton, { brandButton } from '@/components/ui/BrandButton';
import ReportDraftSummary from '@/components/report/ReportDraftSummary';
import ReportChartPreview from './ReportChartPreview';
import { useAuthStore } from '@/store/auth';
import ReportBookCover from '@/components/report/ReportBookCover';
import {
  PHYSICAL_ADDON,
  READER_OPTIONS,
  REPORT_PRODUCT,
  REPORT_TOC,
  SAMPLE_PAGE_TEMPLATES,
  variantInfo,
} from '@/lib/report/catalog';
import { clearDraft, loadDraft, saveDraft, type ReportDraft } from '@/lib/report/draft';
import { addonPrice, loadReportPrices, type ReportPrices } from '@/lib/report/prices';
import { LANGUAGE_NAMES, REPORT_DEFAULT_LOCALE } from '@/lib/report/locale';
import { pricePhysical } from '@/lib/api/reportOrders';
import PhysicalOptions, { normaliseSelection } from '@/components/report/PhysicalOptions';
import { OFFER_HREFS, OFFER_NAMES } from '@/lib/report/offers';
import { formatPrice } from '@/lib/report/prices';
import { firstIncompleteStep, stepHref } from '@/lib/report/steps';

const CHECKOUT = '/report/checkout';
const cardCls = 'rounded-card bg-white p-6 md:p-8';
const sectionTitle = 'font-heading text-[22px] font-normal text-ink md:text-h3';

function fill(template: string, draft: ReportDraft) {
  const reader = READER_OPTIONS.find((o) => o.value === draft.audience.reader)?.label ?? draft.audience.reader;
  const tokens: Record<string, string> = { call_name: draft.audience.call_name, name: draft.subject_name, reader };
  return template.replace(/\{(call_name|name|reader)\}/g, (_, k: string) => tokens[k]);
}

/**
 * 個人化預覽：封面、命盤、目錄、樣張、資料核對（可逐項修改），最後前往結帳。
 * 版本由入口決定（2026-10-28）：「數位報告」只有數位報告；「全新實體書」＝數位報告＋實體書，在這裡選規格。
 * 專人解讀不在購買流程裡，改從會員中心「專人解讀」分頁預約。
 * 未登入時按結帳會先到登入頁，登入後回到結帳頁。
 */
export default function ReportPreview({ prices: zhPrices }: { prices: ReportPrices }) {
  const router = useRouter();
  // 其他語言版本的草稿：售價與實體書設定改讀那個語言的商品（各自的幣別）
  const [prices, setPrices] = useState<ReportPrices>(zhPrices);
  const [pricesLang, setPricesLang] = useState(REPORT_DEFAULT_LOCALE);
  const { isAuthenticated } = useAuthStore();
  const [draft, setDraft] = useState<ReportDraft | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const lang = loadDraft()?.language;
    if (lang && lang !== REPORT_DEFAULT_LOCALE && lang !== pricesLang) {
      loadReportPrices(lang).then((p) => { setPrices(p); setPricesLang(lang); }).catch(() => setPricesLang(lang));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const lang = loadDraft()?.language ?? REPORT_DEFAULT_LOCALE;
    if (lang !== pricesLang) return; // 等該語言的售價載入完再檢查草稿
    const d = loadDraft();
    const pending = d && firstIncompleteStep(d);
    // 草稿不完整（例如直接打開本頁）→ 回精靈補齊
    if (pending) {
      router.replace(stepHref(pending.slug));
      return;
    }
    // 後台關閉實體書（或實體書沒有價格）時，舊草稿選的實體書改回數位報告；舊草稿帶的專人解讀一律清掉
    if (d && ((d.variant === 'physical' && !addonPrice(prices).available) || d.consult_sessions)) {
      const next: ReportDraft = {
        ...d,
        variant: d.variant === 'physical' && addonPrice(prices).available ? 'physical' : 'digital',
        consult_sessions: 0,
      };
      saveDraft(next);
      setDraft(next);
    } else {
      setDraft(d);
    }
    setLoaded(true);
  }, [router, prices, pricesLang]);

  if (!loaded) return null;

  if (!draft) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center md:py-24">
        <h1 className="font-heading text-[26px] font-normal text-ink md:text-h2">找不到填寫中的資料</h1>
        <p className="mt-3 text-text">填寫內容只保存在填寫時使用的裝置與瀏覽器，超過 7 天會自動清除。</p>
        <Link href="/report/create" className={brandButton({ variant: 'primary', className: 'mt-8' })}>
          開始填寫報告資料
          <ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
        </Link>
      </div>
    );
  }

  const physical = draft.variant === 'physical';
  const cfg = prices.physicalConfig;
  const setPhysical = (sel: ReportDraft['physical']) => {
    const next: ReportDraft = { ...draft, physical: sel };
    setDraft(next);
    saveDraft(next);
  };
  const proceed = () =>
    router.push(isAuthenticated ? CHECKOUT : `/login?next=${encodeURIComponent(CHECKOUT)}`);

  const startOver = () => {
    if (!window.confirm('要清除目前填寫的資料，改為另一位主角製作報告嗎？')) return;
    clearDraft();
    router.push(`/report/create?variant=${draft.variant}`);
  };

  const digital = variantInfo('digital');
  const addon = addonPrice(prices);
  const selection = physical && cfg?.enabled ? normaliseSelection(cfg, draft.physical) : null;
  const extras = selection && cfg ? pricePhysical(cfg, selection).total : 0;
  const total = prices.digital.amount != null
    ? { text: formatPrice(prices.digital.amount + extras, prices.symbol), available: true }
    : prices[draft.variant];

  return (
    <div className="pb-28">
      <div className="mx-auto max-w-3xl px-4 py-12 md:px-6 md:py-16">
        <p className="text-sm font-medium tracking-widest text-blue-500">預覽你的報告</p>
        <h1 className="mt-2 font-heading text-[32px] font-normal text-ink md:text-h1">
          {draft.audience.call_name}的{REPORT_PRODUCT.name}
        </h1>
        <p className="mt-3 text-text">
          以下是依你填寫的資料產生的預覽。正式報告的內容在付款後逐章撰寫，並經人工審稿。
        </p>

        {/* 封面 */}
        <section aria-label="封面" className="mt-10">
          <div className="mx-auto max-w-[16rem]">
            <ReportBookCover product={REPORT_PRODUCT} title={draft.subject_name} subtitle={REPORT_PRODUCT.name} size="lg" />
          </div>
          {draft.audience.dedication.trim() && (
            <blockquote className="mx-auto mt-8 max-w-md whitespace-pre-line rounded-inner bg-blue-50 px-6 py-5 font-heading not-italic leading-7 text-blue-800">
              {draft.audience.dedication.trim()}
            </blockquote>
          )}
        </section>

        {/* 命盤 */}
        <section aria-labelledby="pv-chart" className={`${cardCls} mt-12`}>
          <h2 id="pv-chart" className={sectionTitle}>{draft.audience.call_name}的命盤</h2>
          <p className="mt-1 text-small text-text">報告會以這張本命盤為基礎撰寫。</p>
          <div className="mt-4">
            <ReportChartPreview draft={draft} />
          </div>
        </section>

        {/* 目錄 */}
        <section aria-labelledby="pv-toc" className={`${cardCls} mt-6`}>
          <h2 id="pv-toc" className={sectionTitle}>報告目錄</h2>
          <ol className="mt-4 space-y-2 text-sm text-text">
            {REPORT_TOC.map((t) => (
              <li key={t} className="border-b border-line pb-2 last:border-0">{t}</li>
            ))}
          </ol>
        </section>

        {/* 樣張 */}
        <section aria-labelledby="pv-samples" className="mt-12">
          <h2 id="pv-samples" className={sectionTitle}>內頁樣張</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {SAMPLE_PAGE_TEMPLATES.map((p) => (
              <article key={p.title} className="flex min-h-[10rem] flex-col rounded-card bg-white p-6 sm:aspect-[3/4]">
                <h3 className="font-heading text-[18px] font-normal text-ink md:text-h4">{p.title}</h3>
                <p className="mt-3 text-sm leading-7 text-text">{fill(p.body, draft)}</p>
              </article>
            ))}
          </div>
        </section>

        {/* 資料核對 */}
        <section aria-labelledby="pv-check" className="mt-12">
          <h2 id="pv-check" className={`mb-4 ${sectionTitle}`}>核對資料</h2>
          <ReportDraftSummary draft={draft} editable showVariant={false} />
          <button
            type="button"
            onClick={startOver}
            className="mt-3 inline-flex min-h-[44px] items-center rounded-full text-caption text-muted underline-offset-[3px] transition-colors duration-150 hover:text-blue-500 hover:underline active:text-blue-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100"
          >
            改為另一位主角製作
          </button>
        </section>

        {/* 內容與加購 */}
        <section aria-labelledby="pv-order" className="mt-12">
          <h2 id="pv-order" className={sectionTitle}>你的報告</h2>
          <div className={`${cardCls} mt-4`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-bold text-ink">{REPORT_PRODUCT.name}・{digital.label}</p>
                <p className="mt-1 text-sm text-text">{digital.summary}</p>
                <p className="mt-1 text-caption text-muted">{digital.deliveryNote}</p>
              </div>
              <p className={`shrink-0 font-latin font-extrabold ${prices.digital.available ? 'text-ink' : 'text-muted'}`}>
                {prices.digital.text}
              </p>
            </div>
          </div>

          {physical && (
            <div className="mt-3 rounded-card border-[1.5px] border-blue-500 bg-blue-50 p-6 md:p-8">
              <span className="flex items-start justify-between gap-4">
                <span className="font-bold text-ink">{OFFER_NAMES.book}</span>
                <span className="shrink-0 font-latin font-extrabold text-ink">{addon.text}</span>
              </span>
              <span className="mt-1 block text-sm text-text">{PHYSICAL_ADDON.summary}</span>
              <ul className="mt-2 space-y-1 text-sm text-text">
                {PHYSICAL_ADDON.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" strokeWidth={2} aria-hidden="true" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {physical && cfg && selection && (
            <div className="mt-3 rounded-card bg-white p-6 md:p-8">
              <PhysicalOptions cfg={cfg} value={selection} onChange={setPhysical} symbol={prices.symbol} />
            </div>
          )}
          {physical && (
            <p className="mt-3 text-sm text-muted">
              收件人與地址會在結帳時填寫。報告完成後，我們會寄信請你用整本書的預覽設計封面、扉頁與要修改的地方；送印前會請你確認完整內容，確認前都可以取消實體書。
            </p>
          )}
          {!physical && addon.available && (
            <p className="mt-3 text-sm text-muted">
              想印成書？付款後可以在會員中心「{OFFER_NAMES.fromReport}」，或改選
              <Link href={OFFER_HREFS.book} className="mx-1 text-blue-700 underline-offset-2 hover:underline">{OFFER_NAMES.newBook}</Link>。
            </p>
          )}
          <p className="mt-6 rounded-inner bg-tint px-[18px] py-[14px] text-sm leading-relaxed text-text">
            本報告依你提供的出生資料個別製作，屬客製化商品，不適用七日解除權；付款後不受理取消或退款。
            結帳前會再請你確認一次。
          </p>
        </section>
      </div>

      {/* 置底結帳列 */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3 md:px-6">
          <div className="min-w-0 text-sm">
            <span className="text-muted">{physical ? `${OFFER_NAMES.digital}＋${OFFER_NAMES.book}` : OFFER_NAMES.digital}・合計</span>
            <span className="ml-2 font-latin font-extrabold text-ink">{total.text}</span>
            {draft.language && draft.language !== REPORT_DEFAULT_LOCALE && (
              <span className="ml-2 text-caption text-muted">（{LANGUAGE_NAMES[draft.language] ?? draft.language}版報告）</span>
            )}
          </div>
          <BrandButton onClick={proceed} variant="primary" className="shrink-0">
            {isAuthenticated ? '前往結帳' : '登入並結帳'}
            <ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          </BrandButton>
        </div>
      </div>
    </div>
  );
}
