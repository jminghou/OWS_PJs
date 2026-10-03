'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { reportOrdersApi, type ReportOrderSummary } from '@/lib/api';

const ORDER_STATUS: Record<string, string> = { pending: '待付款', paid: '已付款', cancelled: '已取消' };

/** 訂單詳情（會員 v2）。目前付款為佔位模式，訂單建立後停在待付款。 */
export default function ReportOrderPage() {
  const router = useRouter();
  const { order_no: orderNo } = useParams<{ order_no: string }>();
  const { isAuthenticated, checkAuth } = useAuthStore();
  const [checked, setChecked] = useState(false);
  const [order, setOrder] = useState<ReportOrderSummary | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    checkAuth().finally(() => setChecked(true));
  }, [checkAuth]);

  useEffect(() => {
    if (!checked) return;
    if (!isAuthenticated) {
      router.replace(`/login?next=${encodeURIComponent(`/report/orders/${orderNo}`)}`);
      return;
    }
    reportOrdersApi
      .get(orderNo)
      .then((r) => setOrder(r.order))
      .catch((e) => setError(e.message || '無法載入訂單'));
  }, [checked, isAuthenticated, orderNo, router]);

  if (error) {
    return <p className="mx-auto max-w-xl px-4 py-16 text-center text-gray-600">{error}</p>;
  }
  if (!order) return null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <p className="text-sm font-medium text-brand-purple-700">訂單已成立</p>
      <h1 className="mt-1 text-2xl font-bold text-gray-900">訂單 {order.order_no}</h1>

      <div className="mt-8 rounded-banner border border-warm-200/70 bg-white p-5 sm:p-6">
        <dl className="divide-y divide-warm-100 text-sm">
          <div className="flex justify-between py-2.5">
            <dt className="text-gray-500">品項</dt>
            <dd className="text-right text-gray-900">{order.item?.name}</dd>
          </div>
          <div className="flex justify-between py-2.5">
            <dt className="text-gray-500">報告主角</dt>
            <dd className="text-gray-900">{order.item?.subject_name}</dd>
          </div>
          <div className="flex justify-between py-2.5">
            <dt className="text-gray-500">金額</dt>
            <dd className="font-medium text-gray-900">NT${order.amount.toLocaleString('zh-TW')}</dd>
          </div>
          <div className="flex justify-between py-2.5">
            <dt className="text-gray-500">狀態</dt>
            <dd className="text-gray-900">{ORDER_STATUS[order.status] ?? order.status}</dd>
          </div>
        </dl>
      </div>

      {order.status === 'pending' && order.payment_mode === 'placeholder' && (
        <p className="mt-6 rounded-banner border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
          付款功能尚未開放，訂單已保留為「待付款」。開放付款後我們會以 Email 通知你，付款完成才會開始製作報告。
        </p>
      )}
    </div>
  );
}
