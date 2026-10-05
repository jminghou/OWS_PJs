'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { orderApi } from '@/lib/api';

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
    return <div className="p-10 text-center">Invalid Order Number</div>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full text-center">
        <h1 className="text-2xl font-bold mb-6 text-gray-800">Mock Payment Gateway</h1>
        
        <div className="mb-8">
          <p className="text-gray-600 mb-2">Order Number:</p>
          <div className="text-xl font-mono bg-gray-50 p-3 rounded border">
            {order_no}
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <button
            onClick={() => handlePayment('success')}
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded transition disabled:opacity-50"
          >
            {loading ? 'Processing...' : '[測試用] 模擬付款成功'}
          </button>
          
          <button
            onClick={() => handlePayment('failed')}
            disabled={loading}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-6 rounded transition disabled:opacity-50"
          >
            {loading ? 'Processing...' : '[測試用] 模擬付款失敗'}
          </button>
        </div>

        <p className="mt-6 text-xs text-gray-500">
          This is a simulated payment page for development purposes only.
        </p>
      </div>
    </div>
  );
}

