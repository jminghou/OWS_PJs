import type { ChartData } from "../core/model";
import type { ZiweiThemeOverride } from "../core/theme";

/** 可開關的資訊圖層。 */
export interface LayerFlags {
  /** 四化徽章。 */
  sihua: boolean;
  /** 小星文字。 */
  minorStars: boolean;
  /** 星曜亮度標記（主星下方小字）。 */
  brightness: boolean;
  /** 宮位英文名。 */
  palaceNameEn: boolean;
  /** 三方四正連線。 */
  sanfang: boolean;
}

export const DEFAULT_LAYERS: LayerFlags = {
  sihua: true,
  minorStars: true,
  brightness: false,
  palaceNameEn: true,
  sanfang: true,
};

export interface ZiweiChartProps {
  /** API 回傳的正規化 chart_json（或已解析的 ChartData）。 */
  chart: unknown | ChartData;
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
  /** 額外 className（套在外層容器）。 */
  className?: string;
  /** 寬度（CSS），預設 "100%"，maxWidth 800。 */
  width?: number | string;
}
