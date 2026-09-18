'use client';

import { useCallback, useEffect, useState } from 'react';
import { AdminLayout } from '@ows/admin-app';
import { useAuthStore } from '@ows/platform-api';
import { AdminEmptyState, AdminLoadingSkeleton, AdminPagination } from '@ows/ui/admin';
import { Download, Mail, Trash2 } from 'lucide-react';
import { newsletterApi } from '../api';
import type { Subscriber, SubscriberListResponse, SubscriberStatus } from '../types';

type StatusFilter = SubscriberStatus | 'all';

const STATUS_META: Record<SubscriberStatus, { label: string; className: string }> = {
  active: { label: '已確認', className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200' },
  pending: { label: '待確認', className: 'bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200' },
  unsubscribed: { label: '已退訂', className: 'bg-muted text-muted-foreground' },
};
const FILTERS: StatusFilter[] = ['all', 'active', 'pending', 'unsubscribed'];

const btnGhost =
  'inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50';

function formatDate(value: string | null) {
  // 後端存 naive UTC，補上 Z 才會換算成瀏覽器當地時間
  return value ? new Date(`${value}Z`).toLocaleString('zh-TW', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
}

export default function SubscribersPage() {
  const canManage = useAuthStore((s) => s.user?.permissions?.includes('newsletter.manage') ?? false);
  const [data, setData] = useState<SubscriberListResponse | null>(null);
  const [status, setStatus] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await newsletterApi.listSubscribers({
        status: status === 'all' ? undefined : status,
        q: search.trim() || undefined,
        page,
        per_page: 20,
      }));
    } catch (err) {
      setMessage({ type: 'error', text: (err as Error).message || '載入訂閱者失敗' });
    } finally {
      setLoading(false);
    }
  }, [status, search, page]);

  // 搜尋輸入防抖
  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  const handleExport = async () => {
    setExporting(true);
    setMessage(null);
    try {
      await newsletterApi.downloadCsv(status);
    } catch (err) {
      setMessage({ type: 'error', text: (err as Error).message });
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async (subscriber: Subscriber) => {
    if (!confirm(`永久刪除 ${subscriber.email} 的訂閱紀錄？\n\n這是給「個資刪除請求」用的。一般退訂不需要刪除——保留紀錄才不會日後又誤寄給對方。`)) return;
    try {
      await newsletterApi.deleteSubscriber(subscriber.id);
      setMessage({ type: 'success', text: `已刪除 ${subscriber.email}` });
      load();
    } catch (err) {
      setMessage({ type: 'error', text: (err as Error).message || '刪除失敗' });
    }
  };

  const counts = data?.counts;
  const total = counts ? counts.active + counts.pending + counts.unsubscribed : 0;
  const countOf = (filter: StatusFilter) => (counts ? (filter === 'all' ? total : counts[filter]) : null);
  const exportLabel = status === 'all' ? '匯出全部 CSV' : `匯出「${STATUS_META[status].label}」CSV`;

  return (
    <AdminLayout>
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">電子報訂閱</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              發報時請匯出「已確認」名單到寄信工具；CSV 每列附該訂閱者的退訂連結，請放進信件頁尾。
            </p>
          </div>
          <button type="button" onClick={handleExport} disabled={exporting || !total} className={btnGhost}>
            <Download className="h-4 w-4" />
            {exporting ? '匯出中…' : exportLabel}
          </button>
        </div>

        {message && (
          <div
            role={message.type === 'error' ? 'alert' : 'status'}
            className={`mt-4 rounded-md border px-4 py-2 text-sm ${
              message.type === 'error'
                ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200'
                : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200'
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <div className="flex gap-1 rounded-lg bg-muted p-1">
            {FILTERS.map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => { setStatus(filter); setPage(1); }}
                aria-pressed={status === filter}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                  status === filter ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {filter === 'all' ? '全部' : STATUS_META[filter].label}
                {countOf(filter) !== null && <span className="ml-1.5 tabular-nums text-muted-foreground">{countOf(filter)}</span>}
              </button>
            ))}
          </div>
          <input
            type="search"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="搜尋 Email"
            aria-label="搜尋 Email"
            className="min-w-[200px] flex-1 rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-admin-accent-500"
          />
        </div>

        <div className="mt-4">
          {loading && !data ? (
            <AdminLoadingSkeleton variant="table" count={8} />
          ) : !data?.subscribers.length ? (
            <AdminEmptyState
              icon={<Mail className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />}
              title={search || status !== 'all' ? '沒有符合條件的訂閱者' : '還沒有訂閱者'}
              description={search || status !== 'all' ? undefined : '前台的訂閱表單送出後，名單會出現在這裡。'}
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border bg-card">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border text-xs text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium">Email</th>
                    <th scope="col" className="px-4 py-3 font-medium">狀態</th>
                    <th scope="col" className="px-4 py-3 font-medium">語系</th>
                    <th scope="col" className="px-4 py-3 font-medium">來源</th>
                    <th scope="col" className="px-4 py-3 font-medium">訂閱時間</th>
                    <th scope="col" className="px-4 py-3 font-medium">確認時間</th>
                    {canManage && <th scope="col" className="px-4 py-3"><span className="sr-only">操作</span></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.subscribers.map((subscriber) => (
                    <tr key={subscriber.id} className="text-foreground">
                      <td className="px-4 py-3 font-medium">{subscriber.email}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded px-2 py-0.5 text-[11px] font-medium ${STATUS_META[subscriber.status].className}`}>
                          {STATUS_META[subscriber.status].label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{subscriber.locale || '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{subscriber.source || '—'}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatDate(subscriber.consent_at)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatDate(subscriber.confirmed_at)}</td>
                      {canManage && (
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleDelete(subscriber)}
                            aria-label={`刪除 ${subscriber.email}`}
                            title="永久刪除（個資刪除請求）"
                            className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {data && (
          <div className="mt-6">
            <AdminPagination pagination={data.pagination} currentPage={page} onPageChange={setPage} />
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
