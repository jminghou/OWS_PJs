'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Button from '@/components/platform/ui/Button';
import { useAuthStore } from '@/store/auth';
import { reportOrdersApi, type ReportOrderSummary } from '@/lib/api';

const ORDER_STATUS: Record<string, string> = { pending: '待付款', paid: '已付款，報告製作中', cancelled: '已取消' };

const fmtDateTime = (iso: string | null | undefined) =>
  iso ? new Date(iso.endsWith('Z') || iso.includes('+') ? iso : `${iso}Z`).toLocaleString('zh-TW', { hour12: false }) : '';

const today = () => new Date().toISOString().slice(0, 10);

const inputCls =
  'w-full px-4 py-3 border border-gray-300 rounded-banner bg-white focus:ring-2 focus:ring-brand-purple-500 focus:border-transparent';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2.5">
      <dt className="shrink-0 text-gray-500">{label}</dt>
      <dd className="text-right text-gray-900">{children}</dd>
    </div>
  );
}

/** 人工收款：匯款資訊 ＋ 轉帳回報表單／狀態 */
function ManualPayment({ order, onUpdated }: { order: ReportOrderSummary; onUpdated: (o: ReportOrderSummary) => void }) {
  const transfer = order.payment.transfer;
  const bank = order.payment.bank;
  const awaiting = transfer?.status === 'created';
  const [editing, setEditing] = useState(!transfer || transfer.status === 'failed');
  const [form, setForm] = useState({ last5: '', transferred_on: today(), amount: String(order.amount), note: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await reportOrdersApi.reportTransfer(order.order_no, {
        last5: form.last5,
        transferred_on: form.transferred_on,
        amount: Number(form.amount),
        note: form.note.trim() || undefined,
      });
      onUpdated(res.order);
      setEditing(false);
    } catch (err: any) {
      const fields = err.errors ? Object.values(err.errors as Record<string, string>).join('；') : '';
      setError(fields || err.message || '送出失敗，請稍後再試');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-6 space-y-5">
      {bank ? (
        <section className="rounded-banner border-2 border-brand-purple-200 bg-white p-5 sm:p-6">
          <h2 className="text-base font-bold text-gray-900">轉帳資訊</h2>
          <dl className="mt-2 divide-y divide-warm-100 text-sm">
            <Row label="銀行">{bank.bank_name}（代碼 {bank.bank_code}）</Row>
            <Row label="帳號"><span className="font-mono tracking-wide">{bank.account_no}</span></Row>
            <Row label="戶名">{bank.account_name}</Row>
            <Row label="金額"><strong>NT${order.amount.toLocaleString('zh-TW')}</strong></Row>
            {order.payment.deadline && <Row label="匯款期限">{fmtDateTime(order.payment.deadline)} 前</Row>}
          </dl>
          <p className="mt-3 text-xs leading-5 text-gray-500">
            逾期未回報轉帳，訂單會自動取消。我們確認入帳後才會開始製作報告。
          </p>
        </section>
      ) : (
        <p className="rounded-banner bg-white p-4 text-sm text-gray-600">匯款資訊暫時無法顯示，請聯絡客服。</p>
      )}

      {transfer && !editing && (
        <section className={`rounded-banner border p-5 text-sm sm:p-6 ${
          transfer.status === 'failed' ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'
        }`}>
          {awaiting && (
            <>
              <p className="font-medium text-green-900">已收到你的轉帳回報，我們對帳後會寄信通知你。</p>
              <p className="mt-1 text-green-900">
                末五碼 {transfer.last5}・轉帳日期 {transfer.transferred_on}・金額 NT${(transfer.reported_amount ?? 0).toLocaleString('zh-TW')}
              </p>
              <button type="button" onClick={() => setEditing(true)} className="mt-3 text-brand-purple-700 hover:underline">
                回報內容有誤，重新填寫
              </button>
            </>
          )}
          {transfer.status === 'failed' && (
            <p className="text-red-800">轉帳資料無法核對：{transfer.review_note}。請確認後重新回報。</p>
          )}
        </section>
      )}

      {editing && (
        <form onSubmit={submit} className="rounded-banner border border-warm-200/70 bg-white p-5 sm:p-6 space-y-4">
          <h2 className="text-base font-bold text-gray-900">轉帳完成後，回報給我們</h2>
          {transfer?.status === 'failed' && (
            <p className="rounded-banner bg-red-50 p-3 text-sm text-red-800">上次回報無法核對：{transfer.review_note}</p>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="tr-last5" className="mb-2 block text-sm font-medium text-gray-700">轉出帳號末五碼 *</label>
              <input id="tr-last5" inputMode="numeric" maxLength={5} pattern="[0-9]{5}" required value={form.last5}
                     onChange={(e) => setForm((f) => ({ ...f, last5: e.target.value.replace(/\D/g, '') }))}
                     className={`${inputCls} font-mono tracking-[0.3em]`} />
            </div>
            <div>
              <label htmlFor="tr-date" className="mb-2 block text-sm font-medium text-gray-700">轉帳日期 *</label>
              <input id="tr-date" type="date" required max={today()} value={form.transferred_on}
                     onChange={(e) => setForm((f) => ({ ...f, transferred_on: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label htmlFor="tr-amount" className="mb-2 block text-sm font-medium text-gray-700">轉帳金額 *</label>
              <input id="tr-amount" inputMode="numeric" required value={form.amount}
                     onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value.replace(/\D/g, '') }))}
                     className={inputCls} />
            </div>
          </div>
          <div>
            <label htmlFor="tr-note" className="mb-2 block text-sm font-medium text-gray-700">備註（選填）</label>
            <input id="tr-note" maxLength={200} value={form.note} placeholder="例如：用家人的帳戶轉帳"
                   onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} className={inputCls} />
          </div>
          {error && <p className="text-sm text-red-700">{error}</p>}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            {transfer && transfer.status !== 'failed' && (
              <button type="button" onClick={() => setEditing(false)} className="text-sm text-gray-500 hover:underline">取消</button>
            )}
            <Button type="submit" disabled={busy || form.last5.length !== 5}
                    className="bg-brand-purple-600 hover:bg-brand-purple-700 disabled:opacity-50">
              {busy ? '送出中…' : '送出轉帳回報'}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

/** 訂單詳情（會員 v2）：依付款模式顯示佔位說明或人工收款的轉帳資訊與回報。 */
export default function ReportOrderPage() {
  const router = useRouter();
  const { order_no: orderNo } = useParams<{ order_no: string }>();
  const { isAuthenticated, checkAuth } = useAuthStore();
  const [checked, setChecked] = useState(false);
  const [order, setOrder] = useState<ReportOrderSummary | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    checkAuth().finally(() => setChecked(true));
  }, [checkAuth]);

  const load = useCallback(() => {
    reportOrdersApi
      .get(orderNo)
      .then((r) => setOrder(r.order))
      .catch((e) => setError(e.message || '無法載入訂單'));
  }, [orderNo]);

  useEffect(() => {
    if (!checked) return;
    if (!isAuthenticated) {
      router.replace(`/login?next=${encodeURIComponent(`/report/orders/${orderNo}`)}`);
      return;
    }
    load();
  }, [checked, isAuthenticated, orderNo, router, load]);

  if (error) {
    return <p className="mx-auto max-w-xl px-4 py-16 text-center text-gray-600">{error}</p>;
  }
  if (!order) return null;

  const pending = order.status === 'pending';

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <p className="text-sm font-medium text-brand-purple-700">
        {order.status === 'cancelled' ? '訂單已取消' : '訂單已成立'}
      </p>
      <h1 className="mt-1 text-2xl font-bold text-gray-900">訂單 {order.order_no}</h1>

      <div className="mt-8 rounded-banner border border-warm-200/70 bg-white p-5 sm:p-6">
        <dl className="divide-y divide-warm-100 text-sm">
          <Row label="品項">{order.item?.name}</Row>
          <Row label="報告主角">{order.item?.subject_name}</Row>
          <Row label="金額"><span className="font-medium">NT${order.amount.toLocaleString('zh-TW')}</span></Row>
          <Row label="狀態">{ORDER_STATUS[order.status] ?? order.status}</Row>
          {order.paid_at && <Row label="確認收款">{fmtDateTime(order.paid_at)}</Row>}
        </dl>
      </div>

      {pending && order.payment.mode === 'placeholder' && (
        <p className="mt-6 rounded-banner border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
          付款功能尚未開放，訂單已保留為「待付款」。開放付款後我們會以 Email 通知你，付款完成才會開始製作報告。
        </p>
      )}
      {pending && order.payment.mode === 'manual' && <ManualPayment order={order} onUpdated={setOrder} />}
      {order.status === 'paid' && (
        <p className="mt-6 rounded-banner border border-green-200 bg-green-50 p-4 text-sm leading-6 text-green-900">
          已確認收款，報告製作中。完成後會寄信通知你到會員中心下載。
        </p>
      )}
      {order.status === 'cancelled' && (
        <p className="mt-6 rounded-banner bg-white p-4 text-sm leading-6 text-gray-600">
          這筆訂單已取消。若你其實已經轉帳，請直接回覆訂單通知信與我們聯絡。
        </p>
      )}
    </div>
  );
}
