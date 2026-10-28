import type { Metadata } from 'next';
import ReportCatalogView from '@/components/report/pages/ReportCatalogView';

// 價格沿用快取；卡片文字由 loadReportProducts 即時讀取後台設定。
export const revalidate = 600;

export const metadata: Metadata = {
  title: '所有客製報告｜理解自己，重新看見孩子｜親紫之間',
  description: '親紫之間以紫微斗數命盤為線索，製作聚焦一個人的客製報告。從自己的反應到孩子的日常，透過生命描繪與觀察問題，把理解帶回生活核對。',
};

/** 所有客製報告的目錄頁（繁中）；其他語言在 app/[locale]/report */
export default function ReportCatalogPage() {
  return <ReportCatalogView />;
}
