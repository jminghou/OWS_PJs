'use client';

/**
 * 訂單頁的實體書與專人解讀區塊：
 * - PhysicalStatus：這張訂單的實體書進度（實體書版或加購訂單）、取消、退款狀態
 * - ConsultStatus：這張訂單的專人解讀（待安排時可填方便的時段／已約時間／已完成）
 * - AddonSection：原報告訂單底下「加購實體書」「加購專人解讀」入口與已加購的訂單
 */
import Link from 'next/link';
import { useState } from 'react';
import { clsx } from 'clsx';
import { BookOpen, MessageCircle, Plus } from 'lucide-react';
import Alert from '@/components/ui/Alert';
import BrandButton, { brandButton } from '@/components/ui/BrandButton';
import { reportOrdersApi, type ReportOrderSummary } from '@/lib/api';
import { CONSULT_PERIOD_LABELS, type ConsultPeriod } from '@/lib/api/reportOrders';

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
  const needsActivation = order.commerce?.entitlements.some((e) =>
    e.kind === 'book' && e.activation && e.activation.status !== 'redeemed');

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
        needsActivation ? <p className="mt-4 text-sm text-text">請先在訂單頁兌換書籍啟用碼，再開始設計。</p> : p.report_ready ? (
          <div className="mt-4 rounded-inner bg-blue-50 p-4">
            <p className="text-sm text-blue-800">
              {p.design_status === 'submitted'
                ? '你已經開始設計了。檢查一下整本書，沒問題就按「確認內容」，我們就開始製作打樣。'
                : '報告完成了！用整本書的預覽設計封面、扉頁，並標註想修改的地方。'}
            </p>
            <Link href={`/report/orders/${order.order_no}/design`} className={brandButton({ variant: 'primary', size: 'S', className: 'mt-3' })}>
              {p.design_status === 'submitted' ? '繼續設計並確認內容' : '開始設計你的書'}
            </Link>
          </div>
        ) : (
          <p className="mt-4 text-sm text-text">
            付款已確認。報告完成後，我們會寄信請你用整本書的預覽設計封面、扉頁，並標註想修改的地方。
          </p>
        )
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

const INPUT_CLS =
  'w-full rounded-2xl border-[1.5px] border-line-strong bg-white px-4 py-2.5 text-base text-ink ' +
  'focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100';
const isoDay = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const fmtSlot = (s: { date: string; period: ConsultPeriod }) =>
  `${new Date(`${s.date}T00:00:00`).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric', weekday: 'short' })} ${CONSULT_PERIOD_LABELS[s.period]}`;

/** 會員填方便的時段（最多 3 個）＋備註，給我們約時間參考 */
function ConsultPreferenceForm({ order, onUpdated, onDone }: {
  order: ReportOrderSummary; onUpdated: (o: ReportOrderSummary) => void; onDone: () => void;
}) {
  const saved = order.consult?.preferences;
  const [slots, setSlots] = useState<{ date: string; period: ConsultPeriod }[]>(
    saved?.slots.length ? saved.slots : [{ date: '', period: 'afternoon' }]);
  const [note, setNote] = useState(saved?.note ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (i: number, patch: Partial<{ date: string; period: ConsultPeriod }>) =>
    setSlots((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const submit = async () => {
    const filled = slots.filter((x) => x.date);
    if (!filled.length) {
      setError('請至少選一個日期');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const r = await reportOrdersApi.consultPreferences(order.order_no, { slots: filled, note });
      onUpdated(r.order);
      onDone();
    } catch (e: any) {
      setError(e.message || '送出失敗，請稍後再試');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 space-y-3 rounded-inner bg-tint p-4">
      <p className="text-sm text-text">選 1–3 個你方便的時段（明天起 60 天內），我們會從中挑一個跟你確認。</p>
      {slots.map((x, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2">
          <input type="date" aria-label={`第 ${i + 1} 個日期`} className={clsx(INPUT_CLS, 'w-auto flex-1 font-latin')}
            min={isoDay(1)} max={isoDay(60)} value={x.date} onChange={(e) => set(i, { date: e.target.value })} />
          <select aria-label={`第 ${i + 1} 個時段`} className={clsx(INPUT_CLS, 'w-auto')} value={x.period}
            onChange={(e) => set(i, { period: e.target.value as ConsultPeriod })}>
            {(Object.keys(CONSULT_PERIOD_LABELS) as ConsultPeriod[]).map((k) => <option key={k} value={k}>{CONSULT_PERIOD_LABELS[k]}</option>)}
          </select>
          {slots.length > 1 && (
            <button type="button" onClick={() => setSlots((xs) => xs.filter((_, j) => j !== i))}
              className="min-h-[44px] px-2 text-sm text-muted hover:text-ink">移除</button>
          )}
        </div>
      ))}
      {slots.length < 3 && (
        <button type="button" onClick={() => setSlots((xs) => [...xs, { date: '', period: 'afternoon' }])}
          className="inline-flex min-h-[44px] items-center gap-1 text-sm text-blue-500 hover:underline">
          <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" /> 再加一個時段
        </button>
      )}
      <textarea rows={2} maxLength={500} className={INPUT_CLS} value={note} onChange={(e) => setNote(e.target.value)}
        placeholder="想先讓我們知道的事（選填），例如：平日 19:00 後、想聚焦感情與工作" aria-label="備註" />
      {error && <Alert tone="error">{error}</Alert>}
      <div className="flex flex-wrap gap-2">
        <BrandButton variant="primary" size="S" onClick={submit} disabled={busy}>{busy ? '送出中…' : '送出時段'}</BrandButton>
        {saved && <BrandButton variant="soft" size="S" onClick={onDone}>取消</BrandButton>}
      </div>
    </div>
  );
}

export function ConsultStatus({ order, onUpdated }: { order: ReportOrderSummary; onUpdated?: (o: ReportOrderSummary) => void }) {
  const c = order.consult;
  const [editing, setEditing] = useState(false);
  if (!c) return null;
  const prefs = c.preferences;
  const canEdit = c.status === 'to_schedule' && !!onUpdated;
  const needsActivation = order.commerce?.entitlements.some((e) =>
    e.kind === 'consult' && e.activation && e.activation.status !== 'redeemed');
  return (
    <section id="consult" className={clsx(cardCls, 'mt-6 scroll-mt-24')} aria-labelledby="consult-title">
      <div className="flex items-center gap-2">
        <MessageCircle className="h-5 w-5 text-blue-500" strokeWidth={2} aria-hidden="true" />
        <h2 id="consult-title" className={cardTitleCls}>專人解讀</h2>
        <span className="ml-auto rounded-full bg-tint px-3 py-1.5 text-[13px] leading-none text-text">{c.status_label}</span>
      </div>
      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted">次數</dt><dd className="text-ink">{c.sessions} 次（共 {c.sessions * c.minutes} 分鐘）</dd>
        {c.scheduled_at && <><dt className="text-muted">約定時間</dt><dd className="text-ink">{fmtDateTime(c.scheduled_at)}</dd></>}
        {prefs && c.status === 'to_schedule' && (
          <>
            <dt className="text-muted">你方便的時段</dt>
            <dd className="text-ink">{prefs.slots.map(fmtSlot).join('、')}{prefs.note && <span className="block text-text">{prefs.note}</span>}</dd>
          </>
        )}
      </dl>
      {c.status === 'to_schedule' && (
        canEdit && (editing || !prefs) ? (
          <ConsultPreferenceForm order={order} onUpdated={onUpdated!} onDone={() => setEditing(false)} />
        ) : (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <p className="text-sm text-text">{prefs ? '收到你的時段了，我們會盡快以 Email 跟你確認時間。' : '付款已確認，我們會以 Email 或電話跟你約時間。'}</p>
            {canEdit && <BrandButton variant="soft" size="S" onClick={() => setEditing(true)}>修改時段</BrandButton>}
          </div>
        )
      )}
      {c.status === 'to_schedule' && needsActivation && <p className="mt-3 text-sm text-text">可先填寫方便的時段；完成啟用後，我們才能安排解讀。</p>}
      {c.status === 'scheduled' && <p className="mt-4 text-sm text-text">需要更改時間，請直接回覆確認信。</p>}
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

/** 報告完成：線上閱讀／下載 PDF（短效網址，每次點擊重新取得） */
export function ReportDownload({ order }: { order: ReportOrderSummary }) {
  const [busy, setBusy] = useState<'' | 'read' | 'download'>('');
  const [error, setError] = useState('');
  const doc = order.report;
  if (!doc) return null;

  const open = async (mode: 'read' | 'download') => {
    setBusy(mode);
    setError('');
    // 先開新分頁再填網址，避免瀏覽器把非同步開啟的視窗擋掉
    const win = mode === 'read' ? window.open('', '_blank') : null;
    try {
      const { url } = await reportOrdersApi.reportPdfLink(order.order_no);
      if (mode === 'read' && win) win.location.href = url;
      else window.location.assign(`${url}?download=1`);
    } catch (e: any) {
      win?.close();
      setError(e.message || '暫時無法取得報告，請稍後再試');
    } finally {
      setBusy('');
    }
  };

  return (
    <section className={clsx(cardCls, 'mt-6')} aria-labelledby="report-title">
      <h2 id="report-title" className={cardTitleCls}>你的報告完成了</h2>
      <p className="mt-2 text-sm text-text">
        {doc.filename}・{(doc.bytes / 1024 / 1024).toFixed(1)} MB{doc.uploaded_at ? `・${fmtDateTime(doc.uploaded_at)}` : ''}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <BrandButton variant="primary" size="S" onClick={() => open('read')} disabled={!!busy}>{busy === 'read' ? '開啟中…' : '線上閱讀'}</BrandButton>
        <BrandButton variant="soft" size="S" onClick={() => open('download')} disabled={!!busy}>{busy === 'download' ? '準備中…' : '下載 PDF'}</BrandButton>
      </div>
      {error && <Alert tone="error" className="mt-4">{error}</Alert>}
    </section>
  );
}
