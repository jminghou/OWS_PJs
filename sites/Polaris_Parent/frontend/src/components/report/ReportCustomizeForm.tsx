'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import BirthPlaceFields from '@ows/ziwei-app/components/BirthPlaceFields';
import Button from '@/components/platform/ui/Button';
import {
  CALL_NAME_MAX,
  DEDICATION_MAX,
  READER_OPTIONS,
  RELATION_OPTIONS,
  REPORT_VARIANTS,
  type ReportVariant,
} from '@/lib/report/catalog';
import {
  emptyDraft,
  hasErrors,
  loadDraft,
  saveDraft,
  validateDraft,
  type DraftErrors,
  type ReportDraft,
} from '@/lib/report/draft';

const inputCls =
  'w-full px-4 py-3 border border-gray-300 rounded-banner bg-white focus:ring-2 focus:ring-brand-purple-500 focus:border-transparent';
const labelCls = 'block text-sm font-medium text-gray-700 mb-2';
const errCls = 'mt-1.5 text-xs text-red-600';
const sectionCls = 'rounded-banner border border-warm-200/70 bg-white p-5 sm:p-6 space-y-5';

function isVariant(v: string | null): v is ReportVariant {
  return v === 'digital' || v === 'physical';
}

/** 客製報告表單：版本 → 報告主角 → 出生資料 → 讀者設定。送出後存草稿並前往確認頁。 */
export default function ReportCustomizeForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [draft, setDraft] = useState<ReportDraft>(() => emptyDraft());
  const [ready, setReady] = useState(false);
  const [callNameTouched, setCallNameTouched] = useState(false);
  const [timeUnknown, setTimeUnknown] = useState(false);
  const [errors, setErrors] = useState<DraftErrors>({});

  // 回到本頁修改時沿用草稿；網址指定的版本優先
  useEffect(() => {
    const saved = loadDraft();
    const queryVariant = searchParams.get('variant');
    const base = saved ?? emptyDraft();
    setDraft(isVariant(queryVariant) ? { ...base, variant: queryVariant } : base);
    if (saved?.audience.call_name) setCallNameTouched(true);
    setReady(true);
  }, [searchParams]);

  const patch = (p: Partial<ReportDraft>) => setDraft((d) => ({ ...d, ...p }));
  const patchBirth = (p: Partial<ReportDraft['birth']>) => setDraft((d) => ({ ...d, birth: { ...d.birth, ...p } }));
  const patchAudience = (p: Partial<ReportDraft['audience']>) =>
    setDraft((d) => ({ ...d, audience: { ...d.audience, ...p } }));

  const setSubjectName = (name: string) =>
    setDraft((d) => ({
      ...d,
      subject_name: name,
      // 未自行修改前，書中稱呼跟著姓名走
      audience: callNameTouched ? d.audience : { ...d.audience, call_name: name.slice(0, CALL_NAME_MAX) },
    }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (timeUnknown) return;
    const found = validateDraft(draft);
    setErrors(found);
    if (hasErrors(found)) {
      requestAnimationFrame(() => document.querySelector('[data-field-error]')?.scrollIntoView({ block: 'center' }));
      return;
    }
    saveDraft({ ...draft, subject_name: draft.subject_name.trim(),
                audience: { ...draft.audience, call_name: draft.audience.call_name.trim() } });
    router.push('/report/confirm');
  };

  if (!ready) return null;

  const fieldError = (key: keyof DraftErrors) =>
    errors[key] ? <p className={errCls} data-field-error>{errors[key]}</p> : null;

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      {/* 版本 */}
      <fieldset className={sectionCls}>
        <legend className="sr-only">選擇版本</legend>
        <h2 className="text-lg font-bold text-gray-900">1. 選擇版本</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {REPORT_VARIANTS.map((v) => {
            const active = draft.variant === v.variant;
            return (
              <label
                key={v.variant}
                className={`cursor-pointer rounded-banner border p-4 transition-colors ${
                  active ? 'border-brand-purple-500 bg-brand-purple-50' : 'border-gray-200 hover:border-brand-purple-300'
                }`}
              >
                <input
                  type="radio"
                  name="variant"
                  value={v.variant}
                  checked={active}
                  onChange={() => patch({ variant: v.variant })}
                  className="sr-only"
                />
                <span className="block font-medium text-gray-900">{v.label}</span>
                <span className="mt-1 block text-sm text-gray-600">{v.summary}</span>
              </label>
            );
          })}
        </div>
        {draft.variant === 'physical' && (
          <p className="text-sm text-gray-500">收件人與地址會在結帳時填寫。</p>
        )}
      </fieldset>

      {/* 報告主角 */}
      <fieldset className={sectionCls}>
        <legend className="sr-only">報告主角</legend>
        <h2 className="text-lg font-bold text-gray-900">2. 報告主角</h2>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="rc-name" className={labelCls}>姓名 *</label>
            <input id="rc-name" type="text" value={draft.subject_name} maxLength={40}
                   onChange={(e) => setSubjectName(e.target.value)} className={inputCls} placeholder="例如：王小明" />
            {fieldError('subject_name')}
          </div>
          <div>
            <span className={labelCls}>性別 *</span>
            <div className="flex gap-3">
              {(['男', '女'] as const).map((g) => (
                <label key={g} className={`flex-1 cursor-pointer rounded-banner border px-4 py-3 text-center ${
                  draft.gender === g ? 'border-brand-purple-500 bg-brand-purple-50 text-brand-purple-800' : 'border-gray-300'
                }`}>
                  <input type="radio" name="gender" value={g} checked={draft.gender === g}
                         onChange={() => patch({ gender: g })} className="sr-only" />
                  {g}
                </label>
              ))}
            </div>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="rc-relation" className={labelCls}>報告主角是你的 *</label>
            <select id="rc-relation" value={draft.relation_label}
                    onChange={(e) => patch({ relation_label: e.target.value })} className={inputCls}>
              {RELATION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {fieldError('relation_label')}
          </div>
        </div>
      </fieldset>

      {/* 出生資料 */}
      <fieldset className={sectionCls}>
        <legend className="sr-only">出生資料</legend>
        <h2 className="text-lg font-bold text-gray-900">3. 出生資料</h2>
        <p className="text-sm text-gray-600">請以國曆填寫。出生時間會影響整張命盤，請盡量以出生證明或媽媽手冊為準。</p>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="rc-date" className={labelCls}>出生日期（國曆）*</label>
            <input id="rc-date" type="date" value={draft.birth.date} min="1900-01-01"
                   onChange={(e) => patchBirth({ date: e.target.value })} className={inputCls} />
            {fieldError('birth_date')}
          </div>
          <div>
            <label htmlFor="rc-time" className={labelCls}>出生時間 *</label>
            <input id="rc-time" type="time" value={draft.birth.time} disabled={timeUnknown}
                   onChange={(e) => patchBirth({ time: e.target.value })} className={`${inputCls} disabled:bg-gray-50`} />
            {fieldError('birth_time')}
            <label className="mt-2 flex items-center gap-2 text-sm text-gray-600">
              <input type="checkbox" checked={timeUnknown} onChange={(e) => setTimeUnknown(e.target.checked)} />
              我不確定出生時間
            </label>
          </div>
        </div>

        {timeUnknown && (
          <div className="rounded-banner border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
            <p className="font-medium">需要確定的出生時間才能製作報告</p>
            <p className="mt-1">
              紫微斗數以出生時辰排盤，時間不同，命盤就不同；我們不會替你猜一個時間。可以先查看出生證明、媽媽手冊，
              或詢問家人。確認後再回來填寫即可，已填的資料會保留在這個分頁中。
            </p>
          </div>
        )}

        {!timeUnknown && (
          <div className="space-y-4">
            <div>
              <span className={labelCls}>時間類型</span>
              <div className="flex flex-col gap-2 text-sm text-gray-700 sm:flex-row sm:gap-6">
                <label className="flex items-center gap-2">
                  <input type="radio" name="time_type" checked={draft.birth.time_type === 'clock_time'}
                         onChange={() => patchBirth({ time_type: 'clock_time' })} />
                  一般時間（出生證明上的時間）
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="time_type" checked={draft.birth.time_type === 'solar_time'}
                         onChange={() => patchBirth({ time_type: 'solar_time' })} />
                  真太陽時（依出生地校正）
                </label>
              </div>
            </div>
            {draft.birth.time_type === 'solar_time' && (
              <div>
                <BirthPlaceFields value={draft.place} onChange={(place) => patch({ place })} />
                {fieldError('place')}
              </div>
            )}
          </div>
        )}
      </fieldset>

      {/* 讀者設定 */}
      <fieldset className={sectionCls}>
        <legend className="sr-only">讀者設定</legend>
        <h2 className="text-lg font-bold text-gray-900">4. 這份報告要給誰讀</h2>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="rc-reader" className={labelCls}>讀者 *</label>
            <select id="rc-reader" value={draft.audience.reader}
                    onChange={(e) => patchAudience({ reader: e.target.value })} className={inputCls}>
              {READER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-gray-500">報告的語氣與用字會依讀者調整。</p>
            {fieldError('reader')}
          </div>
          <div>
            <label htmlFor="rc-callname" className={labelCls}>書中對主角的稱呼 *</label>
            <input id="rc-callname" type="text" value={draft.audience.call_name} maxLength={CALL_NAME_MAX}
                   onChange={(e) => { setCallNameTouched(true); patchAudience({ call_name: e.target.value }); }}
                   className={inputCls} placeholder="例如：小明、寶貝、你" />
            {fieldError('call_name')}
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="rc-dedication" className={labelCls}>扉頁題字（選填）</label>
            <textarea id="rc-dedication" rows={4} value={draft.audience.dedication} maxLength={DEDICATION_MAX}
                      onChange={(e) => patchAudience({ dedication: e.target.value })}
                      className={inputCls} placeholder="想對主角說的一段話，會印在報告開頭。" />
            <p className="mt-1.5 text-right text-xs text-gray-500">
              {draft.audience.dedication.length} / {DEDICATION_MAX}
            </p>
            {fieldError('dedication')}
          </div>
        </div>
      </fieldset>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <button type="button" onClick={() => router.push('/report')}
                className="text-sm text-brand-purple-700 hover:underline">
          ← 返回商品介紹
        </button>
        <Button type="submit" disabled={timeUnknown}
                className="bg-brand-purple-600 hover:bg-brand-purple-700 disabled:opacity-50 sm:min-w-[12rem]">
          下一步：確認資料
        </Button>
      </div>
    </form>
  );
}
