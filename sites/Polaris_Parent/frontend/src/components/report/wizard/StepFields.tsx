'use client';

import { Check } from 'lucide-react';
import BirthPlaceFields from '@ows/ziwei-app/components/BirthPlaceFields';
import Alert from '@/components/ui/Alert';
import { CALL_NAME_MAX, DEDICATION_MAX, READER_OPTIONS, RELATION_OPTIONS } from '@/lib/report/catalog';
import type { DraftErrors, DraftField, ReportDraft } from '@/lib/report/draft';
import type { StepSlug } from '@/lib/report/steps';

// 表單樣式依品牌規範 §6.3
const inputBase =
  'w-full rounded-2xl border-[1.5px] bg-white px-[18px] py-[13px] text-base text-ink placeholder:text-muted ' +
  'transition-[border-color,box-shadow] duration-150 ease-out focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 ' +
  'disabled:cursor-not-allowed disabled:bg-tint disabled:text-muted';
const inputCls = (error?: string) => `${inputBase} ${error ? 'border-error bg-error-bg' : 'border-line-strong'}`;
const labelCls = 'mb-1.5 block text-sm font-medium text-ink';
const errCls = 'mt-1.5 text-[13px] text-error-fg';

/**
 * 單選選項：膠囊按鈕組，選中 bg-blue-500 白字（§6.3）；未選中沿用篩選標籤的白底細框。
 * radio 本體是 sr-only，所以 focus-visible 外圈掛在 label 上（has-[:focus-visible]）。
 * multiline：帶說明文字的選項改用 rounded-inner，避免兩行字擠在膠囊裡。
 */
function choiceCls(active: boolean, multiline = false) {
  return `cursor-pointer border-[1.5px] px-5 py-3 text-center transition-colors duration-150 ease-out active:brightness-95 has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-blue-100 ${
    multiline ? 'rounded-inner' : 'rounded-full'
  } ${
    active ? 'border-blue-500 bg-blue-500 font-bold text-white' : 'border-line-strong bg-white text-ink hover:border-blue-500'
  }`;
}

interface StepFieldsProps {
  slug: StepSlug;
  draft: ReportDraft;
  onChange: (next: ReportDraft) => void;
  errors: DraftErrors;
  /** 「不確定出生時間」：勾選時精靈不能往下走 */
  timeUnknown: boolean;
  onTimeUnknownChange: (v: boolean) => void;
}

/** 精靈單一步驟的欄位畫面；步驟定義見 lib/report/steps.ts */
export default function StepFields({ slug, draft, onChange, errors, timeUnknown, onTimeUnknownChange }: StepFieldsProps) {
  const patch = (p: Partial<ReportDraft>) => onChange({ ...draft, ...p });
  const patchBirth = (p: Partial<ReportDraft['birth']>) => onChange({ ...draft, birth: { ...draft.birth, ...p } });
  const patchAudience = (p: Partial<ReportDraft['audience']>) =>
    onChange({ ...draft, audience: { ...draft.audience, ...p } });

  const fieldError = (key: DraftField) =>
    errors[key] ? <p className={errCls} data-field-error>{errors[key]}</p> : null;

  switch (slug) {
    case 'who': {
      const setName = (name: string) => {
        // 稱呼還沒自行改過（空的或與舊姓名相同）就跟著姓名走
        const follows = !draft.audience.call_name || draft.audience.call_name === draft.subject_name.slice(0, CALL_NAME_MAX);
        onChange({
          ...draft,
          subject_name: name,
          audience: follows ? { ...draft.audience, call_name: name.slice(0, CALL_NAME_MAX) } : draft.audience,
        });
      };
      return (
        <div className="space-y-6">
          <div>
            <label htmlFor="wz-name" className={labelCls}>主角的姓名</label>
            <input id="wz-name" type="text" value={draft.subject_name} maxLength={40} autoFocus
                   onChange={(e) => setName(e.target.value)} className={inputCls(errors.subject_name)} placeholder="例如：王小明" />
            {fieldError('subject_name')}
          </div>
          <div>
            <span className={labelCls}>主角是你的</span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {RELATION_OPTIONS.map((o) => (
                <label key={o.value} className={choiceCls(draft.relation_label === o.value)}>
                  <input type="radio" name="relation" value={o.value} checked={draft.relation_label === o.value}
                         onChange={() => patch({ relation_label: o.value })} className="sr-only" />
                  {o.label}
                </label>
              ))}
            </div>
            {fieldError('relation_label')}
          </div>
        </div>
      );
    }

    case 'gender':
      return (
        <div className="grid grid-cols-2 gap-3">
          {(['男', '女'] as const).map((g) => (
            <label key={g} className={`${choiceCls(draft.gender === g)} py-5 text-lg`}>
              <input type="radio" name="gender" value={g} checked={draft.gender === g}
                     onChange={() => patch({ gender: g })} className="sr-only" />
              {g}
            </label>
          ))}
        </div>
      );

    case 'birth-date':
      return (
        <div>
          <label htmlFor="wz-date" className={labelCls}>出生日期（國曆）</label>
          <input id="wz-date" type="date" value={draft.birth.date} min="1900-01-01" autoFocus
                 onChange={(e) => patchBirth({ date: e.target.value })} className={`${inputCls(errors.birth_date)} font-latin`} />
          {fieldError('birth_date')}
        </div>
      );

    case 'birth-time':
      return (
        <div className="space-y-6">
          <div>
            <label htmlFor="wz-time" className={labelCls}>出生時間</label>
            <input id="wz-time" type="time" value={draft.birth.time} disabled={timeUnknown}
                   onChange={(e) => patchBirth({ time: e.target.value })} className={`${inputCls(errors.birth_time)} font-latin`} />
            {fieldError('birth_time')}
            <label className="mt-3 inline-flex min-h-[44px] cursor-pointer items-center gap-2.5 text-sm text-text">
              {/* checkbox：22px、圓角 7px，勾選時藍底白勾（規範 §6.3） */}
              <span className="relative flex h-[22px] w-[22px] shrink-0">
                <input type="checkbox" checked={timeUnknown} onChange={(e) => onTimeUnknownChange(e.target.checked)}
                       className="peer h-[22px] w-[22px] cursor-pointer appearance-none rounded-[7px] border-[1.5px] border-line-strong bg-white transition-colors duration-150 checked:border-blue-500 checked:bg-blue-500 hover:border-blue-500 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100" />
                <Check className="pointer-events-none absolute inset-0 m-auto h-4 w-4 text-white opacity-0 peer-checked:opacity-100"
                       strokeWidth={3} aria-hidden="true" />
              </span>
              我不確定出生時間
            </label>
          </div>

          {timeUnknown ? (
            <Alert tone="warning">
              <p className="font-medium">需要確定的出生時間才能製作報告</p>
              <p className="mt-1">
                紫微斗數以出生時辰排盤，時間不同，命盤就不同；我們不會替你猜一個時間。可以先查看出生證明、媽媽手冊，
                或詢問家人。確認後再回來填寫即可，已填的資料會在這台裝置保留 7 天。
              </p>
            </Alert>
          ) : (
            <div>
              <span className={labelCls}>時間類型</span>
              <div className="space-y-2">
                {([
                  ['clock_time', '一般時間', '出生證明上的時間，大多數人選這個'],
                  ['solar_time', '真太陽時', '依出生地經度校正，下一步會請你選出生地'],
                ] as const).map(([value, label, desc]) => (
                  <label key={value} className={`${choiceCls(draft.birth.time_type === value, true)} block text-left`}>
                    <input type="radio" name="time_type" checked={draft.birth.time_type === value}
                           onChange={() => patchBirth({ time_type: value })} className="sr-only" />
                    <span className="block">{label}</span>
                    <span className={`mt-0.5 block text-caption font-normal ${draft.birth.time_type === value ? 'text-blue-50' : 'text-muted'}`}>
                      {desc}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      );

    case 'birth-place':
      return (
        <div>
          <BirthPlaceFields value={draft.place} onChange={(place) => patch({ place })} />
          {fieldError('place')}
        </div>
      );

    case 'reader':
      return (
        <div className="space-y-6">
          <div>
            <span className={labelCls}>讀者</span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {READER_OPTIONS.map((o) => (
                <label key={o.value} className={choiceCls(draft.audience.reader === o.value)}>
                  <input type="radio" name="reader" value={o.value} checked={draft.audience.reader === o.value}
                         onChange={() => patchAudience({ reader: o.value })} className="sr-only" />
                  {o.label}
                </label>
              ))}
            </div>
            {fieldError('reader')}
          </div>
          <div>
            <label htmlFor="wz-callname" className={labelCls}>書中怎麼稱呼主角？</label>
            <input id="wz-callname" type="text" value={draft.audience.call_name} maxLength={CALL_NAME_MAX}
                   onChange={(e) => patchAudience({ call_name: e.target.value })}
                   className={inputCls(errors.call_name)} placeholder="例如：小明、寶貝、你" />
            {fieldError('call_name')}
          </div>
        </div>
      );

    case 'dedication':
      return (
        <div>
          <label htmlFor="wz-dedication" className={labelCls}>扉頁題字（選填）</label>
          <textarea id="wz-dedication" rows={5} value={draft.audience.dedication} maxLength={DEDICATION_MAX} autoFocus
                    onChange={(e) => patchAudience({ dedication: e.target.value })}
                    className={inputCls(errors.dedication)} placeholder="想對主角說的一段話。" />
          <p className="mt-1.5 text-right font-latin text-caption text-muted">
            {draft.audience.dedication.length} / {DEDICATION_MAX}
          </p>
          {fieldError('dedication')}
        </div>
      );
  }
}
