'use client';

/** 會員中心「訂單紀錄」：所有訂單（報告、實體書、專人解讀）照時間排，看金額與付款狀態，點進去是訂單頁。 */
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ChevronRight, FileText } from 'lucide-react';
import Alert from '@/components/ui/Alert';
import { brandButton } from '@/components/ui/BrandButton';
import { reportOrdersApi, type ReportOrderSummary } from '@/lib/api';

const STATUS: Record<string, string> = { pending: '待付款', paid: '已付款', cancelled: '已取消' };
const fmtDate = (iso: string | null) =>
  iso ? new Date(iso.endsWith('Z') || iso.includes('+') ? iso : `${iso}Z`).toLocaleDateString('zh-TW') : '';

export default function MyReportOrders({ orders: given }: { orders?: ReportOrderSummary[] }) {
  const [loaded, setLoaded] = useState<ReportOrderSummary[] | null>(null);
  const [error, setError] = useState('');
  const orders = given ?? loaded;

  useEffect(() => {
    if (given) return;
    reportOrdersApi.list().then((r) => setLoaded(r.orders)).catch((e) => setError(e.message || '無法載入訂單'));
  }, [given]);

  if (error) return <Alert tone="error">{error}</Alert>;
  if (!orders) return <p className="text-muted">載入中…</p>;
  if (orders.length === 0) {
    return (
      <div className="rounded-card bg-white p-8 text-center">
        <FileText className="mx-auto h-8 w-8 text-muted" strokeWidth={1.5} aria-hidden="true" />
        <p className="mt-3 text-text">還沒有報告訂單。</p>
        <Link href="/report" className={brandButton({ variant: 'primary', size: 'S', className: 'mt-4' })}>看客製報告</Link>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {orders.map((o) => {
        const isAddon = o.item?.kind !== 'purchase';
        const transferPending = o.status === 'pending' && o.payment.transfer?.status === 'created';
        const subs = [
          o.physical && o.physical.status !== 'awaiting_payment' ? `實體書：${o.physical.status_label}` : '',
          o.consult && o.consult.status !== 'awaiting_payment' ? `專人解讀：${o.consult.status_label}` : '',
        ].filter(Boolean);
        const canAddon = o.addon_offer?.physical || o.addon_offer?.consult;
        const title = isAddon
          ? o.lines.map((l) => (l.variant === 'consult' ? `專人解讀 × ${l.quantity} 次` : `實體書加購 × ${l.quantity} 本`)).join('＋')
          : o.item?.name;
        const parent = o.item?.parent_order_no;
        return (
          <li key={o.order_no}>
            <Link href={`/report/orders/${o.order_no}`}
              className="flex items-center gap-3 rounded-card bg-white p-5 transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-ink">
                  {title}
                  {o.item?.call_name && <span className="text-text">・{o.item.call_name}</span>}
                </p>
                <p className="mt-1 text-caption text-muted">
                  <span className="font-latin">{o.order_no}</span>・{fmtDate(o.created_at)}・{parent && <>加購自 <span className="font-latin">{parent}</span>・</>}
                  <span className="font-latin">NT${o.amount.toLocaleString('zh-TW')}</span>
                </p>
                <p className="mt-2 flex flex-wrap gap-2 text-[13px]">
                  <span className="rounded-full bg-tint px-2.5 py-1 text-text">{transferPending ? '匯款確認中' : STATUS[o.status] ?? o.status}</span>
                  {subs.map((x) => <span key={x} className="rounded-full bg-blue-50 px-2.5 py-1 text-blue-700">{x}</span>)}
                  {o.commerce?.external?.fulfilment_blocked && <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-800">後續履約暫停</span>}
                  {canAddon && <span className="rounded-full bg-blue-50 px-2.5 py-1 text-blue-700">可加購</span>}
                </p>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-muted" strokeWidth={2} aria-hidden="true" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
