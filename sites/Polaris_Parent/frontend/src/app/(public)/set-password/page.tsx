'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { astrologyApi } from '@/lib/api';
import Button from '@/components/platform/ui/Button';

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
    'w-full px-4 py-3 border border-gray-300 rounded-banner focus:ring-2 focus:ring-brand-purple-500 focus:border-transparent';

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <h1 className="text-2xl font-bold text-gray-900 mb-6 text-center">設定會員密碼</h1>

      {done ? (
        <div className="bg-white rounded-banner border border-warm-200/70 p-6 text-center space-y-4">
          <p className="text-green-700">密碼已設定完成！</p>
          <Link
            href="/"
            className="inline-block px-5 py-3 rounded-banner bg-brand-purple-600 text-white hover:bg-brand-purple-700 transition-colors"
          >
            前往登入
          </Link>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-banner border border-warm-200/70 shadow-[0_8px_30px_rgba(139,92,246,0.06)] p-6 space-y-4"
        >
          <p className="text-sm text-gray-600">
            密碼需至少 8 個字元，並包含大寫字母、小寫字母與數字。
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">新密碼</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputCls}
              autoComplete="new-password"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">確認密碼</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={inputCls}
              autoComplete="new-password"
              required
            />
          </div>
          {err && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-banner text-red-700 text-sm">
              {err}
            </div>
          )}
          <Button
            type="submit"
            disabled={busy}
            className="w-full bg-brand-purple-600 hover:bg-brand-purple-700"
          >
            {busy ? '設定中…' : '設定密碼'}
          </Button>
        </form>
      )}
    </div>
  );
}
