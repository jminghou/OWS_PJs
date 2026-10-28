import { describe, expect, it } from 'vitest';
import type { ReportOrderSummary } from '@/lib/api';
import type { MyPerson } from '@/lib/api/astrology';
import { addBusinessDays, bookTitle, buildTodos, groupFamily, groupReports, ownedBooks, reportStatusText } from './orderModel';

type Over = Omit<Partial<ReportOrderSummary>, 'item'> & { item?: Partial<NonNullable<ReportOrderSummary['item']>> };
const order = (over: Over): ReportOrderSummary => ({
  order_no: 'R1', status: 'paid', amount: 1980, currency: 'TWD', payment_mode: 'manual',
  payment: { mode: 'manual', deadline: null }, created_at: '2026-10-01T00:00:00', paid_at: '2026-10-01T00:00:00',
  lines: [], production: null, shipment: null, report: null, physical: null, consult: null, addons: [], addon_offer: null,
  ...over,
  item: {
    item_no: 'I1', name: '本命客製報告', variant: 'digital', subject_name: '王小明', call_name: '小明',
    kind: 'purchase', quantity: 1, parent_order_no: null, person_user_id: null, chart_id: null, ...over.item,
  },
});

const person = (user_id: string, display_name: string, relation_label: string): MyPerson => ({
  user_id, display_name, relation_label, charts: [{ chart_id: `c${user_id}` }],
});

describe('addBusinessDays', () => {
  it('skips weekends', () => {
    // 2026-10-22 是週四：+3 工作天 → 週五、週一、週二
    expect(addBusinessDays(new Date(2026, 9, 22), 3).getDate()).toBe(27);
    // 週五 +1 → 下週一
    expect(addBusinessDays(new Date(2026, 9, 23), 1).getDate()).toBe(26);
  });
});

describe('reportStatusText', () => {
  it('estimates the finish date while in production, then stops promising once overdue', () => {
    const o = order({ paid_at: '2026-10-22T02:00:00Z' });
    expect(reportStatusText(o, Date.UTC(2026, 9, 22, 3))).toBe('老師正在撰寫，預計 10/27 前完成');
    expect(reportStatusText(o, Date.UTC(2026, 10, 5))).toBe('老師正在做最後的整理，完成會寄信通知你');
  });
  it('speaks plainly about payment', () => {
    expect(reportStatusText(order({ status: 'pending', paid_at: null }))).toBe('還差一步：完成付款後就開始製作');
  });
});

describe('groupFamily', () => {
  it('puts reports under the matching person, falls back to the subject name, and lists people without reports', () => {
    const kid = order({ order_no: 'A', item: { person_user_id: '7', subject_name: '王小寶' } });
    const addon = order({ order_no: 'A2', item: { kind: 'addon', parent_order_no: 'A' } });
    const legacy = order({ order_no: 'B', created_at: '2026-10-05T00:00:00', item: { subject_name: '王大寶' } });
    const people = [person('1', '我', 'self'), person('7', '小寶', 'daughter')];
    const family = groupFamily(groupReports([kid, addon, legacy]), people);

    const bySelf = family.find((m) => m.relation === 'self')!;
    expect(bySelf.reports).toEqual([]);
    const daughter = family.find((m) => m.key === 'p:7')!;
    expect(daughter.reports.map((g) => [g.report.order_no, g.addons.map((a) => a.order_no)])).toEqual([['A', ['A2']]]);
    expect(family.find((m) => m.key === 'n:王大寶')!.reports.map((g) => g.report.order_no)).toEqual(['B']);
  });

  it('puts people who need to act first, then me', () => {
    const pending = order({ order_no: 'P', status: 'pending', paid_at: null, item: { person_user_id: '7' } });
    const family = groupFamily(groupReports([pending]), [person('1', '我', 'self'), person('7', '小寶', 'daughter')]);
    expect(family.map((m) => m.key)).toEqual(['p:7', 'p:1']);
  });
});

describe('buildTodos', () => {
  it('names whose thing it is and says what to do', () => {
    const [t] = buildTodos([order({ status: 'pending', paid_at: null })]);
    expect([t.label, t.title, t.cta]).toEqual(['小明的報告', '還差一步：完成付款', '去付款']);
  });
});

describe('buildTodos for my own report', () => {
  it('says "你的" instead of my own name', () => {
    const mine = order({ status: 'pending', paid_at: null, item: { subject_name: '王美華', call_name: '', person_user_id: '9000' } });
    expect(buildTodos([mine], Date.now(), '9000')[0].label).toBe('你的報告');
    expect(buildTodos([mine], Date.now(), '1')[0].label).toBe('王美華的報告');
  });
});

describe('ownedBooks', () => {
  it('lists paid reports only and flags what can be added', () => {
    const books = ownedBooks([
      order({ order_no: 'A', addon_offer: { physical: true, consult: true, available: true } }),
      order({ order_no: 'B', status: 'pending' }),
      order({ order_no: 'C', payment_mode: 'external_verified', item: { variant: 'physical' } }),
      order({ order_no: 'D', item: { kind: 'addon', parent_order_no: 'A' } }),
    ]);
    expect(books.map((b) => b.order.order_no)).toEqual(['A', 'C']);
    expect(books[0]).toMatchObject({ canPrint: true, canConsult: true, external: false, isPhysical: false });
    expect(books[1]).toMatchObject({ canPrint: false, canConsult: false, external: true, isPhysical: true });
  });

  it('names a book after its reader', () => {
    expect(bookTitle(order({ item: { name: '本命客製報告（數位版）' } }))).toBe('小明的本命客製報告');
  });
});
