'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle } from 'lucide-react';
import Button from '@/components/ui/Button';

export default function OrderCompletedPage() {
  const router = useRouter();
  const [countdown, setCountdown] = useState(5);

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
        {/* Success Icon */}
        <div className="flex justify-center mb-6">
          <div className="rounded-full bg-green-100 p-4">
            <CheckCircle className="w-16 h-16 text-green-600" />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          付款成功！
        </h1>

        {/* Message */}
        <p className="text-gray-600 mb-6">
          感謝您的購買，您的訂單已成功建立並完成付款。
        </p>

        {/* Details */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <p className="text-sm text-gray-600 mb-2">
            我們已收到您的付款，相關服務資訊將透過電子郵件發送給您。
          </p>
          <p className="text-sm text-gray-600">
            如有任何問題，請隨時聯繫我們的客服團隊。
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
            返回產品頁面
          </Button>
          <Button
            onClick={() => router.push('/admin/dashboard')}
            variant="outline"
            className="w-full"
          >
            前往會員中心
          </Button>
        </div>
      </div>
    </div>
  );
}
