/**
 * 命盤版型樣式預設（具名主題）。
 * 以 override 形式提供，套用時深層合併進 DEFAULT_THEME（淺色為基底）。
 * 使用：<ZiweiChart theme={NAMED_THEMES.dark} /> 或自行覆寫部分欄位。
 */
import type { ZiweiThemeOverride } from "./theme";

/** 淺色（即預設，留空代表用 DEFAULT_THEME 原值）。 */
export const LIGHT_THEME: ZiweiThemeOverride = {};

/** 深色（深底、淺字、金色三方四正；星曜圖示自動轉淺色）。 */
export const DARK_THEME: ZiweiThemeOverride = {
  colors: {
    bg: "#15151f",
    gridStroke: "#3d3d57",
    centerBg: "transparent",
    chartIdInk: "rgba(255,255,255,0.20)",
    palaceName: "#EAEAEA",
    palaceNameEn: "rgba(234,234,234,0.40)",
    branchInk: "rgba(255,255,255,0.32)",
    starMinor: "#aeb8c4",
    flowStar: "#5fd3e6",
    starGlyph: "#e8e8ee",
    sihuaBadgeBg: "#d4af55",
    sihuaTagInk: "#15151f",
    palaceLink: "#d4af55",
    axisHighlight: "rgba(212, 175, 85, 0.16)",
  },
};

/** 特殊（暖棕宣紙風範例，示範如何做客製配色）。 */
export const SEPIA_THEME: ZiweiThemeOverride = {
  colors: {
    bg: "#f6efe1",
    gridStroke: "#b9a07a",
    palaceName: "#5b4632",
    palaceNameEn: "rgba(91,70,50,0.40)",
    branchInk: "rgba(91,70,50,0.45)",
    starMinor: "#6b5640",
    flowStar: "#9a5b1e",
    starGlyph: "#4a3b2a",
    sihuaBadgeBg: "#7a5c3a",
    sihuaTagInk: "#f6efe1",
    palaceLink: "#a9762e",
    axisHighlight: "rgba(169, 118, 46, 0.12)",
  },
};

/** 具名主題表，方便做下拉切換。 */
export const NAMED_THEMES: Record<string, ZiweiThemeOverride> = {
  light: LIGHT_THEME,
  dark: DARK_THEME,
  sepia: SEPIA_THEME,
};

export type NamedThemeId = keyof typeof NAMED_THEMES;
