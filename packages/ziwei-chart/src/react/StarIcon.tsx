import type { FC } from "react";
import { STAR_SVG_DATA } from "./starSvgData";
import { starNameZh } from "../core/registry";

interface StarIconProps {
  code: string;
  x: number;
  y: number;
  size: number;
}

/**
 * 單顆星曜圖示。有向量資料者以巢狀 <svg> 內嵌（與 p_e_artist 一致，class 已加前綴）；
 * 無圖檔者以置中文字（中文名）替代。
 */
export const StarIcon: FC<StarIconProps> = ({ code, x, y, size }) => {
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
    >
      {starNameZh(code)}
    </text>
  );
};
