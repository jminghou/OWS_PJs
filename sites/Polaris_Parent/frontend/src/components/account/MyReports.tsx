'use client';

/**
 * 會員中心「我的報告」：一份報告一張卡，報告本身的進度與下載在上面，
 * 實體書、專人解讀（下單時一起買的與事後加購的）列在同一張卡裡，各自顯示進度與下一步。
 */
import Link from 'next/link';
import { useState } from 'react';
import { BookOpen, FileText, MessageCircle } from 'lucide-react';
import { clsx } from 'clsx';
import Alert from '@/components/ui/Alert';
import BrandButton, { brandButton } from '@/components/ui/BrandButton';
import { reportOrdersApi, type ReportOrderSummary } from '@/lib/api';
import type { ConsultView, PhysicalView } from '@/lib/api/reportOrders';
import { fmtDate, fmtDateTime, groupReports, orderHref, type ReportGroup } from './orderModel';

const REPORT_STEPS = ['付款', '製作中', '報告完成'];
const BOOK_STEPS: { label: string; keys: string[] }[] = [
  { label: '付款', keys: ['awaiting_payment'] },
  { label: '設計', keys: ['awaiting_customization'] },
  { label: '打樣', keys: ['awaiting_proof', 'proof_ready', 'changes_requested'] },
  { label: '印製', keys: ['approved', 'printing'] },
  { label: '出貨', keys: ['shipped', 'delivered'] },
];

/** 橫向進度：已完成實心、目前這步外圈、未到空心；done=true 表示全部完成 */
function Progress({ steps, current, done = false }: { steps: string[]; current: number; done?: boolean }) {
  return (
    <ol className="flex items-center gap-1.5 text-[12px] md:text-[13px]" aria-label="進度">
      {steps.map((s, i) => {
        const past = done || i < current;
        const now = !done && i === current;
        return (
          <li key={s} className="flex items-center gap-1.5" aria-current={now ? 'step' : undefined}>
            {i > 0 && <span className={clsx('h-px w-3 md:w-5', past || now ? 'bg-blue-300' : 'bg-line')} aria-hidden="true" />}
            <span className={clsx('h-2.5 w-2.5 shrink-0 rounded-full',
              past ? 'bg-blue-500' : now ? 'bg-white ring-[3px] ring-blue-500' : 'bg-line')} aria-hidden="true" />
            <span className={clsx('whitespace-nowrap', now ? 'font-medium text-ink' : past ? 'text-text' : 'text-muted')}>{s}</span>
          </li>
        );
      })}
    </ol>
  );
}

function bookAction(o: ReportOrderSummary, p: PhysicalView): { href: string; label: string } | null {
  if (o.status === 'pending') return { href: orderHref(o), label: '前往付款' };
  if (p.status === 'awaiting_customization' && p.report_ready) {
    return { href: `/report/orders/${o.order_no}/design`, label: p.design_status === 'submitted' ? '繼續設計' : '設計你的書' };
  }
  if (p.status === 'proof_ready') return { href: orderHref(o), label: '確認打樣' };
  return null;
}

function consultText(c: ConsultView) {
  if (c.status === 'scheduled' && c.scheduled_at) return `約定 ${fmtDateTime(c.scheduled_at)}`;
  if (c.status === 'to_schedule') return c.preferences ? '已收到你的時段，等待確認' : '請選幾個方便的時段';
  return c.status_label;
}

/** 卡片裡的一列：實體書或專人解讀 */
function SubRow({ icon: Icon, title, children, action, href }: {
  icon: typeof BookOpen; title: string; children: React.ReactNode; action?: { href: string; label: string } | null; href: string;
}) {
  return (
    <li className="flex flex-col gap-2 border-t border-line py-3 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Link href={href} className="inline-flex items-center gap-2 text-sm font-medium text-ink hover:text-blue-500">
          <Icon className="h-4 w-4 text-blue-500" strokeWidth={2} aria-hidden="true" />{title}
        </Link>
        {children}
      </div>
      {action && <Link href={action.href} className={brandButton({ variant: 'primary', size: 'S', className: 'self-start sm:self-auto' })}>{action.label}</Link>}
    </li>
  );
}

function ReportCard({ group }: { group: ReportGroup }) {
  const { report: m, addons } = group;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const cancelled = m.status === 'cancelled';
  const isReport = m.item?.kind === 'purchase';
  const step = m.status === 'pending' ? 0 : m.report ? 2 : 1;

  const openPdf = async () => {
    setBusy(true);
    setError('');
    const win = window.open('', '_blank');  // 先開分頁，避免非同步開啟被擋
    try {
      const { url } = await reportOrdersApi.reportPdfLink(m.order_no);
      if (win) win.location.href = url;
      else window.location.assign(url);
    } catch (e: any) {
      win?.close();
      setError(e.message || '暫時無法取得報告，請稍後再試');
    } finally {
      setBusy(false);
    }
  };

  // 下單時一起買的與事後加購的，依時間排
  const subOrders = [m, ...[...addons].reverse()].filter((o) => o.status !== 'cancelled' || o === m);
  const books = subOrders.filter((o) => o.physical && o.physical.status !== 'cancelled');
  const consults = subOrders.filter((o) => o.consult && o.consult.status !== 'cancelled');
  const who = [m.item?.subject_name, m.item?.call_name && m.item.call_name !== m.item.subject_name ? `（${m.item.call_name}）` : '']
    .filter(Boolean).join('');

  return (
    <article className="rounded-card bg-white p-5 md:p-7">
      <div className="flex flex-wrap items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-500">
          <FileText className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-heading text-[18px] font-normal text-ink md:text-h4">{isReport ? m.item?.name : '加購'}{who && <span className="text-text">・{who}</span>}</h3>
          <p className="mt-0.5 text-caption text-muted">
            <Link href={orderHref(m)} className="font-latin hover:text-blue-500 hover:underline">{m.order_no}</Link>・{fmtDate(m.created_at)}
          </p>
        </div>
        {cancelled && <span className="rounded-full bg-tint px-3 py-1.5 text-[13px] leading-none text-text">已取消</span>}
      </div>

      {!cancelled && isReport && (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Progress steps={REPORT_STEPS} current={step} done={!!m.report} />
          <div className="flex flex-wrap gap-2">
            {m.status === 'pending' && <Link href={orderHref(m)} className={brandButton({ variant: 'primary', size: 'S' })}>前往付款</Link>}
            {m.report && <BrandButton variant="primary" size="S" onClick={openPdf} disabled={busy}>{busy ? '開啟中…' : '閱讀報告'}</BrandButton>}
            <Link href={orderHref(m)} className={brandButton({ variant: 'soft', size: 'S' })}>訂單詳情</Link>
          </div>
        </div>
      )}
      {error && <Alert tone="error" className="mt-3">{error}</Alert>}

      {(books.length > 0 || consults.length > 0) && (
        <ul className="mt-4">
          {books.map((o) => {
            const p = o.physical!;
            const current = BOOK_STEPS.findIndex((s) => s.keys.includes(p.status));
            return (
              <SubRow key={`b-${o.order_no}`} icon={BookOpen} href={orderHref(o)} action={bookAction(o, p)}
                title={`實體書 × ${p.quantity} 本${o !== m ? '・加購' : ''}`}>
                <Progress steps={BOOK_STEPS.map((s) => s.label)} current={Math.max(0, current)} done={p.status === 'delivered'} />
              </SubRow>
            );
          })}
          {consults.map((o) => {
            const c = o.consult!;
            const action = o.status === 'pending' ? { href: orderHref(o), label: '前往付款' }
              : c.status === 'to_schedule' && !c.preferences ? { href: orderHref(o, '#consult'), label: '填寫時段' } : null;
            return (
              <SubRow key={`c-${o.order_no}`} icon={MessageCircle} href={orderHref(o, '#consult')} action={action}
                title={`專人解讀 × ${c.sessions} 次${o !== m ? '・加購' : ''}`}>
                <p className="text-[13px] text-text">{o.status === 'pending' ? '待付款' : consultText(c)}</p>
              </SubRow>
            );
          })}
        </ul>
      )}

      {m.addon_offer?.available && (m.addon_offer.physical || m.addon_offer.consult) && (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
          {m.addon_offer.physical && (
            <Link href={`/report/orders/${m.order_no}/addon`} className={brandButton({ variant: 'soft', size: 'S' })}>
              <BookOpen className="h-4 w-4" strokeWidth={2} aria-hidden="true" />加購實體書
            </Link>
          )}
          {m.addon_offer.consult && (
            <Link href={`/report/orders/${m.order_no}/addon?item=consult`} className={brandButton({ variant: 'soft', size: 'S' })}>
              <MessageCircle className="h-4 w-4" strokeWidth={2} aria-hidden="true" />預約專人解讀
            </Link>
          )}
        </div>
      )}
    </article>
  );
}

export default function MyReports({ orders }: { orders: ReportOrderSummary[] }) {
  const groups = groupReports(orders);
  if (!groups.length) {
    return (
      <div className="rounded-card bg-white p-8 text-center">
        <FileText className="mx-auto h-8 w-8 text-muted" strokeWidth={1.5} aria-hidden="true" />
        <p className="mt-3 text-text">還沒有報告。</p>
        <Link href="/report" className={brandButton({ variant: 'primary', size: 'S', className: 'mt-4' })}>看客製報告</Link>
      </div>
    );
  }
  return <div className="space-y-4">{groups.map((g) => <ReportCard key={g.report.order_no} group={g} />)}</div>;
}
