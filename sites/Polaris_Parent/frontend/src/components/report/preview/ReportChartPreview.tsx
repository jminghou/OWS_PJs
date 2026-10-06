'use client';

import { useMemo } from 'react';
import { ZiweiChart, NAMED_THEMES } from '@ows/ziwei-chart';
// 直接用瀏覽器引擎：付款前預覽不打任何後端或紫微 API（docs/membership-v2-architecture.md）。
// 不走 astrologyApi.calculate，因為它在本地算失敗時會退回後端。
import { calculateLocal } from '@ows/ziwei-app/api/localEngine';
import type { ReportDraft } from '@/lib/report/draft';

function chartOf(draft: ReportDraft) {
  try {
    const [year, month, day] = draft.birth.date.split('-').map(Number);
    const [hour, minute] = draft.birth.time.split(':').map(Number);
    const solar = draft.birth.time_type === 'solar_time';
    const res = calculateLocal({
      year, month, day, hour, minute,
      gender: draft.gender,
      name: draft.subject_name,
      time_type: draft.birth.time_type,
      ...(solar ? { place: { country: draft.place.country, city: draft.place.city } } : {}),
      include_chart_json: true,
    });
    return res.chart_json;
  } catch {
    return null;
  }
}

/** 預覽頁的命盤：與報告附錄同一張本命盤 */
export default function ReportChartPreview({ draft }: { draft: ReportDraft }) {
  const chart = useMemo(() => chartOf(draft), [draft]);
  if (!chart) {
    return (
      <p className="rounded-inner bg-tint px-[18px] py-[14px] text-sm text-text">
        命盤預覽暫時無法顯示，不影響下單；報告會依你填寫的出生資料製作。
      </p>
    );
  }
  return <ZiweiChart chart={chart} theme={NAMED_THEMES.light} />;
}
