'use client';

/**
 * 後台外殼：登入守衛 + 權限判定。
 *
 * 站台的 app/admin/layout.tsx 直接渲染它即可（見套件 README 的掛載方式）。
 * 守衛邏輯是平台契約 —— 後台只給 admin / editor，一般會員導回會員中心 ——
 * 每個站台都一樣，不該各寫一份。
 */

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@ows/platform-api';
import { isPathDisabled } from '../config';

export default function AdminShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, isLoading, checkAuth, user } = useAuthStore();

  // 後台僅限管理者 / 編輯者；一般會員（member/user）即使已登入也不得進入。
  const isStaff = !!user && (user.role === 'admin' || user.role === 'editor');

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      if (pathname !== '/admin/login') router.push('/admin/login');
    } else if (!isStaff) {
      // 已登入但非後台人員 → 導回會員中心
      router.push('/account');
    } else if (pathname === '/admin/login') {
      router.push('/admin/dashboard');
    } else if (isPathDisabled(pathname)) {
      // 這個站台沒啟用的平台模組：不只藏選單，直接猜網址也進不去。
      // 否則「關掉商品模組」只是視覺上的，功能其實還在。
      router.replace('/admin/dashboard');
    }
  }, [isAuthenticated, isStaff, isLoading, pathname, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // 未登入（非登入頁）或已登入但非後台人員 → 不渲染後台內容（等待上面導頁）
  if (!isAuthenticated && pathname !== '/admin/login') {
    return null;
  }
  if (isAuthenticated && !isStaff && pathname !== '/admin/login') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {children}
    </div>
  );
}