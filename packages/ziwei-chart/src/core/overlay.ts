/**
 * 疊盤（本命底＋大限／小限／流年 疊色層）—— 對應 PolarisUI
 * logic/artist/overlay_chart.py ＋ overlay_resolver.py 的選層規則：
 *
 *   目標西元年 → 虛歲 → 該歲所屬大限、小限、流年三層（各自可開關）
 *   巢狀大限：大限層關閉、但小限或流年開著時，仍帶「所在大限」的四化與流曜
 *            （十年有效），只是不畫大限宮名（避免與流年宮名並排難辨）。
 *            童限期沿用第 1 大限、超齡取最後一個（與引擎一致）。
 *
 * 純資料，無 React 相依。配色見 theme.colors.layer*（對應 p_e_artist overlay_config.py）。
 */
import type { FlowAgeEntry, FlowData, FlowDecade } from "./flow";
import type { ChartData } from "./model";
import { FLOW_STAR_RE } from "./constants";

export type OverlayKind = "decade" | "small" | "year";

/** 疊層由底到頂的順序（四化徽章與流曜都依此排）。 */
export const OVERLAY_ORDER: readonly OverlayKind[] = ["decade", "small", "year"];

export const OVERLAY_LABEL: Record<OverlayKind, string> = {
  decade: "大限",
  small: "小限",
  year: "流年",
};

/** 流曜後綴 → 對應本命星曜圖示碼（大羊→GLA…，同 overlay_resolver._FLOW_SUFFIX_TO_ICON）。 */
const FLOW_SUFFIX_TO_ICON: Record<string, string> = {
  GL: "GLA", ST: "STO", CA: "CAI", CP: "CPA", DI: "DIV", HH: "HHO", RP: "RPH", HJ: "HJO",
};
const KIND_PREFIX: Record<OverlayKind, string> = { decade: "d", small: "s", year: "y" };

/** 使用者的疊層選擇。全部關閉＝本命單盤。 */
export interface OverlaySelection {
  decade: boolean;
  small: boolean;
  year: boolean;
  /** 目標西元年。 */
  targetYear: number;
  /** 巢狀大限（預設 true）。 */
  nested?: boolean;
}

export interface OverlayLayer {
  kind: OverlayKind;
  /** 巢狀大限：只帶四化與流曜，不畫宮名。 */
  nested: boolean;
  /** 該層命宮所在地支；巢狀層為 null（不畫宮名環）。 */
  mingBranch: string | null;
  /** 星曜碼 → 該層四化碼。 */
  sihua: Record<string, string>;
  /** 地支 → 該層流曜圖示碼（GLA/STO/…）。 */
  flowStars: Record<string, string[]>;
}

export interface OverlayResult {
  year: number;
  /** 虛歲。 */
  age: number | null;
  /** 流年干支（例「丙午」）。 */
  ganzhi: string;
  decade: FlowDecade | null;
  small: FlowAgeEntry | null;
  yearEntry: FlowAgeEntry | null;
  /** 由底到頂（大限→小限→流年）；空陣列＝本命單盤。 */
  layers: OverlayLayer[];
}

/** 此盤可選的西元年範圍（取流年層；沒有就取小限層）。 */
export function overlayYearRange(flow: FlowData): [number, number] | null {
  const ys = (flow.years.length ? flow.years : flow.smallLimits)
    .map((e) => e.year)
    .filter((y): y is number => y != null);
  return ys.length ? [Math.min(...ys), Math.max(...ys)] : null;
}

function parseAgeRange(s: string): [number, number] | null {
  const m = /(\d+)\D+(\d+)/.exec(s || "");
  return m ? [Number(m[1]), Number(m[2])] : null;
}

/** 歲數 → 所屬大限；未起運時 strict 回 null，非 strict 沿用第 1 大限、超齡取最後一個。 */
export function decadeForAge(flow: FlowData, age: number, strict = true): FlowDecade | null {
  const spans = flow.decades
    .map((d) => ({ d, r: parseAgeRange(d.ageRange) }))
    .filter((x): x is { d: FlowDecade; r: [number, number] } => x.r !== null)
    .sort((a, b) => a.r[0] - b.r[0]);
  const hit = spans.find((x) => x.r[0] <= age && age <= x.r[1]);
  if (hit) return hit.d;
  if (strict || !spans.length) return null;
  return age < spans[0].r[0] ? spans[0].d : spans[spans.length - 1].d;
}

function layerFrom(kind: OverlayKind, data: ChartData, mingBranch: string | null, nested = false): OverlayLayer {
  const sihua: Record<string, string> = {};
  for (const e of data.sihuaSummary) sihua[e.starCode] = e.sihuaCode;
  // 只取本層自己的流曜（流年盤內也帶巢狀大限流曜 dXX，那屬於大限層）
  const flowStars: Record<string, string[]> = {};
  for (const p of Object.values(data.palaces)) {
    for (const s of p.minors) {
      const m = FLOW_STAR_RE.exec(s.code);
      if (!m || m[1] !== KIND_PREFIX[kind]) continue;
      const icon = FLOW_SUFFIX_TO_ICON[m[2]];
      if (icon) (flowStars[s.branch] ??= []).push(icon);
    }
  }
  return { kind, nested, mingBranch, sihua, flowStars };
}

/** 依選擇解析疊層。找不到目標年（超出 1–120 歲）時 layers 為空。 */
export function resolveOverlay(flow: FlowData, sel: OverlaySelection): OverlayResult {
  const yearEntry = flow.years.find((e) => e.year === sel.targetYear) ?? null;
  const smallByYear = flow.smallLimits.find((e) => e.year === sel.targetYear) ?? null;
  const age = yearEntry?.age ?? smallByYear?.age ?? null;
  const small =
    (age != null ? flow.smallLimits.find((e) => e.age === age) : null) ?? smallByYear;
  const result: OverlayResult = {
    year: sel.targetYear,
    age,
    ganzhi: yearEntry?.name ?? small?.name ?? "",
    decade: age != null ? decadeForAge(flow, age) : null,
    small,
    yearEntry,
    layers: [],
  };
  if (age == null) return result;

  if (sel.decade) {
    if (result.decade) result.layers.push(layerFrom("decade", result.decade.data, result.decade.mingBranch));
  } else if ((sel.nested ?? true) && (sel.small || sel.year)) {
    const d = decadeForAge(flow, age, false);
    if (d) result.layers.push(layerFrom("decade", d.data, null, true));
  }
  if (sel.small && small) result.layers.push(layerFrom("small", small.data, small.mingBranch));
  if (sel.year && yearEntry) result.layers.push(layerFrom("year", yearEntry.data, yearEntry.mingBranch));
  return result;
}
