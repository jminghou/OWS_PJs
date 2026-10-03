import { describe, expect, it } from 'vitest';
import { DEDICATION_MAX } from './catalog';
import { emptyDraft, hasErrors, placeLabel, validateDraft, type ReportDraft } from './draft';

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
