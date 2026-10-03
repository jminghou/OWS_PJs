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
import Button from '@/components/platform/ui/Button';

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
    'w-full px-4 py-3 border border-gray-300 rounded-banner focus:ring-2 focus:ring-brand-purple-500 focus:border-transparent';
  const tabCls = (active: boolean) =>
    `flex-1 py-2.5 text-sm font-medium transition-colors ${
      active
        ? 'bg-brand-purple-600 text-white'
        : 'text-brand-purple-700 hover:bg-brand-purple-50'
    }`;
  const linkCls = 'text-brand-purple-700 hover:underline disabled:opacity-50 disabled:no-underline';

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
    <div className="max-w-md mx-auto px-4 py-16">
      <h1 className="text-2xl font-bold text-gray-900 mb-6 text-center">{title}</h1>

      <div className="bg-white rounded-banner border border-warm-200/70 shadow-[0_8px_30px_rgba(139,92,246,0.06)] overflow-hidden">
        {/* 登入 / 註冊 分頁（重設密碼不顯示分頁） */}
        {mode !== 'reset' && (
          <div className="flex border-b border-warm-200/70">
            <button type="button" onClick={() => switchMode('login')} className={tabCls(mode === 'login')}>
              登入
            </button>
            <button type="button" onClick={() => switchMode('register')} className={tabCls(mode === 'register')}>
              註冊
            </button>
          </div>
        )}

        <form onSubmit={onSubmit} className="p-6 space-y-4">
          {pendingChart && mode !== 'reset' && (
            <div className="p-3 bg-brand-purple-50 border border-brand-purple-200 rounded-banner text-sm text-brand-purple-800">
              {mode === 'register'
                ? '註冊完成後，會自動把你剛排的命盤存進帳號。'
                : '登入成功後，會自動把你剛排的命盤存進帳號。'}
            </div>
          )}

          {mode === 'register' && step === 'email' && (
            <p className="text-sm text-gray-600">
              我們會寄一組驗證碼到你的 Email，驗證後設定密碼即完成註冊。這個帳號用來保管你的訂單與報告。
            </p>
          )}
          {mode === 'reset' && step === 'email' && (
            <p className="text-sm text-gray-600">輸入註冊時的 Email，我們會寄驗證碼給你重設密碼。</p>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`${inputCls} disabled:bg-gray-50 disabled:text-gray-500`}
              autoComplete="email"
              disabled={mode !== 'login' && step === 'code'}
              required
            />
            {mode !== 'login' && step === 'code' && (
              <button type="button" onClick={() => { setStep('email'); setCode(''); setNotice(''); }}
                      className={`mt-1.5 text-xs ${linkCls}`}>
                改用其他 Email
              </button>
            )}
          </div>

          {mode !== 'login' && step === 'code' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">驗證碼</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                className={`${inputCls} tracking-[0.5em] text-center text-lg`}
                autoComplete="one-time-code"
                required
              />
              <p className="mt-1.5 text-xs text-gray-500">
                沒收到信？請檢查垃圾郵件，或{' '}
                <button type="button" onClick={sendCode} disabled={busy || cooldown > 0} className={linkCls}>
                  {cooldown > 0 ? `${cooldown} 秒後可重寄` : '重寄驗證碼'}
                </button>
              </p>
            </div>
          )}

          {(mode === 'login' || step === 'code') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {mode === 'login' ? '密碼' : mode === 'register' ? '設定密碼' : '新密碼'}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputCls}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
              />
              {mode !== 'login' && (
                <p className="mt-1.5 text-xs text-gray-500">至少 8 個字元，需包含大寫字母、小寫字母與數字。</p>
              )}
            </div>
          )}

          {notice && !localErr && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-banner text-green-700 text-sm">
              {notice}
            </div>
          )}
          {(localErr || (mode === 'login' && error)) && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-banner text-red-700 text-sm">
              {localErr || error}
            </div>
          )}

          <Button type="submit" disabled={submitting} className="w-full bg-brand-purple-600 hover:bg-brand-purple-700">
            {submitLabel}
          </Button>

          <div className="space-y-1.5 text-sm text-gray-500 text-center">
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
