'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Button from '@/components/platform/ui/Button';
import EmailVerifyBox from '@/components/report/EmailVerifyBox';
import ReportDraftSummary from '@/components/report/ReportDraftSummary';
import { useAuthStore } from '@/store/auth';
import { memberAccountApi, reportOrdersApi, type ShippingInfo } from '@/lib/api';
import { POLICY_VERSION } from '@/lib/report/catalog';
import { clearDraft, hasErrors, loadDraft, validateDraft, type ReportDraft } from '@/lib/report/draft';

const CHECKOUT = '/report/checkout';
const EMPTY_SHIPPING: ShippingInfo = { recipient_name: '', recipient_phone: '', postal_code: '', address: '' };
const SHIPPING_LABELS: Record<keyof ShippingInfo, string> = {
  recipient_name: '收件人姓名',
  recipient_phone: '聯絡電話',
  postal_code: '郵遞區號',
  address: '收件地址',
};

const inputCls =
  'w-full px-4 py-3 border border-gray-300 rounded-banner bg-white focus:ring-2 focus:ring-brand-purple-500 focus:border-transparent';
const labelCls = 'block text-sm font-medium text-gray-700 mb-2';

/** 結帳：Email 驗證 → 核對資料 →（實體書）收件資料 → 同意交易政策 → 建立待付款訂單。 */
export default function ReportCheckoutPage() {
  const router = useRouter();
  const { isAuthenticated, checkAuth } = useAuthStore();
  const [checked, setChecked] = useState(false);
  const [draft, setDraft] = useState<ReportDraft | null>(null);
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
    // 有草稿但不完整 → 回表單補齊（表單會帶入已填的內容）
    if (d && hasErrors(validateDraft(d))) {
      router.replace('/report/customize');
      return;
    }
    setDraft(d);
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
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="text-xl font-bold text-gray-900">還沒有要結帳的報告</h1>
        <p className="mt-3 text-sm leading-6 text-gray-600">
          請先填寫報告主角的資料，確認後再前往結帳。填寫內容只保存在填寫時使用的裝置與瀏覽器 7 天；
          換了裝置或瀏覽器、超過 7 天，或訂單已經送出，這裡就不會有資料。
        </p>
        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link href="/report/customize"
                className="inline-flex rounded-banner bg-brand-purple-600 px-5 py-3 text-sm font-medium text-white hover:bg-brand-purple-700">
            開始填寫報告資料
          </Link>
          <Link href="/report" className="text-sm text-brand-purple-700 hover:underline">看商品介紹</Link>
        </div>
      </div>
    );
  }

  const physical = draft.variant === 'physical';
  const setShip = (k: keyof ShippingInfo, v: string) => setShipping((s) => ({ ...s, [k]: v }));

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
        ...(physical ? { shipping } : {}),
      });
      clearDraft();
      router.push(`/report/orders/${res.order.order_no}`);
    } catch (err: any) {
      setError(err.message || '送出失敗，請稍後再試');
      // 欄位錯誤：收件資料就地標示；其他欄位屬於草稿，請客人回到表單修改
      const errs = (err.errors || {}) as Record<string, string>;
      setFieldErrors(Object.fromEntries(Object.entries(errs).filter(([k]) => k in SHIPPING_LABELS)));
      if (Object.keys(errs).some((k) => !(k in SHIPPING_LABELS))) setError('報告資料有誤，請按「修改資料」回到表單檢查。');
      if (err.status === 403) setVerification((v) => (v ? { ...v, verified: false } : v));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-bold text-gray-900">結帳</h1>

      <div className="mt-8 space-y-6">
        {!verification.verified && (
          <EmailVerifyBox
            email={verification.email}
            onVerified={() => setVerification((v) => (v ? { ...v, verified: true } : v))}
          />
        )}

        <div>
          <ReportDraftSummary draft={draft} />
          <Link href="/report/customize" className="mt-3 inline-block text-sm text-brand-purple-700 hover:underline">
            ← 修改資料
          </Link>
        </div>

        <form onSubmit={submit} className="space-y-6">
          {physical && (
            <section className="rounded-banner border border-warm-200/70 bg-white p-5 sm:p-6 space-y-5">
              <h2 className="text-base font-bold text-gray-900">收件資料</h2>
              <p className="text-sm text-gray-600">實體書由合作印刷廠寄出，收件人可以不是你本人。</p>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="ck-name" className={labelCls}>收件人姓名 *</label>
                  <input id="ck-name" value={shipping.recipient_name} maxLength={50} autoComplete="name"
                         onChange={(e) => setShip('recipient_name', e.target.value)} className={inputCls} required />
                </div>
                <div>
                  <label htmlFor="ck-phone" className={labelCls}>聯絡電話 *</label>
                  <input id="ck-phone" type="tel" value={shipping.recipient_phone} autoComplete="tel"
                         onChange={(e) => setShip('recipient_phone', e.target.value)} className={inputCls}
                         placeholder="例如：0912-345-678" required />
                </div>
                <div>
                  <label htmlFor="ck-postal" className={labelCls}>郵遞區號</label>
                  <input id="ck-postal" inputMode="numeric" value={shipping.postal_code} maxLength={6}
                         autoComplete="postal-code"
                         onChange={(e) => setShip('postal_code', e.target.value.replace(/\D/g, ''))} className={inputCls} />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="ck-address" className={labelCls}>收件地址 *</label>
                  <input id="ck-address" value={shipping.address} maxLength={200} autoComplete="street-address"
                         onChange={(e) => setShip('address', e.target.value)} className={inputCls} required />
                </div>
              </div>
              {Object.keys(fieldErrors).length > 0 && (
                <ul className="text-sm text-red-600">
                  {Object.entries(fieldErrors).map(([k, v]) => (
                    <li key={k}>{SHIPPING_LABELS[k as keyof ShippingInfo] ?? k}：{v}</li>
                  ))}
                </ul>
              )}
            </section>
          )}

          <section className="rounded-banner border border-warm-200/70 bg-white p-5 sm:p-6">
            <h2 className="text-base font-bold text-gray-900">付款</h2>
            <p className="mt-2 rounded-banner bg-warm-50 p-3 text-sm leading-6 text-gray-700">
              {payMode?.mode === 'manual' && payMode.available
                ? `銀行轉帳。送出訂單後會顯示匯款帳號，請於 ${payMode.deadline_days} 天內轉帳並回報轉出帳號末五碼；我們確認入帳後才會開始製作。`
                : payMode?.mode === 'manual'
                  ? '目前暫停接受訂單，請稍後再試。'
                  : '付款功能尚未開放。送出後訂單會保留為「待付款」，開放付款後我們會以 Email 通知你。'}
            </p>
          </section>

          <label className="flex items-start gap-3 rounded-banner border border-warm-200/70 bg-white p-5 text-sm leading-6 text-gray-700">
            <input type="checkbox" checked={consented} onChange={(e) => setConsented(e.target.checked)}
                   className="mt-1" />
            <span>
              我已確認出生資料正確，並了解本商品為客製化商品，不適用七日解除權，付款後不受理取消或退款（例外情形依
              <Link href="/report/policy" target="_blank" className="text-brand-purple-700 hover:underline">《交易政策》</Link>
              處理）。
            </span>
          </label>

          {error && (
            <div className="rounded-banner border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}

          <Button type="submit" disabled={busy || !consented || !verification.verified || payMode?.available === false}
                  className="w-full bg-brand-purple-600 hover:bg-brand-purple-700 disabled:opacity-50">
            {busy ? '送出中…' : '送出訂單'}
          </Button>
          {!verification.verified && (
            <p className="text-center text-xs text-gray-500">完成 Email 驗證後即可送出訂單。</p>
          )}
        </form>
      </div>
    </div>
  );
}
