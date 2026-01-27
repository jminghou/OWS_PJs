import { ReactNode } from 'react';
import { Noto_Sans_SC } from 'next/font/google';
import PublicHeader from '@/components/public/PublicHeader';
import PublicFooter from '@/components/public/PublicFooter';

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
      <PublicHeader />
      <main className="flex-1">
        {children}
      </main>
      <PublicFooter />
    </div>
  );
}
