'use client';

import { forwardRef } from 'react';
import Link from 'next/link';
import type { TimeType, ZiweiPlace } from '../api/astrology';
import { ZiweiChart, NAMED_THEMES } from '@ows/ziwei-chart';
import type { ZiweiCalcResponse } from '../api/astrology';

/** 存盤／暫存用的命盤資料（對應 astrologyApi.saveMyChart 與 stashPendingChart）。 */
export interface ZiweiChartPayload {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  gender: string;
  name: string;
  place: string;
  relation: string;
  /** 存盤時依出生地換算用（見 SaveMyChartRequest） */
  time_type?: TimeType;
  birth_place?: ZiweiPlace;
}

interface ZiweiChartResultProps {
  result: ZiweiCalcResponse;
  /** 排出這張盤時送出的資料（目前未用；保留給日後把這張盤帶進購買流程） */
  payload: ZiweiChartPayload;
}

/**
 * 排盤結果：完整版互動命盤（本命＋大限／小限／流年疊盤切換）＋唯一的 CTA。/ziwei 的完整表單與首頁的滾輪排盤共用。
 * 新版規劃：會員中心不再放命盤（只有訂購與報告），所以 CTA 不分登入與否，一律導向購買報告 /report。
 */
const ZiweiChartResult = forwardRef<HTMLDivElement, ZiweiChartResultProps>(function ZiweiChartResult(
  { result }, ref,
) {
  const mingGong = result.data?.['宮位資料']?.['命宮'];

  return (
    <div
      ref={ref}
      className="scroll-mt-20 bg-white rounded-banner border border-warm-200/70 shadow-[0_8px_30px_rgba(139,92,246,0.06)] p-4 sm:p-6"
    >
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 mb-4 text-sm text-gray-600">
        <span>
          命盤 ID：<span className="font-mono">{result.chart_id}</span>
        </span>
        {mingGong && (
          <span>
            命宮：{mingGong['宮位']}（{mingGong['干支']}）
          </span>
        )}
        {result.solar_time && <span>真太陽時：{result.solar_time}</span>}
      </div>

      {/* 互動命盤（含疊盤切換）；chart_json 缺失時退回靜態 SVG */}
      {result.chart_json ? (
        <ZiweiChart chart={result.chart_json} flow={result.flow ?? undefined} theme={NAMED_THEMES.light} />
      ) : result.svg ? (
        <div
          className="w-full overflow-x-auto flex justify-center [&>svg]:max-w-full [&>svg]:h-auto"
          // SVG 由自家後端 p_e_artist 產生（可信來源）
          dangerouslySetInnerHTML={{ __html: result.svg }}
        />
      ) : (
        <p className="text-sm text-amber-600">
          命盤資料已產生，但圖檔渲染失敗。
        </p>
      )}

      {/* 唯一的按鈕：為這張命盤撰寫報告 → 購買報告 */}
      <div className="mt-6 text-center">
        <Link
          href="/report"
          // 與 @ows/ui Button 預設樣式一致（原本的 CTA 就是 Button＋品牌紫）
          className="inline-flex h-10 items-center justify-center rounded-md bg-brand-purple-600 px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-brand-purple-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          為這張命盤撰寫報告
        </Link>
      </div>
    </div>
  );
});

export default ZiweiChartResult;
