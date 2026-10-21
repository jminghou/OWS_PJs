'use client';

/**
 * 外部客人檔案：名稱、平台帳號、聯絡備註、認領碼（客人接到自己的會員帳號），以及這位客人的所有訂單。
 * 後端：/api/v1/admin/external-customers/:id（report_orders.proxy）。
 */
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AdminLayout } from '@ows/admin-app';
import { AdminLoadingSkeleton } from '@ows/ui/admin';
import { ArrowLeft, Plus } from 'lucide-react';
import { formatMoney } from '@/lib/money';
import { channelLabel } from '@/lib/report/proxy';
import { reportOrdersApi, type ExternalCustomer } from '@/lib/api/reportOrders';
import ClaimSection from './ClaimSection';

const btnPrimary =
  'inline-flex min-h-[40px] md:min-h-0 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 bg-admin-accent-600 text-white hover:bg-admin-accent-700';
const inputCls =
  'w-full rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-admin-accent-500';
const labelCls = 'mb-1 block text-xs font-medium text-muted-foreground';
const cardCls = 'rounded-xl border border-border bg-card p-4 text-card-foreground';
const formatDate = (v: string | null | undefined) =>
  v ? new Date(v.endsWith('Z') || v.includes('+') ? v : `${v}Z`).toLocaleString('zh-TW', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

export default function ExternalCustomerPage() {
  const { id } = useParams<{ id: string }>();
  const [customer, setCustomer] = useState<ExternalCustomer | null>(null);
  const [form, setForm] = useState({ display_name: '', platform_handle: '', contact_note: '' });
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const apply = (c: ExternalCustomer) => {
    setCustomer(c);
    setForm({ display_name: c.display_name, platform_handle: c.platform_handle ?? '', contact_note: c.contact_note ?? '' });
  };

  useEffect(() => {
    reportOrdersApi.externalCustomer(Number(id)).then((r) => apply(r.customer)).catch((e) => setError(e.message || '載入失敗'));
  }, [id]);

  const save = async () => {
    if (!customer) return;
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      apply((await reportOrdersApi.updateExternalCustomer(customer.id, {
        display_name: form.display_name, platform_handle: form.platform_handle || null, contact_note: form.contact_note || null,
      })).customer);
      setSaved(true);
    } catch (e: any) {
      setError(e.message || '儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout>
      <div className="mx-auto max-w-4xl p-4 md:p-8">
        <Link href="/admin/external-customers" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> 外部客人
        </Link>
        {error && <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200">{error}</div>}
        {!customer ? (!error && <AdminLoadingSkeleton variant="list" count={3} />) : (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h1 className="text-xl font-semibold">{customer.display_name}</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {customer.claimed ? '客人已認領這份檔案' : '尚未認領'}・建立 {formatDate(customer.created_at)}
                </p>
              </div>
              <Link href={`/admin/proxy-orders/new?customer=${customer.id}`} className={btnPrimary}>
                <Plus className="h-4 w-4" /> 為這位客人建單
              </Link>
            </div>

            <section className={cardCls}>
              <h2 className="mb-3 text-sm font-semibold">客人資料</h2>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="block">
                  <span className={labelCls}>平台上的名稱</span>
                  <input className={inputCls} value={form.display_name} maxLength={100} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
                </label>
                <label className="block">
                  <span className={labelCls}>平台帳號</span>
                  <input className={inputCls} value={form.platform_handle} maxLength={100} onChange={(e) => setForm({ ...form, platform_handle: e.target.value })} />
                </label>
                <label className="block md:col-span-2">
                  <span className={labelCls}>聯絡備註（只有後台看得到）</span>
                  <textarea className={inputCls} rows={2} value={form.contact_note} maxLength={1000} onChange={(e) => setForm({ ...form, contact_note: e.target.value })} />
                </label>
              </div>
              <div className="mt-3 flex items-center justify-end gap-3">
                {saved && <span className="text-xs text-muted-foreground">已儲存</span>}
                <button type="button" className={btnPrimary} disabled={saving || !form.display_name.trim()} onClick={save}>儲存</button>
              </div>
            </section>

            <ClaimSection customer={customer} onChange={apply} onError={setError} />

            <section className={cardCls}>
              <h2 className="mb-3 text-sm font-semibold">訂單（{customer.orders?.length ?? 0}）</h2>
              {!customer.orders?.length ? <p className="text-sm text-muted-foreground">還沒有訂單</p> : (
                <ul className="divide-y divide-border">
                  {customer.orders.map((o) => (
                    <li key={o.order_no}>
                      <Link href={`/admin/report-orders/${encodeURIComponent(o.order_no)}`} className="flex flex-col gap-1 py-2 text-sm hover:text-admin-accent-600 md:flex-row md:items-center md:justify-between">
                        <span>
                          <span className="font-mono">{o.order_no}</span>
                          <span className="ml-2 text-muted-foreground">{o.subject_name ?? '—'}・{o.lines.join('、')}</span>
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {o.external ? `${channelLabel(o.external.channel)} ${o.external.external_order_id ?? ''}・` : ''}
                          {formatMoney(o.amount, o.currency)}・{o.status_label}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
