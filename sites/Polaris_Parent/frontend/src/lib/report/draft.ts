/**
 * 客製報告的下單草稿（會員 v2）。
 *
 * 填寫與確認頁只存在瀏覽器 sessionStorage，不寫資料庫、不呼叫紫微；
 * 登入並完成 Email 驗證後，結帳步驟才把草稿送到後端建單（docs/membership-v2-architecture.md §5）。
 * 送出時的內容會成為 order_items.customization 的快照，所以欄位名稱與後端契約一致。
 */
import type { TimeType } from '@/lib/api/astrology';
import { CALL_NAME_MAX, DEDICATION_MAX, RELATION_OPTIONS, READER_OPTIONS, type ReportVariant } from './catalog';

export interface ReportDraft {
  variant: ReportVariant;
  subject_name: string;
  gender: '男' | '女';
  birth: {
    date: string; // YYYY-MM-DD（國曆）
    time: string; // HH:mm
    time_type: TimeType;
  };
  /** 真太陽時必填（洲／國家／城市）；鐘錶時間可留空 */
  place: { continent: string; country: string; city: string };
  relation_label: string;
  audience: {
    reader: string;
    call_name: string;
    dedication: string;
  };
  /** 每份草稿一個固定鍵，建單時作為 submission_key，重送不會重複建單 */
  submission_key: string;
}

const KEY = 'polaris_report_draft';

export function newSubmissionKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function emptyDraft(variant: ReportVariant = 'digital'): ReportDraft {
  return {
    variant,
    subject_name: '',
    gender: '男',
    birth: { date: '', time: '', time_type: 'clock_time' },
    place: { continent: '', country: '', city: '' },
    relation_label: 'self',
    audience: { reader: '命主本人', call_name: '', dedication: '' },
    submission_key: newSubmissionKey(),
  };
}

export function loadDraft(): ReportDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ReportDraft) : null;
  } catch {
    return null;
  }
}

export function saveDraft(draft: ReportDraft): void {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(draft));
  } catch {
    /* 私密模式等情況寫不進去：表單仍可在本頁完成 */
  }
}

export function clearDraft(): void {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export type DraftErrors = Partial<Record<
  'subject_name' | 'birth_date' | 'birth_time' | 'place' | 'relation_label' | 'reader' | 'call_name' | 'dedication',
  string
>>;

/** 前端檢查（後端建單時會再驗證一次）。回傳空物件代表通過。 */
export function validateDraft(d: ReportDraft, today: Date = new Date()): DraftErrors {
  const errors: DraftErrors = {};
  const name = d.subject_name.trim();
  if (!name) errors.subject_name = '請填寫報告主角的姓名';
  else if (name.length > 40) errors.subject_name = '姓名請在 40 字以內';

  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.birth.date)) {
    errors.birth_date = '請填寫出生日期';
  } else {
    const [y, m, day] = d.birth.date.split('-').map(Number);
    const dt = new Date(y, m - 1, day);
    if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== day) errors.birth_date = '日期不正確';
    else if (y < 1900) errors.birth_date = '目前支援 1900 年以後的出生日期';
    else if (dt > today) errors.birth_date = '出生日期不能晚於今天';
  }

  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(d.birth.time)) errors.birth_time = '請填寫出生時間（時與分）';

  if (d.birth.time_type === 'solar_time' && (!d.place.country || !d.place.city)) {
    errors.place = '使用真太陽時需選擇出生的國家與城市';
  }

  if (!RELATION_OPTIONS.some((o) => o.value === d.relation_label)) errors.relation_label = '請選擇關係';
  if (!READER_OPTIONS.some((o) => o.value === d.audience.reader)) errors.reader = '請選擇這份報告的讀者';

  const callName = d.audience.call_name.trim();
  if (!callName) errors.call_name = '請填寫書中對主角的稱呼';
  else if (callName.length > CALL_NAME_MAX) errors.call_name = `稱呼請在 ${CALL_NAME_MAX} 字以內`;

  if (d.audience.dedication.length > DEDICATION_MAX) errors.dedication = `題字請在 ${DEDICATION_MAX} 字以內`;
  return errors;
}

export const hasErrors = (e: DraftErrors) => Object.keys(e).length > 0;

export function placeLabel(d: ReportDraft): string {
  const p = d.place;
  return p.city && p.country ? `${p.city}, ${p.country}` : '';
}
