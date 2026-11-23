'use client';

/**
 * 社群登入的回跳頁（packages/social_auth）。LINE 整頁轉址回來、或 Google 需要再證明信箱時都到這裡。
 *
 *   ?status=ok        已登入（new=1 表示剛註冊）→ 補存暫存命盤後前往 next 或會員中心
 *   ?status=linked    會員中心加連成功 → 回 next 或「登入方式」分頁
 *   ?status=pending   有待完成票：信箱已是會員（寄碼到該信箱連結）或社群帳號沒給信箱（請對方填）
 *   ?status=error&reason=…
 *
 * 待完成票存在 API 的 httponly cookie，信箱不會出現在網址上。
 */
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { socialAuthApi, type SocialTicket } from '@ows/social-auth';
import { useAuthStore } from '@/store/auth';
import { astrologyApi } from '@/lib/api';
import { clearPendingChart, loadPendingChart } from '@/lib/pendingChart';
import BrandButton from '@/components/ui/BrandButton';
import Alert from '@/components/ui/Alert';
import { LogoMark } from '@/components/ui/BrandLogo';

const PROVIDER_LABEL: Record<string, string> = { google: 'Google', line: 'LINE' };
const RESEND_SECONDS = 60;

const ERROR_TEXT: Record<string, string> = {
  cancelled: '你取消了 LINE 登入。想要的話可以再試一次，或改用 Email。',
  expired: '登入流程逾時了，請再試一次。',
  line_failed: 'LINE 登入沒有完成，請再試一次。',
  line_unavailable: '目前還沒開放 LINE 登入，請改用其他方式。',
  account_disabled: '這個帳號已停用，如有疑問請聯絡我們。',
  login_required: '請先登入，再到會員中心連結 LINE。',
  link_conflict: '這個 LINE 帳號已經連到另一位會員了。請改用那個帳號登入，或先在那個帳號解除連結。',
  server: '登入時發生問題，請稍後再試。',
};

function safeNext(raw: string | null): string | null {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return null;
  return raw;
}

const inputCls =
  'w-full rounded-2xl border-[1.5px] border-line-strong bg-white px-[18px] py-[13px] text-base text-ink ' +
  'placeholder:text-muted focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 ' +
  'disabled:cursor-not-allowed disabled:bg-tint disabled:text-muted';
const linkCls = 'text-blue-500 underline-offset-[3px] hover:text-pink-600 hover:underline';

function SocialReturnContent() {
  const router = useRouter();
  const q = useSearchParams();
  const { checkAuth } = useAuthStore();
  const status = q.get('status');
  const next = safeNext(q.get('next'));
  const reason = q.get('reason') || '';

  // 登入完成後的共同收尾：同步登入狀態、補存排盤頁暫存的命盤、導頁
  const finishing = useRef(false);
  const finishLogin = useCallback(async (email: string | null) => {
    if (finishing.current) return;
    finishing.current = true;
    await checkAuth();
    let chartId: string | null = null;
    const chart = loadPendingChart();
    const memberEmail = email || useAuthStore.getState().user?.username;
    if (chart && memberEmail) {
      try {
        const res = await astrologyApi.saveAndRegister({ ...chart, email: memberEmail });
        clearPendingChart();
        chartId = res.chart_id || null;
      } catch { /* 存盤失敗不擋登入 */ }
    }
    router.replace(next || (chartId ? `/account/charts/${chartId}` : '/account'));
  }, [checkAuth, next, router]);

  useEffect(() => {
    if (status === 'ok') finishLogin(null);
    if (status === 'linked') {
      checkAuth().finally(() => router.replace(next || '/account?tab=login&linked=line'));
    }
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 待完成票 ─────────────────────────────────────────────────────────
  const [ticket, setTicket] = useState<SocialTicket | null>(null);
  const [ticketErr, setTicketErr] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (status !== 'pending') return;
    socialAuthApi.ticket()
      .then((t) => { setTicket(t); if (t.email) setEmail(t.email); })
      .catch(() => setTicketErr('登入流程已逾時，請回登入頁重新開始。'));
  }, [status]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const sendCode = async () => {
    setErr('');
    if (!ticket) return;
    if (ticket.reason === 'email_missing' && !email.trim()) {
      setErr('請先填寫 Email');
      return;
    }
    setBusy(true);
    try {
      const res = await socialAuthApi.ticketEmailCode(ticket.reason === 'email_missing' ? email.trim() : undefined);
      setSentTo(res.email);
      setCooldown(RESEND_SECONDS);
    } catch (e) {
      setErr((e as Error).message || '寄送失敗，請稍後再試');
    } finally {
      setBusy(false);
    }
  };

  const complete = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      const res = await socialAuthApi.ticketComplete(sentTo || undefined, code.trim());
      await finishLogin(res.user.username);
    } catch (e2) {
      setErr((e2 as Error).message || '驗證失敗，請再試一次');
      setBusy(false);
    }
  };

  // ── 畫面 ─────────────────────────────────────────────────────────────
  let body: React.ReactNode;
  if (status === 'ok' || status === 'linked') {
    body = <p className="text-center text-text">{status === 'ok' ? '登入成功，正在帶你過去…' : '已連結，正在回到會員中心…'}</p>;
  } else if (status === 'error') {
    const toAccount = reason === 'link_conflict' || reason === 'login_required';
    body = (
      <div className="space-y-5">
        <Alert tone="error">{ERROR_TEXT[reason] || ERROR_TEXT.server}</Alert>
        <BrandButton variant="primary" className="w-full"
                     onClick={() => router.replace(toAccount && reason !== 'login_required' ? '/account?tab=login' : `/login${next ? `?next=${encodeURIComponent(next)}` : ''}`)}>
          {toAccount && reason !== 'login_required' ? '回會員中心' : '回登入頁'}
        </BrandButton>
      </div>
    );
  } else if (status === 'pending') {
    if (ticketErr) {
      body = (
        <div className="space-y-5">
          <Alert tone="error">{ticketErr}</Alert>
          <BrandButton variant="primary" className="w-full" onClick={() => router.replace('/login')}>回登入頁</BrandButton>
        </div>
      );
    } else if (!ticket) {
      body = <p className="text-center text-muted">載入中…</p>;
    } else {
      const provider = PROVIDER_LABEL[ticket.provider] || ticket.provider;
      const needsLink = ticket.reason === 'needs_link';
      body = (
        <form onSubmit={complete} className="space-y-5">
          <div className="flex items-center gap-3">
            {ticket.picture && (
              // eslint-disable-next-line @next/next/no-img-element -- 社群大頭貼網址
              <img src={ticket.picture} alt="" referrerPolicy="no-referrer" className="h-12 w-12 rounded-full object-cover" />
            )}
            <p className="text-ink">{ticket.name ? `${ticket.name}，` : ''}再一步就完成</p>
          </div>
          <p className="text-sm text-text">
            {needsLink
              ? `這個 Email 已經是會員。我們會寄一組驗證碼到這個信箱，輸入後就會把 ${provider} 連到你原本的帳號，之後兩種方式都能登入。`
              : `${provider} 沒有提供 Email。請填一個常用的 Email，我們會寄驗證碼確認；報告與訂單通知都會寄到這裡。如果這個 Email 已經註冊過，驗證後會連到原本的帳號。`}
          </p>
          {!ticket.can_verify ? (
            <Alert tone="warning">本站暫時無法寄送驗證碼，請先用原本的方式登入。</Alert>
          ) : (
            <>
              <div>
                <label htmlFor="social-email" className="mb-1.5 block text-sm font-medium text-ink">Email</label>
                <input id="social-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                       className={inputCls} autoComplete="email" disabled={needsLink || !!sentTo} required />
                {!needsLink && sentTo && (
                  <button type="button" onClick={() => { setSentTo(null); setCode(''); }} className={`mt-1.5 text-[13px] ${linkCls}`}>
                    改用其他 Email
                  </button>
                )}
              </div>
              {sentTo && (
                <div>
                  <label htmlFor="social-code" className="mb-1.5 block text-sm font-medium text-ink">驗證碼</label>
                  <input id="social-code" type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={code}
                         onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                         className={`${inputCls} text-center font-latin text-lg tracking-[0.5em]`} autoComplete="one-time-code" required />
                  <p className="mt-1.5 text-[13px] text-muted">
                    已寄到 {sentTo}。沒收到？請檢查垃圾郵件，或{' '}
                    <button type="button" onClick={sendCode} disabled={busy || cooldown > 0} className={`${linkCls} disabled:text-muted disabled:no-underline`}>
                      {cooldown > 0 ? <><span className="font-latin">{cooldown}</span> 秒後可重寄</> : '重寄驗證碼'}
                    </button>
                  </p>
                </div>
              )}
              {err && <Alert tone="error">{err}</Alert>}
              {sentTo ? (
                <BrandButton type="submit" variant="primary" disabled={busy || code.length !== 6} className="w-full">
                  {busy ? '處理中…' : '完成並登入'}
                </BrandButton>
              ) : (
                <BrandButton type="button" variant="primary" disabled={busy} onClick={sendCode} className="w-full">
                  {busy ? '寄送中…' : '寄送驗證碼'}
                </BrandButton>
              )}
            </>
          )}
          <p className="text-center text-sm text-muted">
            <Link href="/login" className={linkCls}>改用其他方式登入</Link>
          </p>
        </form>
      );
    }
  } else {
    body = (
      <div className="space-y-5 text-center">
        <p className="text-text">找不到登入資訊。</p>
        <BrandButton variant="primary" className="w-full" onClick={() => router.replace('/login')}>回登入頁</BrandButton>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-72px)] bg-paper px-4 py-12 md:py-16">
      <div className="mx-auto max-w-md rounded-card bg-white p-7 md:p-8">
        <div className="mb-4 flex justify-center"><LogoMark width={72} /></div>
        <h1 className="mb-6 text-center font-heading text-[26px] font-normal text-ink md:text-h2">
          {status === 'pending' ? '確認你的 Email' : status === 'error' ? '登入沒有完成' : '登入中'}
        </h1>
        {body}
      </div>
    </div>
  );
}

export default function SocialReturnPage() {
  return (
    <Suspense fallback={null}>
      <SocialReturnContent />
    </Suspense>
  );
}
