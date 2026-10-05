/**
 * 前端排盤：用 @ows/ziwei-engine 在瀏覽器算，不打後端 /astrology/calculate。
 *
 * 回傳形狀與後端 ZiweiCalcResponse 完全相同，呼叫端不用改。差別只有一個：
 * `svg`（p_e_artist 靜態圖）仍是後端的事，本地算不出來；astrologyApi.calculate 會在
 * 呼叫端要 render 時另外向後端只取 SVG（會員頁下載用），公開頁不再請求。
 *
 * 切換：NEXT_PUBLIC_ZIWEI_ENGINE=api → 全部回到後端（feature flag，後端路由保留）。
 * 本地算失敗（例如離線地點表沒有該城市）時，astrologyApi 會自動退回後端。
 */
import {
  calculateChart,
  buildV3Views,
  geographicHierarchy,
  type CalculateInput,
} from '@ows/ziwei-engine';
import type { GeoHierarchy, ZiweiCalcRequest, ZiweiCalcResponse } from './astrology';

export type EngineMode = 'local' | 'api';

/** 目前的排盤引擎模式（build 期由 NEXT_PUBLIC_ZIWEI_ENGINE 決定；預設 local）。 */
export function engineMode(): EngineMode {
  const v = (process.env.NEXT_PUBLIC_ZIWEI_ENGINE || '').trim().toLowerCase();
  return v === 'api' ? 'api' : 'local';
}

const GENDER: Record<string, '男' | '女'> = {
  男: '男', 女: '女', m: '男', f: '女', male: '男', female: '女',
};

export function normalizeGender(v: string | undefined): '男' | '女' {
  const g = GENDER[(v || '').trim().toLowerCase()] ?? GENDER[(v || '').trim()];
  if (!g) throw new Error('gender 必須為 男/女（或 M/F）');
  return g;
}

/** 與後端 /astrology/calculate 同義的本地實作（不含 svg）。 */
export function calculateLocal(req: ZiweiCalcRequest): ZiweiCalcResponse {
  const timeType = req.time_type ?? 'clock_time';
  const input: CalculateInput = {
    year: req.year, month: req.month, day: req.day, hour: req.hour,
    minute: req.minute ?? 0,
    gender: normalizeGender(req.gender),
    name: (req.name || '').trim(),
    timeType,
    place: req.place,
  };
  const includeFlow = !!req.include_flow;
  const r = calculateChart(input, { includeFlow });

  const chart = r.chart as Record<string, any>;
  const data: Record<string, any> = {
    曆法數據: chart['曆法數據'],
    命盤數據: chart['命盤數據'],
    宮位資料: chart['宮位資料'],
    星曜資料: chart['星曜資料'],
    星曜亮度: chart['星曜亮度'],
    四化資料: chart['四化資料'],
    基本資料: chart['基本資料'],
    chart_id: r.chart.chart_id,
    ...(r.flowRaw ?? {}),
    快速條件編碼: r.encoding,
  };

  let star_energy: ZiweiCalcResponse['star_energy'] = null;
  let readings: ZiweiCalcResponse['readings'] = null;
  if (req.include_star_energy || req.include_readings) {
    const views = buildV3Views(r.encoding.natal_chart_encoding[0].encoded_array, {
      starEnergy: !!req.include_star_energy,
      readings: !!req.include_readings,
      kinds: req.star_energy_kinds ?? null,
    });
    star_energy = (views.star_energy as unknown as ZiweiCalcResponse['star_energy']) ?? null;
    readings = (views.readings as unknown as ZiweiCalcResponse['readings']) ?? null;
  }

  return {
    success: true,
    chart_id: r.chart.chart_id,
    time_type: r.time_type,
    solar_time: r.solar_time,
    data,
    svg: null,
    chart_json: req.include_chart_json ? (r.chart_json as Record<string, any>) : null,
    flow: req.include_chart_json && includeFlow ? (r.flow as Record<string, any> | null) : null,
    star_energy,
    readings,
  };
}

/** 與後端 GET /astrology/geo-options 同義（離線地點表）。 */
export function geoOptionsLocal(): GeoHierarchy {
  return geographicHierarchy();
}
