'use client';

/**
 * 寄信紀錄：訂單通知信寄出了沒有。寄失敗的信由背景排程自動重試（5 分 → 15 分 → 1 時 → 4 時 → 12 時），
 * 次數用完會寄警示給管理者；問題排除後可在這裡手動重寄。頁首顯示背景排程各工作的最後執行時間。
 * 後端：/api/v1/admin/report-notifications（report_orders.read；重寄需 report_orders.fulfill）。
 */
import { useCallback, useEffect, useState } from 'react';
import { AdminLayout } from '@ows/admin-app';
import { AdminEmptyState, AdminLoadingSkeleton } from '@ows/ui/admin';
import { Mail } from 'lucide-react';
import {
  reportOrdersApi,
  type AdminNotification,
  type JobsStatus,
  type NotificationStatus,
} from '@/lib/api/reportOrders';

type Filter = NotificationStatus | 'all';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'failed', label: '寄送失敗' },
  { value: 'pending', label: '寄送中' },
  { value: 'sent', label: '已寄出' },
  { value: 'skipped', label: '不寄送' },
  { value: 'all', label: '全部' },
];

const STATUS_LABEL: Record<NotificationStatus, string> = { pending: '寄送中', sent: '已寄出', failed: '寄送失敗', skipped: '不寄送' };
const STATUS_CLS: Record<NotificationStatus, string> = {
  sent: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  pending: 'bg-muted text-muted-foreground',
  skipped: 'bg-muted text-muted-foreground',
  failed: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
};

const btn =
  'inline-flex min-h-[40px] md:min-h-0 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50';
const btnPrimary = `${btn} bg-admin-accent-600 text-white hover:bg-admin-accent-700`;
const btnGhost = `${btn} border border-border bg-card text-foreground hover:bg-muted`;
const inputCls =
  'w-full rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-admin-accent-500';

// 後端時間是不帶時區的 UTC
const toDate = (v: string) => new Date(v.endsWith('Z') || v.includes('+') ? v : `${v}Z`);
const formatDate = (v: string | null | undefined) =>
  v ? toDate(v).toLocaleString('zh-TW', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

function ago(v: string | null) {
  if (!v) return '從未執行';
  const min = Math.round((Date.now() - toDate(v).getTime()) / 60000);
  if (min < 1) return '剛剛';
  if (min < 60) return `${min} 分鐘前`;
  if (min < 60 * 48) return `${Math.round(min / 60)} 小時前`;
  return `${Math.round(min / 1440)} 天前`;
}

function JobsPanel({ jobs }: { jobs: JobsStatus }) {
  const retry = jobs.jobs.find((j) => j.job === 'retry_mail');
  // 每輪都會跑 retry_mail：超過三個週期沒動靜，代表排程停了
  const stale = !retry?.last_started_at || Date.now() - toDate(retry.last_started_at).getTime() > jobs.interval_seconds * 3000;
  const healthy = jobs.enabled && !stale && jobs.jobs.every((j) => j.last_status !== 'error');
  return (
    <details className="mb-4 rounded-xl border border-border bg-card p-4 text-sm text-card-foreground">
      <summary className="flex cursor-pointer flex-wrap items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${healthy ? 'bg-emerald-500' : 'bg-amber-500'}`} />
        <span className="font-medium">背景排程</span>
        <span className="text-muted-foreground">
          {!jobs.enabled
            ? '未啟用（REPORT_JOBS_ENABLED）'
            : stale
              ? `已超過 ${Math.round((jobs.interval_seconds * 3) / 60)} 分鐘沒有執行，請檢查後端`
              : `正常・最後執行 ${ago(retry?.last_started_at ?? null)}`}
        </span>
      </summary>
      <ul className="mt-3 space-y-1.5">
        {jobs.jobs.map((j) => (
          <li key={j.job} className="flex flex-col gap-0.5 md:flex-row md:items-center md:gap-3">
            <span className="md:w-64">{j.label}</span>
            <span className="text-muted-foreground">{ago(j.last_started_at)}</span>
            {j.last_status === 'error' ? (
              <span className="text-xs text-destructive">失敗：{j.last_error}</span>
            ) : j.last_result ? (
              <span className="font-mono text-xs text-muted-foreground">{JSON.stringify(j.last_result)}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </details>
  );
}

function Row({ n, onDone, onError }: { n: AdminNotification; onDone: (t: string) => void; onError: (t: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [body, setBody] = useState<string | null | undefined>(undefined);

  const resend = async () => {
    setBusy(true);
    try {
      await reportOrdersApi.adminResendNotification(n.id);
      onDone(`已重寄給 ${n.recipient}`);
    } catch (e: any) {
      onError(e.message || '重寄失敗');
    } finally {
      setBusy(false);
    }
  };

  const toggleBody = async () => {
    if (body !== undefined) return setBody(undefined);
    try {
      const res = await reportOrdersApi.adminNotification(n.id);
      setBody(res.notification.body ?? null);
    } catch (e: any) {
      onError(e.message || '載入失敗');
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 text-card-foreground">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1 space-y-1 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${STATUS_CLS[n.status]}`}>{STATUS_LABEL[n.status]}</span>
            <span className="font-medium">{n.event_label}</span>
            {n.order_no && <span className="font-mono text-xs text-muted-foreground">{n.order_no}</span>}
          </div>
          <p className="break-all">收件者 {n.recipient}</p>
          <p className="text-muted-foreground">
            建立 {formatDate(n.created_at)}
            {n.sent_at ? `・寄出 ${formatDate(n.sent_at)}` : ''}
            ・已嘗試 {n.attempts}／{n.max_attempts} 次
          </p>
          {n.status !== 'sent' && n.status !== 'skipped' && (
            <p className="text-muted-foreground">
              {n.next_attempt_at ? `下次自動重試 ${formatDate(n.next_attempt_at)}` : '已停止自動重試'}
            </p>
          )}
          {n.error && n.status === 'skipped' && <p className="break-all text-xs text-muted-foreground">{n.error}</p>}
          {n.error && n.status !== 'sent' && n.status !== 'skipped' && <p className="break-all text-xs text-destructive">錯誤：{n.error}</p>}
          {body !== undefined && (
            <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap rounded-md bg-muted px-3 py-2 text-xs leading-5">
              {n.subject ? `${n.subject}\n\n` : ''}{body ?? '（內文已超過保留期限而清除）'}
            </pre>
          )}
        </div>
        <div className="flex gap-2 md:w-56 md:flex-col">
          <button type="button" className={`${btnGhost} flex-1 md:w-full`} onClick={toggleBody}>
            {body !== undefined ? '收合內文' : '查看內文'}
          </button>
          {n.can_resend && (
            <button type="button" className={`${btnPrimary} flex-1 md:w-full`} disabled={busy} onClick={resend}>
              {busy ? '寄送中…' : '立即重寄'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ReportNotificationsPage() {
  const [filter, setFilter] = useState<Filter>('failed');
  const [keyword, setKeyword] = useState('');
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<AdminNotification[]>([]);
  const [counts, setCounts] = useState<Partial<Record<NotificationStatus, number>>>({});
  const [jobs, setJobs] = useState<JobsStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await reportOrdersApi.adminNotifications(filter, query);
      setRows(res.notifications);
      setCounts(res.counts);
      setJobs(res.jobs);
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message || '載入失敗' });
    } finally {
      setLoading(false);
    }
  }, [filter, query]);

  useEffect(() => { load(); }, [load]);

  return (
    <AdminLayout>
      <div className="mx-auto max-w-5xl p-4 md:p-8">
        <div className="mb-6">
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight">寄信紀錄</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            訂單通知信寄失敗時，系統會自動重試 {rows[0]?.max_attempts ?? 6} 次（間隔由 5 分鐘逐步拉長到 12 小時）；仍失敗會寄警示信給管理者。問題排除後可以在這裡立即重寄。
          </p>
        </div>

        {jobs && <JobsPanel jobs={jobs} />}

        <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="-mx-4 flex gap-1 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
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
          <form className="flex gap-2 md:w-80" onSubmit={(e) => { e.preventDefault(); setQuery(keyword.trim()); }}>
            <input className={inputCls} value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="訂單編號或收件者 Email" />
            <button type="submit" className={`${btnGhost} shrink-0 whitespace-nowrap`}>搜尋</button>
          </form>
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
          <AdminEmptyState icon={<Mail className="h-10 w-10" />}
            title={filter === 'failed' ? '沒有寄送失敗的信' : '沒有符合的信件'} />
        ) : (
          <div className="space-y-3">
            {rows.map((n) => (
              <Row key={n.id} n={n}
                onDone={(text) => { setMessage({ type: 'success', text }); load(); }}
                onError={(text) => setMessage({ type: 'error', text })} />
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
