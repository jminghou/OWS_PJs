'use client';

/**
 * 會員中心「專人解讀」分頁（2026-10-28）：專人解讀從所有購買流程拉出來，只在這裡預約。
 *
 * 專人解讀一律以「一本書」為中心——數位報告或實體書都可以，要先選一本書，解讀就圍繞那本書的內容展開。
 *   ① 說明：怎麼進行、時長與價格
 *   ② 已預約的解讀：狀態、方便的時段（付款前與排定前都能改）
 *   ③ 預約：選書 → 次數 → 1–3 個方便的時段與想聊的重點 → 同意條款 → 建立待付款訂單（連回那本書）
 * 後端：POST /report-orders/:書的訂單號/addons（consult_sessions＋consult_preferences），付款與排定沿用既有流程。
 */
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { BookOpen, CalendarClock, MessageCircle } from 'lucide-react';
import { clsx } from 'clsx';
import Alert from '@/components/ui/Alert';
import BrandButton, { brandButton } from '@/components/ui/BrandButton';
import EmailVerifyBox from '@/components/report/EmailVerifyBox';
import { ConsultSlotsFields, ConsultStatus, EMPTY_SLOT, type ConsultSlot } from '@/components/report/orders/PhysicalSections';
import { memberAccountApi, reportOrdersApi, type ReportOrderSummary } from '@/lib/api';
import type { PhysicalConfig } from '@/lib/api/reportOrders';
import { POLICY_VERSION } from '@/lib/report/catalog';
import { newSubmissionKey } from '@/lib/report/draft';
import { OFFER_HREFS, OFFER_NAMES } from '@/lib/report/offers';
import { bookTitle, nt, ownedBooks, reportStatusText } from './orderModel';

const cardCls = 'rounded-card bg-white p-6 md:p-8';
const titleCls = 'font-heading text-[18px] font-normal text-ink md:text-h4';
const SELECT_CLS =
  'w-full rounded-2xl border-[1.5px] border-line-strong bg-white px-4 py-2.5 text-base text-ink ' +
  'focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100';

export default function ConsultTab({ orders, initialBook, onChanged }: {
  orders: ReportOrderSummary[];
  /** 從書的頁面「預約專人解讀」進來時預選的書（訂單號） */
  initialBook?: string | null;
  onChanged: () => void;
}) {
  const [cfg, setCfg] = useState<PhysicalConfig | null | undefined>(undefined);
  const [payMode, setPayMode] = useState<{ mode: string; available: boolean; deadline_days: number | null } | null>(null);
  const [verification, setVerification] = useState<{ email: string; verified: boolean } | null>(null);

  useEffect(() => {
    reportOrdersApi.physicalConfig().then((r) => setCfg(r.config)).catch(() => setCfg(null));
    reportOrdersApi.paymentMode().then(setPayMode).catch(() => setPayMode(null));
    memberAccountApi.getVerification()
      .then((v) => setVerification({ email: v.email, verified: v.email_verified }))
      .catch(() => setVerification({ email: '', verified: false }));
  }, []);

  const books = useMemo(() => ownedBooks(orders), [orders]);
  const byNo = useMemo(() => new Map(orders.map((o) => [o.order_no, o])), [orders]);
  // 已預約的解讀：有專人解讀的訂單（新的在前）
  const booked = useMemo(() => orders.filter((o) => o.consult && o.status !== 'cancelled'), [orders]);
  const consult = cfg?.consult ?? null;

  return (
    <div className="space-y-6">
      {/* ① 說明 */}
      <section className={cardCls}>
        <div className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-blue-500" strokeWidth={2} aria-hidden="true" />
          <h2 className={titleCls}>{OFFER_NAMES.consult}是什麼？</h2>
        </div>
        <div className="mt-3 space-y-2 text-sm leading-relaxed text-text">
          <p>
            {OFFER_NAMES.consult}一定是圍繞「一本書」進行的：你先選一本已經買過的書（{OFFER_NAMES.digital}或{OFFER_NAMES.book}都可以），
            老師會先讀過這本書，解讀時就從書裡的內容出發，陪你把看不懂、想深入的地方聊清楚。
          </p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>選一本書，決定要預約幾次。</li>
            <li>留下 1–3 個你方便的時段，以及想聊的重點（例如書裡的哪幾章）。</li>
            <li>完成付款後，我們依你的時段安排，並以 Email 確認時間。</li>
            <li>約定時間到了，一對一進行；需要改時間，直接回覆確認信。</li>
          </ol>
          {consult && (
            <p className="text-muted">
              每次 <span className="font-latin">{consult.minutes}</span> 分鐘・<span className="font-latin">{nt(consult.price, cfg?.currency)}</span>・
              一次最多預約 <span className="font-latin">{consult.max_sessions}</span> 次
            </p>
          )}
        </div>
      </section>

      {/* ② 已預約的解讀 */}
      {booked.length > 0 && (
        <section className="space-y-3">
          <h2 className={titleCls}>已預約的解讀</h2>
          {booked.map((o) => {
            const book = o.item?.parent_order_no ? byNo.get(o.item.parent_order_no) : o;
            return (
              <div key={o.order_no}>
                <p className="flex items-center gap-2 text-sm text-text">
                  <BookOpen className="h-4 w-4 text-blue-500" strokeWidth={2} aria-hidden="true" />
                  {book ? bookTitle(book) : o.item?.subject_name}
                  {o.status === 'pending' && (
                    <Link href={`/report/orders/${o.order_no}`} className="ml-auto text-blue-700 hover:underline">去付款</Link>
                  )}
                </p>
                <ConsultStatus order={o} onUpdated={onChanged} />
              </div>
            );
          })}
        </section>
      )}

      {/* ③ 預約 */}
      {cfg === undefined || !verification ? (
        <p className="text-muted">載入中…</p>
      ) : !consult ? (
        <Alert tone="info">{OFFER_NAMES.consult}目前還沒有開放預約，敬請期待。</Alert>
      ) : books.length === 0 ? (
        <section className={cardCls}>
          <h2 className={titleCls}>預約{OFFER_NAMES.consult}</h2>
          <p className="mt-2 text-sm text-text">{OFFER_NAMES.consult}要先有一本書。先買一份報告，完成付款後就能回來預約。</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href={OFFER_HREFS.digital} className={brandButton({ variant: 'primary', size: 'S' })}>購買{OFFER_NAMES.digital}</Link>
            <Link href={OFFER_HREFS.book} className={brandButton({ variant: 'soft', size: 'S' })}>購買{OFFER_NAMES.book}</Link>
          </div>
        </section>
      ) : (
        <BookingForm books={books} cfg={cfg!} initialBook={initialBook} verification={verification}
          onVerified={() => setVerification((v) => (v ? { ...v, verified: true } : v))}
          payMode={payMode} onBooked={onChanged} />
      )}
    </div>
  );
}

function BookingForm({ books, cfg, initialBook, verification, onVerified, payMode, onBooked }: {
  books: ReturnType<typeof ownedBooks>;
  cfg: PhysicalConfig;
  initialBook?: string | null;
  verification: { email: string; verified: boolean };
  onVerified: () => void;
  payMode: { mode: string; available: boolean; deadline_days: number | null } | null;
  onBooked: () => void;
}) {
  const consult = cfg.consult!;
  const firstOk = books.find((b) => b.canConsult && b.order.order_no === initialBook) ?? null;
  const [bookNo, setBookNo] = useState<string>(firstOk?.order.order_no ?? '');
  const [sessions, setSessions] = useState(1);
  const [slots, setSlots] = useState<ConsultSlot[]>([EMPTY_SLOT]);
  const [note, setNote] = useState('');
  const [consented, setConsented] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<string | null>(null);
  const [key, setKey] = useState(newSubmissionKey);

  const total = consult.price * sessions;
  const manualOpen = payMode?.mode === 'manual' && payMode.available;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!bookNo) return setError('請先選一本書');
    const filled = slots.filter((x) => x.date);
    if (!filled.length) return setError('請至少選一個方便的日期');
    if (!consented) return setError('請先閱讀並同意交易政策');
    setBusy(true);
    try {
      const r = await reportOrdersApi.createAddon(bookNo, {
        submission_key: key, policy_consented: true, policy_version: POLICY_VERSION,
        consult_sessions: sessions, consult_preferences: { slots: filled, note },
      });
      setDone(r.order.order_no);
      setKey(newSubmissionKey());
      setSlots([EMPTY_SLOT]);
      setNote('');
      setConsented(false);
      onBooked();
    } catch (err: any) {
      const errs = Object.values((err.errors || {}) as Record<string, string>);
      setError(errs.length ? errs.join('；') : err.message || '預約失敗，請稍後再試');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className={clsx(cardCls, 'space-y-6')}>
      <div className="flex items-center gap-2">
        <CalendarClock className="h-5 w-5 text-blue-500" strokeWidth={2} aria-hidden="true" />
        <h2 className={titleCls}>預約{OFFER_NAMES.consult}</h2>
      </div>
      {!verification.verified && <EmailVerifyBox email={verification.email} onVerified={onVerified} />}
      {done && (
        <Alert tone="success">
          預約已送出。完成付款後我們就會安排時間——
          <Link href={`/report/orders/${done}`} className="ml-1 underline">查看這筆預約與付款方式</Link>
        </Alert>
      )}

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink">1. 選一本書</legend>
        <div className="space-y-2">
          {books.map((b) => (
            <label key={b.order.order_no}
              className={clsx('flex items-start gap-3 rounded-inner border-[1.5px] p-4',
                !b.canConsult ? 'cursor-not-allowed border-transparent bg-tint opacity-70'
                  : bookNo === b.order.order_no ? 'cursor-pointer border-blue-500 bg-blue-50' : 'cursor-pointer border-line hover:border-blue-500')}>
              <input type="radio" name="consult-book" className="mt-1" disabled={!b.canConsult}
                checked={bookNo === b.order.order_no} onChange={() => setBookNo(b.order.order_no)} />
              <span className="min-w-0">
                <span className="block font-medium text-ink">{bookTitle(b.order)}</span>
                <span className="block text-sm text-text">
                  {b.isPhysical ? `${OFFER_NAMES.digital}＋${OFFER_NAMES.book}` : OFFER_NAMES.digital}・{reportStatusText(b.order)}
                </span>
                {b.external && <span className="block text-caption text-muted">在外部平台購買的書，請透過原平台與我們預約。</span>}
                {!b.external && !b.order.report && b.canConsult && (
                  <span className="block text-caption text-muted">書還在製作中：可以先預約，解讀會排在書完成之後。</span>
                )}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="consult-sessions" className="mb-2 block text-sm font-medium text-ink">2. 預約幾次</label>
        <select id="consult-sessions" className={clsx(SELECT_CLS, 'w-auto')} value={sessions}
          onChange={(e) => setSessions(Number(e.target.value))}>
          {Array.from({ length: consult.max_sessions }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>{n} 次（共 {n * consult.minutes} 分鐘）</option>
          ))}
        </select>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium text-ink">3. 你方便的時段與想聊的重點</p>
        <p className="text-sm text-text">選 1–3 個方便的時段（明天起 60 天內），我們會從中挑一個跟你確認；付款前、排定前都還能改。</p>
        <ConsultSlotsFields slots={slots} onSlots={setSlots} note={note} onNote={setNote} />
      </div>

      <div className="rounded-inner bg-tint px-4 py-3 text-sm text-text">
        <p>合計 <span className="font-latin font-extrabold text-ink">{nt(total, cfg.currency)}</span></p>
        <p className="mt-1">
          {manualOpen
            ? `銀行轉帳。送出後會顯示匯款帳號，請於 ${payMode?.deadline_days} 天內轉帳並回報轉出帳號末五碼。`
            : payMode?.mode === 'manual'
              ? '目前暫停接受預約，請稍後再試。'
              : '付款功能尚未開放。送出後預約會保留為「待付款」，開放付款後我們會以 Email 通知你。'}
        </p>
      </div>

      <label className="flex cursor-pointer items-start gap-3 text-sm leading-6 text-text">
        <input type="checkbox" checked={consented} onChange={(e) => setConsented(e.target.checked)} className="mt-1" />
        <span>
          我了解{OFFER_NAMES.consult}依
          <Link href="/report/policy" target="_blank" className="text-blue-500 underline-offset-[3px] hover:underline">《交易政策》</Link>
          處理。
        </span>
      </label>

      {error && <Alert tone="error">{error}</Alert>}
      <BrandButton type="submit" variant="primary" className="w-full sm:w-auto"
        disabled={busy || !bookNo || !consented || !verification.verified || payMode?.available === false}>
        {busy ? '送出中…' : `送出預約（${nt(total, cfg.currency)}）`}
      </BrandButton>
    </form>
  );
}
