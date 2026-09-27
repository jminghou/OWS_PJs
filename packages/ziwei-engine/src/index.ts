/**
 * @ows/ziwei-engine —— 紫微斗數排盤引擎（純 TypeScript）。
 *
 * Python 引擎（P_Union p01_count / p_d_graph_v3，vendored 於 Polaris_Parent 後端）的對應物。
 * 目標輸出契約就是 @ows/ziwei-chart 吃的 RawChartJson 與 FlowData；
 * 正確性由 test/golden 的黃金檔逐張比對保證（scripts/gen_ziwei_golden.py 產生）。
 *
 * 分層（對應 Python 子套件）：
 *   lunar/     sxtwl_utils               農曆、干支、節氣          ← P1 完成
 *   natal/     palace + stars + encoder  本命排盤與編碼            ← P2 完成
 *   convert/   convert/*                 encoded_array → chart_json ← P2 完成
 *   flow/      flow/* + encoder_flow + flow_contract  大限、流年、小限 ← P3
 *   starfield/ p_d_graph_v3              星曜能量、十二宮讀數      ← P3b
 *   solar/     s3_solar_time             真太陽時                  ← P4
 */
export * from "./lunar";
export { canonicalJson, sha256Of } from "./util/canonical";
export { generateChartId, parseChartId, hashNameToInt } from "./chartId";
export * from "./natal/palaces";
export * from "./natal/stars";
export * from "./natal/chart";
export * from "./natal/encoder";
export * from "./convert";
export * from "./flow/data";
export * from "./flow/encoder";
export * from "./flow/layers";
export * from "./starfield";
export * from "./solar";
export * from "./geo";

import { buildNatalChart, type NatalChart, type NatalInput } from "./natal/chart";
import { ENCODING_VERSION, encodeNatalArray } from "./natal/encoder";
import { encodedArrayToChartJson, type ChartJson } from "./convert";
import { buildFlowRaw, type FlowRaw } from "./flow/data";
import {
  calculateDecadeChartEncoding, calculateSmallLimitEncoding, calculateYearFlowEncoding,
  type AgeEncoding, type DecadeEncoding,
} from "./flow/encoder";
import { buildFlowLayers, type FlowLayers } from "./flow/layers";
import { getGeoInfo } from "./geo";
import { buildClockTimeStr, computeSolarTimeStr, parseTimeStr } from "./solar";

/** Python chart["快速條件編碼"] 的對應物 */
export interface FastEncoding {
  encoding_version: string;
  encoding_type: "full_chart";
  natal_chart_encoding: Array<{ chart_type: "natal"; encoded_array: string[] }>;
  decade_chart_encoding?: DecadeEncoding[];
  small_limit_encoding?: AgeEncoding[];
  year_flow_encoding?: AgeEncoding[];
}

export interface CalculateOptions {
  /** 算大限／流年／小限（預設 true；純本命排盤可關掉省時） */
  includeFlow?: boolean;
}

/** API /calculate 的輸入形狀：timeType=solar_time 時需 place，先換算真太陽時再排盤 */
export interface CalculateInput extends NatalInput {
  place?: { city: string; country: string };
}

export interface CalculateResult {
  chart: NatalChart;
  /** 真太陽時字串（'17 November 1980 at 09:56'）；clock_time 路徑為 null */
  solar_time: string | null;
  time_type: "clock_time" | "solar_time";
  flowRaw: FlowRaw | null;
  encoding: FastEncoding;
  /** @ows/ziwei-chart RawChartJson */
  chart_json: ChartJson;
  /** @ows/ziwei-chart FlowData（includeFlow=false 時 null） */
  flow: FlowLayers | null;
}

/** 排盤一條龍：本命 → 流盤資料 → 編碼 → chart_json ＋ flow。對應 API /calculate 的核心輸出。 */
export function calculateChart(input: CalculateInput, opts: CalculateOptions = {}): CalculateResult {
  const includeFlow = opts.includeFlow ?? true;
  const timeType = input.timeType ?? "clock_time";
  let natalInput: NatalInput = { ...input, timeType };
  let solarTime: string | null = null;
  if (timeType === "solar_time") {
    const city = (input.place?.city ?? "").trim();
    const country = (input.place?.country ?? "").trim();
    if (!city || !country) throw new Error("time_type=solar_time 需提供 place.city 與 place.country");
    const geo = getGeoInfo(city, country);
    if (!geo) throw new Error(`太陽時換算失敗：離線地點表沒有 ${city}, ${country}`);
    const clock = buildClockTimeStr(input.year, input.month, input.day, input.hour, input.minute ?? 0);
    solarTime = computeSolarTimeStr(clock, `${geo.place_en}, ${geo.coordinates}`, geo.timezone);
    if (solarTime) {
      const t = parseTimeStr(solarTime);
      natalInput = { ...natalInput, year: t.year, month: t.month, day: t.day, hour: t.hour, minute: t.minute };
    }
    natalInput.birthplace = `${city}, ${country}`;
  }
  const chart = buildNatalChart(natalInput);
  const natalArray = encodeNatalArray(chart);
  const encoding: FastEncoding = {
    encoding_version: ENCODING_VERSION,
    encoding_type: "full_chart",
    natal_chart_encoding: [{ chart_type: "natal", encoded_array: natalArray }],
  };
  let flowRaw: FlowRaw | null = null;
  let flow: FlowLayers | null = null;
  if (includeFlow) {
    flowRaw = buildFlowRaw(chart);
    encoding.decade_chart_encoding = calculateDecadeChartEncoding(natalArray, flowRaw);
    encoding.small_limit_encoding = calculateSmallLimitEncoding(natalArray, flowRaw);
    encoding.year_flow_encoding = calculateYearFlowEncoding(natalArray, flowRaw);
    flow = buildFlowLayers(
      encoding.decade_chart_encoding, encoding.year_flow_encoding, encoding.small_limit_encoding, flowRaw.大限四化,
    );
  }
  const chart_json = encodedArrayToChartJson(natalArray, chart.chart_id);
  return { chart, solar_time: solarTime, time_type: timeType, flowRaw, encoding, chart_json, flow };
}

/** 只排本命（等於 calculateChart(input, {includeFlow:false})） */
export const calculateNatal = (input: CalculateInput) => calculateChart(input, { includeFlow: false });
