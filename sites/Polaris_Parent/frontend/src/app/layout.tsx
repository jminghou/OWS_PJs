import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { SITE_URL } from '@/lib/seo';

// 拉丁字（英文/數字）走 Inter；中文一律走微軟正黑體（見 tailwind sans 設定）
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

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
      <body className={`${inter.variable} font-sans`}>
        {children}
      </body>
    </html>
  );
}