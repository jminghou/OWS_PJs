import type { FC } from "react";
import type { FlowData } from "../core/flow";
import type { ZiweiTheme } from "../core/theme";
import { YearTimeline } from "./YearTimeline";
import type { ActiveLayer } from "./types";

interface LayerSelectorProps {
  flow: FlowData;
  active: ActiveLayer;
  onSelect: (layer: ActiveLayer) => void;
  theme: ZiweiTheme;
}

/** 本命 / 大限 / 流年 / 小限 切換（v2 完整四層）。 */
export const LayerSelector: FC<LayerSelectorProps> = ({ flow, active, onSelect, theme }) => {
  const chipStyle = (on: boolean) => ({
    cursor: "pointer",
    fontSize: 12,
    lineHeight: 1.4,
    padding: "4px 10px",
    borderRadius: 8,
    whiteSpace: "nowrap" as const,
    border: `1px solid ${on ? theme.colors.palaceLink : "rgba(0,0,0,0.18)"}`,
    background: on ? theme.colors.palaceLink : "transparent",
    color: on ? "#fff" : theme.colors.palaceName,
    transition: "all 140ms ease",
  });

  const modes: Array<{ key: ActiveLayer["type"]; label: string; enabled: boolean }> = [
    { key: "natal", label: "本命", enabled: true },
    { key: "decade", label: "大限", enabled: flow.decades.length > 0 },
    { key: "year", label: "流年", enabled: flow.years.length > 0 },
    { key: "smallLimit", label: "小限", enabled: flow.smallLimits.length > 0 },
  ];

  function pickMode(key: ActiveLayer["type"]) {
    if (key === "natal") return onSelect({ type: "natal" });
    onSelect({ type: key, index: 0 });
  }

  return (
    <div style={{ padding: "2px 2px 8px", fontFamily: theme.fontFamily }}>
      {/* 層別 tabs */}
      <div role="group" aria-label="盤面層" style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {modes
          .filter((m) => m.enabled)
          .map((m) => (
            <button
              key={m.key}
              type="button"
              aria-pressed={active.type === m.key}
              onClick={() => pickMode(m.key)}
              style={chipStyle(active.type === m.key)}
            >
              {m.label}
            </button>
          ))}
      </div>

      {/* 大限：12 宮 chips */}
      {active.type === "decade" && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
          {flow.decades.map((d, i) => {
            const on = active.index === i;
            return (
              <button
                key={d.order}
                type="button"
                aria-pressed={on}
                onClick={() => onSelect({ type: "decade", index: i })}
                title={`${d.name}　${d.yearRange}`}
                style={chipStyle(on)}
              >
                大限{d.order}
                <span style={{ opacity: 0.75, marginLeft: 4 }}>{d.ageRange}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* 流年：時間軸 */}
      {active.type === "year" && flow.years.length > 0 && (
        <YearTimeline
          years={flow.years}
          index={active.index}
          onSelect={(i) => onSelect({ type: "year", index: i })}
          theme={theme}
        />
      )}

      {/* 小限：時間軸 */}
      {active.type === "smallLimit" && flow.smallLimits.length > 0 && (
        <YearTimeline
          years={flow.smallLimits}
          index={active.index}
          onSelect={(i) => onSelect({ type: "smallLimit", index: i })}
          theme={theme}
        />
      )}
    </div>
  );
};
