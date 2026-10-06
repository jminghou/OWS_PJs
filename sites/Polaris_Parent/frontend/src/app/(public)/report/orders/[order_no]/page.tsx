'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import Alert from '@/components/ui/Alert';
import BrandButton from '@/components/ui/BrandButton';
import { useAuthStore } from '@/store/auth';
import { reportOrdersApi, type ReportOrderSummary } from '@/lib/api';

const ORDER_STATUS: Record<string, string> = { pending: '待付款', paid: '已付款，報告製作中', cancelled: '已取消' };

// 訂單狀態徽章：語意色（待付款＝warning、已付款＝success）；已取消用中性底
const STATUS_TONE: Record<string, string> = {
  pending: 'bg-warning-bg text-warning-fg',
  paid: 'bg-success-bg text-success-fg',
  cancelled: 'bg-tint text-text',
};

const fmtDateTime = (iso: string | null | undefined) =>
  iso ? new Date(iso.endsWith('Z') || iso.includes('+') ? iso : `${iso}Z`).toLocaleString('zh-TW', { hour12: false }) : '';

const today = () => new Date().toISOString().slice(0, 10);

// 表單（docs/BRAND_GUIDELINES.md §6.3）
const inputCls =
  'w-full rounded-2xl border-[1.5px] border-line-strong bg-white px-[18px] py-[13px] text-base text-ink placeholder:text-muted ' +
  'focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100';
const labelCls = 'mb-1.5 block text-sm font-medium text-ink';
const cardCls = 'rounded-card bg-white p-6 md:p-8';
const cardTitleCls = 'font-heading text-[18px] font-normal text-ink md:text-h4';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2.5">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="text-right text-ink">{children}</dd>
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
        <section className={cardCls}>
          <h2 className={cardTitleCls}>轉帳資訊</h2>
          <dl className="mt-3 divide-y divide-line text-sm">
            <Row label="銀行">{bank.bank_name}（代碼 <span className="font-latin">{bank.bank_code}</span>）</Row>
            <Row label="帳號"><span className="font-latin text-base font-semibold tracking-wide">{bank.account_no}</span></Row>
            <Row label="戶名">{bank.account_name}</Row>
            <Row label="金額">
              <span className="font-latin text-lg font-extrabold">NT${order.amount.toLocaleString('zh-TW')}</span>
            </Row>
            {order.payment.deadline && (
              <Row label="匯款期限"><span className="font-latin">{fmtDateTime(order.payment.deadline)}</span> 前</Row>
            )}
          </dl>
          <Alert tone="warning" className="mt-4">
            逾期未回報轉帳，訂單會自動取消。我們確認入帳後才會開始製作報告。
          </Alert>
        </section>
      ) : (
        <Alert tone="warning">匯款資訊暫時無法顯示，請聯絡客服。</Alert>
      )}

      {transfer && !editing && (
        <>
          {awaiting && (
            <Alert tone="success">
              <p className="font-medium">已收到你的轉帳回報，我們對帳後會寄信通知你。</p>
              <p className="mt-1">
                末五碼 <span className="font-latin">{transfer.last5}</span>・轉帳日期{' '}
                <span className="font-latin">{transfer.transferred_on}</span>・金額{' '}
                <span className="font-latin">NT${(transfer.reported_amount ?? 0).toLocaleString('zh-TW')}</span>
              </p>
              <BrandButton variant="link" onClick={() => setEditing(true)} className="mt-3 text-sm hover:underline">
                回報內容有誤，重新填寫
              </BrandButton>
            </Alert>
          )}
          {transfer.status === 'failed' && (
            <Alert tone="error">轉帳資料無法核對：{transfer.review_note}。請確認後重新回報。</Alert>
          )}
        </>
      )}

      {editing && (
        <form onSubmit={submit} className={clsx(cardCls, 'space-y-5')}>
          <h2 className={cardTitleCls}>轉帳完成後，回報給我們</h2>
          {transfer?.status === 'failed' && (
            <Alert tone="error">上次回報無法核對：{transfer.review_note}</Alert>
          )}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <div>
              <label htmlFor="tr-last5" className={labelCls}>轉出帳號末五碼 *</label>
              <input id="tr-last5" inputMode="numeric" maxLength={5} pattern="[0-9]{5}" required value={form.last5}
                     onChange={(e) => setForm((f) => ({ ...f, last5: e.target.value.replace(/\D/g, '') }))}
                     className={`${inputCls} font-latin tracking-[0.3em]`} />
            </div>
            <div>
              <label htmlFor="tr-date" className={labelCls}>轉帳日期 *</label>
              <input id="tr-date" type="date" required max={today()} value={form.transferred_on}
                     onChange={(e) => setForm((f) => ({ ...f, transferred_on: e.target.value }))}
                     className={`${inputCls} font-latin`} />
            </div>
            <div>
              <label htmlFor="tr-amount" className={labelCls}>轉帳金額 *</label>
              <input id="tr-amount" inputMode="numeric" required value={form.amount}
                     onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value.replace(/\D/g, '') }))}
                     className={`${inputCls} font-latin`} />
            </div>
          </div>
          <div>
            <label htmlFor="tr-note" className={labelCls}>備註（選填）</label>
            <input id="tr-note" maxLength={200} value={form.note} placeholder="例如：用家人的帳戶轉帳"
                   onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} className={inputCls} />
          </div>
          {error && <Alert tone="error">{error}</Alert>}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            {transfer && transfer.status !== 'failed' && (
              <BrandButton variant="soft" onClick={() => setEditing(false)}>取消</BrandButton>
            )}
            <BrandButton type="submit" variant="primary" disabled={busy || form.last5.length !== 5}>
              {busy ? '送出中…' : '送出轉帳回報'}
            </BrandButton>
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
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <Alert tone="error">{error}</Alert>
      </div>
    );
  }
  if (!order) return null;

  const pending = order.status === 'pending';

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 md:px-6 md:py-16">
      <p className="text-sm font-medium text-blue-500">
        {order.status === 'cancelled' ? '訂單已取消' : '訂單已成立'}
      </p>
      <h1 className="mt-1 font-heading text-[32px] font-normal text-ink md:text-h1">
        訂單 <span className="font-latin">{order.order_no}</span>
      </h1>

      <div className={clsx(cardCls, 'mt-8')}>
        <dl className="divide-y divide-line text-sm">
          <Row label="品項">{order.item?.name}</Row>
          <Row label="報告主角">{order.item?.subject_name}</Row>
          <Row label="金額">
            <span className="font-latin text-base font-extrabold">NT${order.amount.toLocaleString('zh-TW')}</span>
          </Row>
          <Row label="狀態">
            <span className={clsx(
              'inline-flex items-center rounded-full px-3 py-1.5 text-[13px] leading-none',
              STATUS_TONE[order.status] ?? 'bg-tint text-text'
            )}>
              {ORDER_STATUS[order.status] ?? order.status}
            </span>
          </Row>
          {order.paid_at && <Row label="確認收款"><span className="font-latin">{fmtDateTime(order.paid_at)}</span></Row>}
        </dl>
      </div>

      {pending && order.payment.mode === 'placeholder' && (
        <Alert tone="warning" className="mt-6">
          付款功能尚未開放，訂單已保留為「待付款」。開放付款後我們會以 Email 通知你，付款完成才會開始製作報告。
        </Alert>
      )}
      {pending && order.payment.mode === 'manual' && <ManualPayment order={order} onUpdated={setOrder} />}
      {order.status === 'paid' && (
        <Alert tone="success" className="mt-6">
          已確認收款，報告製作中。完成後會寄信通知你到會員中心下載。
        </Alert>
      )}
      {order.status === 'cancelled' && (
        <p className="mt-6 rounded-inner bg-white px-[18px] py-[14px] text-sm leading-relaxed text-text">
          這筆訂單已取消。若你其實已經轉帳，請直接回覆訂單通知信與我們聯絡。
        </p>
      )}
    </div>
  );
}
