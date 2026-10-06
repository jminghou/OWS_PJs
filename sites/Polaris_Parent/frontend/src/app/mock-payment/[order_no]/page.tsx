'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { orderApi } from '@/lib/api';
import Alert from '@/components/ui/Alert';
import BrandButton from '@/components/ui/BrandButton';

export default function MockPaymentPage() {
  const params = useParams();
  const router = useRouter();
  const order_no = params?.order_no as string;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePayment = async (status: 'success' | 'failed') => {
    setLoading(true);
    setError(null);
    try {
      // 呼叫後端模擬 Webhook
      await orderApi.mockPaymentWebhook(order_no, status);

      if (status === 'success') {
        router.push('/order/completed');
      } else {
        router.push('/order/failed');
      }
    } catch (err: any) {
      setError(err.message || 'Payment processing failed');
    } finally {
      setLoading(false);
    }
  };

  if (!order_no) {
    return <div className="public-site p-10 text-center text-text">Invalid Order Number</div>;
  }

  return (
    // 本頁不在公開站 layout 內：自己掛 public-site，套用暖白底、字體與品牌色
    <div className="public-site flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-card bg-white p-6 text-center md:p-8">
        <h1 className="mb-6 font-heading text-[26px] font-normal text-ink md:text-h2">Mock Payment Gateway</h1>

        <div className="mb-8">
          <p className="mb-2 text-text">Order Number:</p>
          <div className="rounded-inner bg-tint p-3 font-latin text-xl font-semibold text-ink">
            {order_no}
          </div>
        </div>

        {error && (
          <Alert tone="error" className="mb-4 text-left">
            {error}
          </Alert>
        )}

        {/* 測試用頁面：成功走 primary、失敗走 secondary（錯誤色只用在系統回饋，不用在按鈕上） */}
        <div className="space-y-4">
          <BrandButton variant="primary" onClick={() => handlePayment('success')} disabled={loading} className="w-full">
            {loading ? 'Processing...' : '[測試用] 模擬付款成功'}
          </BrandButton>

          <BrandButton variant="secondary" onClick={() => handlePayment('failed')} disabled={loading} className="w-full">
            {loading ? 'Processing...' : '[測試用] 模擬付款失敗'}
          </BrandButton>
        </div>

        <p className="mt-6 text-caption text-muted">
          This is a simulated payment page for development purposes only.
        </p>
      </div>
    </div>
  );
}
