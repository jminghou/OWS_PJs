import { redirect } from 'next/navigation';

/** 舊網址：確認頁已併入個人化預覽頁 */
export default function ReportConfirmPage() {
  redirect('/report/preview');
}
