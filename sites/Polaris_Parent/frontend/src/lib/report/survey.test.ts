import { describe, expect, it } from 'vitest';
import { SURVEY_CHOICES, SURVEY_COPY, SURVEY_LABELS, formatSurveyForAdmin, surveyPayload } from './survey';

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

  it('定稿文案（Lemon 2026-11-16）：題目、題下小字', () => {
    expect(SURVEY_COPY.title).toBe('你是從哪裡認識親紫之間的？');
    expect(SURVEY_COPY.hint).toBe('選填。你的回答能幫我們知道，哪些分享真的幫上了需要的人。');
  });

  it('選項順序與顯示文字依定稿，含 LINE', () => {
    expect([...SURVEY_CHOICES]).toEqual([
      'facebook', 'instagram', 'threads', 'line', 'podcast', 'youtube', 'friend', 'search', 'other',
    ]);
    expect(SURVEY_CHOICES.map((c) => SURVEY_LABELS[c])).toEqual([
      'Facebook', 'Instagram', 'Threads', 'LINE', 'Podcast', 'YouTube', '親友推薦', 'Google 等搜尋', '其他（可填）',
    ]);
  });
});

describe('formatSurveyForAdmin', () => {
  it('其他＋文字 → 其他：文字', () => {
    expect(formatSurveyForAdmin('other', '朋友的部落格')).toBe('其他：朋友的部落格');
  });

  it('其他但沒文字 → 其他', () => {
    expect(formatSurveyForAdmin('other', null)).toBe('其他');
    expect(formatSurveyForAdmin('other', '  ')).toBe('其他');
  });

  it('一般選項 → 顯示文字', () => {
    expect(formatSurveyForAdmin('line', null)).toBe('LINE');
    expect(formatSurveyForAdmin('friend', null)).toBe('親友推薦');
  });

  it('沒答 → 無；不認得的值原樣顯示', () => {
    expect(formatSurveyForAdmin(null, null)).toBe('無');
    expect(formatSurveyForAdmin(undefined, undefined)).toBe('無');
    expect(formatSurveyForAdmin('', null)).toBe('無');
    expect(formatSurveyForAdmin('tiktok', null)).toBe('tiktok');
  });

  it('結帳頁「其他」選項文字不變', () => {
    expect(SURVEY_LABELS.other).toBe('其他（可填）');
  });
});
