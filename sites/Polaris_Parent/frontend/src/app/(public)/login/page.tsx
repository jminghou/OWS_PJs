'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { astrologyApi, memberAccountApi } from '@/lib/api';
import {
  loadPendingChart,
  clearPendingChart,
} from '@/lib/pendingChart';
import type { RegisterChartPayload } from '@/lib/api/astrology';
import BrandButton from '@/components/ui/BrandButton';
import Alert from '@/components/ui/Alert';
import { LogoMark } from '@/components/ui/BrandLogo';

type Mode = 'login' | 'register' | 'reset';
type Step = 'email' | 'code';

const RESEND_SECONDS = 60;

/** 只接受站內相對路徑，避免 ?next= 被拿來做開放式轉址。 */
function safeNext(raw: string | null): string | null {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return null;
  return raw;
}

/**
 * 公眾會員「登入／註冊」合一頁（會員 v2）。
 * - 註冊與忘記密碼都是兩步：先寄 Email 驗證碼，再輸入驗證碼＋設定密碼；完成即登入。
 * - ?mode=register 直接落在註冊分頁；?next=/路徑 登入後導回該頁（結帳流程使用）。
 * - 排盤頁暫存的命盤（sessionStorage）會在登入／註冊成功後自動存入帳號。
 * （後台管理者請用 /admin/login。）
 */
function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, checkAuth, isLoading, error, clearError } = useAuthStore();
  const next = safeNext(searchParams.get('next'));

  const [mode, setMode] = useState<Mode>(
    searchParams.get('mode') === 'register' ? 'register' : 'login'
  );
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [pendingChart, setPendingChart] = useState<RegisterChartPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [localErr, setLocalErr] = useState('');
  const [notice, setNotice] = useState('');
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    setPendingChart(loadPendingChart());
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const switchMode = (m: Mode) => {
    setMode(m);
    setStep('email');
    setCode('');
    setPassword('');
    setLocalErr('');
    setNotice('');
    clearError();
  };

  const normalisedEmail = () => email.trim().toLowerCase();

  // 登入成功後：若有剛排的命盤，補存到帳號（best-effort，不擋導頁）。
  const attachPendingChart = async (memberEmail: string): Promise<string | null> => {
    const chart = loadPendingChart();
    if (!chart) return null;
    try {
      const res = await astrologyApi.saveAndRegister({ ...chart, email: memberEmail });
      clearPendingChart();
      return res.chart_id || null;
    } catch {
      /* 存盤失敗不擋登入；會員可回排盤頁重排 */
      return null;
    }
  };

  const goAfterLogin = async (memberEmail: string) => {
    const chartId = await attachPendingChart(memberEmail);
    if (next) router.push(next);
    else router.push(chartId ? `/account/charts/${chartId}` : '/account');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalErr('');
    try {
      await login({ username: normalisedEmail(), password });
      await goAfterLogin(normalisedEmail());
    } catch {
      /* 錯誤訊息由 store.error 顯示 */
    }
  };

  const sendCode = async () => {
    setLocalErr('');
    setNotice('');
    if (!normalisedEmail()) {
      setLocalErr('請先填入 Email');
      return;
    }
    setBusy(true);
    try {
      const res = await memberAccountApi.sendEmailCode(mode === 'reset' ? 'reset' : 'register', normalisedEmail());
      setNotice(res.message || '驗證碼已寄出，請收信。');
      setStep('code');
      setCooldown(RESEND_SECONDS);
    } catch (err: any) {
      setLocalErr(err.message || '寄送失敗，請稍後再試');
    } finally {
      setBusy(false);
    }
  };

  const handleSendCode = (e: React.FormEvent) => {
    e.preventDefault();
    sendCode();
  };

  const handleComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalErr('');
    setBusy(true);
    try {
      const memberEmail = normalisedEmail();
      if (mode === 'register') {
        await memberAccountApi.register(memberEmail, code.trim(), password);
      } else {
        await memberAccountApi.resetPassword(memberEmail, code.trim(), password);
      }
      await checkAuth(); // 後端已設好登入 cookies，同步前端登入狀態
      await goAfterLogin(memberEmail);
    } catch (err: any) {
      setLocalErr(err.message || '操作失敗，請稍後再試');
    } finally {
      setBusy(false);
    }
  };

  const inputCls =
    'w-full rounded-2xl border-[1.5px] border-line-strong bg-white px-[18px] py-[13px] text-base text-ink ' +
    'placeholder:text-muted focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100';
  // 分頁用膠囊項目，跟頁首導覽同一套（目前分頁淡藍底、其他 hover 暖灰底）
  const tabCls = (active: boolean) =>
    `flex-1 rounded-full px-3.5 py-2.5 text-[15px] font-medium transition-colors duration-150 ease-out ` +
    `focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 ${
      active ? 'bg-blue-50 text-blue-800' : 'text-ink hover:bg-tint'
    }`;
  const linkCls =
    'rounded-sm2 text-blue-500 underline-offset-[3px] transition-colors duration-150 ease-out hover:text-pink-600 hover:underline ' +
    'active:text-pink-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 ' +
    'disabled:cursor-not-allowed disabled:text-muted disabled:no-underline';

  const title = mode === 'login' ? '會員登入' : mode === 'register' ? '加入會員' : '重設密碼';
  const onSubmit = mode === 'login' ? handleLogin : step === 'email' ? handleSendCode : handleComplete;
  const submitting = mode === 'login' ? isLoading : busy;
  const submitLabel =
    mode === 'login'
      ? submitting ? '登入中…' : '登入'
      : step === 'email'
        ? submitting ? '寄送中…' : '寄送驗證碼'
        : mode === 'register'
          ? submitting ? '註冊中…' : '完成註冊並登入'
          : submitting ? '處理中…' : '重設密碼並登入';

  return (
    <div className="min-h-[calc(100vh-72px)] bg-paper px-4 py-12 md:py-16">
      <div className="mx-auto max-w-md rounded-card bg-white p-7 md:p-8">
        <div className="mb-4 flex justify-center">
          <LogoMark width={72} />
        </div>
        <h1 className="mb-6 text-center font-heading text-[26px] font-normal text-ink md:text-h2">{title}</h1>

        {/* 登入 / 註冊 分頁（重設密碼不顯示分頁） */}
        {mode !== 'reset' && (
          <div className="mb-6 flex gap-2" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'login'}
              onClick={() => switchMode('login')}
              className={tabCls(mode === 'login')}
            >
              登入
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'register'}
              onClick={() => switchMode('register')}
              className={tabCls(mode === 'register')}
            >
              註冊
            </button>
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-5">
          {pendingChart && mode !== 'reset' && (
            <Alert tone="info">
              {mode === 'register'
                ? '註冊完成後，會自動把你剛排的命盤存進帳號。'
                : '登入成功後，會自動把你剛排的命盤存進帳號。'}
            </Alert>
          )}

          {mode === 'register' && step === 'email' && (
            <p className="text-sm text-text">
              我們會寄一組驗證碼到你的 Email，驗證後設定密碼即完成註冊。這個帳號用來保管你的訂單與報告。
            </p>
          )}
          {mode === 'reset' && step === 'email' && (
            <p className="text-sm text-text">輸入註冊時的 Email，我們會寄驗證碼給你重設密碼。</p>
          )}

          <div>
            <label htmlFor="login-email" className="mb-1.5 block text-sm font-medium text-ink">Email</label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`${inputCls} disabled:cursor-not-allowed disabled:bg-tint disabled:text-muted`}
              autoComplete="email"
              disabled={mode !== 'login' && step === 'code'}
              required
            />
            {mode !== 'login' && step === 'code' && (
              <button type="button" onClick={() => { setStep('email'); setCode(''); setNotice(''); }}
                      className={`mt-1.5 text-[13px] ${linkCls}`}>
                改用其他 Email
              </button>
            )}
          </div>

          {mode !== 'login' && step === 'code' && (
            <div>
              <label htmlFor="login-code" className="mb-1.5 block text-sm font-medium text-ink">驗證碼</label>
              <input
                id="login-code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                className={`${inputCls} text-center font-latin text-lg tracking-[0.5em]`}
                autoComplete="one-time-code"
                required
              />
              <p className="mt-1.5 text-[13px] text-muted">
                沒收到信？請檢查垃圾郵件，或{' '}
                <button type="button" onClick={sendCode} disabled={busy || cooldown > 0} className={linkCls}>
                  {cooldown > 0 ? <><span className="font-latin">{cooldown}</span> 秒後可重寄</> : '重寄驗證碼'}
                </button>
              </p>
            </div>
          )}

          {(mode === 'login' || step === 'code') && (
            <div>
              <label htmlFor="login-password" className="mb-1.5 block text-sm font-medium text-ink">
                {mode === 'login' ? '密碼' : mode === 'register' ? '設定密碼' : '新密碼'}
              </label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputCls}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
              />
              {mode !== 'login' && (
                <p className="mt-1.5 text-[13px] text-muted">至少 8 個字元，需包含大寫字母、小寫字母與數字。</p>
              )}
            </div>
          )}

          {notice && !localErr && <Alert tone="success">{notice}</Alert>}
          {(localErr || (mode === 'login' && error)) && <Alert tone="error">{localErr || error}</Alert>}

          <BrandButton type="submit" variant="primary" disabled={submitting} className="w-full">
            {submitLabel}
          </BrandButton>

          <div className="space-y-1.5 text-center text-sm text-muted">
            {mode === 'login' && (
              <>
                <p>
                  還不是會員？{' '}
                  <button type="button" onClick={() => switchMode('register')} className={linkCls}>立即註冊</button>
                </p>
                <p>
                  <button type="button" onClick={() => switchMode('reset')} className={linkCls}>忘記密碼</button>
                </p>
              </>
            )}
            {mode === 'register' && (
              <p>
                已是會員？{' '}
                <button type="button" onClick={() => switchMode('login')} className={linkCls}>直接登入</button>
              </p>
            )}
            {mode === 'reset' && (
              <p>
                <button type="button" onClick={() => switchMode('login')} className={linkCls}>返回登入</button>
              </p>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  // useSearchParams 需要 Suspense 邊界（Next.js App Router 預渲染要求）
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}
