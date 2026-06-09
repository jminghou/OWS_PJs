'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';

export default function AdminLayout({
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