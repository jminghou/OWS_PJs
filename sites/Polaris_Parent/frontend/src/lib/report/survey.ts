/**
 * 結帳頁「你從哪裡知道我們？」（選填）。答案隨建單 payload 送 `survey: {choice, other}`，
 * 後端存進 shop.order_attributions.survey_choice／survey_other，只有後台看得到。
 *
 * choice 的值是和後端約定的 enum（report_orders/attribution.py SURVEY_CHOICES），不要改；
 * 只有顯示文字可以改。
 */

export const SURVEY_CHOICES = ['instagram', 'facebook', 'threads', 'podcast', 'youtube', 'friend', 'search', 'other'] as const;
export type SurveyChoice = (typeof SURVEY_CHOICES)[number];
export const SURVEY_OTHER_MAX = 100;

// TODO: Lemon 定稿文案（之後接 i18n；目前只有繁中結帳頁用到）
export const SURVEY_COPY = {
  title: '你從哪裡知道我們？',
  hint: '選填，幫助我們知道哪裡最常遇見你。',
  otherPlaceholder: '請告訴我們（選填）',
} as const;

// TODO: Lemon 定稿文案
export const SURVEY_LABELS: Record<SurveyChoice, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  threads: 'Threads',
  podcast: 'Podcast',
  youtube: 'YouTube',
  friend: '親友推薦',
  search: '搜尋引擎',
  other: '其他',
};

export interface SurveyAnswer {
  choice: SurveyChoice;
  other: string | null;
}

/** 沒選就不送；只有選「其他」才帶文字（去空白、截 100 字） */
export function surveyPayload(choice: SurveyChoice | '', other: string): SurveyAnswer | undefined {
  if (!choice) return undefined;
  const text = choice === 'other' ? other.trim().slice(0, SURVEY_OTHER_MAX) : '';
  return { choice, other: text || null };
}
