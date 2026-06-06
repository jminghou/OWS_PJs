"use client";

import type { FC } from "react";
import { ZiweiChart } from "./ZiweiChart";
import type { ZiweiThemeOverride } from "../core/theme";

export interface DefineChartItem {
  /** 時辰標籤，例「前一時辰 · 子時 23:00」。 */
  label: string;
  /** 該時辰的 chart_json。 */
  chart: unknown;
  /** 是否為目前選定時辰（高亮邊框）。 */
  current?: boolean;
}

interface DefineChartProps {
  /** 上下相鄰時辰命盤（通常 2~3 張），供定盤對照。 */
  charts: DefineChartItem[];
  theme?: ZiweiThemeOverride;
  /** 點擊某張命盤標題時回呼（傳入索引），可用來「採用此時辰」。 */
  onSelect?: (index: number) => void;
}

/**
 * 定盤對照：把相鄰時辰的命盤並排呈現，方便比較宮位差異以決定正確生時。
 * 各張為靜態互動命盤（隱藏工具列），不互相連動。
 */
export const DefineChart: FC<DefineChartProps> = ({ charts, theme, onSelect }) => {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${Math.min(charts.length, 3)}, minmax(0, 1fr))`,
        gap: 16,
        alignItems: "start",
      }}
    >
      {charts.map((item, i) => (
        <div
          key={i}
          style={{
            border: item.current
              ? "2px solid #c89b3c"
              : "1px solid rgba(0,0,0,0.12)",
            borderRadius: 10,
            padding: 8,
            background: "#fff",
          }}
        >
          <button
            type="button"
            onClick={() => onSelect?.(i)}
            style={{
              display: "block",
              width: "100%",
              cursor: onSelect ? "pointer" : "default",
              background: "transparent",
              border: "none",
              padding: "2px 0 8px",
              fontSize: 13,
              fontWeight: 600,
              color: item.current ? "#a8791f" : "#333",
              textAlign: "center",
            }}
          >
            {item.label}
          </button>
          <ZiweiChart chart={item.chart} theme={theme} showToolbar={false} />
        </div>
      ))}
    </div>
  );
};
