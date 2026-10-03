'use client';

import { useEffect, useState } from 'react';
import Button from '@/components/platform/ui/Button';
import { memberAccountApi } from '@/lib/api';

const RESEND_SECONDS = 60;

/**
 * 結帳前的 Email 驗證（會員 v2）。舊入口註冊、尚未驗證的帳號在這裡補驗證；
 * 新註冊的會員已在註冊時驗證過，不會看到這個區塊。
 */
export default function EmailVerifyBox({ email, onVerified }: { email: string; onVerified: () => void }) {
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const send = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await memberAccountApi.sendEmailCode('verify');
      if (res.already_verified) {
        onVerified();
        return;
      }
      setNotice(res.message || '驗證碼已寄出。');
      setSent(true);
      setCooldown(RESEND_SECONDS);
    } catch (err: any) {
      setError(err.message || '寄送失敗，請稍後再試');
    } finally {
      setBusy(false);
    }
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await memberAccountApi.verifyEmail(code.trim());
      onVerified();
    } catch (err: any) {
      setError(err.message || '驗證失敗，請稍後再試');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-banner border border-amber-200 bg-amber-50 p-5 sm:p-6">
      <h2 className="text-base font-bold text-amber-900">請先驗證 Email</h2>
      <p className="mt-1 text-sm text-amber-900">
        報告與訂單通知會寄到 <strong>{email}</strong>，送出訂單前需要確認這個 Email 是你的。
      </p>
      {!sent ? (
        <Button type="button" onClick={send} disabled={busy} className="mt-4 bg-brand-purple-600 hover:bg-brand-purple-700">
          {busy ? '寄送中…' : '寄送驗證碼'}
        </Button>
      ) : (
        <form onSubmit={verify} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            autoComplete="one-time-code"
            aria-label="驗證碼"
            placeholder="6 位數驗證碼"
            className="w-full rounded-banner border border-gray-300 bg-white px-4 py-3 text-center tracking-[0.4em] sm:w-48"
            required
          />
          <Button type="submit" disabled={busy || code.length !== 6} className="bg-brand-purple-600 hover:bg-brand-purple-700">
            {busy ? '驗證中…' : '確認'}
          </Button>
          <button type="button" onClick={send} disabled={busy || cooldown > 0}
                  className="text-sm text-brand-purple-700 hover:underline disabled:opacity-50 sm:self-center">
            {cooldown > 0 ? `${cooldown} 秒後可重寄` : '重寄驗證碼'}
          </button>
        </form>
      )}
      {notice && !error && <p className="mt-3 text-sm text-green-700">{notice}</p>}
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
    </section>
  );
}
