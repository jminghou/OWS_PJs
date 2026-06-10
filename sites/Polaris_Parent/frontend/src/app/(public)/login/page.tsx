'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { astrologyApi, authApi } from '@/lib/api';
import {
  loadPendingChart,
  clearPendingChart,
} from '@/lib/pendingChart';
import type { RegisterChartPayload } from '@/lib/api/auth';
import Button from '@/components/ui/Button';

/**
 * 公眾會員「登入／註冊」合一頁。
 * - ?mode=register 直接落在註冊分頁（排盤頁 CTA 由此進）。
 * - 排盤頁暫存的命盤（sessionStorage）會在註冊／登入成功後自動存入帳號。
 * - 「重寄設定密碼信」兼忘記密碼（早期免密碼建檔的會員由此補設密碼）。
 * （後台管理者請用 /admin/login。）
 */
function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, register, isLoading, error, clearError } = useAuthStore();

  const [mode, setMode] = useState<'login' | 'register'>(
    searchParams.get('mode') === 'register' ? 'register' : 'login'
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pendingChart, setPendingChart] = useState<RegisterChartPayload | null>(null);
  const [localErr, setLocalErr] = useState('');

  // 重寄設定密碼信（兼忘記密碼）
  const [resendBusy, setResendBusy] = useState(false);
  const [resendMsg, setResendMsg] = useState('');

  // 註冊成功但命盤儲存失敗（降級）→ 顯示警告，不自動導頁
  const [chartWarning, setChartWarning] = useState('');

  useEffect(() => {
    setPendingChart(loadPendingChart());
  }, []);

  const switchMode = (m: 'login' | 'register') => {
    setMode(m);
    setLocalErr('');
    setResendMsg('');
    clearError();
  };

  // 登入成功後：若有剛排的命盤，補存到帳號（best-effort，不擋導頁）
  const attachPendingChart = async (memberEmail: string) => {
    const chart = loadPendingChart();
    if (!chart) return;
    try {
      await astrologyApi.saveAndRegister({ ...chart, email: memberEmail });
      clearPendingChart();
    } catch {
      /* 存盤失敗不擋登入；會員可回排盤頁重排 */
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalErr('');
    try {
      await login({ username: email.trim(), password });
      await attachPendingChart(email.trim().toLowerCase());
      router.push('/account');
    } catch {
      /* 錯誤訊息由 store.error 顯示 */
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalErr('');
    try {
      const res = await register({
        email: email.trim().toLowerCase(),
        password,
        chart: pendingChart ?? undefined,
      });
      clearPendingChart();
      if (res.chart_warning) {
        // 已註冊並登入，但命盤沒存成功 → 留在本頁顯示警告
        setChartWarning(res.chart_warning);
        return;
      }
      router.push('/account');
    } catch {
      /* 錯誤訊息由 store.error 顯示 */
    }
  };

  const handleResend = async () => {
    setResendMsg('');
    setLocalErr('');
    if (!email.trim()) {
      setLocalErr('請先在上方填入你的 email，再按重寄');
      return;
    }
    setResendBusy(true);
    try {
      const res = await authApi.resendSetPassword(email.trim().toLowerCase());
      setResendMsg(res.message || '設定密碼信已寄出，請收信完成設定。');
    } catch (err: any) {
      setLocalErr(err.message || '寄送失敗，請稍後再試');
    } finally {
      setResendBusy(false);
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

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <h1 className="text-2xl font-bold text-gray-900 mb-6 text-center">
        {mode === 'login' ? '會員登入' : '加入會員'}
      </h1>

      <div className="bg-white rounded-banner border border-warm-200/70 shadow-[0_8px_30px_rgba(139,92,246,0.06)] overflow-hidden">
        {/* 登入 / 註冊 分頁 */}
        <div className="flex border-b border-warm-200/70">
          <button type="button" onClick={() => switchMode('login')} className={tabCls(mode === 'login')}>
            登入
          </button>
          <button type="button" onClick={() => switchMode('register')} className={tabCls(mode === 'register')}>
            註冊
          </button>
        </div>

        <form onSubmit={mode === 'login' ? handleLogin : handleRegister} className="p-6 space-y-4">
          {/* 剛排的命盤提示 */}
          {pendingChart && (
            <div className="p-3 bg-brand-purple-50 border border-brand-purple-200 rounded-banner text-sm text-brand-purple-800">
              {mode === 'register'
                ? '註冊完成後，會自動把你剛排的命盤存進帳號。'
                : '登入成功後，會自動把你剛排的命盤存進帳號。'}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputCls}
              autoComplete="email"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">密碼</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputCls}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
            />
            {mode === 'register' && (
              <p className="mt-1.5 text-xs text-gray-500">
                至少 8 個字元，需包含大寫字母、小寫字母與數字。
              </p>
            )}
          </div>

          {(error || localErr) && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-banner text-red-700 text-sm">
              {localErr || error}
            </div>
          )}
          {resendMsg && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-banner text-green-700 text-sm">
              {resendMsg}
            </div>
          )}
          {chartWarning && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-banner text-amber-800 text-sm space-y-2">
              <p>註冊成功！{chartWarning}</p>
              <Button
                type="button"
                onClick={() => router.push('/account')}
                className="bg-brand-purple-600 hover:bg-brand-purple-700"
              >
                前往會員中心
              </Button>
            </div>
          )}

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full bg-brand-purple-600 hover:bg-brand-purple-700"
          >
            {isLoading
              ? mode === 'login' ? '登入中…' : '註冊中…'
              : mode === 'login' ? '登入' : '註冊並登入'}
          </Button>

          {mode === 'login' ? (
            <div className="space-y-1.5 text-sm text-gray-500 text-center">
              <p>
                還不是會員？{' '}
                <button
                  type="button"
                  onClick={() => switchMode('register')}
                  className="text-brand-purple-700 hover:underline"
                >
                  立即註冊
                </button>
              </p>
              <p>
                忘記密碼／尚未設定密碼？{' '}
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendBusy}
                  className="text-brand-purple-700 hover:underline disabled:opacity-50"
                >
                  {resendBusy ? '寄送中…' : '重寄設定密碼信'}
                </button>
              </p>
            </div>
          ) : (
            <p className="text-sm text-gray-500 text-center">
              已是會員？{' '}
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="text-brand-purple-700 hover:underline"
              >
                直接登入
              </button>
            </p>
          )}
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
