/**
 * @ows/ziwei-chart —— 互動式紫微斗數命盤渲染引擎。
 *
 * 主要出口：
 *   <ZiweiChart chart={chartJson} />   互動命盤（點宮位→主軸、三方四正、圖層開關）
 *   <DefineChart charts={[...]} />     上下時辰定盤對照
 *
 * 純核心（框架無關）另從 "@ows/ziwei-chart/core" 取用。
 */

export { ZiweiChart } from "./react/ZiweiChart";
export { DefineChart } from "./react/DefineChart";
export { Toolbar } from "./react/Toolbar";
export { useChartState } from "./react/useChartState";
export { DEFAULT_LAYERS } from "./react/types";
export type { ZiweiChartProps, LayerFlags } from "./react/types";

// 重新匯出核心型別與工具（方便消費端直接取用）
export * from "./core";
