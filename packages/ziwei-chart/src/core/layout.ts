/**
 * 命盤幾何佈局引擎 —— 移植自 p_e_artist layout.py（GridLayout）與
 * svg_writer.py 的 _render_palace_el（v2 宮位內部絕對座標）。
 * 純函式，輸出座標數字，由 React 層畫成 <svg>。
 */

import { BRANCH_GRID_MAP } from "./constants";
import type { PalaceInfo, StarInfo } from "./model";
import type { ZiweiTheme } from "./theme";
import { starNameZh } from "./registry";

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

// ── 宮位內部排版（對應 _render_palace_el）───────────────────

export interface StarIconBox {
  star: StarInfo;
  x: number;
  y: number;
  size: number;
  /** 四化徽章（圓心、半徑、字母），無則 null。 */
  badge: { cx: number; cy: number; r: number; label: string } | null;
}

export interface PalaceLayout {
  cell: CellRect;
  /** 宮名文字基線位置（anchor=start）。 */
  name: { x: number; y: number };
  /** 英文宮名位置。 */
  nameEn: { x: number; y: number };
  /** 地支文字位置（anchor=end）。 */
  branch: { x: number; y: number };
  /** header 底線。 */
  underline: { x1: number; y1: number; x2: number; y2: number };
  majorIcons: StarIconBox[];
  subIcons: StarIconBox[];
  /** 小星單行文字（anchor=middle），無則 null。 */
  minorText: { x: number; y: number; text: string } | null;
}

const SIHUA_LETTER: Record<string, string> = { FO: "F", PW: "P", HO: "H", BI: "I" };

function iconBoxes(
  stars: StarInfo[],
  iconSize: number,
  gap: number,
  rowTopY: number,
  cell: CellRect,
  badgeSize: number,
): StarIconBox[] {
  const n = stars.length;
  if (n === 0) return [];
  const totalW = n * iconSize + (n - 1) * gap;
  const leftX = cell.x + (cell.w - totalW) / 2;
  return stars.map((star, i) => {
    const x = leftX + i * (iconSize + gap);
    const y = rowTopY;
    const letter = star.sihua ? SIHUA_LETTER[star.sihua] ?? "" : "";
    const badge = letter
      ? {
          cx: x + iconSize - badgeSize / 2,
          cy: y + badgeSize / 2,
          r: badgeSize / 2,
          label: letter,
        }
      : null;
    return { star, x, y, size: iconSize, badge };
  });
}

/**
 * 計算單一宮位的完整內部佈局。幾何與 p_e_artist v2 SVG 一致。
 */
export function computePalaceLayout(
  palace: PalaceInfo,
  cell: CellRect,
  theme: ZiweiTheme,
  opts: { cnName: string; enName: string; branchLabel: string },
): PalaceLayout {
  const lo = theme.layout;
  const padLeft = lo.palacePadLeft;
  const padRight = lo.palacePadRight;
  const padBottom = lo.palacePadBottom;
  const iconMain = lo.iconMainSize;
  const iconMainGap = lo.iconMainGap;
  const iconSub = lo.iconSubSize;
  const iconSubGap = lo.iconSubGap;
  const badge = lo.sihuaBadgeSize;
  const minorLh = lo.minorLineHeight;
  const minorPb = lo.minorPadBottom;
  const underlineY = lo.headerUnderlineOffset;
  const baselineY = lo.headerBaselineOffset;
  const sep = lo.minorSeparator;
  const starMinorSize = theme.sizes.starMinor;

  const px = cell.x;
  const py = cell.y;
  const pw = cell.w;
  const ph = cell.h;

  // header
  const cnW = [...opts.cnName].reduce(
    (acc, ch) =>
      acc +
      (ch.codePointAt(0)! > 0x2e80
        ? theme.sizes.palaceName
        : theme.sizes.palaceName * 0.55),
    0,
  );

  // stars 區域幾何（對應 svg_writer）
  const minorHeight = starMinorSize * minorLh + minorPb;
  const starsAreaTop = py + underlineY;
  const starsAreaBottom = py + ph - padBottom;
  const iconsTop = starsAreaTop;
  const hasMajors = palace.majors.length > 0;
  const hasSubs = palace.subs.length > 0;
  const hasMinors = palace.minors.length > 0;
  const iconsBottom = starsAreaBottom - (hasMinors ? minorHeight : 0);
  const iconsH = iconsBottom - iconsTop;
  const iconsTotalH = (hasMajors ? iconMain : 0) + (hasSubs ? iconSub : 0);
  const iconsYStart = iconsTop + (iconsH - iconsTotalH) / 2;

  const majorIcons = hasMajors
    ? iconBoxes(palace.majors, iconMain, iconMainGap, iconsYStart, cell, badge)
    : [];
  const subY = iconsYStart + (hasMajors ? iconMain : 0);
  const subIcons = hasSubs
    ? iconBoxes(palace.subs, iconSub, iconSubGap, subY, cell, badge)
    : [];

  let minorText: PalaceLayout["minorText"] = null;
  if (hasMinors) {
    const lineTop = starsAreaBottom - minorHeight;
    const lineBaseline =
      lineTop + starMinorSize * 0.85 + (starMinorSize * (minorLh - 1)) / 2;
    minorText = {
      x: px + pw / 2,
      y: lineBaseline,
      text: palace.minors
        .map((s) => starLabelFor(s.code))
        .join(sep),
    };
  }

  return {
    cell,
    name: { x: px + padLeft, y: py + baselineY },
    nameEn: { x: px + padLeft + cnW + 4, y: py + baselineY },
    branch: { x: px + pw - padRight, y: py + baselineY },
    underline: {
      x1: px + padLeft,
      y1: py + underlineY,
      x2: px + pw - padRight,
      y2: py + underlineY,
    },
    majorIcons,
    subIcons,
    minorText,
  };
}

function starLabelFor(code: string): string {
  return starNameZh(code);
}
