'use client';

/**
 * 訂單詳細：一張訂單的全貌與時間軸。
 * 上半部：待辦（連到處理的工作頁）、品項、付款紀錄、報告與紫微交接、實體書、專人解讀、相關訂單；
 * 下半部：時間軸（會員／管理者／系統的每個動作與寄出的信），可加內部備註（會員看不到）。
 * 後端：/api/v1/admin/report-orders/:orderNo/detail、/notes（report_orders.read）。
 */
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { AdminLayout } from '@ows/admin-app';
import { AdminLoadingSkeleton } from '@ows/ui/admin';
import { ArrowLeft, Bot, Mail, ShieldCheck, User } from 'lucide-react';
import { reportOrdersApi, type AdminOrderDetail, type TimelineEntry } from '@/lib/api/reportOrders';

const btnPrimary =
  'inline-flex min-h-[40px] md:min-h-0 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 bg-admin-accent-600 text-white hover:bg-admin-accent-700';
const inputCls =
  'w-full rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-admin-accent-500';
const cardCls = 'rounded-xl border border-border bg-card p-4 text-card-foreground';
const nt = (n: number | null | undefined) => (n == null ? '—' : `NT$${n.toLocaleString('zh-TW')}`);
const formatDate = (v: string | null | undefined) =>
  v ? new Date(v.endsWith('Z') || v.includes('+') ? v : `${v}Z`).toLocaleString('zh-TW', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

const PAYMENT_STATUS: Record<string, string> = { created: '待確認', succeeded: '已確認', failed: '已退回', expired: '已過期' };
const ACTOR: Record<TimelineEntry['actor'], { label: string; cls: string }> = {
  member: { label: '會員', cls: 'bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200' },
  admin: { label: '管理者', cls: 'bg-admin-accent-100 text-admin-accent-800 dark:bg-admin-accent-800/40 dark:text-admin-accent-100' },
  system: { label: '系統', cls: 'bg-muted text-muted-foreground' },
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={cardCls}>
      <h2 className="mb-2 text-sm font-semibold">{title}</h2>
      <div className="space-y-1 text-sm">{children}</div>
    </section>
  );
}

function Timeline({ entries }: { entries: TimelineEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">還沒有紀錄（稽核紀錄從 2026-10-20 起開始累積）。</p>;
  }
  return (
    <ol className="space-y-2">
      {[...entries].reverse().map((e, i) => {
        const Icon = e.kind === 'mail' ? Mail : e.actor === 'member' ? User : e.actor === 'admin' ? ShieldCheck : Bot;
        return (
          <li key={i} className="flex gap-3 text-sm">
            <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded px-1.5 py-0.5 text-[11px] ${ACTOR[e.actor].cls}`}>{ACTOR[e.actor].label}</span>
                <span className="text-xs text-muted-foreground">{formatDate(e.at)}</span>
                {e.actor_name && e.actor === 'admin' && <span className="text-xs text-muted-foreground">{e.actor_name}</span>}
              </div>
              <p className="mt-0.5 whitespace-pre-line break-words">
                {e.text}
                {e.kind === 'mail' && (
                  <span className={`ml-2 text-xs ${e.status === 'failed' ? 'text-destructive' : 'text-muted-foreground'}`}>
                    → {e.recipient}{e.status === 'failed' ? '（寄送失敗）' : e.status === 'pending' ? '（寄送中）' : ''}
                  </span>
                )}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export default function ReportOrderDetailPage() {
  const { orderNo } = useParams<{ orderNo: string }>();
  const [order, setOrder] = useState<AdminOrderDetail | null>(null);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setOrder((await reportOrdersApi.adminOrderDetail(decodeURIComponent(orderNo))).order);
    } catch (e: any) {
      setError(e.message || '載入失敗');
    }
  }, [orderNo]);

  useEffect(() => { load(); }, [load]);

  const addNote = async () => {
    if (!order || !note.trim()) return;
    setSaving(true);
    try {
      const res = await reportOrdersApi.adminOrderNote(order.order_no, note);
      setOrder({ ...order, timeline: res.timeline });
      setNote('');
    } catch (e: any) {
      setError(e.message || '儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  const s = order?.summary;
  const p = s?.physical;
  const c = s?.consult;

  return (
    <AdminLayout>
      <div className="mx-auto max-w-5xl p-4 md:p-8">
        <Link href="/admin/report-orders" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> 訂單總覽
        </Link>
        {error && <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200">{error}</div>}
        {!order || !s ? (
          !error && <AdminLoadingSkeleton variant="list" count={4} />
        ) : (
          <div className="space-y-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-mono text-xl font-semibold">{order.order_no}</h1>
                <span className="rounded bg-muted px-2 py-0.5 text-xs">{order.status_label}</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {order.buyer_email}・{nt(order.amount)}・建立 {formatDate(order.created_at)}{order.paid_at ? `・付款 ${formatDate(order.paid_at)}` : ''}
              </p>
            </div>

            {order.todos.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {order.todos.map((t) => {
                  const cls = `rounded-md px-3 py-1.5 text-sm ${t.waiting_on === 'admin'
                    ? 'bg-admin-accent-600 text-white hover:bg-admin-accent-700' : 'bg-muted text-muted-foreground'}`;
                  return t.href && t.waiting_on === 'admin'
                    ? <Link key={t.key} href={t.href} className={cls}>{t.label} →</Link>
                    : <span key={t.key} className={cls}>{t.label}</span>;
                })}
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <Section title="品項">
                <p>主角 {s.item?.subject_name ?? '—'}{s.item?.call_name ? `（${s.item.call_name}）` : ''}</p>
                {s.lines.map((l, i) => <p key={i} className="text-muted-foreground">{l.name}・{nt(l.amount)}</p>)}
                {order.related.map((r) => (
                  <p key={r.order_no}>
                    {r.relation} <Link className="font-mono text-admin-accent-600 hover:underline dark:text-admin-accent-200"
                      href={`/admin/report-orders/${encodeURIComponent(r.order_no)}`}>{r.order_no}</Link>（{r.status_label}）
                  </p>
                ))}
              </Section>

              <Section title="付款">
                {order.payments.length === 0 ? <p className="text-muted-foreground">還沒有付款紀錄</p> : order.payments.map((a) => (
                  <div key={a.attempt_no}>
                    <p>{PAYMENT_STATUS[a.status] ?? a.status}・{nt(a.amount)}{a.manual_reference ? `・末五碼 ${a.manual_reference}` : ''}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.transferred_on ? `轉帳日 ${a.transferred_on}・` : ''}{a.paid_at ? `確認 ${formatDate(a.paid_at)}` : ''}{a.review_note ? `・${a.review_note}` : ''}
                    </p>
                  </div>
                ))}
              </Section>

              {s.item?.kind === 'purchase' && (
                <Section title="報告">
                  <p>紫微工作單：{order.handoff ? `${order.handoff.status_label}${order.handoff.error ? `（${order.handoff.error}）` : ''}` : '—'}</p>
                  {order.documents.length === 0 ? <p className="text-muted-foreground">還沒有上傳報告 PDF</p> : order.documents.map((d, i) => (
                    <p key={i} className={d.is_current ? '' : 'text-muted-foreground line-through'}>
                      {d.filename}・{(d.bytes / 1024 / 1024).toFixed(1)} MB・{formatDate(d.uploaded_at)}
                    </p>
                  ))}
                  <Link href="/admin/report-deliveries" className="text-xs text-admin-accent-600 hover:underline dark:text-admin-accent-200">到報告交付 →</Link>
                </Section>
              )}

              {p && (
                <Section title="實體書">
                  <p>{p.status_label}・{p.spec_label || '—'}・{p.quantity} 本</p>
                  {p.proofs.versions.length > 0 && (
                    <p className="text-muted-foreground">
                      打樣 {p.proofs.versions.length} 版・剩 {p.proofs.revisions_left} 次免費修改
                      {p.proofs.pending ? `・等會員確認到 ${formatDate(p.proofs.pending.due_at)}` : ''}
                    </p>
                  )}
                  {s.shipment?.tracking_no && <p className="text-muted-foreground">物流 {s.shipment.carrier}・{s.shipment.tracking_no}</p>}
                  {p.refund_due ? <p className="text-muted-foreground">應退 {nt(p.refund_due)}{p.refunded_at ? `・已退 ${nt(p.refund_amount)}` : '・尚未退款'}</p> : null}
                  <Link href="/admin/report-shipments" className="text-xs text-admin-accent-600 hover:underline dark:text-admin-accent-200">到實體書出貨 →</Link>
                </Section>
              )}

              {c && (
                <Section title="專人解讀">
                  <p>{c.status_label}・{c.sessions} 次</p>
                  {c.scheduled_at && <p className="text-muted-foreground">約定 {formatDate(c.scheduled_at)}</p>}
                  <Link href="/admin/report-consultations" className="text-xs text-admin-accent-600 hover:underline dark:text-admin-accent-200">到專人解讀 →</Link>
                </Section>
              )}
            </div>

            <section className={cardCls}>
              <h2 className="mb-3 text-sm font-semibold">時間軸</h2>
              <div className="mb-4 flex gap-2">
                <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000}
                  placeholder="加內部備註（會員看不到），例如：會員來電詢問交期" />
                <button type="button" className={`${btnPrimary} shrink-0 whitespace-nowrap`} disabled={saving || !note.trim()} onClick={addNote}>
                  加備註
                </button>
              </div>
              <Timeline entries={order.timeline} />
            </section>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
