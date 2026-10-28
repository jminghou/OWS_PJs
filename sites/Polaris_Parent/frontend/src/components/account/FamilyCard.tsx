'use client';

/**
 * 會員中心「我的家」：一位家人一張卡。
 * 卡頭是名字、關係與「看命盤」；底下每份報告是一張作品卡（書封＋一句話進度＋主按鈕），
 * 實體書、專人解讀掛在作品卡裡，各自一句話說明現在到哪、要不要你動手。
 * 訂單號不放在卡片上，需要時從「訂單詳情」進去看。
 */
import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight, BookOpen, MessageCircle, Settings2 } from 'lucide-react';
import Alert from '@/components/ui/Alert';
import BrandButton, { brandButton } from '@/components/ui/BrandButton';
import { LogoMark } from '@/components/ui/BrandLogo';
import Tag from '@/components/ui/Tag';
import { reportOrdersApi, type ReportOrderSummary } from '@/lib/api';
import type { MyChart } from '@/lib/api/astrology';
import type { ConsultView, PhysicalView } from '@/lib/api/reportOrders';
import { OFFER_HREFS, OFFER_NAMES } from '@/lib/report/offers';
import {
  bookStatusText, fmtDateTime, orderHref, orderTitle, relLabel, reportStatusText,
  type FamilyMember, type ReportGroup,
} from './orderModel';

function bookAction(o: ReportOrderSummary, p: PhysicalView): { href: string; label: string } | null {
  if (o.status === 'pending') return { href: orderHref(o), label: '去付款' };
  if (p.status === 'awaiting_customization' && p.report_ready) {
    return { href: `/report/orders/${o.order_no}/design`, label: p.design_status === 'submitted' ? '繼續設計' : '設計這本書' };
  }
  if (p.status === 'proof_ready') return { href: orderHref(o), label: '看打樣' };
  return null;
}

function consultText(o: ReportOrderSummary, c: ConsultView) {
  if (o.status === 'pending') return '完成付款後就能約時間';
  if (c.status === 'scheduled' && c.scheduled_at) return `約在 ${fmtDateTime(c.scheduled_at)}，到時候見`;
  if (c.status === 'to_schedule') return c.preferences ? '收到你方便的時間了，我們會盡快跟你確認' : '挑幾個你方便的時間，我們來安排';
  return c.status_label;
}

/** 作品卡左邊的小書封：品牌墨底＋Logo＋主角名字（與 ReportBookCover 同一套配色） */
function MiniCover({ name }: { name: string }) {
  return (
    <div className="relative flex aspect-[3/4] w-20 shrink-0 flex-col items-center justify-center overflow-hidden rounded-l-sm rounded-r-md bg-ink px-2 text-center text-white shadow-md sm:w-24">
      <div className="absolute inset-y-0 left-0 w-[8%] bg-white/10" aria-hidden="true" />
      <LogoMark tone="brand" width={32} alt="" />
      {name && <p className="mt-2 line-clamp-2 font-heading text-[13px] leading-snug">{name}</p>}
    </div>
  );
}

/** 作品卡裡的一列：實體書或專人解讀 */
function SubRow({ icon: Icon, title, text, action }: {
  icon: typeof BookOpen; title: string; text: string; action?: { href: string; label: string } | null;
}) {
  return (
    <li className="flex flex-col gap-2 border-t border-line py-3 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex min-w-0 flex-1 items-start gap-2.5">
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" strokeWidth={2} aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">{title}</p>
          <p className="mt-0.5 text-[13px] text-text">{text}</p>
        </div>
      </div>
      {action && <Link href={action.href} className={brandButton({ variant: 'primary', size: 'S', className: 'self-start sm:self-auto' })}>{action.label}</Link>}
    </li>
  );
}

function WorkCard({ group }: { group: ReportGroup }) {
  const { report: m, addons } = group;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const cancelled = m.status === 'cancelled';
  const isReport = m.item?.kind === 'purchase';
  const who = m.item?.call_name || m.item?.subject_name || '';

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
      setError(e.message || '暫時打不開報告，請稍後再試');
    } finally {
      setBusy(false);
    }
  };

  // 下單時一起買的與事後加購的，依時間排
  const subOrders = [m, ...[...addons].reverse()].filter((o) => o.status !== 'cancelled' || o === m);
  const books = subOrders.filter((o) => o.physical && o.physical.status !== 'cancelled');
  const consults = subOrders.filter((o) => o.consult && o.consult.status !== 'cancelled');
  const offer = m.addon_offer?.available && (m.addon_offer.physical || m.addon_offer.consult) ? m.addon_offer : null;

  return (
    <article className={cancelled ? 'rounded-inner bg-tint p-4 opacity-80 md:p-5' : 'rounded-inner border border-line bg-white p-4 md:p-5'}>
      <div className="flex gap-4">
        {isReport && <MiniCover name={who} />}
        <div className="flex min-w-0 flex-1 flex-col">
          <h3 className="font-heading text-[18px] font-normal text-ink md:text-h4">{isReport ? m.item?.name : orderTitle(m)}</h3>
          <p className="mt-1 text-sm text-text [text-wrap:pretty]">{isReport ? reportStatusText(m) : cancelled ? '這份訂單已取消' : ''}</p>
          <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-2 pt-3">
            {!cancelled && m.status === 'pending' && <Link href={orderHref(m)} className={brandButton({ variant: 'primary', size: 'S' })}>去付款</Link>}
            {m.report && <BrandButton variant="primary" size="S" onClick={openPdf} disabled={busy}>{busy ? '打開中…' : '打開報告'}</BrandButton>}
            <Link href={orderHref(m)} className="text-[13px] text-muted underline-offset-2 hover:text-blue-500 hover:underline">訂單詳情</Link>
          </div>
        </div>
      </div>
      {error && <Alert tone="error" className="mt-3">{error}</Alert>}

      {(books.length > 0 || consults.length > 0) && (
        <ul className="mt-4">
          {books.map((o) => {
            const p = o.physical!;
            return (
              <SubRow key={`b-${o.order_no}`} icon={BookOpen} action={bookAction(o, p)}
                title={`精裝實體書 × ${p.quantity} 本`} text={bookStatusText(o, p)} />
            );
          })}
          {consults.map((o) => {
            const c = o.consult!;
            const action = o.status === 'pending' ? { href: orderHref(o), label: '去付款' }
              : c.status === 'to_schedule' && !c.preferences ? { href: orderHref(o, '#consult'), label: '選時間' } : null;
            return (
              <SubRow key={`c-${o.order_no}`} icon={MessageCircle} action={action}
                title={`專人解讀 × ${c.sessions} 次`} text={consultText(o, c)} />
            );
          })}
        </ul>
      )}

      {offer && (
        <div className="mt-4 rounded-inner bg-tint px-4 py-3.5">
          <p className="text-sm text-text">
            {offer.physical ? '想把這份報告放上書架，或送給長大後的他？' : '讀完還有想問的？'}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1">
            {offer.physical && (
              <Link href={OFFER_HREFS.bookFor(m.order_no)} className="inline-flex items-center gap-1 text-sm font-medium text-blue-700 hover:underline">
                印成精裝書<ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              </Link>
            )}
            {offer.consult && (
              <Link href={OFFER_HREFS.consultFor(m.order_no)} className="inline-flex items-center gap-1 text-sm font-medium text-blue-700 hover:underline">
                預約{OFFER_NAMES.consult}<ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              </Link>
            )}
          </div>
        </div>
      )}
    </article>
  );
}

export default function FamilyCard({ member, onViewChart, viewingChartId, viewBusy, viewer }: {
  member: FamilyMember;
  onViewChart: (c: MyChart) => void;
  /** 目前打開的命盤；是這位家人的就把 viewer 放在卡頭下面 */
  viewingChartId?: string | null;
  viewBusy?: boolean;
  viewer?: React.ReactNode;
}) {
  const name = member.name || '（還沒取名字）';
  const chart = member.charts[0];
  const showViewer = !!viewer && member.charts.some((c) => c.chart_id === viewingChartId);

  return (
    <section className="rounded-card bg-white p-5 md:p-7" aria-label={name}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-50 font-heading text-[18px] text-blue-700" aria-hidden="true">
          {(member.name || '？').slice(0, 1)}
        </span>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <h2 className="font-heading text-[20px] font-normal text-ink md:text-h4">{name}</h2>
          {member.relation && <Tag tone="category">{relLabel(member.relation)}</Tag>}
        </div>
        {chart && (
          <div className="flex items-center gap-1">
            {member.charts.map((c, i) => (
              <BrandButton key={c.chart_id} variant="soft" size="S" disabled={viewBusy} onClick={() => onViewChart(c)}>
                {member.charts.length > 1 ? `看命盤 ${i + 1}` : '看命盤'}
              </BrandButton>
            ))}
            <Link href={`/account/charts/${chart.chart_id}`} aria-label="命盤設定"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-tint hover:text-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100">
              <Settings2 className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            </Link>
          </div>
        )}
      </div>

      {showViewer && <div className="mt-5">{viewer}</div>}

      {member.reports.length > 0 ? (
        <div className="mt-5 space-y-3">
          {member.reports.map((g) => <WorkCard key={g.report.order_no} group={g} />)}
        </div>
      ) : (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-inner bg-tint px-4 py-3.5">
          <p className="text-sm text-text">還沒有{member.name ? `${member.name}的` : ''}報告。想更懂{member.relation === 'self' ? '自己' : '他'}一點？</p>
          <Link href="/report" className="inline-flex items-center gap-1 text-sm font-medium text-blue-700 hover:underline">
            {member.relation === 'self' ? '為自己訂一份' : '為他訂一份'}<ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          </Link>
        </div>
      )}
    </section>
  );
}
