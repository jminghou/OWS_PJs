/**
 * 主題設定 —— 移植自 p_e_artist theme.py 的 _DEFAULTS（SVG 相關欄位），
 * 預設值與書籍命盤（P_Union p_e_artist 單盤 natal_default）對齊。
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
  /** 本命四化徽章色（書籍命盤＝紅；徽章形狀本身表意：祿圓、權六角、科方、忌三角）。 */
  sihuaInk: string;
  /** 三方四正連線顏色。 */
  palaceLink: string;
  /** 主軸宮高亮底色（書籍命盤不標＝transparent）。 */
  axisHighlight: string;
  /** 三方四正其餘三宮的高亮底色（書籍命盤不標＝transparent）。 */
  sanfangHighlight: string;
  /** 疊盤各層色（一層一色，星曜與四化同色；對應 p_e_artist overlay_config.py）。 */
  layerNatal: string;
  layerDecade: string;
  layerSmall: string;
  layerYear: string;
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
  /** 主星列與輔星列、輔星各列之間的間距。 */
  iconRowGap: number;
  /** 副星縮小後線條補粗的程度：1＝補到與主星同粗、0＝不補（原稿等比變細）。 */
  iconSubStrokeMatch: number;
  sihuaBadgeSize: number;
  /** 同一顆星多枚徽章（本命＋流盤）橫排的間距。 */
  sihuaBadgeGap: number;
  /** 圖形下緣到徽章頂的間距（徽章貼著圖形放，不貼畫框）。 */
  sihuaBadgeAttachGap: number;
  centerIdInset: number;
  minorLineHeight: number;
  minorPadBottom: number;
  minorSeparator: string;
  headerUnderlineOffset: number;
  headerBaselineOffset: number;
  gridWidth: number;
  /** 三方四正連線線寬（書籍＝0.5pt）。 */
  palaceLinkWidth: number;
  /** 宮位干支："code"＝英數代號（天干 A–J、地支 01–12，書籍預設）；"cn"＝中文。 */
  branchLabelStyle: "code" | "cn";
  /** 宮名表現："icon"＝宮位圖示；"text"＝文字宮名。與 p_e_artist palace_name_style 同義。 */
  palaceNameStyle: "icon" | "text";
  palaceIconHeight: number;
  /** 身宮外框與圖示的間距；版面一律留位，只有身宮真的畫框（12 宮才在同一條線上）。 */
  palaceBodyFramePad: number;
  /** 圖示上緣（含外框）距宮格頂的留白；置中會讓外框貼到格線。 */
  palaceIconTopGap: number;
  /** 圖示模式的表頭帶高（取代 headerUnderlineOffset）。 */
  palaceIconHeaderOffset: number;
  /** 表頭底線；宮位圖示左右本就帶橫線，那條線是重複的。 */
  palaceHeaderLine: boolean;
  /** 表頭各項（宮位圖示／疊層宮位圖示／文字）之間距。 */
  palaceNameGap: number;
  /** 疊層宮位圖示（半寬版 h{碼}）高。 */
  palaceLayerIconHeight: number;
  /** 疊盤尺寸階層（主星／副星／副星間距／四化徽章／徽章間距／列距）。 */
  overlayIconMainSize: number;
  overlayIconSubSize: number;
  overlayIconSubGap: number;
  overlayBadgeSize: number;
  overlayBadgeGap: number;
  overlayRowGap: number;
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
    "HarmonyOS Sans TC, Microsoft JhengHei, PingFang TC, Noto Sans TC, sans-serif",
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
    sihuaInk: "#C62828",
    palaceLink: "#cccccc",
    axisHighlight: "transparent",
    sanfangHighlight: "transparent",
    layerNatal: "#C62828",
    layerDecade: "#2E7D32",
    layerSmall: "#1A237E",
    layerYear: "#1E88E5",
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
    iconSubSize: 35,
    iconSubGap: 1,
    iconRowGap: 3,
    iconSubStrokeMatch: 1,
    sihuaBadgeSize: 21,
    sihuaBadgeGap: 2,
    sihuaBadgeAttachGap: 1,
    centerIdInset: 14,
    minorLineHeight: 1.5,
    minorPadBottom: 1,
    minorSeparator: " · ",
    headerUnderlineOffset: 24,
    headerBaselineOffset: 18,
    gridWidth: 0.5,
    palaceLinkWidth: 0.5 * (4 / 3),
    branchLabelStyle: "code",
    palaceNameStyle: "icon",
    palaceIconHeight: 18,
    palaceBodyFramePad: 3,
    palaceIconTopGap: 7,
    palaceIconHeaderOffset: 34,
    palaceHeaderLine: false,
    palaceNameGap: 4,
    palaceLayerIconHeight: 15,
    overlayIconMainSize: 60,
    overlayIconSubSize: 34,
    overlayIconSubGap: 2,
    overlayBadgeSize: 16,
    overlayBadgeGap: 2,
    overlayRowGap: 3,
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
