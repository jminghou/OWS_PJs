import type { FC } from "react";
import type { ZiweiTheme } from "../core/theme";
import type { LayerFlags } from "./types";

interface ToolbarProps {
  layers: LayerFlags;
  toggleLayer: (key: keyof LayerFlags) => void;
  theme: ZiweiTheme;
  /** 有流盤資料時才顯示「流曜」開關。 */
  hasFlow?: boolean;
}

// 亮度、英文宮名不在書籍命盤上，開關先收起（LayerFlags 仍保留，可由 props.layers 開）。
const ITEMS: Array<{ key: keyof LayerFlags; label: string; flowOnly?: boolean }> = [
  { key: "sanfang", label: "三方四正" },
  { key: "sihua", label: "四化" },
  { key: "minorStars", label: "小星" },
  { key: "flowStars", label: "流曜", flowOnly: true },
];

/** 內建圖層開關工具列（純 inline 樣式，不依賴消費端 CSS 框架）。 */
export const Toolbar: FC<ToolbarProps> = ({ layers, toggleLayer, theme, hasFlow = false }) => {
  return (
    <div
      role="group"
      aria-label="圖層開關"
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 6,
        padding: "6px 2px 10px",
        fontFamily: theme.fontFamily,
      }}
    >
      {ITEMS.filter((it) => hasFlow || !it.flowOnly).map(({ key, label }) => {
        const on = layers[key];
        return (
          <button
            key={key}
            type="button"
            aria-pressed={on}
            onClick={() => toggleLayer(key)}
            style={{
              cursor: "pointer",
              fontSize: 12,
              lineHeight: 1.4,
              padding: "3px 10px",
              borderRadius: 999,
              border: `1px solid ${on ? theme.colors.palaceName : "rgba(0,0,0,0.18)"}`,
              background: on ? theme.colors.palaceName : "transparent",
              color: on ? "#fff" : theme.colors.palaceName,
              transition: "all 140ms ease",
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
};
