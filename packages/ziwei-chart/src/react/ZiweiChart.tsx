"use client";

import { useMemo, type FC } from "react";
import { GridLayout, computePalaceLayout } from "../core/layout";
import { computeSanfang } from "../core/sanfang";
import { parseChart, type ChartData, type StarInfo } from "../core/model";
import { parseFlow } from "../core/flow";
import { resolveTheme } from "../core/theme";
import { PALACE_CODES_12, isFlowStar } from "../core/constants";
import {
  palaceNameZh,
  palaceNameEn,
  branchNameZh,
  starNameZh,
  palaceNamesByMingBranch,
} from "../core/registry";
import { Palace } from "./Palace";
import { SanfangLines } from "./SanfangLines";
import { useChartState } from "./useChartState";
import { Toolbar } from "./Toolbar";
import { LayerSelector } from "./LayerSelector";
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

  const natalData: ChartData = useMemo(
    () => (isChartData(chart) ? chart : parseChart(chart as Parameters<typeof parseChart>[0])),
    [chart],
  );
  const flow = useMemo(() => parseFlow(props.flow), [props.flow]);
  const theme = useMemo(() => resolveTheme(props.theme), [props.theme]);
  const grid = useMemo(() => new GridLayout(theme), [theme]);

  const { axisPalace, selectPalace, layers, toggleLayer, activeLayer, setActiveLayer } =
    useChartState({
      defaultAxisPalace: props.defaultAxisPalace,
      axisPalace: props.axisPalace,
      layers: props.layers,
      onPalaceClick: props.onPalaceClick,
    });

  // 作用層：本命 / 大限 / 流年 / 小限。決定要畫哪份命盤、宮名規則與中宮資訊。
  const activeEntry = useMemo(() => {
    if (!flow) return null;
    if (activeLayer.type === "decade") {
      const d = flow.decades[activeLayer.index];
      if (!d) return null;
      return {
        data: d.data,
        mingBranch: d.mingBranch,
        center: [
          `大限　${d.name}`,
          d.ageRange ? `歲限　${d.ageRange}` : "",
          d.yearRange ? `西元　${d.yearRange}` : "",
        ].filter(Boolean),
      };
    }
    if (activeLayer.type === "year") {
      const y = flow.years[activeLayer.index];
      if (!y) return null;
      return {
        data: y.data,
        mingBranch: y.mingBranch,
        center: [
          `流年　${y.name}`,
          y.year != null ? `西元　${y.year}` : "",
          y.age != null ? `虛歲　${y.age}` : "",
        ].filter(Boolean),
      };
    }
    if (activeLayer.type === "smallLimit") {
      const s = flow.smallLimits[activeLayer.index];
      if (!s) return null;
      return {
        data: s.data,
        mingBranch: s.mingBranch,
        center: [
          `小限　${s.name}`,
          s.year != null ? `西元　${s.year}` : "",
          s.age != null ? `虛歲　${s.age}` : "",
        ].filter(Boolean),
      };
    }
    return null;
  }, [flow, activeLayer]);

  // 流盤宮名（依該層命宮位移）；疊加模式僅用來組宮位標記（大X/流X/小X）。
  const flowNames = useMemo(
    () => (activeEntry ? palaceNamesByMingBranch(activeEntry.mingBranch) : null),
    [activeEntry],
  );
  const layerPrefix =
    activeLayer.type === "decade"
      ? "大"
      : activeLayer.type === "year"
        ? "流"
        : activeLayer.type === "smallLimit"
          ? "小"
          : "";

  // 疊加模式：底層恆為本命盤（本命星曜＋本命四化），流盤層僅「疊加」：
  //   ① 流曜（依地支併入）② 流盤四化（與本命四化雙標，存 flowSihua）。
  const data: ChartData = useMemo(() => {
    if (!activeEntry) return natalData;
    const fd = activeEntry.data;
    const flowSihuaByStar: Record<string, string> = {};
    for (const e of fd.sihuaSummary) flowSihuaByStar[e.starCode] = e.sihuaCode;

    const flowStarsByBranch: Record<string, StarInfo[]> = {};
    for (const p of Object.values(fd.palaces)) {
      for (const s of p.minors) {
        if (isFlowStar(s.code)) (flowStarsByBranch[s.branch] ??= []).push(s);
      }
    }

    const palaces: ChartData["palaces"] = {};
    for (const [code, p] of Object.entries(natalData.palaces)) {
      const baseStars: StarInfo[] = p.stars.map((s) => ({
        ...s,
        flowSihua: flowSihuaByStar[s.code] ?? null,
      }));
      const extra = flowStarsByBranch[p.branch] ?? [];
      const stars = extra.length ? [...baseStars, ...extra] : baseStars;
      palaces[code] = {
        ...p,
        stars,
        majors: stars.filter((s) => s.kind === "main"),
        subs: stars.filter((s) => s.kind === "sub"),
        minors: stars.filter((s) => s.kind === "minor"),
      };
    }
    return { ...natalData, palaces };
  }, [natalData, activeEntry]);

  // 中宮資訊：本命顯示性別/命主/身主；流盤層改顯示該層名稱/年/歲。
  const centerLines = useMemo(() => {
    const genderZh =
      natalData.genderCode === "GM" ? "男" : natalData.genderCode === "GF" ? "女" : "";
    if (activeEntry) {
      return [genderZh ? `性別　${genderZh}` : "", ...activeEntry.center].filter(Boolean);
    }
    return [
      genderZh ? `性別　${genderZh}` : "",
      natalData.lifeMaster ? `命主　${starNameZh(natalData.lifeMaster)}` : "",
      natalData.bodyMaster ? `身主　${starNameZh(natalData.bodyMaster)}` : "",
    ].filter(Boolean);
  }, [natalData, activeEntry]);

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
      // 宮名恆為本命（底層即本命盤）
      let cnName = palaceNameZh(code);
      if (code === natalData.bodyPalace) cnName += "(身)";
      const enName = palaceNameEn(code);
      const branchLabel = branchNameZh(palace.branch);
      // 流盤宮位標記：大X/流X/小X（X = 該層宮名首字）
      const flowZh = flowNames ? flowNames[palace.branch]?.zh : undefined;
      const flowTag = flowZh ? layerPrefix + flowZh[0] : undefined;
      const layout = computePalaceLayout(palace, cell, theme, {
        cnName,
        enName,
        branchLabel,
        flowTag,
      });
      return { palace, layout, cnName, enName, branchLabel };
    }).filter((x): x is NonNullable<typeof x> => x !== null);
  }, [data, grid, theme, flowNames, layerPrefix, natalData]);

  const cw = grid.cellW;
  const ch = grid.cellH;
  const W = grid.canvasW;
  const H = grid.canvasH;

  return (
    <div
      className={className}
      style={{ width, maxWidth: W, margin: "0 auto" }}
    >
      {flow ? (
        <LayerSelector
          flow={flow}
          active={activeLayer}
          onSelect={setActiveLayer}
          theme={theme}
        />
      ) : null}
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
        <CenterInfo
          lines={centerLines}
          chartId={natalData.chartId}
          theme={theme}
          W={W}
          H={H}
          cw={cw}
          ch={ch}
        />

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
  lines: string[];
  chartId: string;
  theme: ReturnType<typeof resolveTheme>;
  W: number;
  H: number;
  cw: number;
  ch: number;
}> = ({ lines, chartId, theme, W, H, cw, ch }) => {
  const inset = theme.layout.centerIdInset;
  const cx = cw + (2 * cw) / 2;
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
      {chartId ? (
        <text
          x={W - inset}
          y={H - inset}
          textAnchor="end"
          fontSize={10}
          fill={theme.colors.chartIdInk}
          fontFamily="monospace"
          letterSpacing="0.05em"
        >
          {chartId}
        </text>
      ) : null}
    </g>
  );
};
