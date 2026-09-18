import { ReactNode } from 'react';
import { Noto_Sans_SC } from 'next/font/google';
// 子路徑匯入：從 barrel 匯入會連帶把 HeroCarousel（與 Swiper 的 CSS）拉進每一頁
import JsonLd from '@ows/site-kit/components/JsonLd';
import { organizationJsonLd, websiteJsonLd } from '@ows/site-kit/seo';
import PublicHeader from '@/components/platform/public/PublicHeader';
import PublicFooter from '@/components/platform/public/PublicFooter';

const notoSansSC = Noto_Sans_SC({
  subsets: ['latin'],
  weight: ['300', '400', '500', '700'],
  display: 'swap',
});

// 支援的語言
const locales = ['zh-TW', 'zh-CN', 'en', 'ja'];

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

interface LocaleLayoutProps {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = await params;
  const isZhCN = locale === 'zh-CN';

  return (
    <div className={`min-h-screen flex flex-col ${isZhCN ? notoSansSC.className : ''}`}>
      {/* 全站實體資料：與 (public)/layout.tsx 一致，語系頁面也要有 */}
      <JsonLd data={[organizationJsonLd(), websiteJsonLd()]} />
      <PublicHeader />
      <main className="flex-1 pt-14">
        {children}
      </main>
      <PublicFooter />
    </div>
  );
}
