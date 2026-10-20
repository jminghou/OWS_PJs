'use client';

/**
 * 訂單總覽：所有報告訂單（含加購）一頁搜尋，每筆標出「現在要做什麼、卡在誰手上」。
 * 點進去是訂單詳細與時間軸。原本的人工收款／報告交付／實體書出貨／專人解讀頁仍是各自的工作清單。
 * 後端：/api/v1/admin/report-orders/overview（report_orders.read）。
 */
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { AdminLayout } from '@ows/admin-app';
import { AdminEmptyState, AdminLoadingSkeleton } from '@ows/ui/admin';
import { ClipboardList, Plus, Search } from 'lucide-react';
import { formatMoney } from '@/lib/money';
import { channelLabel } from '@/lib/report/proxy';
import { reportOrdersApi, type AdminOrderRow } from '@/lib/api/reportOrders';

type Needs = 'all' | 'admin' | 'member';

const NEEDS: { value: Needs; label: string }[] = [
  { value: 'admin', label: '要你處理' },
  { value: 'member', label: '等會員' },
  { value: 'all', label: '全部' },
];
const STATUSES = [
  { value: 'all', label: '所有狀態' },
  { value: 'pending', label: '待付款' },
  { value: 'paid', label: '已付款' },
  { value: 'cancelled', label: '已取消' },
];

const inputCls =
  'w-full rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-admin-accent-500';
const nt = (n: number | null | undefined, currency?: string) => formatMoney(n, currency);
const formatDate = (v: string | null | undefined) =>
  v ? new Date(v.endsWith('Z') || v.includes('+') ? v : `${v}Z`).toLocaleString('zh-TW', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

const STATUS_CLS: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200',
  paid: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200',
  cancelled: 'bg-muted text-muted-foreground',
  refunded: 'bg-muted text-muted-foreground',
};

export default function ReportOrdersOverviewPage() {
  const [needs, setNeeds] = useState<Needs>('admin');
  const [status, setStatus] = useState('all');
  const [keyword, setKeyword] = useState('');
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<AdminOrderRow[]>([]);
  const [counts, setCounts] = useState({ admin: 0, member: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await reportOrdersApi.adminOrdersOverview({ q: query, status, needs });
      setRows(res.orders);
      setCounts(res.counts);
    } catch (e: any) {
      setError(e.message || '載入失敗');
    } finally {
      setLoading(false);
    }
  }, [query, status, needs]);

  useEffect(() => { load(); }, [load]);

  return (
    <AdminLayout>
      <div className="mx-auto max-w-5xl p-4 md:p-8">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-semibold tracking-tight">訂單總覽</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              所有報告訂單（含加購）都在這裡，每筆標出現在要做什麼。點進去看付款、交付、實體書與完整時間軸。
            </p>
          </div>
          <Link href="/admin/proxy-orders/new"
            className="inline-flex min-h-[40px] md:min-h-0 shrink-0 items-center justify-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground hover:bg-muted">
            <Plus className="h-4 w-4" /> 代客建單
          </Link>
        </div>

        <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="-mx-4 flex gap-1 overflow-x-auto px-4 md:mx-0 md:px-0">
            {NEEDS.map((f) => {
              const n = f.value === 'all' ? null : counts[f.value];
              return (
                <button key={f.value} type="button" onClick={() => setNeeds(f.value)}
                  className={`flex-shrink-0 whitespace-nowrap rounded px-2.5 py-2 md:py-1 text-xs font-medium transition ${
                    needs === f.value ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}>
                  {f.label}{n ? <span className="ml-1 tabular-nums opacity-70">{n}</span> : null}
                </button>
              );
            })}
          </div>
          <form className="flex gap-2 md:w-[28rem]" onSubmit={(e) => { e.preventDefault(); setQuery(keyword.trim()); }}>
            <select className={`${inputCls} w-auto`} value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <input className={inputCls} value={keyword} onChange={(e) => setKeyword(e.target.value)}
              placeholder="訂單編號、Email、主角、平台訂單號、客人" />
            <button type="submit" aria-label="搜尋"
              className="inline-flex shrink-0 items-center rounded-md border border-border bg-card px-3 text-foreground hover:bg-muted">
              <Search className="h-4 w-4" />
            </button>
          </form>
        </div>

        {error && <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200">{error}</div>}

        {loading ? (
          <AdminLoadingSkeleton variant="list" count={5} />
        ) : rows.length === 0 ? (
          <AdminEmptyState icon={<ClipboardList className="h-10 w-10" />}
            title={needs === 'admin' && !query ? '目前沒有要你處理的訂單' : '沒有符合的訂單'} />
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <Link key={r.order_no} href={`/admin/report-orders/${encodeURIComponent(r.order_no)}`}
                className="block rounded-xl border border-border bg-card p-4 text-card-foreground transition hover:border-admin-accent-500">
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0 space-y-1 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-medium">{r.order_no}</span>
                      <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${STATUS_CLS[r.status] ?? 'bg-muted'}`}>{r.status_label}</span>
                      {r.kind === 'addon' && <span className="rounded bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">加購・原訂單 {r.parent_order_no}</span>}
                      {r.external && (
                        <span className="rounded bg-sky-50 px-2 py-0.5 text-[11px] text-sky-700 dark:bg-sky-900/40 dark:text-sky-200">
                          {channelLabel(r.external.channel)} {r.external.external_order_id}{r.external.customer_name ? `・${r.external.customer_name}` : ''}
                        </span>
                      )}
                    </div>
                    <p>{r.subject_name ?? '—'}{r.call_name ? `（${r.call_name}）` : ''}・{r.lines.join('、')}</p>
                    <p className="text-muted-foreground">
                      {r.buyer_email ?? '—'}・{nt(r.amount, r.currency)}・建立 {formatDate(r.created_at)}
                      {r.physical_status ? `・實體書 ${r.physical_status}` : ''}{r.consult_status ? `・解讀 ${r.consult_status}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1 md:max-w-[16rem] md:justify-end">
                    {r.todos.map((t) => (
                      <span key={t.key} className={`rounded px-2 py-1 text-[11px] font-medium ${t.waiting_on === 'admin'
                        ? 'bg-admin-accent-100 text-admin-accent-800 dark:bg-admin-accent-800/40 dark:text-admin-accent-100'
                        : 'bg-muted text-muted-foreground'}`}>
                        {t.label}
                      </span>
                    ))}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
