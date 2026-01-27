'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { XCircle } from 'lucide-react';
import Button from '@/components/ui/Button';

export default function OrderFailedPage() {
  const router = useRouter();
  const [countdown, setCountdown] = useState(10);

  useEffect(() => {
    // 倒數計時後自動導向產品頁面
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          router.push('/products');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        {/* Error Icon */}
        <div className="flex justify-center mb-6">
          <div className="rounded-full bg-red-100 p-4">
            <XCircle className="w-16 h-16 text-red-600" />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          付款失敗
        </h1>

        {/* Message */}
        <p className="text-gray-600 mb-6">
          很抱歉，您的付款未能完成。
        </p>

        {/* Details */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <p className="text-sm text-gray-600 mb-3">
            可能的原因：
          </p>
          <ul className="text-sm text-gray-600 text-left space-y-2 list-disc list-inside">
            <li>付款資訊有誤</li>
            <li>信用卡餘額不足</li>
            <li>銀行拒絕此筆交易</li>
            <li>網路連線中斷</li>
          </ul>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-800">
            您的訂單尚未建立，不會產生任何費用。請重新選購並再次嘗試付款。
          </p>
        </div>

        {/* Auto redirect notice */}
        <p className="text-sm text-gray-500 mb-6">
          {countdown} 秒後自動返回產品頁面...
        </p>

        {/* Action Buttons */}
        <div className="space-y-3">
          <Button
            onClick={() => router.push('/products')}
            className="w-full"
          >
            重新選購
          </Button>
          <Button
            onClick={() => router.push('/')}
            variant="outline"
            className="w-full"
          >
            返回首頁
          </Button>
        </div>

        {/* Help Text */}
        <p className="mt-6 text-xs text-gray-500">
          如果問題持續發生，請聯繫客服：support@example.com
        </p>
      </div>
    </div>
  );
}
