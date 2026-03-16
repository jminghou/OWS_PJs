import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: {
    default: '數位鍊金室 - 你的策略建築師',
    template: '%s | 數位鍊金室',
  },
  description: '將數位轉型、行銷科技與電商增長等複雜變數，轉化為支持企業長期成長的堅實架構',
  keywords: ['數位轉型', '策略顧問', 'MarTech', '電商增長', '策略建築師'],
  authors: [{ name: '數位鍊金室' }],
  creator: '數位鍊金室',
  publisher: '數位鍊金室',
  openGraph: {
    type: 'website',
    locale: 'zh_TW',
    url: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
    siteName: '數位鍊金室',
    title: '數位鍊金室 - 你的策略建築師',
    description: '將數位轉型、行銷科技與電商增長等複雜變數，轉化為支持企業長期成長的堅實架構',
  },
  twitter: {
    card: 'summary_large_image',
    title: '數位鍊金室 - 你的策略建築師',
    description: '將數位轉型、行銷科技與電商增長等複雜變數，轉化為支持企業長期成長的堅實架構',
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
      <body className={inter.className}>
        {children}
      </body>
    </html>
  );
}