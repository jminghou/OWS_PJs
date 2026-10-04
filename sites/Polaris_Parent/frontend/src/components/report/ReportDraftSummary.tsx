import Link from 'next/link';
import { READER_OPTIONS, RELATION_OPTIONS, variantInfo } from '@/lib/report/catalog';
import { placeLabel, type ReportDraft } from '@/lib/report/draft';
import { stepHref, type StepSlug } from '@/lib/report/steps';

const labelOf = (opts: { value: string; label: string }[], v: string) => opts.find((o) => o.value === v)?.label ?? v;

function Row({ label, edit, children }: { label: string; edit?: StepSlug; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7rem_1fr_auto] gap-3 py-2.5 text-sm sm:grid-cols-[9rem_1fr_auto]">
      <dt className="text-gray-500">{label}</dt>
      <dd className="whitespace-pre-line break-words text-gray-900">{children}</dd>
      {edit ? (
        <Link href={stepHref(edit, 'preview')} className="text-xs text-brand-purple-700 hover:underline">
          修改
        </Link>
      ) : (
        <span />
      )}
    </div>
  );
}

/**
 * 下單草稿的摘要（預覽頁、結帳頁共用）。出生資料集中呈現，讓購買者付款前再核對一次。
 * editable：每列附「修改」，連回精靈對應步驟，改完回到預覽頁。
 */
export default function ReportDraftSummary({ draft, editable = false }: { draft: ReportDraft; editable?: boolean }) {
  const place = placeLabel(draft);
  const e = (slug: StepSlug) => (editable ? slug : undefined);
  return (
    <div className="space-y-5">
      {draft.variant && (
        <section className="rounded-banner border border-warm-200/70 bg-white p-5 sm:p-6">
          <h2 className="text-base font-bold text-gray-900">版本</h2>
          <dl className="mt-2 divide-y divide-warm-100">
            <Row label="版本">{variantInfo(draft.variant).label}</Row>
          </dl>
        </section>
      )}

      <section className="rounded-banner border-2 border-brand-purple-200 bg-white p-5 sm:p-6">
        <h2 className="text-base font-bold text-gray-900">報告主角與出生資料</h2>
        <p className="mt-1 text-xs text-gray-500">報告依這些資料製作，付款後無法直接修改，請仔細核對。</p>
        <dl className="mt-2 divide-y divide-warm-100">
          <Row label="姓名" edit={e('who')}>{draft.subject_name}</Row>
          <Row label="性別" edit={e('gender')}>{draft.gender}</Row>
          <Row label="與你的關係" edit={e('who')}>{labelOf(RELATION_OPTIONS, draft.relation_label)}</Row>
          <Row label="出生日期" edit={e('birth-date')}>{draft.birth.date}（國曆）</Row>
          <Row label="出生時間" edit={e('birth-time')}>
            {draft.birth.time}（{draft.birth.time_type === 'solar_time' ? '真太陽時' : '一般時間'}）
          </Row>
          {place && <Row label="出生地" edit={e('birth-place')}>{place}</Row>}
        </dl>
      </section>

      <section className="rounded-banner border border-warm-200/70 bg-white p-5 sm:p-6">
        <h2 className="text-base font-bold text-gray-900">讀者設定</h2>
        <dl className="mt-2 divide-y divide-warm-100">
          <Row label="讀者" edit={e('reader')}>{labelOf(READER_OPTIONS, draft.audience.reader)}</Row>
          <Row label="書中稱呼" edit={e('reader')}>{draft.audience.call_name}</Row>
          <Row label="扉頁題字" edit={e('dedication')}>{draft.audience.dedication.trim() || '（不需要）'}</Row>
        </dl>
      </section>
    </div>
  );
}
