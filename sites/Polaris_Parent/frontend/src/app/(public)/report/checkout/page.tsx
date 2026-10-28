'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { clsx } from 'clsx';
import Alert from '@/components/ui/Alert';
import BrandButton, { brandButton } from '@/components/ui/BrandButton';
import EmailVerifyBox from '@/components/report/EmailVerifyBox';
import ShippingFields, { EMPTY_SHIPPING, SHIPPING_LABELS } from '@/components/report/ShippingFields';
import ReportDraftSummary from '@/components/report/ReportDraftSummary';
import { useAuthStore } from '@/store/auth';
import { memberAccountApi, reportOrdersApi, type ShippingInfo } from '@/lib/api';
import { PHYSICAL_ADDON, POLICY_VERSION, REPORT_PRODUCT, variantInfo } from '@/lib/report/catalog';
import { clearDraft, isReadyForCheckout, loadDraft, type ReportDraft } from '@/lib/report/draft';
import { loadReportPrices, type ReportPrices } from '@/lib/report/prices';
import { LANGUAGE_NAMES, REPORT_DEFAULT_LOCALE } from '@/lib/report/locale';
import { pricePhysical, type PriceLine } from '@/lib/api/reportOrders';
import { PriceBreakdown, normaliseSelection } from '@/components/report/PhysicalOptions';
import { PREVIEW_HREF } from '@/lib/report/steps';

const CHECKOUT = '/report/checkout';
// 表單（docs/BRAND_GUIDELINES.md §6.3）
const inputBase =
  'w-full rounded-2xl border-[1.5px] px-[18px] py-[13px] text-base text-ink placeholder:text-muted ' +
  'focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100';
const inputCls = (invalid?: boolean) =>
  clsx(inputBase, invalid ? 'border-error bg-error-bg' : 'border-line-strong bg-white');
const labelCls = 'mb-1.5 block text-sm font-medium text-ink';
const cardCls = 'rounded-card bg-white p-6 md:p-8';
const cardTitleCls = 'font-heading text-[18px] font-normal text-ink md:text-h4';
const textLinkCls =
  'inline-flex items-center gap-1 text-sm text-blue-500 underline-offset-[3px] hover:text-pink-600 hover:underline';
const checkboxCls =
  'mt-0.5 h-[22px] w-[22px] shrink-0 cursor-pointer rounded-[7px] border-[1.5px] border-line-strong accent-blue-500 ' +
  'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100';

/** 結帳：Email 驗證 → 核對資料 →（實體書）收件資料 → 同意交易政策 → 建立待付款訂單。 */
export default function ReportCheckoutPage() {
  const router = useRouter();
  const { isAuthenticated, checkAuth } = useAuthStore();
  const [checked, setChecked] = useState(false);
  const [draft, setDraft] = useState<ReportDraft | null>(null);
  const [prices, setPrices] = useState<ReportPrices | null>(null);
  const [verification, setVerification] = useState<{ email: string; verified: boolean } | null>(null);
  const [shipping, setShipping] = useState<ShippingInfo>(EMPTY_SHIPPING);
  const [consented, setConsented] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [payMode, setPayMode] = useState<{ mode: string; available: boolean; deadline_days: number | null } | null>(null);

  useEffect(() => {
    checkAuth().finally(() => setChecked(true));
    const d = loadDraft();
    // 有草稿但資料不完整 → 回預覽頁（預覽頁會再把缺的資料導回精靈）
    if (d && !isReadyForCheckout(d)) {
      router.replace(PREVIEW_HREF);
      return;
    }
    setDraft(d);
    loadReportPrices(d?.language).then(setPrices).catch(() => setPrices(null));
  }, [checkAuth, router]);

  useEffect(() => {
    if (!checked) return;
    if (!isAuthenticated) {
      router.replace(`/login?next=${encodeURIComponent(CHECKOUT)}`);
      return;
    }
    reportOrdersApi.paymentMode().then(setPayMode).catch(() => setPayMode(null));
    memberAccountApi
      .getVerification()
      .then((v) => setVerification({ email: v.email, verified: v.email_verified }))
      .catch(() => setVerification({ email: '', verified: false }));
  }, [checked, isAuthenticated, router]);

  if (!checked || !isAuthenticated || !verification) return null;

  if (!draft) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center md:py-24">
        <h1 className="font-heading text-[26px] font-normal text-ink md:text-h2">還沒有要結帳的報告</h1>
        <p className="mt-3 text-small text-text">
          請先填寫報告主角的資料，確認後再前往結帳。填寫內容只保存在填寫時使用的裝置與瀏覽器 7 天；
          換了裝置或瀏覽器、超過 7 天，或訂單已經送出，這裡就不會有資料。
        </p>
        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link href="/report/create" className={brandButton({ variant: 'primary' })}>
            開始填寫報告資料
          </Link>
          <Link href="/report" className={textLinkCls}>看商品介紹</Link>
        </div>
      </div>
    );
  }

  const physical = draft.variant === 'physical';
  const cfg = prices?.physicalConfig ?? null;
  const selection = physical && cfg?.enabled ? normaliseSelection(cfg, draft.physical) : null;
  // 金額明細：數位報告＋實體書（第一本／第二本起／特殊客製）。專人解讀不在購買流程裡（會員中心「專人解讀」分頁預約）
  const lines: PriceLine[] = [];
  if (prices?.digital.amount != null) {
    lines.push({ label: `${REPORT_PRODUCT.name}・${variantInfo('digital').label}`, amount: prices.digital.amount });
    if (selection && cfg) lines.push(...pricePhysical(cfg, selection).lines.map((l) => ({ ...l, label: `實體書・${l.label}` })));
  }
  const total = lines.reduce((a, l) => a + l.amount, 0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});
    if (!consented) {
      setError('請先閱讀並同意交易政策');
      return;
    }
    setBusy(true);
    try {
      const res = await reportOrdersApi.create({
        ...draft,
        policy_consented: true,
        policy_version: POLICY_VERSION,
        ...(physical ? { shipping, physical: selection ?? undefined } : {}),
        consult_sessions: 0,
      });
      clearDraft();
      router.push(`/report/orders/${res.order.order_no}`);
    } catch (err: any) {
      setError(err.message || '送出失敗，請稍後再試');
      // 欄位錯誤：收件資料就地標示；其他欄位屬於草稿，請客人回到表單修改
      const errs = (err.errors || {}) as Record<string, string>;
      setFieldErrors(Object.fromEntries(Object.entries(errs).filter(([k]) => k in SHIPPING_LABELS)));
      if (Object.keys(errs).some((k) => !(k in SHIPPING_LABELS))) setError('報告資料有誤，請按「回到預覽」檢查並修改。');
      if (err.status === 403) setVerification((v) => (v ? { ...v, verified: false } : v));
    } finally {
      setBusy(false);
    }
  };

  const manualOpen = payMode?.mode === 'manual' && payMode.available;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 md:px-6 md:py-16">
      <h1 className="font-heading text-[32px] font-normal text-ink md:text-h1">結帳</h1>

      <div className="mt-8 space-y-6">
        {!verification.verified && (
          <EmailVerifyBox
            email={verification.email}
            onVerified={() => setVerification((v) => (v ? { ...v, verified: true } : v))}
          />
        )}

        <div>
          <ReportDraftSummary draft={draft} />
          <Link href={PREVIEW_HREF} className={clsx(textLinkCls, 'mt-3')}>
            <ArrowLeft className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            回到預覽修改資料或加購
          </Link>
        </div>

        <section className={cardCls}>
          <h2 className={cardTitleCls}>金額</h2>
          <div className="mt-3">
            {lines.length ? <PriceBreakdown lines={lines} total={total} symbol={prices?.symbol} /> : <p className="text-sm text-muted">載入中…</p>}
            {draft.language && draft.language !== REPORT_DEFAULT_LOCALE && (
              <p className="mt-2 text-sm text-muted">報告語言：{LANGUAGE_NAMES[draft.language] ?? draft.language}（完成後交付{LANGUAGE_NAMES[draft.language] ?? draft.language}版報告）</p>
            )}
          </div>
          <p className="mt-2 text-caption text-muted">實際金額以送出訂單時的售價為準。</p>
        </section>

        <form onSubmit={submit} className="space-y-6">
          {physical && (
            <section className={clsx(cardCls, 'space-y-5')}>
              <h2 className={cardTitleCls}>收件資料</h2>
              <p className="text-sm text-text">實體書由合作印刷廠寄出，收件人可以不是你本人。</p>
              <ShippingFields value={shipping} onChange={setShipping} errors={fieldErrors} idPrefix="ck" />
            </section>
          )}

          <section className={cardCls}>
            <h2 className={cardTitleCls}>付款</h2>
            {/* 付款說明：可下單時是資訊提示；暫停接單或付款尚未開放時是警示 */}
            <Alert tone={manualOpen ? 'info' : 'warning'} className="mt-3">
              {manualOpen
                ? `銀行轉帳。送出訂單後會顯示匯款帳號，請於 ${payMode?.deadline_days} 天內轉帳並回報轉出帳號末五碼；我們確認入帳後才會開始製作。`
                : payMode?.mode === 'manual'
                  ? '目前暫停接受訂單，請稍後再試。'
                  : '付款功能尚未開放。送出後訂單會保留為「待付款」，開放付款後我們會以 Email 通知你。'}
            </Alert>
          </section>

          <label className="flex cursor-pointer items-start gap-3 rounded-card bg-white p-6 text-sm leading-6 text-text md:px-8">
            <input type="checkbox" checked={consented} onChange={(e) => setConsented(e.target.checked)}
                   className={checkboxCls} />
            <span>
              我已確認出生資料正確，並了解本商品為客製化商品，不適用七日解除權，付款後不受理取消或退款（例外情形依
              <Link href="/report/policy" target="_blank"
                    className="text-blue-500 underline-offset-[3px] hover:text-pink-600 hover:underline">《交易政策》</Link>
              處理）。
            </span>
          </label>

          {error && <Alert tone="error">{error}</Alert>}

          <BrandButton type="submit" variant="primary" size="L" className="w-full"
                       disabled={busy || !consented || !verification.verified || payMode?.available === false}>
            {busy ? '送出中…' : '送出訂單'}
          </BrandButton>
          {!verification.verified && (
            <p className="text-center text-caption text-muted">完成 Email 驗證後即可送出訂單。</p>
          )}
        </form>
      </div>
    </div>
  );
}
