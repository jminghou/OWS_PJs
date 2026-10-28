import type { Metadata } from 'next';

// 與 app/(public)/report/layout.tsx 一致：文案仍在準備中，先不讓搜尋引擎收錄
export const metadata: Metadata = {
  title: '客製命理報告',
  robots: { index: false, follow: false },
};

export default function LocaleReportLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-[calc(100vh-72px)] bg-paper">{children}</div>;
}
