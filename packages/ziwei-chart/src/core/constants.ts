/**
 * 命盤結構常數 —— 移植自 p_e_artist（charts/natal/config.py、layout.py）。
 * 純資料，無 React / DOM 相依。
 */

/** 12 正宮編碼（依序：命→兄→夫→子→財→疾→遷→友→官→田→福→父）。 */
export const PALACE_CODES_12 = [
  "1", "2", "3", "4", "5", "6", "7", "8", "9", "A", "B", "C",
] as const;
export type PalaceCode = (typeof PALACE_CODES_12)[number];

/** 宮位碼 → 索引 1..12（A/B/C = 10/11/12）。 */
export function palaceCodeToIndex(code: string): number {
  const i = PALACE_CODES_12.indexOf(code as PalaceCode);
  return i < 0 ? -1 : i + 1;
}

/**
 * 地支兩位碼 → 4×4 格位 (row, col)。固定物理佈局，不受主題影響。
 * 與 p_e_artist layout.py 的 BRANCH_GRID_MAP 完全一致。
 */
export const BRANCH_GRID_MAP: Record<string, [number, number]> = {
  "01": [3, 2], "02": [3, 1], "03": [3, 0], "04": [2, 0],
  "05": [1, 0], "06": [0, 0], "07": [0, 1], "08": [0, 2],
  "09": [0, 3], "10": [1, 3], "11": [2, 3], "12": [3, 3],
};

/** 十四主星編碼（圖示邊長為副星 2 倍）。 */
export const FOURTEEN_MAIN_STAR_CODES: ReadonlySet<string> = new Set([
  "POL", "HPI", "SUN", "MAR", "HAR", "MAG", "TRE", "MOO",
  "AWO", "GGA", "MIN", "BLE", "VAN", "BRE",
]);

/** 以 SVG 圖示呈現的星曜編碼（須與 assets/stars/{code}.svg 一致）。 */
export const MAJOR_STAR_CODES: ReadonlySet<string> = new Set([
  // 十四主星
  "POL", "HPI", "SUN", "MAR", "HAR", "MIN", "BLE",
  "MAG", "AWO", "GGA", "TRE", "MOO", "VAN", "BRE",
  // 六吉、祿馬、四煞、空劫、截空
  "LHA", "RHA", "AAC", "AAR", "CPA", "CAI", "DIV", "HHO",
  "GLA", "STO", "FSP", "CHI", "EVO", "MAE", "INT",
]);

/** 副星 = 有圖檔但非十四主星。 */
export const SUB_STAR_CODES: ReadonlySet<string> = new Set(
  [...MAJOR_STAR_CODES].filter((c) => !FOURTEEN_MAIN_STAR_CODES.has(c)),
);

/** 四化碼 → 徽章字母（與 p_e_artist svg_writer._SIHUA_LABEL 一致）。 */
export const SIHUA_LABEL: Record<string, string> = {
  FO: "F", PW: "P", HO: "H", BI: "I",
};

export type SihuaCode = "FO" | "PW" | "HO" | "BI";

/**
 * 流曜（流盤加星）編碼樣式：前綴 d=大限 / y=流年 / s=小限，
 * 後綴為 8 顆 魁鉞祿羊馬鸞喜陀（CP/CA/DI/GL/HH/RP/HJ/ST）。
 */
export const FLOW_STAR_RE = /^([dys])(GL|ST|CP|CA|DI|HH|RP|HJ)$/;

/** 是否為流曜（流盤層才會出現）。 */
export function isFlowStar(code: string): boolean {
  return FLOW_STAR_RE.test(code);
}
