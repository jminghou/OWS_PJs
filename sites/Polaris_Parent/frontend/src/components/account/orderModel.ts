/**
 * 會員中心的訂單整理：把事後加購的訂單掛回原報告，並從訂單狀態算出「需要你處理」的事項。
 * 只用 /report-orders 清單已有的欄位，不另外打 API。
 */
import type { ReportOrderSummary } from '@/lib/api';
import { formatMoney } from '@/lib/money';

export const nt = (n: number, currency?: string) => formatMoney(n, currency);

const toDate = (iso: string) => new Date(iso.endsWith('Z') || iso.includes('+') ? iso : `${iso}Z`);
export const fmtDate = (iso: string | null) => (iso ? toDate(iso).toLocaleDateString('zh-TW') : '');
export const fmtDateTime = (iso: string | null) =>
  iso ? toDate(iso).toLocaleString('zh-TW', { hour12: false, month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' }) : '';

export const orderHref = (o: ReportOrderSummary, hash = '') => `/report/orders/${o.order_no}${hash}`;

/** 訂單的一行標題：報告名稱，或加購內容 */
export function orderTitle(o: ReportOrderSummary) {
  if (o.item?.kind === 'purchase') return o.item.name;
  return o.lines.map((l) => (l.variant === 'consult' ? `專人解讀 × ${l.quantity} 次` : `實體書 × ${l.quantity} 本`)).join('＋') || o.item?.name || '';
}

export interface ReportGroup {
  report: ReportOrderSummary;
  /** 這份報告事後加購的訂單（新的在前） */
  addons: ReportOrderSummary[];
}

/** 一份報告一組；找不到原報告的加購訂單自成一組 */
export function groupReports(orders: ReportOrderSummary[]): ReportGroup[] {
  const mains = orders.filter((o) => !o.item?.parent_order_no);
  const byNo = new Map(mains.map((o) => [o.order_no, { report: o, addons: [] as ReportOrderSummary[] }]));
  const groups = [...byNo.values()];
  for (const o of orders) {
    const parent = o.item?.parent_order_no;
    if (!parent) continue;
    const g = byNo.get(parent);
    if (g) g.addons.push(o);
    else groups.push({ report: o, addons: [] });
  }
  return groups;
}

export type TodoTone = 'action' | 'info';

export interface Todo {
  key: string;
  tone: TodoTone;
  label: string;
  title: string;
  detail: string;
  href: string;
  cta: string;
}

const REPORT_NEW_DAYS = 14;

/** 需要會員處理（action）或值得提醒（info）的事項，action 在前 */
export function buildTodos(orders: ReportOrderSummary[], now = Date.now()): Todo[] {
  const todos: Todo[] = [];
  for (const o of orders) {
    const who = o.item?.call_name || o.item?.subject_name || '';
    const title = `${orderTitle(o)}${who ? `・${who}` : ''}`;
    if (o.status === 'pending') {
      const reported = o.payment.transfer && o.payment.transfer.status === 'created';
      todos.push(reported
        ? { key: `${o.order_no}:pay`, tone: 'info', label: '匯款確認中', title, detail: '已收到你的匯款回報，確認後會寄信通知你。', href: orderHref(o), cta: '查看訂單' }
        : {
          key: `${o.order_no}:pay`, tone: 'action', label: '待付款', title,
          detail: `${nt(o.amount, o.currency)}${o.payment.deadline ? `・請於 ${fmtDate(o.payment.deadline)} 前完成` : ''}`,
          href: orderHref(o), cta: '前往付款',
        });
      continue;
    }
    if (o.status !== 'paid') continue;
    const p = o.physical;
    if (p?.status === 'awaiting_customization' && p.report_ready) {
      todos.push({
        key: `${o.order_no}:design`, tone: 'action', label: '設計你的書', title,
        detail: p.design_status === 'submitted' ? '設計好了嗎？確認內容後就開始製作打樣。' : '報告完成了，用整本書的預覽設計封面與內容。',
        href: `/report/orders/${o.order_no}/design`, cta: p.design_status === 'submitted' ? '繼續設計' : '開始設計',
      });
    }
    if (p?.status === 'proof_ready') {
      const due = p.proofs?.pending?.due_at;
      todos.push({
        key: `${o.order_no}:proof`, tone: 'action', label: '確認打樣', title,
        detail: due ? `打樣好了，請在 ${fmtDateTime(due)} 前確認或提出修改；期限到會自動確認送印。` : '打樣好了，請確認後我們才會送印。',
        href: orderHref(o), cta: '確認打樣',
      });
    }
    if (p?.status === 'shipped') {
      todos.push({ key: `${o.order_no}:ship`, tone: 'info', label: '實體書已出貨', title, detail: '物流資訊在訂單頁。', href: orderHref(o), cta: '查看物流' });
    }
    const c = o.consult;
    if (c?.status === 'to_schedule' && !c.preferences) {
      todos.push({ key: `${o.order_no}:consult`, tone: 'action', label: '預約專人解讀', title, detail: '選幾個你方便的時段，我們會跟你確認時間。', href: orderHref(o, '#consult'), cta: '填寫時段' });
    }
    if (c?.status === 'scheduled' && c.scheduled_at && toDate(c.scheduled_at).getTime() > now) {
      todos.push({ key: `${o.order_no}:consult`, tone: 'info', label: '專人解讀', title, detail: `約定時間 ${fmtDateTime(c.scheduled_at)}`, href: orderHref(o, '#consult'), cta: '查看' });
    }
    const up = o.report?.uploaded_at;
    if (up && now - toDate(up).getTime() < REPORT_NEW_DAYS * 86400000) {
      todos.push({ key: `${o.order_no}:report`, tone: 'info', label: '報告完成了', title, detail: `${fmtDate(up)} 完成，可以線上閱讀或下載。`, href: orderHref(o), cta: '看報告' });
    }
  }
  return [...todos.filter((t) => t.tone === 'action'), ...todos.filter((t) => t.tone === 'info')];
}
