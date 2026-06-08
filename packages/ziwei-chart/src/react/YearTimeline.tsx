import { useEffect, useRef, type FC, type CSSProperties } from "react";
import type { FlowAgeEntry } from "../core/flow";
import type { ZiweiTheme } from "../core/theme";

interface YearTimelineProps {
  years: FlowAgeEntry[];
  index: number;
  onSelect: (index: number) => void;
  theme: ZiweiTheme;
}

/** 流年時間軸：可橫向捲動的年份刻度，附前/後一年步進，作用年份自動置中。 */
export const YearTimeline: FC<YearTimelineProps> = ({ years, index, onSelect, theme }) => {
  const activeRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    activeRef.current?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [index]);

  const clamp = (i: number) => Math.max(0, Math.min(years.length - 1, i));

  const stepBtn = (disabled: boolean): CSSProperties => ({
    flexShrink: 0,
    cursor: disabled ? "default" : "pointer",
    fontSize: 12,
    lineHeight: 1,
    padding: "6px 8px",
    borderRadius: 8,
    border: `1px solid ${disabled ? "rgba(0,0,0,0.12)" : theme.colors.palaceLink}`,
    background: "transparent",
    color: disabled ? "rgba(0,0,0,0.3)" : theme.colors.palaceLink,
  });

  const tick = (on: boolean): CSSProperties => ({
    flexShrink: 0,
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 1,
    minWidth: 48,
    padding: "3px 6px 5px",
    borderRadius: 8,
    border: `1px solid ${on ? theme.colors.palaceLink : "transparent"}`,
    borderBottom: on
      ? `2px solid ${theme.colors.palaceLink}`
      : `2px solid rgba(0,0,0,0.12)`,
    background: on ? theme.colors.palaceLink : "transparent",
    color: on ? "#fff" : theme.colors.palaceName,
    transition: "all 140ms ease",
  });

  return (
    <div style={{ display: "flex", alignItems: "stretch", gap: 6, marginTop: 8 }}>
      <button
        type="button"
        aria-label="前一年"
        onClick={() => onSelect(clamp(index - 1))}
        disabled={index <= 0}
        style={stepBtn(index <= 0)}
      >
        ◀
      </button>

      <div
        style={{
          display: "flex",
          gap: 4,
          overflowX: "auto",
          padding: "2px",
          flex: 1,
          scrollbarWidth: "thin",
        }}
      >
        {years.map((y, i) => {
          const on = i === index;
          return (
            <button
              key={i}
              ref={on ? activeRef : undefined}
              type="button"
              onClick={() => onSelect(i)}
              title={y.name}
              style={tick(on)}
            >
              <span style={{ fontSize: 12, fontVariantNumeric: "tabular-nums" }}>
                {y.year ?? ""}
              </span>
              <span style={{ fontSize: 9, opacity: 0.75 }}>
                {y.age != null ? `${y.age}歲` : y.name}
              </span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        aria-label="後一年"
        onClick={() => onSelect(clamp(index + 1))}
        disabled={index >= years.length - 1}
        style={stepBtn(index >= years.length - 1)}
      >
        ▶
      </button>
    </div>
  );
};
