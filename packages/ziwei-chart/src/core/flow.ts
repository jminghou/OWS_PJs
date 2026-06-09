/**
 * 流盤資料模型（v2）。目前支援大限層。
 * 對應後端 /calculate 回傳的 `flow` 區塊（flow_contract.py 產生）。
 */
import { parseChart, type ChartData, type RawChartJson } from "./model";

export interface FlowDecade {
  /** 大限順序 1..12。 */
  order: number;
  /** 歲數區間，例 "4-13"。 */
  ageRange: string;
  /** 西元年區間，例 "1990-1999"。 */
  yearRange: string;
  /** 大限名稱，例 "癸卯限"。 */
  name: string;
  /** 該大限命宮所在地支兩位碼。 */
  mingBranch: string;
  /** 該大限的正規化命盤（含十四主星 + 大限流曜 + 大限四化）。 */
  data: ChartData;
}

/** 流年 / 小限 共用的逐歲層。 */
export interface FlowAgeEntry {
  /** 虛歲。 */
  age: number | null;
  /** 西元年。 */
  year: number | null;
  /** 干支，例 "甲午"。 */
  name: string;
  /** 該層命宮所在地支兩位碼。 */
  mingBranch: string;
  /** 該層正規化命盤（含流曜 + 該層四化）。 */
  data: ChartData;
}

export interface FlowData {
  decades: FlowDecade[];
  years: FlowAgeEntry[];
  smallLimits: FlowAgeEntry[];
}

interface RawFlowDecade {
  order: number;
  ageRange?: string;
  yearRange?: string;
  name?: string;
  mingBranch?: string;
  chart: RawChartJson;
}
interface RawFlowAge {
  age?: number | null;
  year?: number | null;
  name?: string;
  mingBranch?: string;
  chart: RawChartJson;
}
interface RawFlow {
  decades?: RawFlowDecade[];
  years?: RawFlowAge[];
  smallLimits?: RawFlowAge[];
}

function parseAgeLayer(arr: RawFlowAge[] | undefined): FlowAgeEntry[] {
  if (!Array.isArray(arr)) return [];
  return arr.map((e) => ({
    age: e.age ?? null,
    year: e.year ?? null,
    name: e.name ?? "",
    mingBranch: e.mingBranch ?? "",
    data: parseChart(e.chart),
  }));
}

/** 解析後端 flow 區塊；無資料回 null。 */
export function parseFlow(raw: unknown): FlowData | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as RawFlow;
  const decades = Array.isArray(r.decades)
    ? r.decades.map((d) => ({
        order: d.order,
        ageRange: d.ageRange ?? "",
        yearRange: d.yearRange ?? "",
        name: d.name ?? "",
        mingBranch: d.mingBranch ?? "",
        data: parseChart(d.chart),
      }))
    : [];
  const years = parseAgeLayer(r.years);
  const smallLimits = parseAgeLayer(r.smallLimits);
  if (decades.length === 0 && years.length === 0 && smallLimits.length === 0) {
    return null;
  }
  return { decades, years, smallLimits };
}
