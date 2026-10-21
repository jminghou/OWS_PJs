'use client';

/**
 * 認領平台訂單（/account/claim?code=…）：在小紅書、Etsy、Pinkoi 等平台訂購、由我們代為建檔的客人，
 * 用我們給的認領碼把訂單與命盤接到自己的會員帳號。
 * 流程：未登入 → 登入／註冊後回到這頁（帶著認領碼）→ 需要時先驗證 Email → 輸入認領碼看有哪些訂單 → 確認認領。
 * 後端：/api/v1/report-claims/preview、/report-claims（需登入且 Email 已驗證；report_orders/claims.py）。
 */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import Alert from '@/components/ui/Alert';
import BrandButton, { brandButton } from '@/components/ui/BrandButton';
import EmailVerifyBox from '@/components/report/EmailVerifyBox';
import { useAuthStore } from '@/store/auth';
import { memberAccountApi, reportOrdersApi } from '@/lib/api';
import type { ClaimPreview } from '@/lib/api/reportOrders';

const INPUT =
  'w-full rounded-2xl border-[1.5px] border-line-strong bg-white px-[18px] py-[13px] text-base text-ink tracking-widest ' +
  'placeholder:tracking-normal placeholder:text-muted focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100';
const LABEL = 'mb-1.5 block text-sm font-medium text-ink';

/** 輸入時自動轉大寫、每 4 碼補連字號（只是顯示；後端不分大小寫、可省略連字號） */
const formatCode = (v: string) =>
  v.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 12).replace(/(.{4})(?=.)/g, '$1-');

export default function ClaimPage() {
  const router = useRouter();
  const { isAuthenticated, checkAuth } = useAuthStore();
  const [checked, setChecked] = useState(false);
  const [verification, setVerification] = useState<{ email: string; verified: boolean } | null>(null);
  const [code, setCode] = useState('');
  const [preview, setPreview] = useState<ClaimPreview | null>(null);
  const [done, setDone] = useState<{ customer_name: string; orders: string[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('code');
    if (fromUrl) setCode(formatCode(fromUrl));
    checkAuth().finally(() => setChecked(true));
  }, [checkAuth]);

  useEffect(() => {
    if (!checked) return;
    if (!isAuthenticated) {
      const here = `/account/claim${code ? `?code=${encodeURIComponent(code)}` : ''}`;
      router.replace(`/login?mode=register&next=${encodeURIComponent(here)}`);
      return;
    }
    memberAccountApi.getVerification()
      .then((v) => setVerification({ email: v.email, verified: v.email_verified }))
      .catch(() => setVerification({ email: '', verified: false }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 只在登入狀態確定時跑一次；code 只用來組回跳網址
  }, [checked, isAuthenticated, router]);

  const look = async () => {
    setBusy(true);
    setError('');
    setPreview(null);
    try {
      setPreview(await reportOrdersApi.previewClaim(code));
    } catch (e: any) {
      if (e.status === 403) setVerification((v) => (v ? { ...v, verified: false } : v));
      setError(e.message || '認領碼不正確或已失效');
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    setBusy(true);
    setError('');
    try {
      setDone(await reportOrdersApi.claim(code));
      setPreview(null);
    } catch (e: any) {
      setError(e.message || '認領失敗，請稍後再試');
    } finally {
      setBusy(false);
    }
  };

  if (!checked || !isAuthenticated || !verification) return null;

  return (
    <div className="mx-auto max-w-xl px-4 py-10 md:py-12">
      <h1 className="font-heading text-[28px] font-normal text-ink md:text-h2">認領平台訂單</h1>
      <p className="mt-2 text-text">
        在小紅書、Etsy、Pinkoi 等平台向我們訂購的報告，可以用我們給你的認領碼接到這個會員帳號：
        之後就能在會員中心看到訂單進度、打樣與命盤。
      </p>

      <div className="mt-6 space-y-4">
        {!verification.verified && (
          <EmailVerifyBox email={verification.email}
            onVerified={() => setVerification((v) => (v ? { ...v, verified: true } : v))} />
        )}
        {error && <Alert tone="error">{error}</Alert>}

        {done ? (
          <div className="space-y-4 rounded-card bg-white p-6">
            <p className="flex items-center gap-2 text-ink">
              <CheckCircle2 className="h-5 w-5 text-success-fg" aria-hidden="true" />
              認領完成，{done.orders.length} 筆訂單已接到你的帳號。
            </p>
            <p className="text-sm text-text">命盤也會一起出現在會員中心的「命盤資料」（可能要等幾分鐘同步）。</p>
            <Link href="/account" className={brandButton({ variant: 'primary' })}>到會員中心</Link>
          </div>
        ) : (
          <form className="space-y-4 rounded-card bg-white p-6" onSubmit={(e) => { e.preventDefault(); look(); }}>
            <div>
              <label htmlFor="claim-code" className={LABEL}>認領碼</label>
              <input id="claim-code" className={INPUT} value={code} autoComplete="off" inputMode="text"
                placeholder="XXXX-XXXX-XXXX" onChange={(e) => { setCode(formatCode(e.target.value)); setPreview(null); }} />
              <p className="mt-1.5 text-xs text-muted">共 12 碼，不分大小寫。認領碼只能使用一次。</p>
            </div>
            {!preview && (
              <BrandButton type="submit" disabled={busy || !verification.verified || code.replace(/-/g, '').length !== 12}>
                {busy ? '查詢中…' : '查詢'}
              </BrandButton>
            )}
          </form>
        )}

        {preview && !done && (
          <div className="space-y-4 rounded-card bg-white p-6">
            <p className="text-ink">
              這組認領碼屬於「<span className="font-medium">{preview.customer_name}</span>」，裡面有 {preview.orders.length} 筆訂單：
            </p>
            <ul className="space-y-2 text-sm text-text">
              {preview.orders.map((o) => (
                <li key={o.order_no} className="rounded-inner bg-warm-50 px-4 py-3">
                  <span className="font-medium text-ink">{o.subject_name ?? '—'}</span>・{o.lines.join('、')}
                  <span className="block text-xs text-muted">{o.order_no}・{o.status_label}</span>
                </li>
              ))}
            </ul>
            <p className="text-sm text-text">確認是你的訂單後再認領；認領後會接到目前登入的帳號（{verification.email}），無法再轉給別人。</p>
            <div className="flex flex-wrap gap-2">
              <BrandButton onClick={confirm} disabled={busy}>{busy ? '認領中…' : '確認認領'}</BrandButton>
              <BrandButton variant="soft" onClick={() => setPreview(null)} disabled={busy}>不是我的</BrandButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
