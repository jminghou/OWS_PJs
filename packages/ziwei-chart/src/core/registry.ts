/**
 * 編碼 → 顯示名稱查詢中心 —— 移植自 engine CodeRegistry + star_codes.json。
 * 純資料表，供前端標籤 / tooltip / 小星文字使用。
 */

import type { SihuaCode } from "./constants";

/** 星曜編碼 → 中文名（來源：p01_count config/encoding_mappings/star_codes.json，反轉）。 */
export const STAR_NAME_ZH: Record<string, string> = {
  POL: "紫微", HPI: "天機", SUN: "太陽", MAR: "武曲", HAR: "天同",
  MAG: "廉貞", TRE: "天府", MOO: "太陰", AWO: "貪狼", GGA: "巨門",
  MIN: "天相", BLE: "天梁", VAN: "七殺", BRE: "破軍",
  LHA: "左輔", RHA: "右弼", AAC: "文昌", AAR: "文曲", GLA: "擎羊",
  STO: "陀羅", FSP: "火星", CHI: "鈴星", CPA: "天魁", CAI: "天鉞",
  DIV: "祿存", HHO: "天馬", EVO: "地空", MAE: "地劫", ECA: "華蓋",
  RPH: "紅鸞", HJO: "天喜", PPO: "咸池", GLM: "天姚", DIS: "天刑",
  SHA: "陰煞", RES: "解神", JUP: "歲建", WTI: "白虎", DVI: "龍德",
  CGU: "吊客", SCH: "病符", "3PL": "三台", "8ST": "八座", MGT: "喪門",
  SHM: "天巫", WEE: "天哭", OFC: "天官", GEN: "天才", AIL: "天月",
  VOI: "天虛", NOB: "天貴", FEA: "天福", LON: "天壽", LNR: "孤辰",
  EDI: "封誥", WID: "寡宿", CMD: "將星", SDR: "小耗", INT: "截空",
  RST: "息神", SLA: "指背", GLO: "晦氣", LSA: "月煞", CSH: "災煞",
  SHT: "破碎", SHK: "貫索", VDN: "亡神", POD: "台輔", PHO: "鳳閣",
  DRA: "龍池", STD: "攀鞍", HIA: "旬空", YHO: "歲驛", MDR: "大耗",
  ROB: "劫殺", GRA: "恩光", GOS: "蜚廉", PRV: "天德",
  dGL: "大羊", dST: "大陀", dCP: "大魁", dCA: "大鉞", dDI: "大祿",
  dHH: "大馬", dRP: "大鸞", dHJ: "大喜",
};

/** 宮位編碼 → 中文名（來源：p_a_foundation palace_codes.json）。 */
export const PALACE_NAME_ZH: Record<string, string> = {
  "1": "命宮", "2": "兄弟", "3": "夫妻", "4": "子女",
  "5": "財帛", "6": "疾厄", "7": "遷移", "8": "交友",
  "9": "官祿", A: "田宅", B: "福德", C: "父母",
};

/** 宮位編碼 → 英文名（與 p_e_artist composer._PALACE_EN 一致）。 */
export const PALACE_NAME_EN: Record<string, string> = {
  "1": "Destiny", "2": "Siblings", "3": "Marriage", "4": "Children",
  "5": "Wealth", "6": "Health", "7": "Mobility", "8": "Friends",
  "9": "Career", A: "Estate", B: "Virtue", C: "Parents",
};

/** 地支兩位碼 → 中文字。 */
export const BRANCH_NAME_ZH: Record<string, string> = {
  "01": "子", "02": "丑", "03": "寅", "04": "卯",
  "05": "辰", "06": "巳", "07": "午", "08": "未",
  "09": "申", "10": "酉", "11": "戌", "12": "亥",
};

/** 四化碼 → 中文名。 */
export const SIHUA_NAME_ZH: Record<SihuaCode, string> = {
  FO: "化祿", PW: "化權", HO: "化科", BI: "化忌",
};

/** 亮度碼 → 中文（七級：廟旺得利平不陷）。 */
export const BRIGHTNESS_NAME_ZH: Record<string, string> = {
  P3: "廟", P2: "旺", P1: "得", P0: "利", N1: "平", N2: "不", N3: "陷",
};
export function brightnessNameZh(code: string | null): string {
  if (!code) return "";
  return BRIGHTNESS_NAME_ZH[code] ?? "";
}

// 流曜中文名生成（y*/s* 未列於 star_codes.json，依樣式組名）。
const _FLOW_PREFIX_ZH: Record<string, string> = { d: "大", y: "流", s: "小" };
const _FLOW_SUFFIX_ZH: Record<string, string> = {
  GL: "羊", ST: "陀", CP: "魁", CA: "鉞", DI: "祿", HH: "馬", RP: "鸞", HJ: "喜",
};

function flowStarNameZh(code: string): string | null {
  const m = /^([dys])(GL|ST|CP|CA|DI|HH|RP|HJ)$/.exec(code);
  if (!m) return null;
  return _FLOW_PREFIX_ZH[m[1]] + _FLOW_SUFFIX_ZH[m[2]];
}

export function starNameZh(code: string): string {
  return STAR_NAME_ZH[code] ?? flowStarNameZh(code) ?? code;
}
export function palaceNameZh(code: string): string {
  return PALACE_NAME_ZH[code] ?? code;
}
export function palaceNameEn(code: string): string {
  return PALACE_NAME_EN[code] ?? "";
}
export function branchNameZh(code: string): string {
  return BRANCH_NAME_ZH[code] ?? code;
}

// 宮名序列（命→兄→夫→…→父），與 PALACE_NAME_ZH/EN 的編碼順序一致。
const _NAME_SEQ_CODES = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "A", "B", "C"];

/**
 * 流盤宮名重排：給「該層命宮所在地支」，回傳 地支碼 → {zh,en} 宮名。
 * 規律與本命一致：命宮在 mingBranch，後續宮位地支每 -1（卯→寅→丑…）。
 * 供大限/流年切換時，整組宮名隨命宮位移。
 */
export function palaceNamesByMingBranch(
  mingBranch: string,
): Record<string, { zh: string; en: string }> {
  const mingInt = parseInt(mingBranch, 10);
  const out: Record<string, { zh: string; en: string }> = {};
  if (!mingInt || Number.isNaN(mingInt)) return out;
  for (let k = 0; k < 12; k++) {
    const b = (((mingInt - 1 - k) % 12) + 12) % 12 + 1;
    const code = _NAME_SEQ_CODES[k];
    out[String(b).padStart(2, "0")] = {
      zh: PALACE_NAME_ZH[code],
      en: PALACE_NAME_EN[code],
    };
  }
  return out;
}
