'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import LanguageSwitcher from '@ows/site-kit/components/LanguageSwitcher';
import { useAuthStore } from '@/store/auth';

// 多語言導航內容
const navContent: Record<string, {
  siteName: string;
  home: string;
  about: string;
  articles: string;
  products: string;
  contact: string;
  ziwei: string;
  openMenu: string;
  login: string;
  account: string;
  logout: string;
}> = {
  'zh-TW': {
    siteName: '親紫之間',
    home: '首頁',
    about: '關於我們',
    articles: '親紫專欄',
    products: '服務與產品',
    contact: '聯絡我們',
    ziwei: '線上排盤',
    openMenu: '打開主選單',
    login: '登入',
    account: '會員中心',
    logout: '登出',
  },
  'zh-CN': {
    siteName: '亲紫之间',
    home: '首页',
    about: '关于我们',
    articles: '亲紫专栏',
    products: '服务与产品',
    contact: '联系我们',
    ziwei: '在线排盘',
    openMenu: '打开主菜单',
    login: '登录',
    account: '会员中心',
    logout: '登出',
  },
  'en': {
    siteName: 'Qin Zi Blog',
    home: 'Home',
    about: 'About',
    articles: 'Articles',
    products: 'Products',
    contact: 'Contact',
    ziwei: 'Ziwei Chart',
    openMenu: 'Open main menu',
    login: 'Login',
    account: 'My Account',
    logout: 'Logout',
  },
  'ja': {
    siteName: '親紫の間',
    home: 'ホーム',
    about: '私たちについて',
    articles: '記事',
    products: '製品',
    contact: 'お問い合わせ',
    ziwei: '紫微占い',
    openMenu: 'メニューを開く',
    login: 'ログイン',
    account: 'マイページ',
    logout: 'ログアウト',
  },
};

const locales = ['zh-TW', 'zh-CN', 'en', 'ja'];

export default function PublicHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [i18nEnabled, setI18nEnabled] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, checkAuth, logout } = useAuthStore();

  // 載入時確認登入狀態（讓頂部導覽顯示會員中心/登出）
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // 換頁後收起手機選單
  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    await logout();
    setIsMenuOpen(false);
    router.push('/');
  };

  // 從路徑獲取當前語言
  const pathLocale = pathname.split('/')[1];
  const currentLocale = locales.includes(pathLocale) ? pathLocale : 'zh-TW';
  const content = navContent[currentLocale] || navContent['zh-TW'];
  const basePath = currentLocale === 'zh-TW' ? '' : `/${currentLocale}`;

  // 導覽一律是真正的頁面連結（首頁由站名連回）
  const navItems = [
    { href: `${basePath}/articles`, label: content.articles },
    { href: `${basePath}/about`, label: content.about },
    { href: `${basePath}/products`, label: content.products },
    { href: `${basePath}/ziwei`, label: content.ziwei },
  ];
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  // 檢查 i18n 是否啟用
  useEffect(() => {
    const checkI18n = async () => {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/settings/i18n`
        );
        if (response.ok) {
          const data = await response.json();
          setI18nEnabled(data.enabled);
        }
      } catch (error) {
        console.error('Failed to fetch i18n settings:', error);
      }
    };
    checkI18n();
  }, []);

  return (
    <header className="bg-white shadow-sm border-b fixed top-0 left-0 right-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-14">
          <div className="flex items-center">
            <Link
              href={basePath || '/'}
              className="text-2xl font-bold text-brand-purple-700 hover:text-brand-purple-600 transition-colors"
            >
              {content.siteName}
            </Link>
          </div>

          <nav className="hidden md:flex items-center space-x-4">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item.href) ? 'page' : undefined}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors hover:text-brand-purple-600 ${
                  isActive(item.href) ? 'text-brand-purple-700' : 'text-gray-900'
                }`}
              >
                {item.label}
              </Link>
            ))}
            {isAuthenticated ? (
              <>
                <Link
                  href="/account"
                  className="text-brand-purple-700 hover:text-brand-purple-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  {content.account}
                </Link>
                <button
                  onClick={handleLogout}
                  className="text-gray-500 hover:text-brand-purple-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  {content.logout}
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="text-brand-purple-700 hover:text-brand-purple-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
              >
                {content.login}
              </Link>
            )}
            {i18nEnabled && <LanguageSwitcher />}
          </nav>

          <div className="md:hidden flex items-center gap-2">
            {i18nEnabled && <LanguageSwitcher />}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-expanded={isMenuOpen}
              aria-controls="public-mobile-menu"
              className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-purple-500 p-2 rounded-md"
            >
              <span className="sr-only">{content.openMenu}</span>
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                stroke="currentColor"
                aria-hidden="true"
              >
                {isMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {isMenuOpen && (
        <div className="md:hidden" id="public-mobile-menu">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-white border-t">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item.href) ? 'page' : undefined}
                className={`hover:bg-warm-50 block w-full text-left px-3 py-2 rounded-md text-base font-medium ${
                  isActive(item.href) ? 'text-brand-purple-700' : 'text-gray-900'
                }`}
              >
                {item.label}
              </Link>
            ))}
            <div className="border-t border-warm-100 my-1" />
            {isAuthenticated ? (
              <>
                <Link
                  href="/account"
                  className="text-brand-purple-700 hover:bg-warm-50 block w-full text-left px-3 py-2 rounded-md text-base font-medium"
                >
                  {content.account}
                </Link>
                <button
                  onClick={handleLogout}
                  className="text-gray-500 hover:bg-warm-50 block w-full text-left px-3 py-2 rounded-md text-base font-medium"
                >
                  {content.logout}
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="text-brand-purple-700 hover:bg-warm-50 block w-full text-left px-3 py-2 rounded-md text-base font-medium"
              >
                {content.login}
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
