import { describe, expect, it } from 'vitest';
import type { ReportOrderSummary } from '@/lib/api';
import type { MyPerson } from '@/lib/api/astrology';
import { addBusinessDays, bookTitle, buildTodos, groupFamily, groupReports, ownedBooks, reportPhase, reportStatusText } from './orderModel';

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

type Production = NonNullable<ReportOrderSummary['production']>;
const prod = (handoff_status: string, status: string | null): Production => ({
  handoff_status, ziwei_status: null, member_note: null,
  progress: { status, status_label: null, member_note: null, last_synced_at: null, stale: false },
});
const fakeReport = { uploaded_at: '2026-10-25T00:00:00' } as unknown as ReportOrderSummary['report'];

const QUEUED = '已付款，已排入製作。';
const IN_PROGRESS = '報告製作中，完成後可以在這裡查看。';
const NEEDS_INFO = '我們需要和你確認一些資料，請到訂單頁查看說明。';
const DELIVERED = '報告已完成，可以開始閱讀了。';

/** 每一個案例：[說明, 訂單, 預期 phase, 預期文字] */
const CASES: [string, ReportOrderSummary, string, string][] = [
  ['paid, no production yet', order({ production: null }), 'queued', QUEUED],
  ...(['not_ready', 'pending', 'failed', 'cancelled'] as const).flatMap((h) =>
    ([null, 'queued', 'in_progress', 'completed', 'failed'] as const).map((s): [string, ReportOrderSummary, string, string] =>
      [`handoff ${h} / progress ${s}`, order({ production: prod(h, s) }), 'queued', QUEUED])),
  ['sent / progress queued', order({ production: prod('sent', 'queued') }), 'queued', QUEUED],
  ['sent / progress null', order({ production: prod('sent', null) }), 'queued', QUEUED],
  ['sent / no progress object', order({ production: { handoff_status: 'sent', ziwei_status: null, member_note: null, progress: null } }), 'queued', QUEUED],
  ['sent / in_progress', order({ production: prod('sent', 'in_progress') }), 'in_progress', IN_PROGRESS],
  ['sent / completed, PDF not uploaded', order({ production: prod('sent', 'completed') }), 'in_progress', IN_PROGRESS],
  ['sent / needs_info', order({ production: prod('sent', 'needs_info') }), 'needs_info', NEEDS_INFO],
  ['sent / production failed', order({ production: prod('sent', 'failed') }), 'queued', QUEUED],
  ['sent / production cancelled', order({ production: prod('sent', 'cancelled') }), 'queued', QUEUED],
  ['handoff failed but progress in_progress (contradiction)', order({ production: prod('failed', 'in_progress') }), 'queued', QUEUED],
  ['delivered', order({ report: fakeReport, production: prod('failed', null) }), 'delivered', DELIVERED],
  ['delivered while blocked', order({ report: fakeReport, fulfilment_control: { blocked: true } }), 'delivered', DELIVERED],
  ['admin pause + sent + in_progress', order({ fulfilment_control: { blocked: true }, production: prod('sent', 'in_progress') }), 'queued', QUEUED],
  ['external pause + sent + in_progress',
    order({ commerce: { external: { receipt_id: 1, evidence_status: 'disputed', fulfilment_blocked: true } } as ReportOrderSummary['commerce'], production: prod('sent', 'in_progress') }),
    'queued', QUEUED],
  ['pending, transfer reported',
    order({ status: 'pending', paid_at: null, payment: { mode: 'manual', deadline: null, transfer: { status: 'created' } } as unknown as ReportOrderSummary['payment'] }),
    'unpaid', '收到你的匯款回報了，確認後就開始製作'],
  ['pending, not paid', order({ status: 'pending', paid_at: null }), 'unpaid', '還差一步：完成付款後就開始製作'],
  ['cancelled', order({ status: 'cancelled', production: prod('sent', 'in_progress') }), 'cancelled', '這份訂單已取消'],
];

describe('reportPhase / reportStatusText', () => {
  it.each(CASES)('%s', (_name, o, phase, text) => {
    expect(reportPhase(o)).toBe(phase);
    expect(reportStatusText(o)).toBe(text);
  });

  it('never says 製作中 unless the handoff was sent and production reported progress', () => {
    for (const [, o, phase] of CASES) {
      if (phase !== 'in_progress') expect(reportStatusText(o)).not.toMatch(/製作中/);
    }
  });

  it('never mentions the teacher or promises a date', () => {
    for (const [, o] of CASES) {
      expect(reportStatusText(o)).not.toMatch(/老師|預計/);
      expect(reportStatusText(o, Date.UTC(2026, 9, 22, 3))).not.toMatch(/老師|預計/);
    }
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
