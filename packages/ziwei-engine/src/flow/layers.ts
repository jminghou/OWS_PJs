/**
 * 流盤契約：Polaris_Parent 後端 flow_contract.py 的對應物。
 * 輸出形狀＝@ows/ziwei-chart 的 FlowData：
 *   { decades: [{order, ageRange, yearRange, name, mingBranch, chart}], years: [...], smallLimits: [...] }
 * 每層星盤用與本命相同的轉換器解 encoded_array，再清掉生年四化、改套該層四化。
 */
import { encodedArrayToChartJson, type ChartJson } from "../convert";
import { BRANCH_CODE_MAP, STAR_CODE_MAP } from "../natal/encoder";
import { FOUR_TRANSFORMATIONS } from "../natal/tables";
import type { DecadeSihua } from "./data";
import type { AgeEncoding, DecadeEncoding } from "./encoder";

const SIHUA_ZH_TO_CODE: Array<[string, string]> = [["祿", "FO"], ["權", "PW"], ["科", "HO"], ["忌", "BI"]];

export interface FlowDecade {
  order: number; ageRange: string; yearRange: string; name: string; mingBranch: string; chart: ChartJson;
}
export interface FlowAgeEntry {
  age: number | null; year: number | null; name: string; mingBranch: string; chart: ChartJson;
}
export interface FlowLayers { decades: FlowDecade[]; years: FlowAgeEntry[]; smallLimits: FlowAgeEntry[] }

function findPalaceOfStar(placements: ChartJson["placements"], starCode: string): string | null {
  for (const [pc, p] of Object.entries(placements)) if (starCode in (p.stars || {})) return pc;
  return null;
}

/** 清掉盤內生年四化，改套 {四化碼: 中文星名}（就地修改）。 */
export function applySihuaByNames(chart: ChartJson, namesByCode: Record<string, string>): void {
  const placements = chart.placements || {};
  for (const p of Object.values(placements)) for (const s of Object.values(p.stars || {})) s.sihua = null;
  const summary: ChartJson["sihua_summary"] = {};
  for (const [code, zh] of Object.entries(namesByCode)) {
    const sc = STAR_CODE_MAP[(zh || "").trim()];
    if (!sc) continue;
    const pc = findPalaceOfStar(placements, sc);
    if (pc === null) continue;
    placements[pc].stars[sc].sihua = code;
    summary[code] = { star: sc, palace: pc };
  }
  chart.sihua_summary = summary;
}

function decadeSihuaNames(dasian: DecadeSihua, order: number): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [zh, code] of SIHUA_ZH_TO_CODE) {
    const names = ((dasian[zh]?.星曜) || "").split(",").map((s) => s.trim());
    if (order - 1 >= 0 && order - 1 < names.length) out[code] = names[order - 1];
  }
  return out;
}

function stemSihuaNames(ganzhi: string): Record<string, string> {
  const stem = (ganzhi || "").trim().slice(0, 1);
  const table = FOUR_TRANSFORMATIONS[stem] ?? {};
  const out: Record<string, string> = {};
  for (const [zh, code] of SIHUA_ZH_TO_CODE) if (zh in table) out[code] = table[zh];
  return out;
}

function normalize(encoded: string[]): ChartJson | null {
  try {
    const ch = encodedArrayToChartJson(encoded);
    delete ch.chart_id; // Python serialize_chart 不帶 chart_id
    return ch;
  } catch {
    return null;
  }
}

export function buildDecadeLayer(enc: DecadeEncoding[], dasian: DecadeSihua | null): FlowDecade[] {
  const out: FlowDecade[] = [];
  for (const e of enc) {
    const ch = normalize(e.encoded_array);
    if (!ch) continue;
    let order = parseInt(e.decade_order, 10);
    if (Number.isNaN(order)) order = out.length + 1;
    if (dasian && Object.keys(dasian).length) applySihuaByNames(ch, decadeSihuaNames(dasian, order));
    out.push({
      order, ageRange: e.age_range, yearRange: e.year_range, name: e.decade_name,
      mingBranch: BRANCH_CODE_MAP[(e.palace_position || "").trim()] ?? "", chart: ch,
    });
  }
  return out;
}

export function buildAgeLayer(enc: AgeEncoding[]): FlowAgeEntry[] {
  const out: FlowAgeEntry[] = [];
  for (const e of enc) {
    const ch = normalize(e.encoded_array);
    if (!ch) continue;
    const gz = e.lunar_year || "";
    applySihuaByNames(ch, stemSihuaNames(gz));
    const age = parseInt(e.age, 10);
    const year = parseInt(e.western_year, 10);
    out.push({
      age: Number.isNaN(age) ? null : age, year: Number.isNaN(year) ? null : year, name: gz,
      mingBranch: BRANCH_CODE_MAP[(e.palace_position || "").trim()] ?? "", chart: ch,
    });
  }
  return out;
}

export function buildFlowLayers(
  decades: DecadeEncoding[], years: AgeEncoding[], small: AgeEncoding[], dasian: DecadeSihua | null,
): FlowLayers | null {
  const d = buildDecadeLayer(decades, dasian);
  const y = buildAgeLayer(years);
  const s = buildAgeLayer(small);
  if (!d.length && !y.length && !s.length) return null;
  return { decades: d, years: y, smallLimits: s };
}
