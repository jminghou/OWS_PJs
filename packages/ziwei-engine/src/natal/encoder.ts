/**
 * 本命盤編碼（v2.3）：core/encoder.py 的對應物。
 * encoded_array 是整條鏈的中間契約（DB 存的就是它），順序與 Python 逐字一致。
 */
import earthlyBranchCodes from "../data/earthly_branch_codes.json";
import heavenlyStemCodes from "../data/heavenly_stem_codes.json";
import palaceCodes from "../data/palace_codes.json";
import sihuaCodes from "../data/sihua_codes.json";
import starCodes from "../data/star_codes.json";
import type { NatalChart } from "./chart";

export const PALACE_CODE_MAP: Record<string, string> = palaceCodes;
export const STAR_CODE_MAP: Record<string, string> = starCodes;
export const BRANCH_CODE_MAP: Record<string, string> = earthlyBranchCodes;
export const STEM_CODE_MAP: Record<string, string> = heavenlyStemCodes;
export const SIHUA_CODE_MAP: Record<string, string> = sihuaCodes;

export const ENCODING_VERSION = "2.3";
const SPECIAL_PREFIXES = new Set(["Q", "L", "M", "G", "I", "Y"]);
const PALACE_ORDER = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "A", "B", "C"];

/** 地支 → 宮位代碼（由宮位資料動態建） */
export function buildBranchToPalaceMap(chart: NatalChart): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, info] of Object.entries(chart.宮位資料)) {
    const code = PALACE_CODE_MAP[name];
    if (info.宮位 && code) out[info.宮位] = code;
  }
  return out;
}

export function encodeNatalArray(chart: NatalChart): string[] {
  const ebToPalace = buildBranchToPalaceMap(chart);
  const starToSihua: Record<string, string> = {};
  for (const [type, info] of Object.entries(chart.四化資料)) {
    if (info.星曜) starToSihua[info.星曜] = type;
  }

  const list: string[] = [];
  const bodyEb = chart.命盤數據.身宮;

  // 4.1 身宮
  const bodyPalace = bodyEb ? ebToPalace[bodyEb] : undefined;
  if (bodyPalace) list.push(`Q${bodyPalace}`);
  // 4.2 命主 / 4.3 身主
  const lm = STAR_CODE_MAP[chart.命盤數據.命主];
  if (lm) list.push(`L${lm}`);
  const bm = STAR_CODE_MAP[chart.命盤數據.身主];
  if (bm) list.push(`M${bm}`);
  // 4.4 性別
  if (chart.基本資料.性別 === "男") list.push("GM");
  else if (chart.基本資料.性別 === "女") list.push("GF");
  // 4.5 生年干支
  const sc = STEM_CODE_MAP[chart.曆法數據.出生年干];
  const bc = BRANCH_CODE_MAP[chart.曆法數據.出生年支];
  if (sc && bc) list.push(`Y${sc}${bc}`);
  // 4.6 身宮星曜
  if (bodyEb) {
    for (const stars of Object.values(chart.星曜資料)) {
      for (const [star, eb] of Object.entries(stars)) {
        if (eb !== bodyEb) continue;
        const s = STAR_CODE_MAP[star];
        const e = BRANCH_CODE_MAP[eb];
        if (!s || !e) continue;
        list.push(`Q${s}${e}`);
        const sh = starToSihua[star] && SIHUA_CODE_MAP[starToSihua[star]];
        if (sh) list.push(`Q${s}${sh}`);
      }
    }
  }
  // 4.7 亮度
  for (const [star, val] of Object.entries(chart.星曜亮度)) {
    const s = STAR_CODE_MAP[star];
    if (!s) continue;
    const v = val.trim();
    const sign = v.startsWith("-") ? "N" : "P";
    const num = v.replace(/^[-+]/, "");
    list.push(`I${s}${sign}${num}`);
  }
  // 5 所有宮位星曜
  for (const stars of Object.values(chart.星曜資料)) {
    for (const [star, eb] of Object.entries(stars)) {
      const s = STAR_CODE_MAP[star];
      if (!s) continue;
      const e = BRANCH_CODE_MAP[eb];
      if (!e) continue;
      const p = ebToPalace[eb];
      if (!p) continue;
      list.push(`${p}${s}${e}`);
      const sh = starToSihua[star] && SIHUA_CODE_MAP[starToSihua[star]];
      if (sh) list.push(`${p}${s}${sh}`);
    }
  }
  // 6 特殊碼在前，宮位碼依宮序穩定排序
  const special = list.filter((c) => SPECIAL_PREFIXES.has(c[0]));
  const palaceCodesList = list.filter((c) => !SPECIAL_PREFIXES.has(c[0]));
  const order = (c: string) => { const i = PALACE_ORDER.indexOf(c[0]); return i < 0 ? 99 : i; };
  palaceCodesList.sort((a, b) => order(a) - order(b)); // Array.prototype.sort 穩定（ES2019+）
  return [...special, ...palaceCodesList];
}

export interface NatalEncoding {
  encoding_version: string;
  encoding_type: "full_chart";
  natal_chart_encoding: Array<{ chart_type: "natal"; encoded_array: string[] }>;
}

export function encodeChartData(chart: NatalChart): NatalEncoding {
  return {
    encoding_version: ENCODING_VERSION,
    encoding_type: "full_chart",
    natal_chart_encoding: [{ chart_type: "natal", encoded_array: encodeNatalArray(chart) }],
  };
}
