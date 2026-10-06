import type { Metadata } from 'next';

// 會員 v2 客製報告：文案仍是佔位內容，上線前不讓搜尋引擎收錄
export const metadata: Metadata = {
  title: '客製命理報告',
  robots: { index: false, follow: false },
};

export default function ReportLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-[calc(100vh-72px)] bg-paper">{children}</div>;
}
