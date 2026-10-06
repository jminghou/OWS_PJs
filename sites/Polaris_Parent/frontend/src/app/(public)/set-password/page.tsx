'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { astrologyApi } from '@/lib/api';
import BrandButton, { brandButton } from '@/components/ui/BrandButton';
import Alert from '@/components/ui/Alert';
import { LogoMark } from '@/components/ui/BrandLogo';

/**
 * 設定會員密碼頁（一鍵建檔後寄出的「設定密碼信」連結目標）。
 * 連結形如 /set-password?token=...；token 由後端簽章，24 小時有效。
 */
export default function SetPasswordPage() {
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get('token') || '');
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    if (!token) {
      setErr('連結無效或缺少 token，請使用信件中的完整連結');
      return;
    }
    if (password !== confirm) {
      setErr('兩次輸入的密碼不一致');
      return;
    }
    setBusy(true);
    try {
      await astrologyApi.setPassword(token, password);
      setDone(true);
    } catch (e: any) {
      setErr(e.message || '設定失敗，連結可能已過期，請重新申請');
    } finally {
      setBusy(false);
    }
  };

  const inputCls =
    'w-full rounded-2xl border-[1.5px] border-line-strong bg-white px-[18px] py-[13px] text-base text-ink ' +
    'placeholder:text-muted focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100';

  return (
    <div className="min-h-[calc(100vh-72px)] bg-paper px-4 py-16">
      <div className="mx-auto max-w-md">
        <div className="mb-6 flex justify-center">
          <LogoMark width={72} />
        </div>
        <h1 className="mb-6 text-center font-heading text-[26px] font-normal text-ink md:text-h2">設定會員密碼</h1>

        {done ? (
          <div className="space-y-5 rounded-card bg-white p-7 text-center md:p-8">
            <Alert tone="success" className="text-left">密碼已設定完成！</Alert>
            <Link href="/" className={brandButton({ variant: 'primary', className: 'w-full' })}>
              前往登入
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5 rounded-card bg-white p-7 md:p-8">
            <p className="text-sm text-text">
              密碼需至少 8 個字元，並包含大寫字母、小寫字母與數字。
            </p>
            <div>
              <label htmlFor="sp-password" className="mb-1.5 block text-sm font-medium text-ink">新密碼</label>
              <input
                id="sp-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputCls}
                autoComplete="new-password"
                required
              />
            </div>
            <div>
              <label htmlFor="sp-confirm" className="mb-1.5 block text-sm font-medium text-ink">確認密碼</label>
              <input
                id="sp-confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={inputCls}
                autoComplete="new-password"
                required
              />
            </div>
            {err && <Alert tone="error">{err}</Alert>}
            <BrandButton type="submit" variant="primary" disabled={busy} className="w-full">
              {busy ? '設定中…' : '設定密碼'}
            </BrandButton>
          </form>
        )}
      </div>
    </div>
  );
}
