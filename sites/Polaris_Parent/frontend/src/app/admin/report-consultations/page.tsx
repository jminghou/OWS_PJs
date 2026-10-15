'use client';

/**
 * 專人解讀管理：付款後「待安排」→ 以 Email／電話約好時間後登錄（寄確認信）→ 完成。
 * 取消規則不對外公開：會員來詢問時由這裡代為取消，已付款的取消後到「待退款」登錄退款。
 * 後端：/api/v1/admin/report-consultations（report_orders.fulfill）。
 */
import { useCallback, useEffect, useState } from 'react';
import { AdminLayout } from '@ows/admin-app';
import { AdminEmptyState, AdminLoadingSkeleton } from '@ows/ui/admin';
import { MessageCircle } from 'lucide-react';
import { CONSULT_PERIOD_LABELS, reportOrdersApi, type AdminConsultation, type ConsultAction } from '@/lib/api/reportOrders';

type Filter = 'to_schedule' | 'scheduled' | 'completed' | 'refund_pending' | 'cancelled' | 'awaiting_payment' | 'all';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'to_schedule', label: '待安排' },
  { value: 'scheduled', label: '已約時間' },
  { value: 'completed', label: '已完成' },
  { value: 'refund_pending', label: '待退款' },
  { value: 'cancelled', label: '已取消' },
  { value: 'awaiting_payment', label: '待付款' },
  { value: 'all', label: '全部' },
];

const btn =
  'inline-flex min-h-[40px] md:min-h-0 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50';
const btnPrimary = `${btn} bg-admin-accent-600 text-white hover:bg-admin-accent-700`;
const btnGhost = `${btn} border border-border bg-card text-foreground hover:bg-muted`;
const btnDanger = `${btn} text-destructive hover:bg-destructive/10`;
const inputCls =
  'w-full rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-admin-accent-500';

const nt = (n: number | null | undefined) => (n == null ? '—' : `NT$${n.toLocaleString('zh-TW')}`);
const formatDate = (v: string | null | undefined) =>
  v ? new Date(v.endsWith('Z') || v.includes('+') ? v : `${v}Z`).toLocaleString('zh-TW', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
/** datetime-local（瀏覽器當地時間）→ 含時區的 ISO 字串 */
const toIso = (local: string) => (local ? new Date(local).toISOString() : '');
const toLocalInput = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

function Actions({ c, onDone, onError }: { c: AdminConsultation; onDone: (t: string) => void; onError: (t: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [when, setWhen] = useState(toLocalInput(c.scheduled_at));
  const [note, setNote] = useState(c.admin_note ?? '');
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const [refund, setRefund] = useState(c.refund_due ? String(c.refund_due) : '');
  const [refundNote, setRefundNote] = useState('');

  const run = async (action: ConsultAction, body: Record<string, unknown>, done: string) => {
    setBusy(true);
    try {
      await reportOrdersApi.adminConsultationAction(c.id, action, body);
      onDone(done);
    } catch (e: any) {
      onError(e.message || '操作失敗');
    } finally {
      setBusy(false);
    }
  };

  const refundPending = c.status === 'cancelled' && c.refund_due != null && !c.refunded_at;

  return (
    <div className="space-y-3">
      {(c.status === 'to_schedule' || c.status === 'scheduled') && (
        <div className="space-y-2">
          <label className="block text-xs text-muted-foreground">約定時間
            <input type="datetime-local" className={inputCls} value={when} onChange={(e) => setWhen(e.target.value)} />
          </label>
          <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder="說明（例如：Google Meet 連結或電話）" />
          <button type="button" className={`${btnPrimary} w-full`} disabled={busy || !when}
            onClick={() => run('schedule', { scheduled_at: toIso(when), note }, `${c.order_no} 已登錄時間並寄確認信`)}>
            {c.status === 'scheduled' ? '更新時間並通知會員' : '登錄時間並通知會員'}
          </button>
        </div>
      )}
      {c.status === 'scheduled' && (
        <button type="button" className={`${btnGhost} w-full`} disabled={busy}
          onClick={() => run('complete', {}, `${c.order_no} 已標記完成`)}>
          標記已完成
        </button>
      )}
      {refundPending && (
        <div className="space-y-2 rounded-md bg-amber-50 p-3 text-sm dark:bg-amber-900/30">
          <p className="font-medium text-amber-900 dark:text-amber-100">待退款 {nt(c.refund_due)}</p>
          <input className={inputCls} inputMode="numeric" value={refund} onChange={(e) => setRefund(e.target.value.replace(/\D/g, ''))} placeholder="實際退款金額" />
          <input className={inputCls} value={refundNote} onChange={(e) => setRefundNote(e.target.value)} placeholder="備註" maxLength={500} />
          <button type="button" className={`${btnPrimary} w-full`} disabled={busy || !refund}
            onClick={() => run('refund', { amount: Number(refund), note: refundNote }, `${c.order_no} 已登錄退款並通知會員`)}>
            登錄退款並通知會員
          </button>
        </div>
      )}
      {!['completed', 'cancelled'].includes(c.status) && (
        cancelling ? (
          <div className="space-y-2">
            <input className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="取消原因（內部紀錄）" maxLength={500} />
            <div className="flex gap-2">
              <button type="button" className={btnGhost} onClick={() => setCancelling(false)}>返回</button>
              <button type="button" className={`${btnPrimary} flex-1`} disabled={busy || !reason.trim()}
                onClick={() => run('cancel', { reason }, `${c.order_no} 的專人解讀已取消`)}>
                確認取消
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className={`${btnDanger} w-full`} onClick={() => setCancelling(true)}>代為取消</button>
        )
      )}
    </div>
  );
}

export default function ReportConsultationsPage() {
  const [filter, setFilter] = useState<Filter>('to_schedule');
  const [rows, setRows] = useState<AdminConsultation[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await reportOrdersApi.adminConsultations(filter);
      setRows(res.consultations);
      setCounts(res.counts);
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message || '載入失敗' });
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  return (
    <AdminLayout>
      <div className="mx-auto max-w-5xl p-4 md:p-8">
        <div className="mb-6">
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight">專人解讀</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            付款後在「待安排」。用 Email 或電話跟會員約好時間後登錄，系統會寄確認信。會員要取消時由這裡代為取消（前台不顯示取消規則）。
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
        ) : rows.length === 0 ? (
          <AdminEmptyState icon={<MessageCircle className="h-10 w-10" />} title="沒有符合的專人解讀" />
        ) : (
          <div className="space-y-3">
            {rows.map((c) => (
              <div key={c.id} className="rounded-xl border border-border bg-card p-4 text-card-foreground">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0 flex-1 space-y-1 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-medium">{c.order_no}</span>
                      <span className="rounded bg-admin-accent-100 px-2 py-0.5 text-[11px] font-medium text-admin-accent-800 dark:bg-admin-accent-800/40 dark:text-admin-accent-100">{c.status_label}</span>
                      {c.report_order_no && c.report_order_no !== c.order_no && (
                        <span className="rounded bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">原報告 {c.report_order_no}</span>
                      )}
                    </div>
                    <p>主角 {c.subject_name}（{c.call_name}）・{c.sessions} 次 × {c.minutes} 分鐘・{nt(c.amount)}</p>
                    <p className="text-muted-foreground">購買者 {c.buyer_email ?? '—'}・付款 {formatDate(c.paid_at)}</p>
                    {c.preferences && c.status === 'to_schedule' && (
                      <div className="rounded-md bg-muted px-3 py-2 text-xs leading-5">
                        <p>會員方便的時段：{c.preferences.slots.map((x) => `${x.date} ${CONSULT_PERIOD_LABELS[x.period]}`).join('、')}</p>
                        {c.preferences.note && <p className="whitespace-pre-line">備註：{c.preferences.note}</p>}
                      </div>
                    )}
                    {c.scheduled_at && <p>約定時間 <strong>{formatDate(c.scheduled_at)}</strong>{c.admin_note ? `・${c.admin_note}` : ''}</p>}
                    {c.status === 'cancelled' && (
                      <p className="text-xs text-muted-foreground">
                        已取消{c.cancel_reason ? `：${c.cancel_reason}` : ''}
                        {c.refunded_at ? `・已退款 ${nt(c.refund_amount)}（${formatDate(c.refunded_at)}）${c.refund_note ? `・${c.refund_note}` : ''}` : ''}
                      </p>
                    )}
                  </div>
                  <div className="w-full md:w-72">
                    <Actions c={c} onDone={(text) => { setMessage({ type: 'success', text }); load(); }}
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
