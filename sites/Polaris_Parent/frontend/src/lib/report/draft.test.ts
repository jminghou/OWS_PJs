import { afterEach, describe, expect, it } from 'vitest';
import { DEDICATION_MAX } from './catalog';
import {
  clearDraft, DRAFT_TTL_DAYS, emptyDraft, hasErrors, loadDraft, placeLabel, saveDraft, validateDraft, type ReportDraft,
} from './draft';

const TODAY = new Date(2026, 9, 3);

function valid(over: Partial<ReportDraft> = {}): ReportDraft {
  return {
    ...emptyDraft('digital'),
    subject_name: '王小明',
    birth: { date: '2020-05-01', time: '08:00', time_type: 'clock_time' },
    audience: { reader: '父母', call_name: '小明', dedication: '' },
    ...over,
  };
}

describe('validateDraft', () => {
  it('accepts a complete draft', () => {
    expect(validateDraft(valid(), TODAY)).toEqual({});
  });

  it('requires name, date, time and call name on an empty draft', () => {
    const e = validateDraft(emptyDraft(), TODAY);
    expect(Object.keys(e).sort()).toEqual(['birth_date', 'birth_time', 'call_name', 'subject_name']);
  });

  it('rejects impossible, future and pre-1900 dates', () => {
    expect(validateDraft(valid({ birth: { date: '2021-02-30', time: '08:00', time_type: 'clock_time' } }), TODAY).birth_date)
      .toBe('日期不正確');
    expect(validateDraft(valid({ birth: { date: '2026-10-04', time: '08:00', time_type: 'clock_time' } }), TODAY).birth_date)
      .toBe('出生日期不能晚於今天');
    expect(validateDraft(valid({ birth: { date: '1899-12-31', time: '08:00', time_type: 'clock_time' } }), TODAY).birth_date)
      .toBeTruthy();
  });

  it('rejects malformed times', () => {
    for (const time of ['24:00', '8:00', '08:60', '']) {
      expect(validateDraft(valid({ birth: { date: '2020-05-01', time, time_type: 'clock_time' } }), TODAY).birth_time)
        .toBeTruthy();
    }
  });

  it('requires a place only for true solar time', () => {
    const solar = valid({ birth: { date: '2020-05-01', time: '08:00', time_type: 'solar_time' } });
    expect(validateDraft(solar, TODAY).place).toBeTruthy();
    const withPlace = { ...solar, place: { continent: 'Asia', country: 'Taiwan', city: 'Taipei' } };
    expect(validateDraft(withPlace, TODAY)).toEqual({});
    expect(placeLabel(withPlace)).toBe('Taipei, Taiwan');
  });

  it('only accepts known relation and reader values', () => {
    expect(validateDraft(valid({ relation_label: 'x'.repeat(21) }), TODAY).relation_label).toBeTruthy();
    expect(validateDraft(valid({ audience: { reader: '路人', call_name: '小明', dedication: '' } }), TODAY).reader)
      .toBeTruthy();
  });

  it('limits dedication length', () => {
    const d = valid({ audience: { reader: '父母', call_name: '小明', dedication: '字'.repeat(DEDICATION_MAX + 1) } });
    expect(hasErrors(validateDraft(d, TODAY))).toBe(true);
  });

  it('gives each draft its own submission key', () => {
    expect(emptyDraft().submission_key).not.toBe(emptyDraft().submission_key);
  });
});

function memoryStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
}

describe('draft storage', () => {
  afterEach(() => {
    delete (globalThis as any).window;
  });

  const install = () => {
    const w = { localStorage: memoryStorage(), sessionStorage: memoryStorage() };
    (globalThis as any).window = w;
    return w;
  };
  const DAY = 24 * 60 * 60 * 1000;

  it('keeps a draft for the TTL and drops it afterwards', () => {
    install();
    const d = valid();
    saveDraft(d, 0);
    expect(loadDraft(DRAFT_TTL_DAYS * DAY - 1)?.submission_key).toBe(d.submission_key);
    expect(loadDraft(DRAFT_TTL_DAYS * DAY + 1)).toBeNull();
    expect(loadDraft(0)).toBeNull(); // 過期時已一併刪除
  });

  it('migrates a legacy sessionStorage draft once', () => {
    const w = install();
    const d = valid();
    w.sessionStorage.setItem('polaris_report_draft', JSON.stringify(d));
    expect(loadDraft()?.submission_key).toBe(d.submission_key);
    expect(w.sessionStorage.getItem('polaris_report_draft')).toBeNull();
    expect(loadDraft()?.submission_key).toBe(d.submission_key);
  });

  it('clearDraft removes it', () => {
    install();
    saveDraft(valid());
    clearDraft();
    expect(loadDraft()).toBeNull();
  });
});
