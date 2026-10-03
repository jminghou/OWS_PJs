import { Suspense } from 'react';
import ReportCustomizeForm from '@/components/report/ReportCustomizeForm';

export default function ReportCustomizePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-bold text-gray-900">填寫報告資料</h1>
      <p className="mt-2 text-sm text-gray-600">填寫內容只會暫存在這個瀏覽器分頁，送出訂單前都可以修改。</p>
      <div className="mt-8">
        {/* useSearchParams 需要 Suspense 邊界 */}
        <Suspense fallback={null}>
          <ReportCustomizeForm />
        </Suspense>
      </div>
    </div>
  );
}
