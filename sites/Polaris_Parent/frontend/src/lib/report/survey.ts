/**
 * 結帳頁來源問卷（選填，單選）。答案隨建單 payload 送 `survey: {choice, other}`，
 * 後端存進 shop.order_attributions.survey_choice／survey_other，只有後台看得到。
 *
 * choice 的值是和後端約定的 enum（report_orders/attribution.py SURVEY_CHOICES），不要改；
 * 只有顯示文字可以改。
 */

export const SURVEY_CHOICES = [
  'facebook', 'instagram', 'threads', 'line', 'podcast', 'youtube', 'friend', 'search', 'other',
] as const;
export type SurveyChoice = (typeof SURVEY_CHOICES)[number];
export const SURVEY_OTHER_MAX = 100;

// 定稿文案：Lemon 2026-11-16 確認（之後接 i18n；目前只有繁中結帳頁用到）
export const SURVEY_COPY = {
  title: '你是從哪裡認識親紫之間的？',
  hint: '選填。你的回答能幫我們知道，哪些分享真的幫上了需要的人。',
  otherPlaceholder: '例如某個網站、活動或文章（選填）',
} as const;

// 選項順序＝SURVEY_CHOICES；顯示文字依 Lemon 2026-11-16 定稿
export const SURVEY_LABELS: Record<SurveyChoice, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  threads: 'Threads',
  line: 'LINE',
  podcast: 'Podcast',
  youtube: 'YouTube',
  friend: '親友推薦',
  search: 'Google 等搜尋',
  other: '其他（可填）',
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

/**
 * 後台顯示用（不影響結帳頁選項文字）：「其他」不帶「（可填）」；有文字時「其他：文字」。
 * 沒答（含沒有來源紀錄）顯示「無」；不認得的 choice 原樣顯示。
 */
export const SURVEY_ADMIN_LABELS: Record<SurveyChoice, string> = { ...SURVEY_LABELS, other: '其他' };

export function formatSurveyForAdmin(choice: string | null | undefined, other: string | null | undefined): string {
  if (!choice) return '無';
  const label = SURVEY_ADMIN_LABELS[choice as SurveyChoice] ?? choice;
  if (choice !== 'other') return label;
  const text = (other ?? '').trim();
  return text ? `${label}：${text}` : label;
}
