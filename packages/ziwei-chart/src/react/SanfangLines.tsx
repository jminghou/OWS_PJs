import type { FC } from "react";
import type { SanfangResult } from "../core/sanfang";
import type { ZiweiTheme } from "../core/theme";

interface SanfangLinesProps {
  sanfang: SanfangResult;
  theme: ZiweiTheme;
}

/** 三方四正連線；座標變動時以 CSS transition 平滑移動。 */
export const SanfangLines: FC<SanfangLinesProps> = ({ sanfang, theme }) => {
  return (
    <g className="zw-sanfang" style={{ pointerEvents: "none" }}>
      {sanfang.lines.map((ln, i) => (
        <line
          key={i}
          x1={ln.x1}
          y1={ln.y1}
          x2={ln.x2}
          y2={ln.y2}
          stroke={theme.colors.palaceLink}
          strokeWidth={0.8}
          strokeDasharray="4 2"
          style={{
            transition:
              "x1 220ms ease, y1 220ms ease, x2 220ms ease, y2 220ms ease",
          }}
        />
      ))}
    </g>
  );
};
