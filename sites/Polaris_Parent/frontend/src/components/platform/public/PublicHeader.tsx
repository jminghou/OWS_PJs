'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import LanguageSwitcher from '@ows/site-kit/components/LanguageSwitcher';
import { useAuthStore } from '@/store/auth';
import { LogoLockup } from '@/components/ui/BrandLogo';

// 多語言導航內容
const navContent: Record<string, {
  siteName: string;
  articles: string;
  reports: string;
  contact: string;
  newsletter: string;
  openMenu: string;
  closeMenu: string;
  account: string;
  logout: string;
}> = {
  'zh-TW': {
    siteName: '親紫之間',
    articles: '親紫專欄',
    reports: '購買報告',
    contact: '聯絡我們',
    newsletter: '電子報',
    openMenu: '打開主選單',
    closeMenu: '關閉主選單',
    account: '會員中心',
    logout: '登出',
  },
  'zh-CN': {
    siteName: '亲紫之间',
    articles: '亲紫专栏',
    reports: '购买报告',
    contact: '联系我们',
    newsletter: '电子报',
    openMenu: '打开主菜单',
    closeMenu: '关闭主菜单',
    account: '会员中心',
    logout: '登出',
  },
  'en': {
    siteName: 'Qin Zi Blog',
    articles: 'Articles',
    reports: 'Buy a Report',
    contact: 'Contact',
    newsletter: 'Newsletter',
    openMenu: 'Open main menu',
    closeMenu: 'Close main menu',
    account: 'My Account',
    logout: 'Logout',
  },
  'ja': {
    siteName: '親紫の間',
    articles: '記事',
    reports: 'レポートを購入',
    contact: 'お問い合わせ',
    newsletter: 'ニュースレター',
    openMenu: 'メニューを開く',
    closeMenu: 'メニューを閉じる',
    account: 'マイページ',
    logout: 'ログアウト',
  },
};

const locales = ['zh-TW', 'zh-CN', 'en', 'ja'];

const PILL =
  'rounded-full px-3.5 py-2 text-[15px] font-medium transition-colors duration-150 ease-out ' +
  'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100';
// 目前頁面淡藍底；其他 hover 暖灰底（品牌規範 §6.6）
const navClass = (active: boolean) => `${PILL} ${active ? 'bg-blue-50 text-blue-800' : 'text-ink hover:bg-tint'}`;
const mobileItemClass = (active: boolean) =>
  `block w-full rounded-full px-5 py-3 text-left text-[18px] font-medium transition-colors duration-150 ease-out ${
    active ? 'bg-blue-50 text-blue-800' : 'text-ink hover:bg-tint'
  }`;

export default function PublicHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
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

  // 黏在頂端、頁面已捲動時才加陰影
  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 0);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // 全螢幕選單打開時鎖住背後頁面的捲動
  useEffect(() => {
    if (!isMenuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isMenuOpen]);

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
  const homeHref = basePath || '/';

  // 首頁由 Logo 連回；排盤入口在首頁內文，頁首不另放「首頁」與「立即排盤」
  const navItems = [
    // 客製報告目前只有中文頁面（/report），各語系都連到同一頁
    { href: '/report', label: content.reports },
    { href: `${basePath}/articles`, label: content.articles },
    { href: `${basePath}/newsletter`, label: content.newsletter },
  ];
  const isActive = (href: string) =>
    pathname === href || (pathname.startsWith(`${href}/`) && !href.endsWith('/newsletter'));

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
    <header
      className={`sticky top-0 z-50 border-b border-line bg-white transition-shadow duration-150 ease-out ${
        isScrolled ? 'shadow-sm' : ''
      }`}
    >
      <div className="mx-auto max-w-content px-4 md:px-6">
        <div className="flex h-[72px] items-center justify-between gap-4">
          <Link
            href={homeHref}
            aria-label={content.siteName}
            className="rounded-full focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100"
          >
            <LogoLockup name={content.siteName} markWidth={58} priority />
          </Link>

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item.href) ? 'page' : undefined}
                className={navClass(isActive(item.href))}
              >
                {item.label}
              </Link>
            ))}
            {/* 未登入不顯示登入入口：/login 只從結帳流程進入；後台由 /admin/login 直接進 */}
            {isAuthenticated && (
              <>
                <Link
                  href="/account"
                  aria-current={isActive('/account') ? 'page' : undefined}
                  className={navClass(isActive('/account'))}
                >
                  {content.account}
                </Link>
                <button onClick={handleLogout} className={`${PILL} text-muted hover:bg-tint hover:text-ink`}>
                  {content.logout}
                </button>
              </>
            )}
            {i18nEnabled && <LanguageSwitcher />}
          </nav>

          <div className="flex items-center gap-1 lg:hidden">
            {i18nEnabled && <LanguageSwitcher />}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-expanded={isMenuOpen}
              aria-controls="public-mobile-menu"
              className="flex h-11 w-11 items-center justify-center rounded-full text-ink transition-colors hover:bg-tint focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100"
            >
              <span className="sr-only">{isMenuOpen ? content.closeMenu : content.openMenu}</span>
              {isMenuOpen ? (
                <X className="h-6 w-6" strokeWidth={2} aria-hidden="true" />
              ) : (
                <Menu className="h-6 w-6" strokeWidth={2} aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 手機：全螢幕白底面板，項目 18px、間距 8px */}
      {isMenuOpen && (
        <div
          id="public-mobile-menu"
          className="fixed inset-x-0 bottom-0 top-[72px] z-50 flex flex-col overflow-y-auto bg-white px-4 pb-8 pt-4 lg:hidden"
        >
          <nav className="flex flex-col gap-2" aria-label="Main">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item.href) ? 'page' : undefined}
                className={mobileItemClass(isActive(item.href))}
              >
                {item.label}
              </Link>
            ))}
            {isAuthenticated && (
              <>
                <div className="my-2 border-t border-line" />
                <Link
                  href="/account"
                  aria-current={isActive('/account') ? 'page' : undefined}
                  className={mobileItemClass(isActive('/account'))}
                >
                  {content.account}
                </Link>
                <button
                  onClick={handleLogout}
                  className="block w-full rounded-full px-5 py-3 text-left text-[18px] font-medium text-muted transition-colors hover:bg-tint hover:text-ink"
                >
                  {content.logout}
                </button>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
