// 必須最先載入：注入站台識別到 @ows/site-kit（見該檔說明）
import { SITE_URL } from '@/siteConfig';
import type { Metadata } from 'next';
import { Archivo, Huninn, Inter, Noto_Sans_TC } from 'next/font/google';
import './globals.css';

// 後台：拉丁字（英文/數字）走 Inter；中文一律走微軟正黑體（見 tailwind sans 設定）
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

// 公開站（docs/BRAND_GUIDELINES.md §4）：標題粉圓、內文思源黑體、數字與英文 Archivo。
// subsets 只決定預載哪一段；中文字形由 Google 的 unicode-range 分片按需載入。
const huninn = Huninn({ weight: '400', subsets: ['latin'], variable: '--font-huninn', display: 'swap' });
const notoSansTC = Noto_Sans_TC({
  weight: ['400', '500', '700'],
  subsets: ['latin'],
  variable: '--font-noto',
  display: 'swap',
});
const archivo = Archivo({ weight: ['400', '600', '800'], subsets: ['latin'], variable: '--font-archivo', display: 'swap' });

export const metadata: Metadata = {
  // 讓 OG / Twitter / canonical 的相對網址能解析成絕對網址
  metadataBase: new URL(SITE_URL),
  title: {
    default: '親紫之間 - 紫微斗數育兒分析',
    template: '%s | 親紫之間',
  },
  description: '透過紫微斗數與數據分析，幫助家長理解孩子的獨特之處',
  keywords: ['紫微斗數', '育兒', '親子關係', '家庭教育'],
  authors: [{ name: '親紫之間' }],
  creator: '親紫之間',
  publisher: '親紫之間',
  openGraph: {
    type: 'website',
    locale: 'zh_TW',
    url: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
    siteName: '親紫之間',
    title: '親紫之間 - 紫微斗數育兒分析',
    description: '透過紫微斗數與數據分析，幫助家長理解孩子的獨特之處',
  },
  twitter: {
    card: 'summary_large_image',
    title: '親紫之間 - 紫微斗數育兒分析',
    description: '透過紫微斗數與數據分析，幫助家長理解孩子的獨特之處',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-TW">
      <body
        className={`${inter.variable} ${huninn.variable} ${notoSansTC.variable} ${archivo.variable} font-sans`}
      >
        {children}
      </body>
    </html>
  );
}