'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Button from '@/components/platform/ui/Button';
import ReportDraftSummary from '@/components/report/ReportDraftSummary';
import ReportChartPreview from './ReportChartPreview';
import { useAuthStore } from '@/store/auth';
import {
  READER_OPTIONS,
  REPORT_PRODUCT,
  REPORT_TOC,
  REPORT_VARIANTS,
  SAMPLE_PAGE_TEMPLATES,
  type ReportVariant,
} from '@/lib/report/catalog';
import { clearDraft, loadDraft, saveDraft, type ReportDraft } from '@/lib/report/draft';
import type { ReportPrices } from '@/lib/report/prices';
import { firstIncompleteStep, stepHref } from '@/lib/report/steps';

const CHECKOUT = '/report/checkout';
const cardCls = 'rounded-banner border border-warm-200/70 bg-white p-5 sm:p-6';

function fill(template: string, draft: ReportDraft) {
  const reader = READER_OPTIONS.find((o) => o.value === draft.audience.reader)?.label ?? draft.audience.reader;
  const tokens: Record<string, string> = { call_name: draft.audience.call_name, name: draft.subject_name, reader };
  return template.replace(/\{(call_name|name|reader)\}/g, (_, k: string) => tokens[k]);
}

/**
 * 個人化預覽：封面、命盤、目錄、樣張、資料核對（可逐項修改），最後才選版本前往結帳。
 * 未登入時按結帳會先到登入頁，登入後回到結帳頁。
 */
export default function ReportPreview({ prices }: { prices: ReportPrices }) {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [draft, setDraft] = useState<ReportDraft | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const d = loadDraft();
    const pending = d && firstIncompleteStep(d);
    // 草稿不完整（例如直接打開本頁）→ 回精靈補齊
    if (pending) {
      router.replace(stepHref(pending.slug));
      return;
    }
    setDraft(d);
    setLoaded(true);
  }, [router]);

  if (!loaded) return null;

  if (!draft) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="text-xl font-bold text-gray-900">找不到填寫中的資料</h1>
        <p className="mt-2 text-sm text-gray-600">填寫內容只保存在填寫時使用的裝置與瀏覽器，超過 7 天會自動清除。</p>
        <Link href="/report/create"
              className="mt-6 inline-flex rounded-banner bg-brand-purple-600 px-5 py-3 text-sm font-medium text-white hover:bg-brand-purple-700">
          開始填寫報告資料
        </Link>
      </div>
    );
  }

  const selectVariant = (variant: ReportVariant) => {
    const next = { ...draft, variant };
    setDraft(next);
    saveDraft(next);
  };

  const proceed = () =>
    router.push(isAuthenticated ? CHECKOUT : `/login?next=${encodeURIComponent(CHECKOUT)}`);

  const startOver = () => {
    if (!window.confirm('要清除目前填寫的資料，改為另一位主角製作報告嗎？')) return;
    clearDraft();
    router.push('/report/create');
  };

  const selected = draft.variant ? prices[draft.variant] : null;

  return (
    <div className="pb-28">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <p className="text-sm font-medium tracking-widest text-brand-purple-700">預覽你的報告</p>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">{draft.audience.call_name}的{REPORT_PRODUCT.name}</h1>
        <p className="mt-2 text-sm text-gray-600">
          以下是依你填寫的資料產生的預覽。正式報告的內容在付款後逐章撰寫，並經人工審稿。
        </p>

        {/* 封面 */}
        <section aria-label="封面" className="mt-8">
          <div className="mx-auto flex aspect-[3/4] max-w-xs flex-col items-center justify-center rounded-banner bg-gradient-to-b from-brand-purple-700 to-brand-purple-900 p-8 text-center text-white shadow-lg">
            <p className="text-xs tracking-[0.3em] text-brand-purple-200">{REPORT_PRODUCT.name}</p>
            <p className="mt-6 text-3xl font-bold">{draft.subject_name}</p>
            <p className="mt-3 text-sm text-brand-purple-100">{draft.birth.date}</p>
          </div>
          {draft.audience.dedication.trim() && (
            <blockquote className="mx-auto mt-6 max-w-md whitespace-pre-line text-center text-sm italic leading-7 text-gray-700">
              {draft.audience.dedication.trim()}
            </blockquote>
          )}
        </section>

        {/* 命盤 */}
        <section aria-labelledby="pv-chart" className={`${cardCls} mt-10`}>
          <h2 id="pv-chart" className="text-lg font-bold text-gray-900">{draft.audience.call_name}的命盤</h2>
          <p className="mt-1 text-sm text-gray-600">報告會以這張本命盤為基礎撰寫。</p>
          <div className="mt-4">
            <ReportChartPreview draft={draft} />
          </div>
        </section>

        {/* 目錄 */}
        <section aria-labelledby="pv-toc" className={`${cardCls} mt-6`}>
          <h2 id="pv-toc" className="text-lg font-bold text-gray-900">報告目錄</h2>
          <ol className="mt-3 space-y-2 text-sm text-gray-700">
            {REPORT_TOC.map((t) => (
              <li key={t} className="border-b border-warm-100 pb-2 last:border-0">{t}</li>
            ))}
          </ol>
        </section>

        {/* 樣張 */}
        <section aria-labelledby="pv-samples" className="mt-10">
          <h2 id="pv-samples" className="text-lg font-bold text-gray-900">內頁樣張</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {SAMPLE_PAGE_TEMPLATES.map((p) => (
              <article key={p.title} className="flex min-h-[10rem] flex-col rounded-banner sm:aspect-[3/4] border border-warm-200 bg-white p-5 shadow-sm">
                <h3 className="text-sm font-bold text-brand-purple-800">{p.title}</h3>
                <p className="mt-3 text-sm leading-7 text-gray-700">{fill(p.body, draft)}</p>
              </article>
            ))}
          </div>
        </section>

        {/* 資料核對 */}
        <section aria-labelledby="pv-check" className="mt-10">
          <h2 id="pv-check" className="mb-4 text-lg font-bold text-gray-900">核對資料</h2>
          <ReportDraftSummary draft={{ ...draft, variant: null }} editable />
          <button type="button" onClick={startOver} className="mt-3 text-xs text-gray-500 hover:underline">
            改為另一位主角製作
          </button>
        </section>

        {/* 版本 */}
        <section aria-labelledby="pv-variant" className="mt-10">
          <h2 id="pv-variant" className="text-lg font-bold text-gray-900">選擇版本</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            {REPORT_VARIANTS.map((v) => {
              const active = draft.variant === v.variant;
              return (
                <label key={v.variant}
                       className={`relative flex cursor-pointer flex-col rounded-banner border-2 bg-white p-5 transition-colors ${
                         active ? 'border-brand-purple-500 bg-brand-purple-50' : 'border-warm-200 hover:border-brand-purple-300'
                       }`}>
                  <input type="radio" name="variant" value={v.variant} checked={active}
                         onChange={() => selectVariant(v.variant)} className="sr-only" />
                  {v.variant === 'physical' && (
                    <span className="absolute right-4 top-4 rounded-full bg-brand-purple-600 px-2 py-0.5 text-xs text-white">
                      含數位版
                    </span>
                  )}
                  <span className="text-base font-bold text-gray-900">{v.label}</span>
                  <span className="mt-1 text-sm text-gray-600">{v.summary}</span>
                  <span className={`mt-3 text-xl font-bold ${prices[v.variant].available ? 'text-gray-900' : 'text-gray-400'}`}>
                    {prices[v.variant].text}
                  </span>
                  <ul className="mt-3 space-y-1 text-sm text-gray-700">
                    {v.features.map((f) => (
                      <li key={f} className="flex gap-2">
                        <span aria-hidden="true" className="text-brand-purple-600">✓</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <span className="mt-3 text-xs text-gray-500">{v.deliveryNote}</span>
                </label>
              );
            })}
          </div>
          {draft.variant === 'physical' && <p className="mt-3 text-sm text-gray-500">收件人與地址會在結帳時填寫。</p>}
          <p className="mt-6 rounded-banner bg-white p-4 text-sm leading-6 text-gray-600">
            本報告依你提供的出生資料個別製作，屬客製化商品，不適用七日解除權；付款後不受理取消或退款。
            結帳前會再請你確認一次。
          </p>
        </section>
      </div>

      {/* 置底結帳列 */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-warm-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="min-w-0 text-sm">
            {draft.variant ? (
              <>
                <span className="text-gray-500">{REPORT_VARIANTS.find((v) => v.variant === draft.variant)!.label}</span>
                <span className="ml-2 font-bold text-gray-900">{selected?.text}</span>
              </>
            ) : (
              <span className="text-gray-500">請先選擇版本</span>
            )}
          </div>
          <Button onClick={proceed} disabled={!draft.variant}
                  className="shrink-0 bg-brand-purple-600 hover:bg-brand-purple-700 disabled:opacity-50">
            {isAuthenticated ? '前往結帳' : '登入並結帳'}
          </Button>
        </div>
      </div>
    </div>
  );
}
