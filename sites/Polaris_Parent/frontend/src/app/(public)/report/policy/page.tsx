import { POLICY_VERSION } from '@/lib/report/catalog';

// 交易政策（docs/membership-v2-architecture.md §10 的草稿）。改版時同步更新 POLICY_VERSION
// （前端 lib/report/catalog.ts 與後端 extensions/report_orders/service.py），訂單會記錄同意的版本。
export default function ReportPolicyPage() {
  return (
    <div className="mx-auto max-w-[680px] px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-bold text-gray-900">交易政策</h1>
      <p className="mt-2 text-xs text-gray-500">版本 {POLICY_VERSION}</p>

      <div className="mt-8 space-y-5 text-base leading-7 text-gray-700">
        <p>
          本站報告依您提供的姓名與出生資料個別製作，屬依消費者要求所為之客製化商品；數位版為非以有形媒介提供之數位內容。
          依《通訊交易解除權合理例外情事適用準則》，本商品不適用七日解除權（鑑賞期），付款完成後恕不受理取消或退款。
          下單前請務必確認出生資料正確。
        </p>
        <div>
          <p>下列情形不在此限，本站將視情況補正、重新製作、重新寄送或退款：</p>
          <ol className="mt-2 list-decimal space-y-1 pl-6">
            <li>重複扣款或扣款金額錯誤。</li>
            <li>因本站因素無法於公告期限內交付，經通知後仍無法完成。</li>
            <li>
              成品內容與您確認的資料不符（非因您提供的資料錯誤）、檔案損毀無法開啟，或實體書有印刷、裝訂瑕疵或運送毀損。
            </li>
          </ol>
        </div>
        <p>
          付款後如發現資料填寫錯誤，請於報告開始製作前聯絡客服；已開始製作或已送印者，是否能更正及是否另收費用，由客服個別說明。
        </p>
      </div>
    </div>
  );
}
