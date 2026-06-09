import type { FC } from "react";
import type { ZiweiTheme } from "../core/theme";
import type { LayerFlags } from "./types";

interface ToolbarProps {
  layers: LayerFlags;
  toggleLayer: (key: keyof LayerFlags) => void;
  theme: ZiweiTheme;
}

const ITEMS: Array<{ key: keyof LayerFlags; label: string }> = [
  { key: "sanfang", label: "三方四正" },
  { key: "sihua", label: "四化" },
  { key: "minorStars", label: "小星" },
  { key: "flowStars", label: "流曜" },
  { key: "brightness", label: "亮度" },
  { key: "palaceNameEn", label: "英文宮名" },
];

/** 內建圖層開關工具列（純 inline 樣式，不依賴消費端 CSS 框架）。 */
export const Toolbar: FC<ToolbarProps> = ({ layers, toggleLayer, theme }) => {
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
      {ITEMS.map(({ key, label }) => {
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
              border: `1px solid ${on ? theme.colors.palaceLink : "rgba(0,0,0,0.18)"}`,
              background: on ? theme.colors.palaceLink : "transparent",
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
