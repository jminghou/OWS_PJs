'use client';

/**
 * 訂單頁的實體書與專人解讀區塊：
 * - PhysicalStatus：這張訂單的實體書進度（實體書版或加購訂單）、取消、退款狀態
 * - ConsultStatus：這張訂單的專人解讀（待安排／已約時間／已完成）
 * - AddonSection：原報告訂單底下「加購實體書」「加購專人解讀」入口與已加購的訂單
 */
import Link from 'next/link';
import { useState } from 'react';
import { clsx } from 'clsx';
import { BookOpen, MessageCircle, Plus } from 'lucide-react';
import Alert from '@/components/ui/Alert';
import BrandButton, { brandButton } from '@/components/ui/BrandButton';
import { reportOrdersApi, type ReportOrderSummary } from '@/lib/api';

const cardCls = 'rounded-card bg-white p-6 md:p-8';
const cardTitleCls = 'font-heading text-[18px] font-normal text-ink md:text-h4';
const nt = (n: number) => `NT$${n.toLocaleString('zh-TW')}`;
const fmtDateTime = (iso: string | null) =>
  iso ? new Date(iso.endsWith('Z') || iso.includes('+') ? iso : `${iso}Z`).toLocaleString('zh-TW', { hour12: false, dateStyle: 'medium', timeStyle: 'short' }) : '';

// 實體書流程的步驟（取消另外顯示）
const STEPS: { key: string[]; label: string }[] = [
  { key: ['awaiting_payment'], label: '待付款' },
  { key: ['awaiting_customization'], label: '設計內容' },
  { key: ['awaiting_proof', 'proof_ready', 'changes_requested'], label: '確認打樣' },
  { key: ['approved', 'printing'], label: '印製' },
  { key: ['shipped', 'delivered'], label: '出貨' },
];

export function PhysicalStatus({ order, onUpdated }: { order: ReportOrderSummary; onUpdated: (o: ReportOrderSummary) => void }) {
  const p = order.physical;
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!p) return null;

  const isAddon = order.item?.kind === 'addon';
  const current = STEPS.findIndex((s) => s.key.includes(p.status));
  // 實體書版：未付款時不提供取消（逾期會自動取消）；加購訂單未付款也可以直接取消
  const canCancel = p.cancellable && (isAddon || order.status === 'paid');

  const cancel = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await reportOrdersApi.cancelPhysical(order.order_no);
      onUpdated(res.order);
      setConfirming(false);
    } catch (e: any) {
      setError(e.message || '取消失敗，請稍後再試');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={clsx(cardCls, 'mt-6')} aria-labelledby="physical-title">
      <div className="flex items-center gap-2">
        <BookOpen className="h-5 w-5 text-blue-500" strokeWidth={2} aria-hidden="true" />
        <h2 id="physical-title" className={cardTitleCls}>實體書</h2>
        <span className="ml-auto rounded-full bg-tint px-3 py-1.5 text-[13px] leading-none text-text">{p.status_label}</span>
      </div>

      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        {p.spec_label && (<><dt className="text-muted">規格</dt><dd className="text-ink">{p.spec_label}</dd></>)}
        <dt className="text-muted">數量</dt><dd className="text-ink">{p.quantity} 本</dd>
        {p.custom_labels.length > 0 && (<><dt className="text-muted">特殊客製</dt><dd className="text-ink">{p.custom_labels.join('、')}</dd></>)}
        {order.shipment?.tracking_no && (
          <><dt className="text-muted">物流</dt><dd className="text-ink">{order.shipment.carrier}・<span className="font-latin">{order.shipment.tracking_no}</span></dd></>
        )}
      </dl>

      {p.status !== 'cancelled' ? (
        <ol className="mt-5 flex flex-wrap gap-x-1 gap-y-2 text-[13px]" aria-label="實體書進度">
          {STEPS.map((s, i) => (
            <li key={s.label} className={clsx('flex items-center gap-1', i <= current ? 'text-blue-600 font-medium' : 'text-muted')}>
              <span className={clsx('inline-flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-latin',
                i < current ? 'bg-blue-500 text-white' : i === current ? 'border-[1.5px] border-blue-500' : 'border border-line-strong')}>
                {i + 1}
              </span>
              {s.label}
              {i < STEPS.length - 1 && <span className="mx-1 text-line-strong" aria-hidden="true">—</span>}
            </li>
          ))}
        </ol>
      ) : (
        <Alert tone="info" className="mt-4">
          實體書已取消。
          {p.refund_due ? (p.refunded_at ? ` 已退款 ${nt(p.refund_amount ?? p.refund_due)}。` : ` 應退金額 ${nt(p.refund_due)}，我們會以轉帳退款，完成後寄信通知你。`) : ''}
          {!isAddon && ' 數位版報告不受影響。'}
        </Alert>
      )}

      {p.status === 'awaiting_customization' && (
        <p className="mt-4 text-sm text-text">
          付款已確認。接下來會用這份報告的完整內容做整本書預覽，讓你設計封面、扉頁並標註想修改的地方（功能即將開放，開放後會寄信通知你）。
        </p>
      )}

      {error && <Alert tone="error" className="mt-4">{error}</Alert>}
      {canCancel && (
        <div className="mt-5 border-t border-line pt-4">
          <p className="text-caption text-muted">確認送印前都可以取消實體書。</p>
          {confirming ? (
            <div className="mt-2 space-y-3">
              <p className="text-sm text-text">
                {isAddon
                  ? `確定要取消這筆實體書加購嗎？${order.status === 'paid' ? '已付款的實體書金額會以轉帳退還。' : ''}`
                  : '確定要取消實體書嗎？數位版報告照常交付，實體書的金額會以轉帳退還。'}
              </p>
              <div className="flex flex-wrap gap-2">
                <BrandButton variant="soft" size="S" onClick={() => setConfirming(false)}>不要取消</BrandButton>
                <BrandButton variant="primary" size="S" onClick={cancel} disabled={busy}>{busy ? '處理中…' : '確定取消實體書'}</BrandButton>
              </div>
            </div>
          ) : (
            <BrandButton variant="soft" size="S" onClick={() => setConfirming(true)} className="mt-2">取消實體書</BrandButton>
          )}
        </div>
      )}
    </section>
  );
}

export function ConsultStatus({ order }: { order: ReportOrderSummary }) {
  const c = order.consult;
  if (!c) return null;
  return (
    <section className={clsx(cardCls, 'mt-6')} aria-labelledby="consult-title">
      <div className="flex items-center gap-2">
        <MessageCircle className="h-5 w-5 text-blue-500" strokeWidth={2} aria-hidden="true" />
        <h2 id="consult-title" className={cardTitleCls}>專人解讀</h2>
        <span className="ml-auto rounded-full bg-tint px-3 py-1.5 text-[13px] leading-none text-text">{c.status_label}</span>
      </div>
      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted">次數</dt><dd className="text-ink">{c.sessions} 次（共 {c.sessions * c.minutes} 分鐘）</dd>
        {c.scheduled_at && <><dt className="text-muted">約定時間</dt><dd className="text-ink">{fmtDateTime(c.scheduled_at)}</dd></>}
      </dl>
      {c.status === 'to_schedule' && <p className="mt-4 text-sm text-text">付款已確認，我們會以 Email 或電話跟你約時間。</p>}
      {c.status === 'cancelled' && (
        <Alert tone="info" className="mt-4">
          專人解讀已取消。{c.refund_due ? (c.refunded_at ? '已完成退款。' : `應退金額 ${nt(c.refund_due)}，我們會以轉帳退款。`) : ''}
        </Alert>
      )}
    </section>
  );
}

export function AddonSection({ order }: { order: ReportOrderSummary }) {
  const offer = order.addon_offer;
  const addons = order.addons ?? [];
  if (!offer?.physical && !offer?.consult && addons.length === 0) return null;
  const base = `/report/orders/${order.order_no}/addon`;

  return (
    <>
      {addons.length > 0 && (
        <section className={clsx(cardCls, 'mt-6')} aria-labelledby="addons-title">
          <h2 id="addons-title" className={cardTitleCls}>已加購</h2>
          <ul className="mt-3 divide-y divide-line text-sm">
            {addons.map((a) => (
              <li key={a.order_no} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3">
                <Link href={`/report/orders/${a.order_no}`} className="font-latin text-blue-600 underline-offset-[3px] hover:underline">
                  {a.order_no}
                </Link>
                <span className="text-text">
                  {[a.physical && `實體書 ${a.physical.quantity} 本`, a.consult && `專人解讀 ${a.consult.sessions} 次`].filter(Boolean).join('＋')}
                  ・{nt(a.amount)}
                </span>
                <span className="ml-auto rounded-full bg-tint px-3 py-1 text-[13px] text-text">
                  {a.order_status === 'pending' ? '待付款' : a.order_status === 'cancelled' ? '已取消'
                    : [a.physical?.status_label, a.consult?.status_label].filter(Boolean).join('・')}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {offer?.physical && (
        <section className={clsx(cardCls, 'mt-6')}>
          <h2 className={cardTitleCls}>{order.item?.variant === 'physical' || addons.some((a) => a.physical) ? '再加購實體書' : '加購實體書'}</h2>
          <p className="mt-2 text-sm text-text">
            把這份報告印成實體書，可以選規格、數量與特殊客製，付款前用整本書的預覽確認內容。
          </p>
          <Link href={base} className={brandButton({ variant: 'primary', className: 'mt-5' })}>
            <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" /> 加購實體書
          </Link>
        </section>
      )}

      {offer?.consult && (
        <section className={clsx(cardCls, 'mt-6')}>
          <h2 className={cardTitleCls}>加購專人解讀</h2>
          <p className="mt-2 text-sm text-text">由專人陪你一起讀這份報告，付款後我們以 Email 或電話跟你約時間。</p>
          <Link href={`${base}?item=consult`} className={brandButton({ variant: 'soft', className: 'mt-5' })}>
            <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" /> 加購專人解讀
          </Link>
        </section>
      )}
    </>
  );
}
