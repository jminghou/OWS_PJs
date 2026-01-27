'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import LanguageSwitcher from './LanguageSwitcher';

// 多語言導航內容
const navContent: Record<string, {
  siteName: string;
  home: string;
  about: string;
  articles: string;
  products: string;
  contact: string;
  openMenu: string;
}> = {
  'zh-TW': {
    siteName: '親紫之間',
    home: '首頁',
    about: '關於我們',
    articles: '親紫專欄',
    products: '服務與產品',
    contact: '聯絡我們',
    openMenu: '打開主選單',
  },
  'zh-CN': {
    siteName: '亲紫之间',
    home: '首页',
    about: '关于我们',
    articles: '亲紫专栏',
    products: '服务与产品',
    contact: '联系我们',
    openMenu: '打开主菜单',
  },
  'en': {
    siteName: 'Qin Zi Blog',
    home: 'Home',
    about: 'About',
    articles: 'Articles',
    products: 'Products',
    contact: 'Contact',
    openMenu: 'Open main menu',
  },
  'ja': {
    siteName: '親紫の間',
    home: 'ホーム',
    about: '私たちについて',
    articles: '記事',
    products: '製品',
    contact: 'お問い合わせ',
    openMenu: 'メニューを開く',
  },
};

const locales = ['zh-TW', 'zh-CN', 'en', 'ja'];

export default function PublicHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [i18nEnabled, setI18nEnabled] = useState(false);
  const pathname = usePathname();

  // 從路徑獲取當前語言
  const getCurrentLocale = () => {
    const pathLocale = pathname.split('/')[1];
    if (locales.includes(pathLocale)) {
      return pathLocale;
    }
    return 'zh-TW';
  };

  const currentLocale = getCurrentLocale();
  const content = navContent[currentLocale] || navContent['zh-TW'];
  const basePath = currentLocale === 'zh-TW' ? '' : `/${currentLocale}`;

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
    <header className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link href={basePath || '/'} className="text-2xl font-bold text-brand-purple-700 hover:text-brand-purple-600">
              {content.siteName}
            </Link>
          </div>

          <nav className="hidden md:flex items-center space-x-8">
            <Link
              href={basePath || '/'}
              className="text-gray-900 hover:text-brand-purple-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
            >
              {content.home}
            </Link>
            <Link
              href={`${basePath}/about`}
              className="text-gray-900 hover:text-brand-purple-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
            >
              {content.about}
            </Link>
            <Link
              href={`${basePath}/articles`}
              className="text-gray-900 hover:text-brand-purple-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
            >
              {content.articles}
            </Link>
            <Link
              href={`${basePath}/products`}
              className="text-gray-900 hover:text-brand-purple-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
            >
              {content.products}
            </Link>
            {/* <Link
              href={`${basePath}/contact`}
              className="text-gray-900 hover:text-brand-purple-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
            >
              {content.contact}
            </Link> */}
            {i18nEnabled && <LanguageSwitcher />}
          </nav>

          <div className="md:hidden flex items-center gap-2">
            {i18nEnabled && <LanguageSwitcher />}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 p-2 rounded-md"
            >
              <span className="sr-only">{content.openMenu}</span>
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                stroke="currentColor"
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
        <div className="md:hidden">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-white border-t">
            <Link
              href={basePath || '/'}
              className="text-gray-900 hover:bg-warm-50 block px-3 py-2 rounded-md text-base font-medium"
              onClick={() => setIsMenuOpen(false)}
            >
              {content.home}
            </Link>
            <Link
              href={`${basePath}/about`}
              className="text-gray-900 hover:bg-warm-50 block px-3 py-2 rounded-md text-base font-medium"
              onClick={() => setIsMenuOpen(false)}
            >
              {content.about}
            </Link>
            <Link
              href={`${basePath}/articles`}
              className="text-gray-900 hover:bg-warm-50 block px-3 py-2 rounded-md text-base font-medium"
              onClick={() => setIsMenuOpen(false)}
            >
              {content.articles}
            </Link>
            <Link
              href={`${basePath}/products`}
              className="text-gray-900 hover:bg-warm-50 block px-3 py-2 rounded-md text-base font-medium"
              onClick={() => setIsMenuOpen(false)}
            >
              {content.products}
            </Link>
            {/* <Link
              href={`${basePath}/contact`}
              className="text-gray-900 hover:bg-warm-50 block px-3 py-2 rounded-md text-base font-medium"
              onClick={() => setIsMenuOpen(false)}
            >
              {content.contact}
            </Link> */}
          </div>
        </div>
      )}
    </header>
  );
}
