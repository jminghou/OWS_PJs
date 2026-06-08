'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth';
import Button from '@/components/ui/Button';

/**
 * 公眾會員登入頁。會員以 email（=帳號）+ 密碼登入，登入後進入會員中心 /account。
 * （後台管理者請用 /admin/login。）
 */
export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading, error } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login({ username: email.trim(), password });
      router.push('/account');
    } catch {
      /* 錯誤訊息由 store.error 顯示 */
    }
  };

  const inputCls =
    'w-full px-4 py-3 border border-gray-300 rounded-banner focus:ring-2 focus:ring-brand-purple-500 focus:border-transparent';

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <h1 className="text-2xl font-bold text-gray-900 mb-6 text-center">會員登入</h1>
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-banner border border-warm-200/70 shadow-[0_8px_30px_rgba(139,92,246,0.06)] p-6 space-y-4"
      >
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
            autoComplete="current-password"
            required
          />
        </div>
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-banner text-red-700 text-sm">
            {error}
          </div>
        )}
        <Button
          type="submit"
          disabled={isLoading}
          className="w-full bg-brand-purple-600 hover:bg-brand-purple-700"
        >
          {isLoading ? '登入中…' : '登入'}
        </Button>
        <p className="text-sm text-gray-500 text-center">
          還不是會員？到{' '}
          <Link href="/ziwei" className="text-brand-purple-700 hover:underline">
            排盤頁
          </Link>{' '}
          排一張命盤即可一鍵建檔加入。
        </p>
      </form>
    </div>
  );
}
