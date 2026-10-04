'use client';

import BirthPlaceFields from '@ows/ziwei-app/components/BirthPlaceFields';
import { CALL_NAME_MAX, DEDICATION_MAX, READER_OPTIONS, RELATION_OPTIONS } from '@/lib/report/catalog';
import type { DraftErrors, DraftField, ReportDraft } from '@/lib/report/draft';
import type { StepSlug } from '@/lib/report/steps';

const inputCls =
  'w-full px-4 py-3 border border-gray-300 rounded-banner bg-white text-base focus:ring-2 focus:ring-brand-purple-500 focus:border-transparent';
const labelCls = 'block text-sm font-medium text-gray-700 mb-2';
const errCls = 'mt-1.5 text-xs text-red-600';

function choiceCls(active: boolean) {
  return `cursor-pointer rounded-banner border px-4 py-3 text-center transition-colors ${
    active ? 'border-brand-purple-500 bg-brand-purple-50 text-brand-purple-800' : 'border-gray-300 bg-white hover:border-brand-purple-300'
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
                   onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="例如：王小明" />
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
            <label key={g} className={`${choiceCls(draft.gender === g)} py-6 text-lg`}>
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
                 onChange={(e) => patchBirth({ date: e.target.value })} className={inputCls} />
          {fieldError('birth_date')}
        </div>
      );

    case 'birth-time':
      return (
        <div className="space-y-6">
          <div>
            <label htmlFor="wz-time" className={labelCls}>出生時間</label>
            <input id="wz-time" type="time" value={draft.birth.time} disabled={timeUnknown}
                   onChange={(e) => patchBirth({ time: e.target.value })} className={`${inputCls} disabled:bg-gray-50`} />
            {fieldError('birth_time')}
            <label className="mt-3 flex items-center gap-2 text-sm text-gray-600">
              <input type="checkbox" checked={timeUnknown} onChange={(e) => onTimeUnknownChange(e.target.checked)} />
              我不確定出生時間
            </label>
          </div>

          {timeUnknown ? (
            <div className="rounded-banner border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
              <p className="font-medium">需要確定的出生時間才能製作報告</p>
              <p className="mt-1">
                紫微斗數以出生時辰排盤，時間不同，命盤就不同；我們不會替你猜一個時間。可以先查看出生證明、媽媽手冊，
                或詢問家人。確認後再回來填寫即可，已填的資料會在這台裝置保留 7 天。
              </p>
            </div>
          ) : (
            <div>
              <span className={labelCls}>時間類型</span>
              <div className="space-y-2">
                {([
                  ['clock_time', '一般時間', '出生證明上的時間，大多數人選這個'],
                  ['solar_time', '真太陽時', '依出生地經度校正，下一步會請你選出生地'],
                ] as const).map(([value, label, desc]) => (
                  <label key={value} className={`${choiceCls(draft.birth.time_type === value)} block text-left`}>
                    <input type="radio" name="time_type" checked={draft.birth.time_type === value}
                           onChange={() => patchBirth({ time_type: value })} className="sr-only" />
                    <span className="block font-medium">{label}</span>
                    <span className="block text-xs text-gray-500">{desc}</span>
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
                   className={inputCls} placeholder="例如：小明、寶貝、你" />
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
                    className={inputCls} placeholder="想對主角說的一段話。" />
          <p className="mt-1.5 text-right text-xs text-gray-500">
            {draft.audience.dedication.length} / {DEDICATION_MAX}
          </p>
          {fieldError('dedication')}
        </div>
      );
  }
}
