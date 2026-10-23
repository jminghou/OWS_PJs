/**
 * 命盤幾何佈局引擎 —— 移植自 p_e_artist layout.py（GridLayout）與
 * svg_writer.py 的 _render_palace_el／_star_area（單盤＋疊盤版面，與書籍命盤一致）。
 * 純函式，輸出座標數字，由 React 層畫成 <svg>。
 */

import {
  BRANCH_GRID_MAP,
  FOURTEEN_MAIN_STAR_CODES,
  SIHUA_LABEL,
  SUB_STAR_SORT_RANK,
} from "./constants";
import type { PalaceInfo, StarInfo } from "./model";
import type { ZiweiTheme } from "./theme";
import { STAR_ART_BOUNDS, type ArtBounds } from "./starBounds";

export interface CellRect {
  x: number;
  y: number;
  w: number;
  h: number;
  row: number;
  col: number;
}

export class GridLayout {
  readonly cellW: number;
  readonly cellH: number;
  readonly canvasW: number;
  readonly canvasH: number;

  constructor(theme: ZiweiTheme) {
    this.cellW = theme.layout.cellWidth;
    this.cellH = theme.layout.cellHeight;
    this.canvasW = 4 * this.cellW;
    this.canvasH = 4 * this.cellH;
  }

  branchToCell(branchCode: string): CellRect {
    const [row, col] = BRANCH_GRID_MAP[branchCode] ?? [3, 2];
    return {
      x: col * this.cellW,
      y: row * this.cellH,
      w: this.cellW,
      h: this.cellH,
      row,
      col,
    };
  }

  centerRect(): CellRect {
    return {
      x: this.cellW,
      y: this.cellH,
      w: 2 * this.cellW,
      h: 2 * this.cellH,
      row: 1,
      col: 1,
    };
  }
}

// ── 宮位內部排版（對應 _render_palace_el／_star_area）─────────

const FULL_FRAME: ArtBounds = { l: 0, t: 0, r: 1, b: 1 };

/** 圖示實際圖形佔畫框的比例；查不到時以整個畫框為準。 */
export function starArtBounds(code: string): ArtBounds {
  return STAR_ART_BOUNDS[code] ?? FULL_FRAME;
}

/** 十四主星圖形下緣的最大比例：主星列保留高用它，跨宮位的輔星首列才會同一條線。 */
const MAIN_ART_BOTTOM = Math.max(
  ...[...FOURTEEN_MAIN_STAR_CODES].map((c) => starArtBounds(c).b),
);

// 星曜原稿 289 畫框、線寬 5；宮位圖原稿線寬 4.5（畫框讀 viewBox）。
const STAR_FRAME_UNITS = 289;
const STAR_STROKE_UNITS = 5;
const PALACE_STROKE_UNITS = 4.5;

/** 四化徽章（圖示 F/P/H/I，貼在星曜圖形正下方）。 */
export interface BadgeBox {
  x: number;
  y: number;
  size: number;
  /** 徽章圖示碼 F/P/H/I。 */
  label: string;
  /** 徽章色（本命紅在前、各層色在後）。 */
  ink: string;
}

export interface StarIconBox {
  star: StarInfo;
  x: number;
  y: number;
  size: number;
  /** 線寬倍率（副星縮小後補到與主星同粗）。 */
  strokeScale: number;
  /** 圖示墨色；空字串＝主題預設（starGlyph）。 */
  ink: string;
  badges: BadgeBox[];
}

/** 表頭項：宮位圖示（本命全寬或疊層半寬，key＝PALACE_SVG_DATA 鍵）或文字。 */
export type HeadItem =
  | { type: "icon"; key: string; x: number; y: number; w: number; h: number; ink: string; strokeScale: number }
  | { type: "text"; role: "name" | "layer" | "en"; text: string; x: number; y: number; fontSize: number; ink: string };

/** 一層在本宮的資料（由 ZiweiChart 依疊層解析後傳入；本命單盤不給）。 */
export interface PalaceOverlayInput {
  /** 疊層表頭：各層在本宮的宮位碼／縮寫名與層色（巢狀大限不列）。 */
  headerLayers: Array<{ palaceCode: string; name: string; ink: string }>;
  /** 星曜碼 → 疊層四化（依層序）。 */
  badgesByStar: Record<string, Array<{ sihua: string; ink: string }>>;
  /** 本宮流曜（依層序，接在輔星後同網格排）。 */
  flowItems: Array<{ code: string; ink: string }>;
}

export interface PalaceLayout {
  cell: CellRect;
  /** 表頭（宮位圖示／疊層宮位圖示／文字），整組水平置中。 */
  head: HeadItem[];
  /** 身宮外框（此宮為身宮且走圖示模式時非 null）。 */
  bodyFrame: { x: number; y: number; w: number; h: number; strokeWidth: number; ink: string } | null;
  /** 地支文字位置（宮格右下角，anchor=end）。 */
  branch: { x: number; y: number };
  /** 宮干文字位置（宮格左下角，anchor=start）；無宮干時仍給座標，由呼叫端決定畫不畫。 */
  stem: { x: number; y: number };
  /** header 底線。 */
  underline: { x1: number; y1: number; x2: number; y2: number };
  majorIcons: StarIconBox[];
  /** 輔星＋流曜（同一網格）。 */
  subIcons: StarIconBox[];
  /** 輔星塞不下時的「+N」收尾（anchor=middle）；無則 null。 */
  overflow: { x: number; y: number; text: string } | null;
  /** 小星文字列基線（anchor=middle）；不顯示小星時為 null。 */
  minorText: { x: number; y: number } | null;
}

function cjkWidth(s: string, fs: number): number {
  return [...s].reduce((acc, ch) => acc + (ch.codePointAt(0)! > 0x2e80 ? fs : fs * 0.55), 0);
}

/**
 * 計算單一宮位的完整內部佈局。幾何與 p_e_artist SVG（書籍命盤）一致：
 *
 *   表頭＝宮位圖示（疊盤時本命與各層半寬圖示並排、各上層色），整組置中
 *   主星列＝鎖星曜區頂，其下貼著圖形放四化徽章（本命紅在前、各層色在後）
 *   輔星＋流曜＝固定網格（首列在「主星＋四化排保留位」之下），依格寬換行；
 *          塞不下時整塊上移，仍不夠則捨尾列改「+N」
 *   整組以實際圖形上下緣垂直置中於星曜區
 *   小星文字列（有才佔高）在下緣；干支列（宮干左下、地支右下）最底
 *
 * 尺寸階層＝單盤 77/35/21、疊盤 60/34/16。
 */
export function computePalaceLayout(
  palace: PalaceInfo,
  cell: CellRect,
  theme: ZiweiTheme,
  opts: {
    /** 文字宮名（圖示模式無圖檔時的退路）。 */
    cnName: string;
    /** 英文宮名；空字串＝不顯示。 */
    enName?: string;
    isBody?: boolean;
    /** 小星文字列要顯示幾顆（依圖層開關決定）；0＝不保留高度。 */
    minorCount?: number;
    /** 宮位圖示畫框 [w, h]（PALACE_SVG_DATA 的 viewBox）；查不到回 undefined。 */
    palaceViewBox?: (key: string) => [number, number] | undefined;
    /** 疊盤資料；給了就走疊盤尺寸與表頭。 */
    overlay?: PalaceOverlayInput;
  },
): PalaceLayout {
  const lo = theme.layout;
  const ov = opts.overlay;
  const padLeft = lo.palacePadLeft;
  const padRight = lo.palacePadRight;
  const padBottom = lo.palacePadBottom;
  const iconMain = ov ? lo.overlayIconMainSize : lo.iconMainSize;
  const iconMainGap = lo.iconMainGap;
  const iconSub = ov ? lo.overlayIconSubSize : lo.iconSubSize;
  const iconSubGap = ov ? lo.overlayIconSubGap : lo.iconSubGap;
  const badge = ov ? lo.overlayBadgeSize : lo.sihuaBadgeSize;
  const badgeGap = ov ? lo.overlayBadgeGap : lo.sihuaBadgeGap;
  const rowGap = ov ? lo.overlayRowGap : lo.iconRowGap;
  const attachGap = lo.sihuaBadgeAttachGap;
  // 疊盤時本命層的星曜、宮位圖示也上本命層色（紅）；單盤留空＝主題 starGlyph
  const natalInk = ov ? theme.colors.layerNatal : "";
  const useIcon = lo.palaceNameStyle === "icon";
  // 表頭帶高＝星曜區起點。圖示模式較高（要容下圖示＋身宮外框），
  // 且只看 style 不看個別宮位——12 宮的星曜區必須從同一條線開始。
  const underlineY = useIcon ? lo.palaceIconHeaderOffset : lo.headerUnderlineOffset;
  // 線寬對齊主星圖示的視覺線寬（整張盤線條一致；疊盤主星較小，線也跟著細）
  const strokePx = (STAR_STROKE_UNITS * iconMain) / STAR_FRAME_UNITS;
  const starMinorSize = theme.sizes.starMinor;

  const px = cell.x;
  const py = cell.y;
  const pw = cell.w;
  const ph = cell.h;

  // ── 表頭：本命宮位圖示（疊盤用半寬版）＋各層半寬圖示（缺圖退回縮寫文字），整組置中 ──
  const vb = (key: string) => opts.palaceViewBox?.(key);
  const natalKey = ov && vb(`h${palace.code}`) ? `h${palace.code}` : palace.code;
  const natalVb = useIcon ? vb(natalKey) : undefined;
  const iconH = lo.palaceIconHeight;
  const halfH = lo.palaceLayerIconHeight;
  const framePad = lo.palaceBodyFramePad;
  const iconTop = py + lo.palaceIconTopGap;
  const iconY = iconTop + framePad;          // 本命圖示上緣（12 宮同一條線）
  const midY = iconY + iconH / 2;           // 疊層圖示對齊本命圖示的中線
  const baselineY = py + lo.headerBaselineOffset;

  type Pending =
    | { type: "icon"; key: string; w: number; h: number; vbH: number; ink: string; natal: boolean }
    | { type: "text"; role: "name" | "layer" | "en"; text: string; fontSize: number; ink: string };
  const pending: Pending[] = [];
  if (natalVb) {
    pending.push({
      type: "icon", key: natalKey, w: (iconH * natalVb[0]) / natalVb[1], h: iconH,
      vbH: natalVb[1], ink: natalInk || theme.colors.palaceName, natal: true,
    });
  } else if (opts.cnName) {
    pending.push({ type: "text", role: "name", text: opts.cnName, fontSize: theme.sizes.palaceName, ink: theme.colors.palaceName });
  }
  for (const L of ov?.headerLayers ?? []) {
    const key = `h${L.palaceCode}`;
    const lvb = useIcon ? vb(key) : undefined;
    if (lvb) {
      pending.push({ type: "icon", key, w: (halfH * lvb[0]) / lvb[1], h: halfH, vbH: lvb[1], ink: L.ink, natal: false });
    } else {
      pending.push({ type: "text", role: "layer", text: L.name, fontSize: theme.sizes.palaceName, ink: L.ink });
    }
  }
  if (opts.enName) {
    pending.push({ type: "text", role: "en", text: opts.enName, fontSize: theme.sizes.palaceNameEn, ink: theme.colors.palaceNameEn });
  }

  // 外框留白一律計入版面（只有身宮真的畫框），否則有框那格的圖示會跟別格不齊
  const itemW = (it: Pending) =>
    it.type === "icon" ? it.w + (it.natal ? 2 * framePad : 0) : cjkWidth(it.text, it.fontSize);
  const nameGap = lo.palaceNameGap;
  const headW = pending.reduce((a, it) => a + itemW(it), 0) + nameGap * Math.max(0, pending.length - 1);
  let hx = px + (pw - headW) / 2;
  const head: HeadItem[] = [];
  let bodyFrame: PalaceLayout["bodyFrame"] = null;
  for (const it of pending) {
    if (it.type === "icon") {
      const x = hx + (it.natal ? framePad : 0);
      const y = it.natal ? iconY : midY - it.h / 2;
      head.push({
        type: "icon", key: it.key, x, y, w: it.w, h: it.h, ink: it.ink,
        strokeScale: strokePx / ((PALACE_STROKE_UNITS * it.h) / it.vbH),
      });
      if (it.natal && opts.isBody) {
        bodyFrame = {
          x: hx, y: iconTop, w: it.w + 2 * framePad, h: it.h + 2 * framePad,
          strokeWidth: strokePx, ink: it.ink,
        };
      }
    } else {
      head.push({ type: "text", role: it.role, text: it.text, x: hx, y: baselineY, fontSize: it.fontSize, ink: it.ink });
    }
    hx += itemW(it) + nameGap;
  }

  // ── 星曜區幾何 ──
  const minorCount = opts.minorCount ?? 0;
  const minorHeight =
    minorCount > 0 ? starMinorSize * lo.minorLineHeight + lo.minorPadBottom : 0;
  // 干支列整列保留高度：星曜置中排、寬度逼近內寬，逐宮判斷會讓各宮基準線不齊
  const gzHeight = theme.sizes.branch + 2;
  const areaTop = py + underlineY;
  const areaBottom = py + ph - padBottom - gzHeight - minorHeight;

  // 四化徽章貼著「圖形」放而非貼著畫框：圖示畫框內約有 25% 留白
  const badgeDrop = (code: string, size: number) => size * starArtBounds(code).b + attachGap;
  const badgeCx = (code: string, ix: number, size: number) => {
    const b = starArtBounds(code);
    return ix + (size * (b.l + b.r)) / 2;
  };
  const strokeScale = (size: number) =>
    size <= 0 || size >= iconMain ? 1 : 1 + lo.iconSubStrokeMatch * (iconMain / size - 1);

  // 一顆星的徽章：本命四化（紅）在前，各疊層四化依層序在後；流曜本身不帶四化
  interface Item { star: StarInfo; ink: string; flow: boolean }
  const badgeSpecs = (it: Item): Array<{ label: string; ink: string }> => {
    if (it.flow) return [];
    const out: Array<{ label: string; ink: string }> = [];
    const natal = it.star.sihua ? SIHUA_LABEL[it.star.sihua] : undefined;
    if (natal) out.push({ label: natal, ink: theme.colors.sihuaInk });
    for (const b of ov?.badgesByStar[it.star.code] ?? []) {
      const label = SIHUA_LABEL[b.sihua];
      if (label) out.push({ label, ink: b.ink });
    }
    return out;
  };
  const badgeRow = (it: Item, cx: number, top: number): BadgeBox[] => {
    const specs = badgeSpecs(it);
    let bx = cx - (specs.length * badge + (specs.length - 1) * badgeGap) / 2;
    return specs.map((s) => {
      const box = { x: bx, y: top, size: badge, label: s.label, ink: s.ink };
      bx += badge + badgeGap;
      return box;
    });
  };

  const majors: Item[] = palace.majors.map((star) => ({ star, ink: natalInk, flow: false }));
  // 顯示排序（空劫→煞→輔→雜曜）；穩定排序讓同碼的本命星與各層流曜相鄰（本命在前、層序在後）
  const subItems: Item[] = [
    ...palace.subs.map((star) => ({ star, ink: natalInk, flow: false })),
    ...(ov?.flowItems ?? []).map((f) => ({
      star: { code: f.code, branch: palace.branch, brightness: null, sihua: null, kind: "sub" as const },
      ink: f.ink,
      flow: true,
    })),
  ].sort(
    (a, b) =>
      (SUB_STAR_SORT_RANK[a.star.code] ?? Infinity) - (SUB_STAR_SORT_RANK[b.star.code] ?? Infinity),
  );

  // 主星列保留高＝跨宮位固定（不看本宮是哪顆主星），輔星首列才會同一條線；
  // 徽章多半落在畫框下緣的留白內，幾乎不另佔高。
  const mainReserved =
    Math.max(iconMain, iconMain * MAIN_ART_BOTTOM + attachGap + badge) + badgeGap;
  const hasMainBadge = majors.some((m) => badgeSpecs(m).length > 0);
  const hMajors = majors.length ? (hasMainBadge ? mainReserved : iconMain * MAIN_ART_BOTTOM) : 0;

  // ── 主星列：鎖星曜區頂 ──
  const majorIcons: StarIconBox[] = [];
  if (majors.length) {
    const n = majors.length;
    const left = px + (pw - (n * iconMain + (n - 1) * iconMainGap)) / 2;
    majors.forEach((it, i) => {
      const ix = left + i * (iconMain + iconMainGap);
      majorIcons.push({
        star: it.star,
        x: ix,
        y: areaTop,
        size: iconMain,
        strokeScale: 1,
        ink: it.ink,
        badges: badgeRow(it, badgeCx(it.star.code, ix, iconMain), areaTop + badgeDrop(it.star.code, iconMain)),
      });
    });
  }
  const majorsBottom = areaTop + hMajors;

  // ── 輔星＋流曜：依格寬換行 ──
  const innerW = pw - padLeft - padRight;
  let lines: Item[][] = [];
  let cur: Item[] = [];
  let curW = 0;
  for (const it of subItems) {
    const add = cur.length ? iconSubGap + iconSub : iconSub;
    if (cur.length && curW + add > innerW) {
      lines.push(cur);
      cur = [it];
      curW = iconSub;
    } else {
      cur.push(it);
      curW += add;
    }
  }
  if (cur.length) lines.push(cur);

  let lineH = lines.map((line) =>
    Math.max(
      iconSub,
      ...line
        .filter((it) => badgeSpecs(it).length > 0)
        .map((it) => badgeDrop(it.star.code, iconSub) + badge + badgeGap),
    ),
  );
  const totalH = (hs: number[]) =>
    hs.reduce((a, b) => a + b, 0) + rowGap * Math.max(0, hs.length - 1);

  // 首列鎖固定線（主星＋四化排保留位之下）；塞不下時整塊上移，但不侵入主星實際佔用區；
  // 物理極限外捨尾列，改以「+N」收尾——寧可截斷示意，也不讓圖示脫框。
  const floorY = majorsBottom + (majors.length ? rowGap : 0);
  let subsTotal = totalH(lineH);
  let y = areaTop + mainReserved + rowGap;
  if (y + subsTotal > areaBottom) y = Math.max(areaBottom - subsTotal, floorY);

  let overflowN = 0;
  if (y + subsTotal > areaBottom) {
    const markerH = starMinorSize + 4;
    const avail = areaBottom - floorY;
    let keep = lines.length;
    while (keep > 0) {
      const budget = avail - (keep < lines.length ? markerH + rowGap : 0);
      if (totalH(lineH.slice(0, keep)) <= budget) break;
      keep -= 1;
    }
    overflowN = lines.slice(keep).reduce((a, l) => a + l.length, 0);
    lines = lines.slice(0, keep);
    lineH = lineH.slice(0, keep);
    subsTotal = totalH(lineH);
    y = floorY;
  }

  const subIcons: StarIconBox[] = [];
  lines.forEach((line, li) => {
    const lineW = line.length * iconSub + iconSubGap * (line.length - 1);
    let ix = px + (pw - lineW) / 2;
    for (const it of line) {
      subIcons.push({
        star: it.star,
        x: ix,
        y,
        size: iconSub,
        strokeScale: strokeScale(iconSub),
        ink: it.ink,
        badges: badgeRow(it, badgeCx(it.star.code, ix, iconSub), y + badgeDrop(it.star.code, iconSub)),
      });
      ix += iconSub + iconSubGap;
    }
    y += lineH[li] + (li < lines.length - 1 ? rowGap : 0);
  });

  let overflow: PalaceLayout["overflow"] = null;
  if (overflowN) {
    overflow = {
      x: px + pw / 2,
      y: y + (lines.length ? rowGap : 0) + starMinorSize * 0.85,
      text: `+${overflowN}`,
    };
  }

  // ── 整組垂直置中：以實際圖形上下緣為準（畫框留白不算），上下皆可移但不出星曜區 ──
  const icons = [...majorIcons, ...subIcons];
  const tops: number[] = [];
  const bottoms: number[] = [];
  for (const box of icons) {
    const b = starArtBounds(box.star.code);
    tops.push(box.y + box.size * b.t);
    bottoms.push(box.y + box.size * b.b);
    for (const bd of box.badges) {
      const bb = starArtBounds(bd.label);
      tops.push(bd.y + bd.size * bb.t);
      bottoms.push(bd.y + bd.size * bb.b);
    }
  }
  if (overflow) {
    tops.push(overflow.y - starMinorSize);
    bottoms.push(overflow.y);
  }
  if (tops.length) {
    const minTop = Math.min(...tops);
    const maxBottom = Math.max(...bottoms);
    let dy = (areaTop + areaBottom - (minTop + maxBottom)) / 2;
    dy = Math.max(areaTop - minTop, Math.min(dy, areaBottom - maxBottom));
    for (const box of icons) {
      box.y += dy;
      for (const bd of box.badges) bd.y += dy;
    }
    if (overflow) overflow.y += dy;
  }

  let minorText: PalaceLayout["minorText"] = null;
  if (minorCount > 0) {
    const lineTop = py + ph - padBottom - gzHeight - minorHeight;
    minorText = {
      x: px + pw / 2,
      y: lineTop + starMinorSize * 0.85 + (starMinorSize * (lo.minorLineHeight - 1)) / 2,
    };
  }

  // 干支在宮格下緣：宮干左下、地支右下，同一條基線
  const gzBaseline = py + ph - padBottom;

  return {
    cell,
    head,
    bodyFrame,
    branch: { x: px + pw - padRight, y: gzBaseline },
    stem: { x: px + padLeft, y: gzBaseline },
    underline: {
      x1: px + padLeft,
      y1: py + underlineY,
      x2: px + pw - padRight,
      y2: py + underlineY,
    },
    majorIcons,
    subIcons,
    overflow,
    minorText,
  };
}
