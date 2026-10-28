'use client';

/**
 * 用我的報告做成書（2026-10-28 起只處理實體書）：已付款的報告 → 規格／數量／特殊客製 → 設計你的書 → 收件資料
 * → 同意交易政策 → 建立新的待付款訂單。新訂單連回原報告（不重新排盤、不重新製作報告）；
 * 書裡的改寫與加內容只套用在這本書上，原報告不受影響。
 * 報告已完成時，付款前就能用整本書的預覽「設計你的書」（可略過，付款後再做）；草稿隨訂單送出連到訂單。
 * 專人解讀改從會員中心「專人解讀」分頁預約；舊網址 ?item=consult 轉到那裡。
 */
import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { clsx } from 'clsx';
import Alert from '@/components/ui/Alert';
import BrandButton from '@/components/ui/BrandButton';
import EmailVerifyBox from '@/components/report/EmailVerifyBox';
import PhysicalOptions, { PriceBreakdown, normaliseSelection } from '@/components/report/PhysicalOptions';
import BookDesigner from '@/components/report/design/BookDesigner';
import ShippingFields, { EMPTY_SHIPPING, SHIPPING_LABELS } from '@/components/report/ShippingFields';
import { useAuthStore } from '@/store/auth';
import { memberAccountApi, reportOrdersApi, type ReportOrderSummary, type ShippingInfo } from '@/lib/api';
import { pricePhysical, type DesignView, type PhysicalConfig, type PhysicalSelection, type PriceLine } from '@/lib/api/reportOrders';
import { POLICY_VERSION } from '@/lib/report/catalog';
import { newSubmissionKey } from '@/lib/report/draft';
import { formatPrice } from '@/lib/report/prices';
import { OFFER_HREFS, OFFER_NAMES } from '@/lib/report/offers';

const cardCls = 'rounded-card bg-white p-6 md:p-8';
const cardTitleCls = 'font-heading text-[18px] font-normal text-ink md:text-h4';
const checkboxCls =
  'mt-0.5 h-[22px] w-[22px] shrink-0 cursor-pointer rounded-[7px] border-[1.5px] border-line-strong accent-blue-500 ' +
  'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100';

/** 同一個瀏覽器分頁重新整理時沿用同一個送出編號，避免重複建單 */
function useSubmissionKey(orderNo: string) {
  return useMemo(() => {
    const k = `polaris_addon_key_${orderNo}`;
    try {
      const saved = sessionStorage.getItem(k);
      if (saved) return saved;
      const key = newSubmissionKey();
      sessionStorage.setItem(k, key);
      return key;
    } catch {
      return newSubmissionKey();
    }
  }, [orderNo]);
}

export default function ReportAddonPage() {
  return <Suspense fallback={null}><ReportAddonContent /></Suspense>;
}

function ReportAddonContent() {
  const router = useRouter();
  const { order_no: orderNo } = useParams<{ order_no: string }>();
  const consultLink = useSearchParams().get('item') === 'consult';
  const { isAuthenticated, checkAuth } = useAuthStore();
  const [checked, setChecked] = useState(false);
  const [order, setOrder] = useState<ReportOrderSummary | null>(null);
  const [cfg, setCfg] = useState<PhysicalConfig | null | undefined>(undefined);
  const [verification, setVerification] = useState<{ email: string; verified: boolean } | null>(null);
  const [payMode, setPayMode] = useState<{ mode: string; available: boolean; deadline_days: number | null } | null>(null);
  const [selection, setSelection] = useState<PhysicalSelection | null>(null);
  const [shipping, setShipping] = useState<ShippingInfo>(EMPTY_SHIPPING);
  const [consented, setConsented] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [design, setDesign] = useState<DesignView | null>(null);
  const [designOpen, setDesignOpen] = useState(false);
  const [designBusy, setDesignBusy] = useState(false);
  const [designError, setDesignError] = useState('');
  const submissionKey = useSubmissionKey(orderNo);

  useEffect(() => {
    checkAuth().finally(() => setChecked(true));
  }, [checkAuth]);

  useEffect(() => {
    if (consultLink) {
      router.replace(OFFER_HREFS.consultFor(orderNo));  // 專人解讀已移到會員中心
      return;
    }
    if (!checked) return;
    const here = OFFER_HREFS.bookFor(orderNo);
    if (!isAuthenticated) {
      router.replace(`/login?next=${encodeURIComponent(here)}`);
      return;
    }
    reportOrdersApi.get(orderNo).then((r) => setOrder(r.order)).catch((e) => setError(e.message || '無法載入訂單'));
    reportOrdersApi.physicalConfig()
      .then((r) => {
        setCfg(r.config);
        if (r.config.enabled) setSelection(normaliseSelection(r.config, null));
      })
      .catch(() => setCfg(null));
    reportOrdersApi.paymentMode().then(setPayMode).catch(() => setPayMode(null));
    memberAccountApi.getVerification()
      .then((v) => setVerification({ email: v.email, verified: v.email_verified }))
      .catch(() => setVerification({ email: '', verified: false }));
  }, [checked, isAuthenticated, orderNo, router, consultLink]);

  if (error && !order) {
    return <div className="mx-auto max-w-xl px-4 py-16"><Alert tone="error">{error}</Alert></div>;
  }
  if (!order || cfg === undefined || !verification) return null;

  const back = (
    <Link href={OFFER_HREFS.fromReport} className="inline-flex min-h-[44px] items-center gap-1 text-sm text-blue-500 hover:underline">
      <ArrowLeft className="h-4 w-4" strokeWidth={2} aria-hidden="true" /> 選其他報告
    </Link>
  );

  const canBook = !!cfg?.enabled && !!order.addon_offer?.physical;
  if (!order.addon_offer || !cfg || !canBook || !selection) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        {back}
        <Alert tone="info" className="mt-4">
          {order.status !== 'paid' ? '這份報告完成付款後才能做成書。' : `${OFFER_NAMES.book}目前沒有開放購買。`}
        </Alert>
      </div>
    );
  }

  const book = selection;
  const lines: PriceLine[] = pricePhysical(cfg, selection).lines.map((l) => ({ ...l, label: `${OFFER_NAMES.book}・${l.label}` }));
  const total = lines.reduce((a, l) => a + l.amount, 0);
  const manualOpen = payMode?.mode === 'manual' && payMode.available;

  const reportReady = !!order.report;

  const openDesign = async () => {
    setDesignError('');
    if (design) {
      setDesignOpen(true);
      return;
    }
    setDesignBusy(true);
    try {
      const r = await reportOrdersApi.designDraft(orderNo);
      setDesign(r.design);
      setDesignOpen(true);
    } catch (e: any) {
      setDesignError(e.message || '無法開啟設計，請稍後再試');
    } finally {
      setDesignBusy(false);
    }
  };

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
      const res = await reportOrdersApi.createAddon(orderNo, {
        submission_key: submissionKey,
        policy_consented: true,
        policy_version: POLICY_VERSION,
        consult_sessions: 0,
        physical: selection, shipping, ...(design ? { design_id: design.id } : {}),
      });
      try { sessionStorage.removeItem(`polaris_addon_key_${orderNo}`); } catch { /* ignore */ }
      router.push(`/report/orders/${res.order.order_no}`);
    } catch (err: any) {
      const errs = (err.errors || {}) as Record<string, string>;
      setFieldErrors(Object.fromEntries(Object.entries(errs).filter(([k]) => k in SHIPPING_LABELS)));
      const other = Object.entries(errs).filter(([k]) => !(k in SHIPPING_LABELS)).map(([, v]) => v);
      setError(other.length ? other.join('；') : err.message || '送出失敗，請稍後再試');
      if (err.status === 403) setVerification((v) => (v ? { ...v, verified: false } : v));
    } finally {
      setBusy(false);
    }
  };

  const who = order.item?.call_name || order.item?.subject_name;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 md:px-6 md:py-16">
      {back}
      <h1 className="mt-2 font-heading text-[28px] font-normal text-ink md:text-h1">把「{who}」的報告做成書</h1>
      <p className="mt-2 text-text">
        內容沿用這份報告，不需要重新填寫資料。你在書裡修改的文字、放進的照片只會出現在這本書上，原本的報告不會被改動；
        付款後，會員中心會多一本新的書。
      </p>

      <div className="mt-8 space-y-6">
        {!verification.verified && (
          <EmailVerifyBox email={verification.email}
            onVerified={() => setVerification((v) => (v ? { ...v, verified: true } : v))} />
        )}

        <section className={cardCls}>
          <h2 className={cardTitleCls}>規格與數量</h2>
          <p className="mt-1 text-sm text-text">送印前會請你確認完整內容。</p>
          <div className="mt-6 border-t border-line pt-6">
            <PhysicalOptions cfg={cfg} value={selection} onChange={setSelection} />
          </div>
        </section>

        {book && (
          <section className={cardCls}>
            <h2 className={cardTitleCls}>設計你的書</h2>
            {!reportReady ? (
              <p className="mt-2 text-sm text-text">
                報告完成後，我們會寄信請你用整本書的預覽設計封面、扉頁與要修改的地方；送印前也會請你確認完整內容。
              </p>
            ) : !designOpen ? (
              <>
                <p className="mt-2 text-sm text-text">
                  翻閱整本書的樣子，填上封面名字與扉頁贈言，看到想調整的地方直接標註。可以現在做，也可以付款後再做；內容會自動儲存。
                </p>
                {designError && <Alert tone="error" className="mt-3">{designError}</Alert>}
                <BrandButton variant="soft" className="mt-4" onClick={openDesign} disabled={designBusy}>
                  {designBusy ? '開啟中…' : design ? '繼續設計' : '開始設計'}
                </BrandButton>
              </>
            ) : design && (
              <div className="mt-4 space-y-4">
                <BookDesigner
                  design={design}
                  onDesignChange={setDesign}
                  cfg={cfg}
                  purchased={{ custom: selection.custom ?? [], spreads: selection.spreads ?? 0 }}
                  onAddCustom={(k) => setSelection((s) => (s && !(s.custom ?? []).includes(k) ? { ...s, custom: [...(s.custom ?? []), k] } : s))}
                />
                <BrandButton variant="soft" size="S" onClick={() => setDesignOpen(false)}>收合預覽</BrandButton>
              </div>
            )}
          </section>
        )}

        <form onSubmit={submit} className="space-y-6">
          {book && (
            <section className={clsx(cardCls, 'space-y-5')}>
              <h2 className={cardTitleCls}>收件資料</h2>
              <p className="text-sm text-text">由合作印刷廠寄出，收件人可以不是你本人。</p>
              <ShippingFields value={shipping} onChange={setShipping} errors={fieldErrors} idPrefix="addon" />
            </section>
          )}

          <section className={cardCls}>
            <h2 className={cardTitleCls}>金額與付款</h2>
            <div className="mt-3">
              <PriceBreakdown lines={lines} total={total} totalLabel="合計（含運費）" />
            </div>
            <Alert tone={manualOpen ? 'info' : 'warning'} className="mt-4">
              {manualOpen
                ? `銀行轉帳。送出後會顯示匯款帳號，請於 ${payMode?.deadline_days} 天內轉帳並回報轉出帳號末五碼。`
                : payMode?.mode === 'manual'
                  ? '目前暫停接受訂單，請稍後再試。'
                  : '付款功能尚未開放。送出後訂單會保留為「待付款」，開放付款後我們會以 Email 通知你。'}
            </Alert>
          </section>

          <label className="flex cursor-pointer items-start gap-3 rounded-card bg-white p-6 text-sm leading-6 text-text md:px-8">
            <input type="checkbox" checked={consented} onChange={(e) => setConsented(e.target.checked)} className={checkboxCls} />
            <span>
              我了解實體書為客製化商品，不適用七日解除權；在我確認打樣、送印之前可以取消並退款，確認送印後不受理取消（例外情形依
              <Link href="/report/policy" target="_blank" className="text-blue-500 underline-offset-[3px] hover:underline">《交易政策》</Link>
              處理）。
            </span>
          </label>

          {error && <Alert tone="error">{error}</Alert>}

          <BrandButton type="submit" variant="primary" size="L" className="w-full"
            disabled={busy || !consented || !verification.verified || payMode?.available === false}>
            {busy ? '送出中…' : `送出（${formatPrice(total)}）`}
          </BrandButton>
        </form>
      </div>
    </div>
  );
}
