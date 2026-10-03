import { READER_OPTIONS, RELATION_OPTIONS, variantInfo } from '@/lib/report/catalog';
import { placeLabel, type ReportDraft } from '@/lib/report/draft';

const labelOf = (opts: { value: string; label: string }[], v: string) => opts.find((o) => o.value === v)?.label ?? v;

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-3 py-2.5 text-sm sm:grid-cols-[9rem_1fr]">
      <dt className="text-gray-500">{label}</dt>
      <dd className="whitespace-pre-line break-words text-gray-900">{children}</dd>
    </div>
  );
}

/** 下單草稿的摘要（確認頁、結帳頁共用）。出生資料集中呈現，讓購買者付款前再核對一次。 */
export default function ReportDraftSummary({ draft }: { draft: ReportDraft }) {
  const place = placeLabel(draft);
  return (
    <div className="space-y-5">
      <section className="rounded-banner border border-warm-200/70 bg-white p-5 sm:p-6">
        <h2 className="text-base font-bold text-gray-900">版本</h2>
        <dl className="mt-2 divide-y divide-warm-100">
          <Row label="版本">{variantInfo(draft.variant).label}</Row>
        </dl>
      </section>

      <section className="rounded-banner border-2 border-brand-purple-200 bg-white p-5 sm:p-6">
        <h2 className="text-base font-bold text-gray-900">報告主角與出生資料</h2>
        <p className="mt-1 text-xs text-gray-500">報告依這些資料製作，付款後無法直接修改，請仔細核對。</p>
        <dl className="mt-2 divide-y divide-warm-100">
          <Row label="姓名">{draft.subject_name}</Row>
          <Row label="性別">{draft.gender}</Row>
          <Row label="與你的關係">{labelOf(RELATION_OPTIONS, draft.relation_label)}</Row>
          <Row label="出生日期">{draft.birth.date}（國曆）</Row>
          <Row label="出生時間">
            {draft.birth.time}（{draft.birth.time_type === 'solar_time' ? '真太陽時' : '一般時間'}）
          </Row>
          {place && <Row label="出生地">{place}</Row>}
        </dl>
      </section>

      <section className="rounded-banner border border-warm-200/70 bg-white p-5 sm:p-6">
        <h2 className="text-base font-bold text-gray-900">讀者設定</h2>
        <dl className="mt-2 divide-y divide-warm-100">
          <Row label="讀者">{labelOf(READER_OPTIONS, draft.audience.reader)}</Row>
          <Row label="書中稱呼">{draft.audience.call_name}</Row>
          <Row label="扉頁題字">{draft.audience.dedication.trim() || '（不需要）'}</Row>
        </dl>
      </section>
    </div>
  );
}
