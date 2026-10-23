import type { CSSProperties, FC } from "react";
import type { FlowData } from "../core/flow";
import { OVERLAY_LABEL, OVERLAY_ORDER, type OverlayKind, type OverlayResult } from "../core/overlay";
import type { ZiweiTheme } from "../core/theme";
import { YearTimeline } from "./YearTimeline";
import type { OverlayState } from "./types";

interface OverlayControlsProps {
  flow: FlowData;
  state: OverlayState;
  /** 已解析的目標年（state.targetYear 為 null 時的預設年也在這裡）。 */
  year: number;
  resolved: OverlayResult | null;
  onChange: (next: OverlayState) => void;
  theme: ZiweiTheme;
}

export function layerInk(theme: ZiweiTheme, kind: OverlayKind | "natal"): string {
  switch (kind) {
    case "decade": return theme.colors.layerDecade;
    case "small": return theme.colors.layerSmall;
    case "year": return theme.colors.layerYear;
    default: return theme.colors.layerNatal;
  }
}

function firstYear(yearRange: string): number | null {
  const m = /\d{4}/.exec(yearRange || "");
  return m ? Number(m[0]) : null;
}

/**
 * 疊盤切換（對應 PolarisUI 疊盤繪圖的 show_decade/show_small/show_year ＋ target_year）：
 * 三層各自開關、全關＝本命；開了任一層就出現流年時間軸，開大限時另列 12 個大限可跳轉。
 */
export const OverlayControls: FC<OverlayControlsProps> = ({
  flow,
  state,
  year,
  resolved,
  onChange,
  theme,
}) => {
  const anyOn = state.decade || state.small || state.year;
  const ink = theme.colors.palaceName;
  const available: Record<OverlayKind, boolean> = {
    decade: flow.decades.length > 0,
    small: flow.smallLimits.length > 0,
    year: flow.years.length > 0,
  };

  const chip = (on: boolean, color: string): CSSProperties => ({
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontSize: 13,
    lineHeight: 1.4,
    padding: "4px 12px",
    borderRadius: 999,
    whiteSpace: "nowrap",
    border: `1px solid ${on ? color : "rgba(0,0,0,0.18)"}`,
    background: on ? color : "transparent",
    color: on ? "#fff" : ink,
    transition: "all 140ms ease",
  });
  const dot = (color: string, on: boolean): CSSProperties => ({
    width: 8,
    height: 8,
    borderRadius: 999,
    background: on ? "#fff" : color,
    flexShrink: 0,
  });

  // 時間軸以流年層為主（沒有就用小限層），兩者逐歲對齊
  const timeline = flow.years.length ? flow.years : flow.smallLimits;
  const tlIndex = Math.max(0, timeline.findIndex((e) => e.year === year));
  const setYear = (y: number) => onChange({ ...state, targetYear: y });

  return (
    <div style={{ padding: "2px 2px 8px", fontFamily: theme.fontFamily }}>
      <div role="group" aria-label="疊盤層" style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        <button
          type="button"
          aria-pressed={!anyOn}
          onClick={() => onChange({ ...state, decade: false, small: false, year: false })}
          style={chip(!anyOn, ink)}
        >
          本命
        </button>
        {OVERLAY_ORDER.filter((k) => available[k]).map((k) => {
          const on = state[k];
          const color = layerInk(theme, k);
          return (
            <button
              key={k}
              type="button"
              aria-pressed={on}
              onClick={() => onChange({ ...state, [k]: !on })}
              style={chip(on, color)}
            >
              <span aria-hidden="true" style={dot(color, on)} />
              {OVERLAY_LABEL[k]}
            </button>
          );
        })}
      </div>

      {anyOn && timeline.length > 0 ? (
        <YearTimeline
          years={timeline}
          index={tlIndex}
          onSelect={(i) => {
            const y = timeline[i]?.year;
            if (y != null) setYear(y);
          }}
          theme={theme}
          accent={ink}
        />
      ) : null}

      {state.decade && flow.decades.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
          {flow.decades.map((d) => {
            const on = resolved?.decade?.order === d.order;
            const color = theme.colors.layerDecade;
            const y0 = firstYear(d.yearRange);
            return (
              <button
                key={d.order}
                type="button"
                aria-pressed={on}
                disabled={y0 == null}
                onClick={() => y0 != null && setYear(on ? year : y0)}
                title={`${d.name}　${d.yearRange}`}
                style={{ ...chip(on, color), fontSize: 12, padding: "3px 10px", gap: 4 }}
              >
                {d.ageRange}
                <span style={{ opacity: 0.75 }}>歲</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};
