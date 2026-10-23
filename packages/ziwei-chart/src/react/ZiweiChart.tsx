"use client";

import { useMemo, type FC } from "react";
import { GridLayout, computePalaceLayout, type PalaceOverlayInput } from "../core/layout";
import { computeSanfang } from "../core/sanfang";
import { parseChart, type ChartData } from "../core/model";
import { parseFlow } from "../core/flow";
import {
  OVERLAY_LABEL,
  overlayYearRange,
  resolveOverlay,
  type OverlayLayer,
  type OverlayResult,
} from "../core/overlay";
import { resolveTheme, type ZiweiTheme } from "../core/theme";
import { PALACE_CODES_12 } from "../core/constants";
import { PALACE_SVG_DATA } from "./starSvgData";
import {
  palaceNameZh,
  palaceNameEn,
  branchNameZh,
  stemNameZh,
  palaceCodesByMingBranch,
  palaceNamesByMingBranch,
} from "../core/registry";
import { Palace } from "./Palace";
import { SanfangLines } from "./SanfangLines";
import { useChartState } from "./useChartState";
import { Toolbar } from "./Toolbar";
import { OverlayControls, layerInk } from "./OverlayControls";
import { ChartLegend } from "./ChartLegend";
import type { ZiweiChartProps } from "./types";

/** 天干兩位碼 01–10 → 書籍代號 A–J；不合法時回空字串（等同無宮干）。 */
function stemLetter(code: string | null): string {
  const i = Number(code);
  return Number.isInteger(i) && i >= 1 && i <= 10 ? String.fromCharCode(64 + i) : "";
}

function isChartData(x: unknown): x is ChartData {
  return (
    typeof x === "object" &&
    x !== null &&
    "palaces" in x &&
    !("placements" in (x as Record<string, unknown>)) &&
    !("chart" in (x as Record<string, unknown>))
  );
}

function palaceViewBox(key: string): [number, number] | undefined {
  const d = PALACE_SVG_DATA[key];
  if (!d) return undefined;
  const [, , w, h] = d.viewBox.split(/\s+/).map(Number);
  return w && h ? [w, h] : undefined;
}

/** 一層的宮位環（地支 → 宮位碼／宮名首字），巢狀層不畫宮名。 */
function layerRing(L: OverlayLayer) {
  if (!L.mingBranch) return null;
  return { codes: palaceCodesByMingBranch(L.mingBranch), names: palaceNamesByMingBranch(L.mingBranch) };
}

/** 互動式紫微斗數命盤：本命單盤，或本命底＋大限／小限／流年疊色層（書籍疊盤樣式）。 */
export const ZiweiChart: FC<ZiweiChartProps> = (props) => {
  const {
    chart,
    showToolbar = true,
    showLegend = true,
    nestedSihua = true,
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

  const { axisPalace, selectPalace, layers, toggleLayer, overlay, setOverlay } = useChartState({
    defaultAxisPalace: props.defaultAxisPalace,
    axisPalace: props.axisPalace,
    layers: props.layers,
    onPalaceClick: props.onPalaceClick,
    defaultOverlay: props.defaultOverlay,
  });

  // 目標年：未指定＝今年，夾在此盤可選範圍內
  const year = useMemo(() => {
    const range = flow ? overlayYearRange(flow) : null;
    const y = overlay.targetYear ?? new Date().getFullYear();
    return range ? Math.min(range[1], Math.max(range[0], y)) : y;
  }, [flow, overlay.targetYear]);

  const resolved: OverlayResult | null = useMemo(
    () =>
      flow
        ? resolveOverlay(flow, {
            decade: overlay.decade,
            small: overlay.small,
            year: overlay.year,
            targetYear: year,
            nested: nestedSihua,
          })
        : null,
    [flow, overlay.decade, overlay.small, overlay.year, year, nestedSihua],
  );
  const overlayLayers = resolved?.layers ?? [];
  const isOverlay = overlayLayers.length > 0;

  // 每宮的疊層資料：表頭宮位、四化徽章（依層序）、流曜（依層序）
  const overlayByBranch = useMemo(() => {
    if (!isOverlay) return null;
    const rings = overlayLayers.map(layerRing);
    const out: Record<string, PalaceOverlayInput> = {};
    for (const p of Object.values(natalData.palaces)) {
      const input: PalaceOverlayInput = { headerLayers: [], badgesByStar: {}, flowItems: [] };
      overlayLayers.forEach((L, i) => {
        const ink = layerInk(theme, L.kind);
        const ring = rings[i];
        const code = ring?.codes[p.branch];
        if (ring && code) {
          // 縮寫名（大財／小兄／流父）只在沒有宮位圖示時當退路
          const zh = ring.names[p.branch]?.zh ?? "";
          input.headerLayers.push({ palaceCode: code, name: OVERLAY_LABEL[L.kind][0] + zh.slice(0, 1), ink });
        }
        for (const s of p.stars) {
          const sh = L.sihua[s.code];
          if (sh) (input.badgesByStar[s.code] ??= []).push({ sihua: sh, ink });
        }
        if (layers.flowStars) {
          for (const icon of L.flowStars[p.branch] ?? []) input.flowItems.push({ code: icon, ink });
        }
      });
      out[p.branch] = input;
    }
    return out;
  }, [isOverlay, overlayLayers, natalData, theme, layers.flowStars]);

  const sanfang = useMemo(
    () => computeSanfang(natalData, grid, axisPalace),
    [natalData, grid, axisPalace],
  );
  const sanfangBranches = useMemo(
    () => new Set(sanfang?.highlightBranches ?? []),
    [sanfang],
  );

  const palaceLayouts = useMemo(() => {
    return PALACE_CODES_12.map((code) => {
      const palace = natalData.palaces[code];
      if (!palace) return null;
      const cell = grid.branchToCell(palace.branch);
      let cnName = palaceNameZh(code);
      if (code === natalData.bodyPalace) cnName += "(身)";
      // 宮位干支拆兩段：宮干走左下角、地支走右下角（與靜態圖一致）。
      // code＝書籍代號（天干 01–10→A–J、地支兩位碼）；cn＝中文干支。
      const codeStyle = theme.layout.branchLabelStyle === "code";
      const branchLabel = codeStyle ? palace.branch : branchNameZh(palace.branch);
      const stemLabel = codeStyle ? stemLetter(palace.stem) : stemNameZh(palace.stem);
      const layout = computePalaceLayout(palace, cell, theme, {
        cnName,
        enName: layers.palaceNameEn ? palaceNameEn(code) : "",
        isBody: code === natalData.bodyPalace,
        minorCount: layers.minorStars ? palace.minors.length : 0,
        palaceViewBox,
        overlay: overlayByBranch?.[palace.branch],
      });
      return { palace, layout, branchLabel, stemLabel };
    }).filter((x): x is NonNullable<typeof x> => x !== null);
  }, [natalData, grid, theme, layers.palaceNameEn, layers.minorStars, overlayByBranch]);

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
        <OverlayControls
          flow={flow}
          state={overlay}
          year={year}
          resolved={resolved}
          onChange={setOverlay}
          theme={theme}
        />
      ) : null}
      {showToolbar ? (
        <Toolbar layers={layers} toggleLayer={toggleLayer} theme={theme} hasFlow={isOverlay} />
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

        {/* 三方四正連線（畫在宮位與中宮卡之下） */}
        {layers.sanfang && sanfang ? <SanfangLines sanfang={sanfang} theme={theme} /> : null}

        {/* 中宮：本命＝留白＋右下角命盤 ID；疊盤＝年份／虛歲／各層與配色說明 */}
        {isOverlay && resolved ? (
          <CenterCard resolved={resolved} theme={theme} cw={cw} ch={ch} />
        ) : (
          <ChartIdMark chartId={natalData.chartId} theme={theme} cw={cw} ch={ch} />
        )}

        {/* 十二宮 */}
        {palaceLayouts.map((p) => (
          <Palace
            key={p.palace.code}
            palace={p.palace}
            layout={p.layout}
            theme={theme}
            layers={layers}
            branchLabel={p.branchLabel}
            stemLabel={p.stemLabel}
            isAxis={p.palace.code === axisPalace}
            inSanfang={
              p.palace.code !== axisPalace && sanfangBranches.has(p.palace.branch)
            }
            onClick={selectPalace}
          />
        ))}
      </svg>
      {showLegend ? <ChartLegend data={natalData} theme={theme} /> : null}
    </div>
  );
};

/** 命盤 ID：中宮右下角（與書籍命盤一致；畫在全盤右下會壓到亥宮）。 */
const ChartIdMark: FC<{ chartId: string; theme: ZiweiTheme; cw: number; ch: number }> = ({
  chartId,
  theme,
  cw,
  ch,
}) => {
  if (!chartId) return null;
  const inset = theme.layout.centerIdInset;
  return (
    <text
      x={3 * cw - inset}
      y={3 * ch - inset}
      textAnchor="end"
      fontSize={theme.sizes.starMinor}
      fill={theme.colors.chartIdInk}
      fontFamily="monospace"
      letterSpacing="0.05em"
      style={{ pointerEvents: "none" }}
    >
      {chartId}
    </text>
  );
};

type CardItem =
  | { type: "title"; text: string }
  | { type: "kv"; label: string; value: string; color?: string }
  | { type: "divider" }
  | { type: "colorKey"; items: Array<{ label: string; color: string }> };

/** 中宮內容卡：對應 p_e_artist composer._compose_center_card 的呈現原語（垂直置中堆疊）。 */
const CenterCard: FC<{ resolved: OverlayResult; theme: ZiweiTheme; cw: number; ch: number }> = ({
  resolved,
  theme,
  cw,
  ch,
}) => {
  const items: CardItem[] = [
    { type: "title", text: `${resolved.year}　${resolved.ganzhi}年` },
  ];
  if (resolved.age != null) items.push({ type: "kv", label: "虛歲", value: `${resolved.age} 歲` });
  items.push({ type: "divider" });
  for (const L of resolved.layers) {
    const color = layerInk(theme, L.kind);
    if (L.kind === "decade" && resolved.decade) {
      const d = resolved.decade;
      items.push({
        type: "kv",
        label: L.nested ? "大限四化" : "大限",
        value: `${d.name}　${d.ageRange} 歲`,
        color,
      });
    } else if (L.kind === "small" && L.mingBranch) {
      items.push({ type: "kv", label: "小限", value: `命宮在${branchNameZh(L.mingBranch)}`, color });
    } else if (L.kind === "year" && L.mingBranch) {
      items.push({ type: "kv", label: "流年", value: `命宮在${branchNameZh(L.mingBranch)}`, color });
    }
  }
  items.push({ type: "divider" });
  items.push({
    type: "colorKey",
    items: [
      { label: "本命", color: theme.colors.layerNatal },
      ...resolved.layers.map((L) => ({
        label: L.nested ? "大限四化" : OVERLAY_LABEL[L.kind],
        color: layerInk(theme, L.kind),
      })),
    ],
  });

  const fsTitle = 16;
  const fsKv = 12;
  const fsKvl = 10;
  const fsKey = 10;
  const hOf = (it: CardItem) =>
    it.type === "title" ? fsTitle + 10 : it.type === "kv" ? fsKv + 7 : it.type === "divider" ? 13 : fsKey + 10;
  const pad = 24;
  const cx = 2 * cw;
  const total = items.reduce((a, it) => a + hOf(it), 0);
  let y = ch + Math.max(pad, (2 * ch - total) / 2);
  const est = (s: string, fs: number) =>
    [...s].reduce((a, c) => a + (c.codePointAt(0)! > 0x2e80 ? fs : fs * 0.55), 0);

  const els = items.map((it, i) => {
    const top = y;
    y += hOf(it);
    if (it.type === "title") {
      return (
        <text key={i} x={cx} y={top + fsTitle} textAnchor="middle" fontSize={fsTitle} fontWeight="bold"
          fill={theme.colors.palaceName} fontFamily={theme.fontFamily} letterSpacing="0.06em">
          {it.text}
        </text>
      );
    }
    if (it.type === "kv") {
      const gap = 8;
      const wl = est(it.label, fsKvl);
      const x0 = cx - (wl + gap + est(it.value, fsKv)) / 2;
      return (
        <g key={i}>
          <text x={x0} y={top + fsKv} fontSize={fsKvl} fill={it.color ?? "#888888"} fontWeight={it.color ? 600 : undefined}
            fontFamily={theme.fontFamily}>
            {it.label}
          </text>
          <text x={x0 + wl + gap} y={top + fsKv} fontSize={fsKv} fill="#333333" fontFamily={theme.fontFamily}>
            {it.value}
          </text>
        </g>
      );
    }
    if (it.type === "divider") {
      const w = 2 * cw * 0.42;
      return (
        <line key={i} x1={cx - w / 2} y1={top + 6} x2={cx + w / 2} y2={top + 6}
          stroke={theme.colors.gridStroke} strokeWidth={0.5} />
      );
    }
    const segGap = 14;
    const r = 4.5;
    const dotGap = 5;
    const widths = it.items.map((e) => 2 * r + dotGap + est(e.label, fsKey));
    let x = cx - (widths.reduce((a, b) => a + b, 0) + segGap * Math.max(0, widths.length - 1)) / 2;
    const cy = top + hOf(it) / 2 - 2;
    return (
      <g key={i}>
        {it.items.map((e, j) => {
          const x0 = x;
          x += widths[j] + segGap;
          return (
            <g key={j}>
              <circle cx={x0 + r} cy={cy} r={r} fill={e.color} />
              <text x={x0 + 2 * r + dotGap} y={cy + fsKey * 0.35} fontSize={fsKey} fill="#333333"
                fontFamily={theme.fontFamily}>
                {e.label}
              </text>
            </g>
          );
        })}
      </g>
    );
  });

  return <g style={{ pointerEvents: "none" }}>{els}</g>;
};
