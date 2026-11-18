import { ReactNode } from 'react';
import { Noto_Sans_SC } from 'next/font/google';
// 子路徑匯入：從 barrel 匯入會連帶把 HeroCarousel（與 Swiper 的 CSS）拉進每一頁
import JsonLd from '@ows/site-kit/components/JsonLd';
import { organizationJsonLd, websiteJsonLd } from '@ows/site-kit/seo';
import PublicHeader from '@/components/platform/public/PublicHeader';
import PublicFooter from '@/components/platform/public/PublicFooter';
import LocalePreviewBar from '@/components/platform/public/LocalePreviewBar';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { isLocale, locales } from '@/i18n/config';
import { getPublicLocales } from '@/lib/i18n/publicLocales';

const notoSansSC = Noto_Sans_SC({
  subsets: ['latin'],
  weight: ['300', '400', '500', '700'],
  display: 'swap',
});

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

// 編輯中的語言：只有持通行證的人進得來（middleware），這裡再加 noindex，萬一網址外流也不被收錄
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const publicLocales = await getPublicLocales();
  return publicLocales.includes(locale) ? {} : { robots: { index: false, follow: false, nocache: true } };
}

interface LocaleLayoutProps {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const isZhCN = locale === 'zh-CN';

  return (
    <div className={`public-site min-h-screen flex flex-col ${isZhCN ? notoSansSC.className : ''}`}>
      {/* 全站實體資料：與 (public)/layout.tsx 一致，語系頁面也要有 */}
      <JsonLd data={[organizationJsonLd(), websiteJsonLd()]} />
      <LocalePreviewBar />
      <PublicHeader />
      <main className="flex-1">
        {children}
      </main>
      <PublicFooter />
    </div>
  );
}
