"use client";

import { useMemo, type FC } from "react";
import { GridLayout, computePalaceLayout } from "../core/layout";
import { computeSanfang } from "../core/sanfang";
import { parseChart, type ChartData } from "../core/model";
import { resolveTheme } from "../core/theme";
import { PALACE_CODES_12 } from "../core/constants";
import { palaceNameZh, palaceNameEn, branchNameZh, starNameZh } from "../core/registry";
import { Palace } from "./Palace";
import { SanfangLines } from "./SanfangLines";
import { useChartState } from "./useChartState";
import { Toolbar } from "./Toolbar";
import type { ZiweiChartProps } from "./types";

function isChartData(x: unknown): x is ChartData {
  return (
    typeof x === "object" &&
    x !== null &&
    "palaces" in x &&
    !("placements" in (x as Record<string, unknown>)) &&
    !("chart" in (x as Record<string, unknown>))
  );
}

/** 互動式紫微斗數命盤（本命盤）。 */
export const ZiweiChart: FC<ZiweiChartProps> = (props) => {
  const {
    chart,
    showToolbar = true,
    className,
    width = "100%",
  } = props;

  const data: ChartData = useMemo(
    () => (isChartData(chart) ? chart : parseChart(chart as Parameters<typeof parseChart>[0])),
    [chart],
  );
  const theme = useMemo(() => resolveTheme(props.theme), [props.theme]);
  const grid = useMemo(() => new GridLayout(theme), [theme]);

  const { axisPalace, selectPalace, layers, toggleLayer } = useChartState({
    defaultAxisPalace: props.defaultAxisPalace,
    axisPalace: props.axisPalace,
    layers: props.layers,
    onPalaceClick: props.onPalaceClick,
  });

  const sanfang = useMemo(
    () => computeSanfang(data, grid, axisPalace),
    [data, grid, axisPalace],
  );
  const sanfangBranches = useMemo(
    () => new Set(sanfang?.highlightBranches ?? []),
    [sanfang],
  );

  const palaceLayouts = useMemo(() => {
    return PALACE_CODES_12.map((code) => {
      const palace = data.palaces[code];
      if (!palace) return null;
      const cell = grid.branchToCell(palace.branch);
      let cnName = palaceNameZh(code);
      if (code === data.bodyPalace) cnName += "(身)";
      const enName = palaceNameEn(code);
      const branchLabel = branchNameZh(palace.branch);
      const layout = computePalaceLayout(palace, cell, theme, {
        cnName,
        enName,
        branchLabel,
      });
      return { palace, layout, cnName, enName, branchLabel };
    }).filter((x): x is NonNullable<typeof x> => x !== null);
  }, [data, grid, theme]);

  const cw = grid.cellW;
  const ch = grid.cellH;
  const W = grid.canvasW;
  const H = grid.canvasH;

  return (
    <div
      className={className}
      style={{ width, maxWidth: W, margin: "0 auto" }}
    >
      {showToolbar ? (
        <Toolbar layers={layers} toggleLayer={toggleLayer} theme={theme} />
      ) : null}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        role="img"
        aria-label="紫微斗數命盤"
        style={{ display: "block", background: theme.colors.bg, userSelect: "none" }}
      >
        {/* 外框 */}
        <rect
          x={0}
          y={0}
          width={W}
          height={H}
          fill="none"
          stroke={theme.colors.gridStroke}
          strokeWidth={theme.layout.gridWidth}
        />
        {/* 格線（中橫／中直略過中宮） */}
        {[1, 2, 3].map((r) => {
          const y = r * ch;
          if (r === 2) {
            return (
              <g key={`h${r}`}>
                <line x1={0} y1={y} x2={cw} y2={y} stroke={theme.colors.gridStroke} strokeWidth={theme.layout.gridWidth} />
                <line x1={3 * cw} y1={y} x2={W} y2={y} stroke={theme.colors.gridStroke} strokeWidth={theme.layout.gridWidth} />
              </g>
            );
          }
          return <line key={`h${r}`} x1={0} y1={y} x2={W} y2={y} stroke={theme.colors.gridStroke} strokeWidth={theme.layout.gridWidth} />;
        })}
        {[1, 2, 3].map((c) => {
          const x = c * cw;
          if (c === 2) {
            return (
              <g key={`v${c}`}>
                <line x1={x} y1={0} x2={x} y2={ch} stroke={theme.colors.gridStroke} strokeWidth={theme.layout.gridWidth} />
                <line x1={x} y1={3 * ch} x2={x} y2={H} stroke={theme.colors.gridStroke} strokeWidth={theme.layout.gridWidth} />
              </g>
            );
          }
          return <line key={`v${c}`} x1={x} y1={0} x2={x} y2={H} stroke={theme.colors.gridStroke} strokeWidth={theme.layout.gridWidth} />;
        })}

        {/* 三方四正連線（畫在宮位之下） */}
        {layers.sanfang && sanfang ? <SanfangLines sanfang={sanfang} theme={theme} /> : null}

        {/* 中央資訊 */}
        <CenterInfo data={data} theme={theme} W={W} H={H} cw={cw} ch={ch} />

        {/* 十二宮 */}
        {palaceLayouts.map((p) => (
          <Palace
            key={p.palace.code}
            palace={p.palace}
            layout={p.layout}
            theme={theme}
            layers={layers}
            cnName={p.cnName}
            enName={p.enName}
            branchLabel={p.branchLabel}
            isAxis={p.palace.code === axisPalace}
            inSanfang={
              p.palace.code !== axisPalace && sanfangBranches.has(p.palace.branch)
            }
            onClick={selectPalace}
          />
        ))}
      </svg>
    </div>
  );
};

const CenterInfo: FC<{
  data: ChartData;
  theme: ReturnType<typeof resolveTheme>;
  W: number;
  H: number;
  cw: number;
  ch: number;
}> = ({ data, theme, W, H, cw, ch }) => {
  const inset = theme.layout.centerIdInset;
  const cx = cw + (2 * cw) / 2;
  const lines: string[] = [];
  const genderZh = data.genderCode === "GM" ? "男" : data.genderCode === "GF" ? "女" : "";
  if (genderZh) lines.push(`性別　${genderZh}`);
  if (data.lifeMaster) lines.push(`命主　${starNameZh(data.lifeMaster)}`);
  if (data.bodyMaster) lines.push(`身主　${starNameZh(data.bodyMaster)}`);
  return (
    <g style={{ pointerEvents: "none" }}>
      {lines.map((ln, i) => (
        <text
          key={i}
          x={cx}
          y={ch + 34 + i * 22}
          textAnchor="middle"
          fontSize={13}
          fill={theme.colors.palaceName}
          fontFamily={theme.fontFamily}
          letterSpacing="0.04em"
        >
          {ln}
        </text>
      ))}
      {data.chartId ? (
        <text
          x={W - inset}
          y={H - inset}
          textAnchor="end"
          fontSize={10}
          fill={theme.colors.chartIdInk}
          fontFamily="monospace"
          letterSpacing="0.05em"
        >
          {data.chartId}
        </text>
      ) : null}
    </g>
  );
};
