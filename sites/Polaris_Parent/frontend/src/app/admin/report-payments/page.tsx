'use client';

import { useCallback, useEffect, useState } from 'react';
import { AdminLayout } from '@ows/admin-app';
import { useAuthStore } from '@ows/platform-api';
import { AdminEmptyState, AdminLoadingSkeleton } from '@ows/ui/admin';
import { Banknote } from 'lucide-react';
import { reportOrdersApi, type AdminReportOrder } from '@/lib/api';

type Filter = 'awaiting' | 'pending' | 'paid' | 'cancelled' | 'all';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'awaiting', label: '待確認回報' },
  { value: 'pending', label: '全部待付款' },
  { value: 'paid', label: '已收款' },
  { value: 'cancelled', label: '已取消' },
  { value: 'all', label: '全部' },
];

const ORDER_STATUS: Record<string, { label: string; className: string }> = {
  pending: { label: '待付款', className: 'bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200' },
  paid: { label: '已收款', className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200' },
  cancelled: { label: '已取消', className: 'bg-muted text-muted-foreground' },
};

const TRANSFER_STATUS: Record<string, string> = {
  created: '會員已回報，待確認',
  succeeded: '已確認',
  failed: '已退回',
  expired: '已逾期',
};

const btn =
  'inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50';
const btnPrimary = `${btn} bg-admin-accent-600 text-white hover:bg-admin-accent-700`;
const btnGhost = `${btn} border border-border bg-card text-foreground hover:bg-muted`;
const inputCls =
  'w-full rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-admin-accent-500';

function formatDate(value: string | null | undefined) {
  // 後端存 naive UTC，補上 Z 才會換算成瀏覽器當地時間
  return value ? new Date(`${value.replace(/Z$/, '')}Z`).toLocaleString('zh-TW', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
}

function ConfirmForm({ order, onDone, onError }: {
  order: AdminReportOrder;
  onDone: (o: AdminReportOrder, message: string) => void;
  onError: (message: string) => void;
}) {
  const transfer = order.payment.transfer;
  const [amount, setAmount] = useState('');
  const [last5, setLast5] = useState(transfer?.last5 ?? '');
  const [note, setNote] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    const received = Number(amount);
    if (received !== order.amount) {
      onError(`實收金額 NT$${received.toLocaleString('zh-TW')} 與訂單金額 NT$${order.amount.toLocaleString('zh-TW')} 不符，請先與會員聯絡。`);
      return;
    }
    if (!window.confirm(`確認已收到 ${order.order_no} 的款項 NT$${order.amount.toLocaleString('zh-TW')}？確認後會通知會員並排入報告製作，無法在此撤回。`)) return;
    setBusy(true);
    try {
      const res = await reportOrdersApi.adminConfirmPayment(order.order_no, {
        received_amount: received,
        last5: last5 || undefined,
        note: note.trim() || undefined,
      });
      onDone(res.order, `已確認收款：${order.order_no}`);
    } catch (e: any) {
      onError(e.message || '確認失敗');
    } finally {
      setBusy(false);
    }
  };

  const reject = async () => {
    if (!reason.trim()) return;
    setBusy(true);
    try {
      const res = await reportOrdersApi.adminRejectTransfer(order.order_no, reason.trim());
      onDone(res.order, `已退回轉帳回報：${order.order_no}`);
      setRejecting(false);
    } catch (e: any) {
      onError(e.message || '退回失敗');
    } finally {
      setBusy(false);
    }
  };

  if (rejecting) {
    return (
      <div className="space-y-2">
        <label className="block text-xs text-muted-foreground">退回原因（會寄給會員）</label>
        <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} className={inputCls}
               placeholder="例如：查無此筆入帳，請確認轉帳日期與末五碼" />
        <div className="flex gap-2">
          <button type="button" onClick={reject} disabled={busy || !reason.trim()} className={btnPrimary}>送出退回</button>
          <button type="button" onClick={() => setRejecting(false)} className={btnGhost}>取消</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-muted-foreground">實收金額 *</label>
          <input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
                 className={inputCls} placeholder={String(order.amount)} />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground">末五碼</label>
          <input inputMode="numeric" maxLength={5} value={last5}
                 onChange={(e) => setLast5(e.target.value.replace(/\D/g, ''))} className={`${inputCls} font-mono`} />
        </div>
      </div>
      <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} className={inputCls}
             placeholder="備註（選填，僅後台可見）" />
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={confirm} disabled={busy || !amount} className={btnPrimary}>確認收款</button>
        {transfer?.status === 'created' && (
          <button type="button" onClick={() => setRejecting(true)} disabled={busy} className={btnGhost}>退回回報</button>
        )}
      </div>
    </div>
  );
}

/** 人工收款：會員回報轉帳後，管理者對帳確認（會員 v2，docs/membership-v2-architecture.md §3）。 */
export default function ReportPaymentsPage() {
  const canConfirm = useAuthStore((s) => s.user?.permissions?.includes('report_orders.confirm_payment') ?? false);
  const [filter, setFilter] = useState<Filter>('awaiting');
  const [orders, setOrders] = useState<AdminReportOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await reportOrdersApi.adminList(
        filter === 'awaiting' ? { status: 'pending', awaiting: true } : { status: filter }
      );
      setOrders(res.orders);
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message || '載入失敗' });
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const onDone = (_o: AdminReportOrder, text: string) => {
    setMessage({ type: 'success', text });
    load();
  };

  return (
    <AdminLayout>
      <div className="mx-auto max-w-5xl p-6 md:p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">人工收款</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            會員轉帳後會回報末五碼。請先到網銀核對入帳，實收金額必須等於訂單金額才能確認；確認後會通知會員並排入報告製作。
          </p>
        </div>

        <div className="mb-4 flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <button key={f.value} type="button" onClick={() => setFilter(f.value)}
                    className={`rounded px-2.5 py-1 text-xs font-medium transition ${
                      filter === f.value ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}>
              {f.label}
            </button>
          ))}
        </div>

        {message && (
          <div className={`mb-4 rounded-md border px-3 py-2 text-sm ${
            message.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200'
              : 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200'
          }`}>
            {message.text}
          </div>
        )}

        {loading ? (
          <AdminLoadingSkeleton variant="list" count={4} />
        ) : orders.length === 0 ? (
          <AdminEmptyState icon={<Banknote className="h-10 w-10" />} title="沒有符合的訂單"
                           description={filter === 'awaiting' ? '目前沒有待確認的轉帳回報。' : undefined} />
        ) : (
          <div className="space-y-3">
            {orders.map((o) => {
              const t = o.payment.transfer;
              const status = ORDER_STATUS[o.status] ?? ORDER_STATUS.cancelled;
              return (
                <div key={o.order_no} className="rounded-xl border border-border bg-card p-4 text-card-foreground">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0 flex-1 space-y-1 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-medium">{o.order_no}</span>
                        <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${status.className}`}>{status.label}</span>
                        {o.payment.mode !== 'manual' && (
                          <span className="rounded bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">佔位訂單</span>
                        )}
                      </div>
                      <p>{o.item?.name}・主角 {o.item?.subject_name}</p>
                      <p className="text-muted-foreground">購買者 {o.buyer_email ?? '—'}・成立 {formatDate(o.created_at)}</p>
                      <p>訂單金額 <strong>NT${o.amount.toLocaleString('zh-TW')}</strong>
                        {o.payment.deadline && o.status === 'pending' && (
                          <span className="text-muted-foreground">・匯款期限 {formatDate(o.payment.deadline)}</span>
                        )}
                      </p>
                      {t && (
                        <div className="mt-2 rounded-md bg-muted px-3 py-2 text-xs leading-5">
                          <p className="font-medium">{TRANSFER_STATUS[t.status] ?? t.status}</p>
                          <p>末五碼 <span className="font-mono">{t.last5 ?? '—'}</span>・轉帳日期 {t.transferred_on ?? '—'}・
                            回報金額 NT${(t.reported_amount ?? 0).toLocaleString('zh-TW')}
                            {t.reported_amount !== null && t.reported_amount !== o.amount && (
                              <span className="ml-1 font-medium text-red-600 dark:text-red-300">（與訂單金額不符）</span>
                            )}
                          </p>
                          {t.member_note && <p>會員備註：{t.member_note}</p>}
                          {t.review_note && <p>處理備註：{t.review_note}</p>}
                          {t.paid_at && <p>確認時間：{formatDate(t.paid_at)}</p>}
                        </div>
                      )}
                    </div>
                    {canConfirm && o.status === 'pending' && o.payment.mode === 'manual' && (
                      <div className="w-full md:w-72">
                        <ConfirmForm order={o} onDone={onDone} onError={(text) => setMessage({ type: 'error', text })} />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
