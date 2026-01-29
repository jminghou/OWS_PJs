'use client';

import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
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
  const router = useRouter();

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

  // 判斷是否在首頁
  const isHomePage = pathname === '/' || pathname === `/${currentLocale}` || pathname === `/${currentLocale}/`;

  // 錨點跳轉處理
  const scrollToSection = useCallback((sectionId: string) => {
    if (isHomePage) {
      // 在首頁：直接滾動到該區塊
      const element = document.getElementById(sectionId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    } else {
      // 不在首頁：先跳轉到首頁，然後滾動
      router.push(`${basePath || '/'}#${sectionId}`);
    }
    setIsMenuOpen(false);
  }, [isHomePage, basePath, router]);

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
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <button
              onClick={() => scrollToSection('hero')}
              className="text-2xl font-bold text-brand-purple-700 hover:text-brand-purple-600 transition-colors"
            >
              {content.siteName}
            </button>
          </div>

          <nav className="hidden md:flex items-center space-x-8">
            <button
              onClick={() => scrollToSection('hero')}
              className="text-gray-900 hover:text-brand-purple-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
            >
              {content.home}
            </button>
            <button
              onClick={() => scrollToSection('about')}
              className="text-gray-900 hover:text-brand-purple-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
            >
              {content.about}
            </button>
            <button
              onClick={() => scrollToSection('articles')}
              className="text-gray-900 hover:text-brand-purple-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
            >
              {content.articles}
            </button>
            <button
              onClick={() => scrollToSection('products')}
              className="text-gray-900 hover:text-brand-purple-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
            >
              {content.products}
            </button>
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
            <button
              className="text-gray-900 hover:bg-warm-50 block w-full text-left px-3 py-2 rounded-md text-base font-medium"
              onClick={() => scrollToSection('hero')}
            >
              {content.home}
            </button>
            <button
              className="text-gray-900 hover:bg-warm-50 block w-full text-left px-3 py-2 rounded-md text-base font-medium"
              onClick={() => scrollToSection('about')}
            >
              {content.about}
            </button>
            <button
              className="text-gray-900 hover:bg-warm-50 block w-full text-left px-3 py-2 rounded-md text-base font-medium"
              onClick={() => scrollToSection('articles')}
            >
              {content.articles}
            </button>
            <button
              className="text-gray-900 hover:bg-warm-50 block w-full text-left px-3 py-2 rounded-md text-base font-medium"
              onClick={() => scrollToSection('products')}
            >
              {content.products}
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
