'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@ows/platform-api';
import { getAdminConfig } from '../config';
import { PLATFORM_NAV } from '../platformNav';
import AdminLabeledShell from './AdminLabeledShell';
import { useVisibleItems } from './useVisibleNav';

/** extraNav 項目沒提供圖示時的通用圖示。 */
function GenericNavIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h7" />
    </svg>
  );
}

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  if (getAdminConfig().shell === 'labeled') {
    return <AdminLabeledShell>{children}</AdminLabeledShell>;
  }
  return <AdminRailLayout>{children}</AdminRailLayout>;
}

/** 原本的 72px 圖示長條外殼（shell 未設或 'rail' 時使用，行為與改版前一致）。 */
function AdminRailLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    router.push('/admin/login');
  };

  const { siteName, extraNav = [], globalSearch } = getAdminConfig();

  // 站台自己的後台頁面（例如 Polaris 的訂單審核 / 折扣碼）從設定注入，
  // 不寫死在共用套件裡 —— 否則每個站台的後台都會看到別站的功能。
  // 三層過濾（模組 × 權限）在 useVisibleItems。
  const navigation = useVisibleItems([
    ...PLATFORM_NAV.map((n) => ({ ...n, divider: false })),
    ...extraNav,
  ]).map((item) => ({
    ...item,
    name: item.label,
    icon: item.icon ?? <GenericNavIcon />,
  }));

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Icon-only Sidebar */}
      <div
        className={`${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } fixed inset-y-0 left-0 z-50 w-[72px] bg-[#212134] transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0`}
      >
        <div className="flex flex-col h-full">
          {/* Logo Area */}
          <div className="flex items-center justify-center h-16">
            <Link href="/" className="flex items-center justify-center w-10 h-10 bg-blue-600 rounded-lg">
              <span className="text-lg font-bold text-white">親</span>
            </Link>
          </div>

          {/* Navigation Icons */}
          <nav className="flex-1 py-4">
            <div className="flex flex-col items-center space-y-1">
              {navigation.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                return (
                  <Link
                    key={item.name}
                    data-divider={item.divider ? '' : undefined}
                    href={item.href}
                    className={`group relative flex items-center justify-center w-12 h-12 rounded-lg transition-all duration-200 ${
                      item.divider ? 'mt-3 before:absolute before:-top-2 before:left-2 before:right-2 before:border-t before:border-gray-700' : ''
                    } ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-400 hover:bg-[#32324d] hover:text-white'
                    }`}
                    onClick={() => setSidebarOpen(false)}
                    title={item.name}
                  >
                    {item.icon}
                    {/* Tooltip */}
                    <span className="absolute left-full ml-3 px-2 py-1 text-sm font-medium text-white bg-gray-900 rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50">
                      {item.name}
                    </span>
                  </Link>
                );
              })}
            </div>
          </nav>

          {/* User Area */}
          <div className="py-4 border-t border-gray-700">
            <div className="flex flex-col items-center space-y-3">
              {/* 全域搜尋（由站台 config 注入，例如 Studio 的 ⌘K） */}
              {globalSearch}
              {/* User Avatar */}
              <div className="group relative">
                <div className="flex items-center justify-center w-10 h-10 bg-gray-600 rounded-full cursor-pointer">
                  <span className="text-sm font-medium text-white">
                    {user?.username?.charAt(0).toUpperCase()}
                  </span>
                </div>
                {/* User Tooltip */}
                <span className="absolute left-full ml-3 px-2 py-1 text-sm font-medium text-white bg-gray-900 rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50">
                  {user?.username} ({user?.role})
                </span>
              </div>
              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className="group relative flex items-center justify-center w-10 h-10 text-gray-400 hover:text-white hover:bg-[#32324d] rounded-lg transition-colors"
                title="登出"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                {/* Logout Tooltip */}
                <span className="absolute left-full ml-3 px-2 py-1 text-sm font-medium text-white bg-gray-900 rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50">
                  登出
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Header */}
        <header className="bg-white shadow-sm border-b lg:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="text-gray-500 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <span className="text-lg font-semibold text-gray-900">{siteName} 管理後台</span>
            <div className="w-6"></div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}