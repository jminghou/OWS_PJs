import { Suspense } from 'react';
import ReportCustomizeForm from '@/components/report/ReportCustomizeForm';

export default function ReportCustomizePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-bold text-gray-900">填寫報告資料</h1>
      <p className="mt-2 text-sm text-gray-600">填寫內容會暫存在這台裝置的瀏覽器 7 天，送出訂單前都可以修改；使用公用電腦時，送出後資料即自動清除。</p>
      <div className="mt-8">
        {/* useSearchParams 需要 Suspense 邊界 */}
        <Suspense fallback={null}>
          <ReportCustomizeForm />
        </Suspense>
      </div>
    </div>
  );
}
