import { describe, expect, it } from 'vitest';
import { SURVEY_CHOICES, SURVEY_LABELS, surveyPayload } from './survey';

describe('surveyPayload', () => {
  it('沒選不送', () => {
    expect(surveyPayload('', 'whatever')).toBeUndefined();
  });

  it('只有「其他」才帶文字，去空白並截 100 字', () => {
    expect(surveyPayload('instagram', '不該送出')).toEqual({ choice: 'instagram', other: null });
    expect(surveyPayload('other', '  朋友的部落格  ')).toEqual({ choice: 'other', other: '朋友的部落格' });
    expect(surveyPayload('other', '   ')).toEqual({ choice: 'other', other: null });
    expect(surveyPayload('other', 'x'.repeat(300))!.other).toHaveLength(100);
  });

  it('每個選項都有顯示文字', () => {
    for (const c of SURVEY_CHOICES) expect(SURVEY_LABELS[c]).toBeTruthy();
  });
});
