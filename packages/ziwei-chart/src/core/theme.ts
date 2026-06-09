/**
 * 主題設定 —— 移植自 p_e_artist theme.py 的 _DEFAULTS（SVG 相關欄位）。
 * 額外新增互動所需欄位（主軸高亮、三方四正線色）。
 */

export interface ZiweiThemeColors {
  bg: string;
  gridStroke: string;
  centerBg: string;
  chartIdInk: string;
  palaceName: string;
  palaceNameEn: string;
  branchInk: string;
  starMinor: string;
  /** 流曜（大限/流年/小限加星）文字色，與一般小星區隔。 */
  flowStar: string;
  /** 星曜圖示墨色（圖示內 currentColor 由此決定）。 */
  starGlyph: string;
  sihuaFo: string;
  sihuaPw: string;
  sihuaHo: string;
  sihuaBi: string;
  sihuaBadgeBg: string;
  sihuaTagInk: string;
  /** 三方四正連線顏色。 */
  palaceLink: string;
  /** 主軸宮高亮底色。 */
  axisHighlight: string;
}

export interface ZiweiThemeSizes {
  palaceName: number;
  palaceNameEn: number;
  branch: number;
  starMain: number;
  starMinor: number;
  brightness: number;
  sihuaTag: number;
}

export interface ZiweiThemeLayout {
  cellWidth: number;
  cellHeight: number;
  palacePadTop: number;
  palacePadRight: number;
  palacePadBottom: number;
  palacePadLeft: number;
  iconMainSize: number;
  iconMainGap: number;
  iconSubSize: number;
  iconSubGap: number;
  sihuaBadgeSize: number;
  centerIdInset: number;
  minorLineHeight: number;
  minorPadBottom: number;
  minorSeparator: string;
  headerUnderlineOffset: number;
  headerBaselineOffset: number;
  gridWidth: number;
}

export interface ZiweiTheme {
  fontFamily: string;
  fontBranch: string;
  colors: ZiweiThemeColors;
  sizes: ZiweiThemeSizes;
  layout: ZiweiThemeLayout;
}

export const DEFAULT_THEME: ZiweiTheme = {
  fontFamily:
    "HarmonyOS Sans TC, Microsoft JhengHei, PingFang TC, Noto Sans TC, sans-serif",
  fontBranch:
    '"Noto Serif TC", "Source Han Serif TC", "LiSong Pro", "PMingLiU", "Times New Roman", serif',
  colors: {
    bg: "transparent",
    gridStroke: "#555555",
    centerBg: "transparent",
    chartIdInk: "rgba(0, 0, 0, 0.18)",
    palaceName: "#1A1A2E",
    palaceNameEn: "rgba(26,26,46,0.38)",
    branchInk: "rgba(0, 0, 0, 0.26)",
    starMinor: "#3a4a5c",
    flowStar: "#0e7490",
    starGlyph: "#231815",
    sihuaFo: "#2E7D32",
    sihuaPw: "#1565C0",
    sihuaHo: "#6A1B9A",
    sihuaBi: "#C62828",
    sihuaBadgeBg: "#111111",
    sihuaTagInk: "#FFFFFF",
    palaceLink: "#c89b3c",
    axisHighlight: "rgba(200, 155, 60, 0.10)",
  },
  sizes: {
    palaceName: 11,
    palaceNameEn: 8,
    branch: 14,
    starMain: 13,
    starMinor: 10,
    brightness: 11,
    sihuaTag: 12,
  },
  layout: {
    cellWidth: 200,
    cellHeight: 200,
    palacePadTop: 7,
    palacePadRight: 9,
    palacePadBottom: 5,
    palacePadLeft: 9,
    iconMainSize: 77,
    iconMainGap: 5,
    iconSubSize: 43,
    iconSubGap: 1,
    sihuaBadgeSize: 21,
    centerIdInset: 14,
    minorLineHeight: 1.5,
    minorPadBottom: 1,
    minorSeparator: " · ",
    headerUnderlineOffset: 24,
    headerBaselineOffset: 18,
    gridWidth: 0.5,
  },
};

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };
export type ZiweiThemeOverride = DeepPartial<ZiweiTheme>;

/** 將 override 深層合併進預設主題。 */
export function resolveTheme(override?: ZiweiThemeOverride): ZiweiTheme {
  if (!override) return DEFAULT_THEME;
  return {
    fontFamily: override.fontFamily ?? DEFAULT_THEME.fontFamily,
    fontBranch: override.fontBranch ?? DEFAULT_THEME.fontBranch,
    colors: { ...DEFAULT_THEME.colors, ...override.colors },
    sizes: { ...DEFAULT_THEME.sizes, ...override.sizes },
    layout: { ...DEFAULT_THEME.layout, ...override.layout },
  };
}

/** FO/PW/HO/BI → 對應顏色。 */
export function sihuaColor(theme: ZiweiTheme, code: string): string {
  switch (code) {
    case "FO": return theme.colors.sihuaFo;
    case "PW": return theme.colors.sihuaPw;
    case "HO": return theme.colors.sihuaHo;
    case "BI": return theme.colors.sihuaBi;
    default: return theme.colors.starMinor;
  }
}
