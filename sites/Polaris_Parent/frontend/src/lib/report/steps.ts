/**
 * 客製報告填寫精靈的步驟登錄表（一題一頁）。
 *
 * 精靈頁、進度條、預覽頁的「修改」連結都由這張表推導；新增或調整題目只改這裡
 * 與 components/report/wizard/StepFields.tsx 對應的欄位畫面。
 * 每一步的檢查沿用 validateDraft()，只取該步負責的欄位。
 */
import { validateDraft, type DraftErrors, type DraftField, type ReportDraft } from './draft';

export type StepSlug = 'who' | 'gender' | 'birth-date' | 'birth-time' | 'birth-place' | 'reader' | 'dedication';

export interface ReportStep {
  slug: StepSlug;
  /** 這一頁問的問題 */
  title: string;
  hint?: string;
  fields: DraftField[];
  /** 省略＝一律出現 */
  isVisible?: (d: ReportDraft) => boolean;
}

export const REPORT_STEPS: ReportStep[] = [
  {
    slug: 'who',
    title: '這份報告是為誰製作的？',
    hint: '報告會以這位主角的命盤撰寫。',
    fields: ['subject_name', 'relation_label'],
  },
  { slug: 'gender', title: '主角的性別', hint: '紫微斗數排盤需要性別。', fields: [] },
  {
    slug: 'birth-date',
    title: '主角的出生日期',
    hint: '請以國曆填寫，盡量以出生證明或媽媽手冊為準。',
    fields: ['birth_date'],
  },
  {
    slug: 'birth-time',
    title: '主角的出生時間',
    hint: '出生時間會影響整張命盤。',
    fields: ['birth_time'],
  },
  {
    slug: 'birth-place',
    title: '主角在哪裡出生？',
    hint: '真太陽時需要依出生地校正時間。',
    fields: ['place'],
    isVisible: (d) => d.birth.time_type === 'solar_time',
  },
  {
    slug: 'reader',
    title: '這份報告要給誰讀？',
    hint: '報告的語氣與用字會依讀者調整。',
    fields: ['reader', 'call_name'],
  },
  {
    slug: 'dedication',
    title: '想在扉頁寫一段話嗎？',
    hint: '會印在報告開頭；不需要可以直接略過。',
    fields: ['dedication'],
  },
];

export const isStepSlug = (v: string): v is StepSlug => REPORT_STEPS.some((s) => s.slug === v);

export const visibleSteps = (d: ReportDraft) => REPORT_STEPS.filter((s) => !s.isVisible || s.isVisible(d));

export function stepErrors(step: ReportStep, d: ReportDraft): DraftErrors {
  const all = validateDraft(d);
  return Object.fromEntries(step.fields.filter((f) => all[f]).map((f) => [f, all[f]])) as DraftErrors;
}

/** 第一個還沒填好的步驟；全部完成回傳 null */
export function firstIncompleteStep(d: ReportDraft): ReportStep | null {
  return visibleSteps(d).find((s) => Object.keys(stepErrors(s, d)).length > 0) ?? null;
}

export const stepHref = (slug: StepSlug, returnTo?: 'preview') =>
  `/report/create/${slug}${returnTo ? `?return=${returnTo}` : ''}`;

export const PREVIEW_HREF = '/report/preview';
