// 必須最先載入：注入站台識別到 @ows/site-kit（見該檔說明）
import { SITE_URL } from '@/siteConfig';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

// 拉丁字（英文/數字）走 Inter；中文一律走微軟正黑體（見 tailwind sans 設定）
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export const metadata: Metadata = {
  // 讓 OG / Twitter / canonical 的相對網址能解析成絕對網址
  metadataBase: new URL(SITE_URL),
  title: {
    default: '職場媽媽崩潰啥？ - 個人專欄',
    template: '%s | 職場媽媽崩潰啥？',
  },
  description: '職場媽媽崩潰啥？ 的個人專欄：分享生活、觀察與想法。',
  keywords: ['專欄', '生活', '閱讀', '筆記'],
  authors: [{ name: 'Happy Wu' }],
  creator: 'Happy Wu',
  publisher: '職場媽媽崩潰啥？',
  openGraph: {
    type: 'website',
    locale: 'zh_TW',
    url: SITE_URL,
    siteName: '職場媽媽崩潰啥？',
    title: '職場媽媽崩潰啥？ - 個人專欄',
    description: '職場媽媽崩潰啥？ 的個人專欄：分享生活、觀察與想法。',
  },
  twitter: {
    card: 'summary_large_image',
    title: '職場媽媽崩潰啥？ - 個人專欄',
    description: '職場媽媽崩潰啥？ 的個人專欄：分享生活、觀察與想法。',
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
      <body className={`${inter.variable} font-sans`}>
        {children}
      </body>
    </html>
  );
}