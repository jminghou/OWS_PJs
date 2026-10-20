'use client';

/**
 * 外部客人：外部平台（小紅書、Etsy、Pinkoi…）的客人檔案。每位客人背後是一個不能登入的會員帳號，
 * 代客建單的訂單都掛在這個帳號下；之後客人可以用認領碼把檔案接到自己真正的會員帳號。
 * 後端：/api/v1/admin/external-customers（report_orders.proxy）。
 */
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { AdminLayout } from '@ows/admin-app';
import { AdminEmptyState, AdminLoadingSkeleton } from '@ows/ui/admin';
import { Plus, Users } from 'lucide-react';
import { reportOrdersApi, type ExternalCustomer } from '@/lib/api/reportOrders';

const inputCls =
  'w-full rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-admin-accent-500';
const formatDate = (v: string | null | undefined) =>
  v ? new Date(v.endsWith('Z') || v.includes('+') ? v : `${v}Z`).toLocaleDateString('zh-TW') : '—';

export default function ExternalCustomersPage() {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<ExternalCustomer[] | null>(null);
  const [error, setError] = useState('');
  const seq = useRef(0);

  useEffect(() => {
    const mine = ++seq.current;
    const t = setTimeout(() => {
      reportOrdersApi.externalCustomers(q.trim())
        .then((r) => { if (mine === seq.current) { setRows(r.customers); setError(''); } })
        .catch((e) => { if (mine === seq.current) setError(e.message || '載入失敗'); });
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <AdminLayout>
      <div className="mx-auto max-w-4xl p-4 md:p-8">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-semibold tracking-tight">外部客人</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              外部平台客人的檔案。代客建單時選既有客人，訂單就會集中在同一份檔案下。
            </p>
          </div>
          <Link href="/admin/proxy-orders/new"
            className="inline-flex min-h-[40px] md:min-h-0 shrink-0 items-center justify-center gap-1.5 rounded-md bg-admin-accent-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-admin-accent-700">
            <Plus className="h-4 w-4" /> 代客建單
          </Link>
        </div>

        <input className={`${inputCls} mb-4`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜尋客人名稱或平台帳號" />
        {error && <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200">{error}</div>}

        {rows === null ? (!error && <AdminLoadingSkeleton variant="list" count={4} />) : rows.length === 0 ? (
          <AdminEmptyState icon={<Users className="h-10 w-10" />} title={q ? '沒有符合的客人' : '還沒有外部客人'}
            description={q ? undefined : '第一次代客建單時新增客人，檔案就會出現在這裡。'} />
        ) : (
          <div className="space-y-2">
            {rows.map((c) => (
              <Link key={c.id} href={`/admin/external-customers/${c.id}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 text-sm text-card-foreground transition hover:border-admin-accent-500">
                <div className="min-w-0">
                  <p className="font-medium">{c.display_name}{c.platform_handle ? <span className="ml-1 font-normal text-muted-foreground">（{c.platform_handle}）</span> : null}</p>
                  {c.contact_note && <p className="truncate text-xs text-muted-foreground">{c.contact_note}</p>}
                </div>
                <div className="shrink-0 text-right text-xs text-muted-foreground">
                  <p>{c.claimed ? '已認領' : '未認領'}</p>
                  <p>建立 {formatDate(c.created_at)}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
