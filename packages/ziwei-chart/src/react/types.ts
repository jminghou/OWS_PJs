import type { ChartData } from "../core/model";
import type { ZiweiThemeOverride } from "../core/theme";

/** 可開關的資訊圖層。 */
export interface LayerFlags {
  /** 四化徽章。 */
  sihua: boolean;
  /** 小星文字（不含流曜）；書籍命盤不列，預設關。 */
  minorStars: boolean;
  /** 疊盤時各層的流曜圖示（大羊、流祿…）。 */
  flowStars: boolean;
  /** 星曜亮度標記（主星下方小字）。 */
  brightness: boolean;
  /** 宮位英文名。 */
  palaceNameEn: boolean;
  /** 三方四正連線。 */
  sanfang: boolean;
}

export const DEFAULT_LAYERS: LayerFlags = {
  sihua: true,
  minorStars: false,
  flowStars: true,
  brightness: false,
  palaceNameEn: false,
  sanfang: true,
};

/** 疊盤狀態：三層各自開關；全關＝本命單盤。targetYear 為 null 時取今年（夾在此盤範圍內）。 */
export interface OverlayState {
  decade: boolean;
  small: boolean;
  year: boolean;
  targetYear: number | null;
}

export const DEFAULT_OVERLAY: OverlayState = {
  decade: false,
  small: false,
  year: false,
  targetYear: null,
};

export interface ZiweiChartProps {
  /** API 回傳的正規化 chart_json（或已解析的 ChartData）。 */
  chart: unknown | ChartData;
  /** API 回傳的 flow 區塊（大限/流年/小限）；提供時顯示疊盤切換。 */
  flow?: unknown;
  /** 疊盤初始狀態（部分覆寫 DEFAULT_OVERLAY），例 { year: true, targetYear: 2026 }。 */
  defaultOverlay?: Partial<OverlayState>;
  /** 巢狀大限：大限層關閉但小限/流年開著時，仍帶所在大限的四化與流曜。預設 true。 */
  nestedSihua?: boolean;
  /** 預設主軸宮位碼，預設 "1"（命宮）。 */
  defaultAxisPalace?: string;
  /** 受控主軸宮位碼；提供時由外部掌控。 */
  axisPalace?: string;
  /** 圖層開關（部分覆寫預設）。 */
  layers?: Partial<LayerFlags>;
  /** 主題覆寫。 */
  theme?: ZiweiThemeOverride;
  /** 點擊宮位時回呼（傳入宮位碼）。 */
  onPalaceClick?: (palaceCode: string) => void;
  /** 是否顯示內建圖層開關工具列，預設 true。 */
  showToolbar?: boolean;
  /** 是否在命盤下方顯示圖例（主星／輔星／四化對照），預設 true。 */
  showLegend?: boolean;
  /** 額外 className（套在外層容器）。 */
  className?: string;
  /** 寬度（CSS），預設 "100%"，maxWidth 800。 */
  width?: number | string;
}
