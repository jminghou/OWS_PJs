'use client';

import { forwardRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ZiweiChart, NAMED_THEMES } from '@ows/ziwei-chart';
import Button from '@ows/ui/ui/Button';
import { useAuthStore } from '@ows/platform-api';
import { stashPendingChart } from '../pendingChart';
import { astrologyApi, type ZiweiCalcResponse } from '../api/astrology';

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
}

interface ZiweiChartResultProps {
  result: ZiweiCalcResponse;
  /** 排出這張盤時送出的資料；CTA 存的就是它 */
  payload: ZiweiChartPayload;
}

/**
 * 排盤結果：互動命盤（本命層）＋唯一的 CTA。/ziwei 的完整表單與首頁的滾輪排盤共用。
 * - 未登入：CTA「加入會員，儲存這張命盤」→ 暫存命盤並前往
 *   /login?mode=register，註冊／登入成功後命盤自動存入帳號並直開詳情頁。
 * - 已登入：CTA「儲存並開啟進階命盤」→ 直接把剛排的盤存進帳號
 *   （後端有去重，重複儲存回既有盤），再導向該命盤詳情頁。
 */
const ZiweiChartResult = forwardRef<HTMLDivElement, ZiweiChartResultProps>(function ZiweiChartResult(
  { result, payload }, ref,
) {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [ctaBusy, setCtaBusy] = useState(false);
  const [ctaError, setCtaError] = useState('');

  // ── 訪客 CTA：暫存剛排的命盤 → 前往登入／註冊合一頁 ──
  const goJoin = () => {
    stashPendingChart(payload);
    router.push('/login?mode=register');
  };

  // ── 會員 CTA：直接把剛排的盤存進帳號（後端去重），再開該命盤詳情頁 ──
  const goAdvanced = async () => {
    setCtaBusy(true);
    setCtaError('');
    try {
      const res = await astrologyApi.saveMyChart(payload);
      router.push(`/account/charts/${res.chart_id}`);
    } catch (err: any) {
      if (err?.status === 401) {
        // 登入狀態已過期（本地狀態過時）→ 退回訪客流程：暫存後前往登入
        stashPendingChart(payload);
        router.push('/login');
        return;
      }
      setCtaError(err.message || '儲存失敗，請稍後再試');
      setCtaBusy(false);
    }
    // 成功導頁時不重設 busy，避免按鈕在跳轉前閃回可按狀態
  };

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

      {/* 互動命盤（本命層）；chart_json 缺失時退回靜態 SVG */}
      {result.chart_json ? (
        <ZiweiChart chart={result.chart_json} theme={NAMED_THEMES.light} />
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

      {/* 唯一的按鈕：依登入狀態決定 CTA */}
      <div className="mt-6 text-center">
        {ctaError && (
          <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-banner text-red-700 text-sm">
            {ctaError}
          </div>
        )}
        {isAuthenticated ? (
          <>
            <Button
              type="button"
              onClick={goAdvanced}
              disabled={ctaBusy}
              className="bg-brand-purple-600 hover:bg-brand-purple-700"
            >
              {ctaBusy ? '儲存中…' : '儲存並開啟進階命盤'}
            </Button>
            <p className="mt-3 text-xs text-gray-400">
              會把這張命盤存進你的帳號（重複儲存不會建立新盤），並開啟大限／流年、版型切換與下載等進階功能。
            </p>
          </>
        ) : (
          <>
            <Button
              type="button"
              onClick={goJoin}
              className="bg-brand-purple-600 hover:bg-brand-purple-700"
            >
              加入會員，儲存這張命盤
            </Button>
            <p className="mt-3 text-xs text-gray-400">
              註冊後會自動把這張命盤存進帳號，並解鎖大限／流年、版型切換與下載等進階功能。
            </p>
          </>
        )}
      </div>
    </div>
  );
});

export default ZiweiChartResult;
