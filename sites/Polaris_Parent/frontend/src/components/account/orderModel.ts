/**
 * 會員中心的訂單整理：把事後加購的訂單掛回原報告、再把報告分到家人底下，
 * 並從訂單狀態算出「需要你幫忙的事」與給客人看的一句話進度。
 * 只用 /report-orders 與 my-charts 已有的欄位，不另外打 API。
 */
import type { ReportOrderSummary } from '@/lib/api';
import type { MyChart, MyPerson } from '@/lib/api/astrology';
import type { PhysicalView } from '@/lib/api/reportOrders';
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

// ── 家人 ──────────────────────────────────────────────────────────────

export const RELATION_LABELS: Record<string, string> = {
  self: '我自己',
  father: '父親',
  mother: '母親',
  son: '兒子',
  daughter: '女兒',
  brother: '兄弟',
  sister: '姊妹',
  spouse: '配偶',
  friend: '朋友',
};
export const relLabel = (r?: string | null) => (r ? RELATION_LABELS[r] || r : '');

export interface FamilyMember {
  key: string;
  name: string;
  /** 關係代碼（self、son…）；依名字分組時沒有 */
  relation: string | null;
  charts: MyChart[];
  reports: ReportGroup[];
}

/** 這組報告（含加購）有沒有等客人動手的事 */
const groupNeedsAction = (g: ReportGroup) =>
  buildTodos([g.report, ...g.addons]).some((t) => t.tone === 'action');

const latest = (m: FamilyMember) =>
  Math.max(0, ...m.reports.map((g) => (g.report.created_at ? toDate(g.report.created_at).getTime() : 0)));

/**
 * 把報告分到家人底下：先用訂單上的 person_user_id 對 my-charts 的人，
 * 對不到（舊單、命盤服務沒開）就用報告主角的名字分組；有命盤但沒報告的人也列出來。
 * 排序：有待辦的人 → 我自己 → 最近下單的人。
 */
export function groupFamily(groups: ReportGroup[], people: MyPerson[]): FamilyMember[] {
  const members = new Map<string, FamilyMember>();
  for (const p of people) {
    members.set(`p:${p.user_id}`, {
      key: `p:${p.user_id}`, name: p.display_name || '', relation: p.relation_label || null, charts: p.charts, reports: [],
    });
  }
  for (const g of groups) {
    const pid = g.report.item?.person_user_id;
    const name = g.report.item?.subject_name || g.report.item?.call_name || '';
    let m = pid ? members.get(`p:${pid}`) : undefined;
    if (!m) {
      const key = `n:${name}`;
      m = members.get(key) ?? { key, name, relation: null, charts: [], reports: [] };
      members.set(key, m);
    }
    m.reports.push(g);
  }
  const rank = (m: FamilyMember) => (m.reports.some(groupNeedsAction) ? 0 : m.relation === 'self' ? 1 : 2);
  return [...members.values()].sort((a, b) => rank(a) - rank(b) || latest(b) - latest(a));
}

// ── 給客人看的進度 ────────────────────────────────────────────────────

/** 工期（工作天）：定稿見 docs/品牌資料/report頁面文案.md「數位報告約 3 個工作天、實體書另外約 7 個工作天」 */
export const REPORT_LEAD_DAYS = 3;
export const BOOK_LEAD_DAYS = 7;

/** 往後算 n 個工作天（只跳過週六日，不含國定假日） */
export function addBusinessDays(from: Date, n: number) {
  const d = new Date(from);
  while (n > 0) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) n -= 1;
  }
  return d;
}

const shortDate = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;

/** 報告卡上的一句話：完成、待付款、製作中（附預估完成日） */
export function reportStatusText(o: ReportOrderSummary, now = Date.now()) {
  if (o.status === 'cancelled') return '這份訂單已取消';
  if (o.report) return `${fmtDate(o.report.uploaded_at)} 完成，隨時可以打開來讀`;
  if (o.status === 'pending') {
    return o.payment.transfer?.status === 'created' ? '收到你的匯款回報了，確認後就開始製作' : '還差一步：完成付款後就開始製作';
  }
  if (!o.paid_at) return '老師正在撰寫';
  const due = addBusinessDays(toDate(o.paid_at), REPORT_LEAD_DAYS);
  return due.getTime() > now
    ? `老師正在撰寫，預計 ${shortDate(due)} 前完成`
    : '老師正在做最後的整理，完成會寄信通知你';
}

/** 實體書的一句話（設計、打樣都要客人參與，所以只在印製後才給出貨時間） */
export function bookStatusText(o: ReportOrderSummary, p: PhysicalView) {
  if (o.status === 'pending') return '完成付款後就能開始';
  switch (p.status) {
    case 'awaiting_customization':
      return p.report_ready ? (p.design_status === 'submitted' ? '設計好了嗎？確認後就開始打樣' : '報告完成了，可以開始設計你的書')
        : '報告完成後，就能開始設計這本書';
    case 'awaiting_proof': return '我們正在做打樣';
    case 'proof_ready': return '打樣好了，等你看一眼';
    case 'changes_requested': return '收到你的修改，正在調整打樣';
    case 'approved':
    case 'printing': return `印製中，通常 ${BOOK_LEAD_DAYS} 個工作天內寄出`;
    case 'shipped': return '已經寄出了，正在路上';
    case 'delivered': return '已送達，希望你喜歡';
    default: return p.status_label;
  }
}

// ── 需要你幫忙的事 ────────────────────────────────────────────────────

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

/**
 * 需要會員處理（action）或值得提醒（info）的事項，action 在前。
 * selfPersonId：命盤裡「我自己」的 person user_id；是本人的報告就說「你的報告」而不是叫自己的名字。
 */
export function buildTodos(orders: ReportOrderSummary[], now = Date.now(), selfPersonId?: string | null): Todo[] {
  const todos: Todo[] = [];
  // 加購訂單沒有 person_user_id，跟著原報告
  const personOf = new Map(orders.map((o) => [o.order_no, o.item?.person_user_id ?? null]));
  for (const o of orders) {
    const pid = o.item?.person_user_id ?? personOf.get(o.item?.parent_order_no ?? '') ?? null;
    const isSelf = !!selfPersonId && pid === selfPersonId;
    const who = o.item?.call_name || o.item?.subject_name || '';
    // label：是誰的哪一件（小寶的報告／小寶的書）；title：一句人話說要做什麼
    const whose = (thing: string) => (isSelf ? `你的${thing}` : who ? `${who}的${thing}` : thing);
    const what = o.item?.kind === 'purchase' ? whose('報告') : whose(o.physical ? '書' : '專人解讀');
    if (o.status === 'pending') {
      const reported = o.payment.transfer && o.payment.transfer.status === 'created';
      todos.push(reported
        ? { key: `${o.order_no}:pay`, tone: 'info', label: what, title: '收到你的匯款回報了', detail: '我們確認後會寄信通知你，接著就開始製作。', href: orderHref(o), cta: '看看細節' }
        : {
          key: `${o.order_no}:pay`, tone: 'action', label: what, title: '還差一步：完成付款',
          detail: `${nt(o.amount, o.currency)}${o.payment.deadline ? `，請在 ${fmtDate(o.payment.deadline)} 前完成` : ''}；付款後就開始製作。`,
          href: orderHref(o), cta: '去付款',
        });
      continue;
    }
    if (o.status !== 'paid') continue;
    const p = o.physical;
    if (p?.status === 'awaiting_customization' && p.report_ready) {
      todos.push({
        key: `${o.order_no}:design`, tone: 'action', label: whose('書'),
        title: p.design_status === 'submitted' ? '書設計好了嗎？' : '報告完成了，來設計這本書吧',
        detail: p.design_status === 'submitted' ? '確認內容後我們就開始做打樣。' : '挑封面、看整本書的預覽，做成專屬的一本。',
        href: `/report/orders/${o.order_no}/design`, cta: p.design_status === 'submitted' ? '繼續設計' : '開始設計',
      });
    }
    if (p?.status === 'proof_ready') {
      const due = p.proofs?.pending?.due_at;
      todos.push({
        key: `${o.order_no}:proof`, tone: 'action', label: whose('書'), title: '打樣好了，等你看一眼',
        detail: due ? `請在 ${fmtDateTime(due)} 前確認或告訴我們要改哪裡；時間到會自動送印。` : '你確認之後我們才會送印。',
        href: orderHref(o), cta: '看打樣',
      });
    }
    if (p?.status === 'shipped') {
      todos.push({ key: `${o.order_no}:ship`, tone: 'info', label: whose('書'), title: '書已經寄出了', detail: '可以在這裡查物流進度。', href: orderHref(o), cta: '查物流' });
    }
    const c = o.consult;
    if (c?.status === 'to_schedule' && !c.preferences) {
      todos.push({ key: `${o.order_no}:consult`, tone: 'action', label: whose('專人解讀'), title: '挑幾個你方便的時間', detail: '選好之後，我們會跟你約定確切時間。', href: orderHref(o, '#consult'), cta: '選時間' });
    }
    if (c?.status === 'scheduled' && c.scheduled_at && toDate(c.scheduled_at).getTime() > now) {
      todos.push({ key: `${o.order_no}:consult`, tone: 'info', label: whose('專人解讀'), title: `約在 ${fmtDateTime(c.scheduled_at)}`, detail: '到時候見！', href: orderHref(o, '#consult'), cta: '看看細節' });
    }
    const up = o.report?.uploaded_at;
    if (up && now - toDate(up).getTime() < REPORT_NEW_DAYS * 86400000) {
      todos.push({ key: `${o.order_no}:report`, tone: 'info', label: whose('報告'), title: '報告完成了！', detail: `${fmtDate(up)} 完成，往下在家人卡片裡就能打開來讀。`, href: orderHref(o), cta: '看看細節' });
    }
  }
  return [...todos.filter((t) => t.tone === 'action'), ...todos.filter((t) => t.tone === 'info')];
}
