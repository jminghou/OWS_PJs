import type { FC } from "react";
import { STAR_SVG_DATA } from "./starSvgData";
import { starNameZh } from "../core/registry";

interface StarIconProps {
  code: string;
  x: number;
  y: number;
  size: number;
  /** 圖示墨色（圖內 currentColor 由此決定，預設黑）。 */
  glyphColor?: string;
}

/**
 * 單顆星曜圖示。有向量資料者以巢狀 <svg> 內嵌（與 p_e_artist 一致，class 已加前綴）；
 * 圖內深色墨已轉 currentColor，故由 color 控制墨色以支援深色/特殊主題。
 * 無圖檔者以置中文字（中文名）替代。
 */
export const StarIcon: FC<StarIconProps> = ({ code, x, y, size, glyphColor = "#231815" }) => {
  const d = STAR_SVG_DATA[code];
  if (d) {
    return (
      <svg
        x={x}
        y={y}
        width={size}
        height={size}
        viewBox={d.viewBox}
        preserveAspectRatio="xMidYMid meet"
        color={glyphColor}
        dangerouslySetInnerHTML={{ __html: d.inner }}
      />
    );
  }
  return (
    <text
      x={x + size / 2}
      y={y + size / 2}
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={Math.min(size * 0.5, 13)}
      fill={glyphColor}
    >
      {starNameZh(code)}
    </text>
  );
};
