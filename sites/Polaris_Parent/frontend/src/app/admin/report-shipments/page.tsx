'use client';

/**
 * 實體書出貨管理：下單選實體書版與事後加購的實體書都在這裡，依狀態分頁。
 * 送印 → 登錄物流（寄出貨通知）→ 送達；送印前可取消，已付款的取消後在這裡登錄退款。
 * 後端：/api/v1/admin/report-print-jobs（report_orders.fulfill）。
 */
import { useCallback, useEffect, useState } from 'react';
import { AdminLayout } from '@ows/admin-app';
import { AdminEmptyState, AdminLoadingSkeleton } from '@ows/ui/admin';
import { Copy, Truck } from 'lucide-react';
import { reportOrdersApi, type AdminPrintJob, type PrintJobAction } from '@/lib/api/reportOrders';

type Filter = 'all' | 'awaiting_payment' | 'awaiting_customization' | 'awaiting_proof' | 'proof_ready' | 'changes_requested'
  | 'approved' | 'printing' | 'shipped' | 'delivered' | 'cancelled' | 'refund_pending';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'awaiting_customization', label: '待設計內容' },
  { value: 'awaiting_proof', label: '待出打樣' },
  { value: 'proof_ready', label: '待會員確認' },
  { value: 'changes_requested', label: '待修改' },
  { value: 'approved', label: '待送印' },
  { value: 'printing', label: '印製中' },
  { value: 'shipped', label: '已出貨' },
  { value: 'delivered', label: '已送達' },
  { value: 'refund_pending', label: '待退款' },
  { value: 'cancelled', label: '已取消' },
  { value: 'awaiting_payment', label: '待付款' },
  { value: 'all', label: '全部' },
];

const PRE_PRINT = ['awaiting_customization', 'awaiting_proof', 'proof_ready', 'changes_requested', 'approved'];

const btn =
  'inline-flex min-h-[40px] md:min-h-0 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50';
const btnPrimary = `${btn} bg-admin-accent-600 text-white hover:bg-admin-accent-700`;
const btnGhost = `${btn} border border-border bg-card text-foreground hover:bg-muted`;
const btnDanger = `${btn} text-destructive hover:bg-destructive/10`;
const inputCls =
  'w-full rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-admin-accent-500';

const nt = (n: number | null | undefined) => (n == null ? '—' : `NT$${n.toLocaleString('zh-TW')}`);
const formatDate = (v: string | null | undefined) =>
  v ? new Date(`${v.replace(/Z$|\+00:00$/, '')}Z`).toLocaleString('zh-TW', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

/** 給排版／印刷用的文字摘要 */
function summaryText(j: AdminPrintJob) {
  return [
    `訂單：${j.order_no}${j.parent_order_no ? `（原報告 ${j.parent_order_no}）` : ''}`,
    `報告主角：${j.subject_name ?? ''}（稱呼：${j.call_name ?? ''}）`,
    `規格：${j.spec_label || '—'}・數量：${j.quantity} 本`,
    j.custom_labels.length ? `特殊客製：${j.custom_labels.join('、')}` : '',
    j.options?.cover_name ? `封面名字：${j.options.cover_name}` : '',
    j.options?.cover_style ? `封面款式：${j.options.cover_style}` : '',
    j.dedication ? `扉頁贈言：${j.dedication}` : '',
    j.shipping ? `收件：${j.shipping.recipient_name}・${j.shipping.recipient_phone}・${j.shipping.postal_code ?? ''} ${j.shipping.address}` : '',
  ].filter(Boolean).join('\n');
}

function Actions({ job, onDone, onError }: {
  job: AdminPrintJob;
  onDone: (text: string) => void;
  onError: (text: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [carrier, setCarrier] = useState('');
  const [tracking, setTracking] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const [refund, setRefund] = useState(job.refund_due ? String(job.refund_due) : '');
  const [refundNote, setRefundNote] = useState('');

  const run = async (action: PrintJobAction, body: Record<string, unknown>, done: string) => {
    setBusy(true);
    try {
      await reportOrdersApi.adminPrintJobAction(job.id, action, body);
      onDone(done);
    } catch (e: any) {
      onError(e.message || '操作失敗');
    } finally {
      setBusy(false);
    }
  };

  const refundPending = job.status === 'cancelled' && job.refund_due != null && !job.refunded_at;
  const cancellable = job.cancellable && (job.kind === 'addon' || job.order_status === 'paid');

  return (
    <div className="space-y-3">
      {PRE_PRINT.includes(job.status) && (
        <button type="button" className={`${btnPrimary} w-full`} disabled={busy}
          onClick={() => window.confirm(`確定已把 ${job.order_no} 送印？`) && run('printing', {}, `${job.order_no} 已標記送印`)}>
          標記送印
        </button>
      )}

      {job.status === 'printing' && (
        <div className="space-y-2">
          <input className={inputCls} value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="物流業者，例如：黑貓宅急便" />
          <input className={`${inputCls} font-mono`} value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="物流單號" />
          <button type="button" className={`${btnPrimary} w-full`} disabled={busy || !carrier.trim() || !tracking.trim()}
            onClick={() => run('shipped', { carrier, tracking_no: tracking }, `${job.order_no} 已登錄出貨並通知會員`)}>
            <Truck className="h-4 w-4" /> 登錄出貨並通知會員
          </button>
        </div>
      )}

      {job.status === 'shipped' && (
        <button type="button" className={`${btnGhost} w-full`} disabled={busy}
          onClick={() => run('delivered', {}, `${job.order_no} 已標記送達`)}>
          標記已送達
        </button>
      )}

      {refundPending && (
        <div className="space-y-2 rounded-md bg-amber-50 p-3 text-sm dark:bg-amber-900/30">
          <p className="font-medium text-amber-900 dark:text-amber-100">待退款 {nt(job.refund_due)}</p>
          <input className={inputCls} inputMode="numeric" value={refund} onChange={(e) => setRefund(e.target.value.replace(/\D/g, ''))} placeholder="實際退款金額" />
          <input className={inputCls} value={refundNote} onChange={(e) => setRefundNote(e.target.value)} placeholder="備註（例如：退至會員帳戶末五碼）" maxLength={500} />
          <button type="button" className={`${btnPrimary} w-full`} disabled={busy || !refund}
            onClick={() => run('refund', { amount: Number(refund), note: refundNote }, `${job.order_no} 已登錄退款並通知會員`)}>
            登錄退款並通知會員
          </button>
        </div>
      )}

      {cancellable && (
        cancelling ? (
          <div className="space-y-2">
            <input className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="取消原因（會寄給會員）" maxLength={500} />
            <div className="flex gap-2">
              <button type="button" className={btnGhost} onClick={() => setCancelling(false)}>返回</button>
              <button type="button" className={`${btnPrimary} flex-1`} disabled={busy || !reason.trim()}
                onClick={() => run('cancel', { reason }, `${job.order_no} 的實體書已取消`)}>
                確認取消
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className={`${btnDanger} w-full`} onClick={() => setCancelling(true)}>取消實體書</button>
        )
      )}
    </div>
  );
}

export default function ReportShipmentsPage() {
  const [filter, setFilter] = useState<Filter>('awaiting_customization');
  const [jobs, setJobs] = useState<AdminPrintJob[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await reportOrdersApi.adminPrintJobs(filter);
      setJobs(res.jobs);
      setCounts(res.counts);
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message || '載入失敗' });
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const copy = async (j: AdminPrintJob) => {
    try {
      await navigator.clipboard.writeText(summaryText(j));
      setMessage({ type: 'success', text: `已複製 ${j.order_no} 的實體書資料` });
    } catch {
      setMessage({ type: 'error', text: '無法複製，請手動選取文字' });
    }
  };

  return (
    <AdminLayout>
      <div className="mx-auto max-w-5xl p-4 md:p-8">
        <div className="mb-6">
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight">實體書出貨</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            下單選實體書版與事後加購的實體書都在這裡。送印前會員可以取消；已付款的取消後請到「待退款」轉帳並登錄。
          </p>
        </div>

        <div className="mb-4 -mx-4 flex gap-1 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
          {FILTERS.map((f) => {
            const n = f.value === 'all' ? null : counts[f.value];
            return (
              <button key={f.value} type="button" onClick={() => setFilter(f.value)}
                className={`flex-shrink-0 whitespace-nowrap rounded px-2.5 py-2 md:py-1 text-xs font-medium transition ${
                  filter === f.value ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}>
                {f.label}{n ? <span className="ml-1 tabular-nums opacity-70">{n}</span> : null}
              </button>
            );
          })}
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
        ) : jobs.length === 0 ? (
          <AdminEmptyState icon={<Truck className="h-10 w-10" />} title="沒有符合的實體書" />
        ) : (
          <div className="space-y-3">
            {jobs.map((j) => (
              <div key={j.id} className="rounded-xl border border-border bg-card p-4 text-card-foreground">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0 flex-1 space-y-1 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-medium">{j.order_no}</span>
                      <span className="rounded bg-admin-accent-100 px-2 py-0.5 text-[11px] font-medium text-admin-accent-800 dark:bg-admin-accent-800/40 dark:text-admin-accent-100">
                        {j.status_label}
                      </span>
                      <span className="rounded bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                        {j.kind === 'addon' ? `事後加購・原訂單 ${j.parent_order_no}` : '下單選實體書版'}
                      </span>
                    </div>
                    <p>主角 {j.subject_name}（{j.call_name}）・{j.spec_label || '未分規格'}・{j.quantity} 本{j.custom_labels.length ? `・${j.custom_labels.join('、')}` : ''}</p>
                    <p className="text-muted-foreground">購買者 {j.buyer_email ?? '—'}・訂單金額 {nt(j.amount)}・付款 {formatDate(j.paid_at)}</p>
                    {j.dedication && <p className="whitespace-pre-line text-muted-foreground">扉頁贈言：{j.dedication}</p>}
                    {j.shipping && (
                      <div className="mt-2 rounded-md bg-muted px-3 py-2 text-xs leading-5">
                        <p>收件人 {j.shipping.recipient_name}・<span className="font-mono">{j.shipping.recipient_phone}</span></p>
                        <p>{j.shipping.postal_code} {j.shipping.address}</p>
                        {j.shipping.tracking_no && <p>物流 {j.shipping.carrier}・<span className="font-mono">{j.shipping.tracking_no}</span>・出貨 {formatDate(j.shipping.shipped_at)}</p>}
                      </div>
                    )}
                    {j.status === 'cancelled' && (
                      <p className="text-xs text-muted-foreground">
                        {j.cancelled_by === 'member' ? '會員取消' : j.cancelled_by === 'admin' ? '管理者取消' : '系統取消'}
                        {j.cancel_reason ? `：${j.cancel_reason}` : ''}
                        {j.refunded_at ? `・已退款 ${nt(j.refund_amount)}（${formatDate(j.refunded_at)}）${j.refund_note ? `・${j.refund_note}` : ''}` : ''}
                      </p>
                    )}
                    <button type="button" onClick={() => copy(j)}
                      className="mt-1 inline-flex min-h-[40px] md:min-h-0 items-center gap-1 text-xs text-admin-accent-600 hover:underline dark:text-admin-accent-200">
                      <Copy className="h-3.5 w-3.5" /> 複製實體書資料
                    </button>
                  </div>
                  <div className="w-full md:w-72">
                    <Actions job={j} onDone={(text) => { setMessage({ type: 'success', text }); load(); }}
                      onError={(text) => setMessage({ type: 'error', text })} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
