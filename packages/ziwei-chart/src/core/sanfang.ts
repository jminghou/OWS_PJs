/**
 * 三方四正連線計算 —— 移植自 p_e_artist composer.py
 * (_sanfang_sizheng_branches / _cell_connection_point / _TRIANGLE_EDGES)。
 *
 * 以任一宮位為主軸：本宮 ↔ 對宮(±6)、本宮 ↔ 三合A(+4)、本宮 ↔ 三合B(+8)、三合A ↔ 三合B。
 */

import type { CellRect } from "./layout";
import type { GridLayout } from "./layout";
import type { ChartData } from "./model";

export interface SanfangLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface SanfangResult {
  /** 主軸宮地支、對宮、三合A、三合B 的地支兩位碼。 */
  branches: [string, string, string, string];
  /** 4 條連線座標。 */
  lines: SanfangLine[];
  /** 構成三方四正的 4 個地支（供主軸高亮）。 */
  highlightBranches: string[];
}

// 4 條連線：本宮↔對宮、本宮↔三合A、本宮↔三合B、三合A↔三合B。
const TRIANGLE_EDGES: ReadonlyArray<readonly [number, number]> = [
  [0, 1], [0, 2], [0, 3], [2, 3],
];

/** 傳回 (本宮, 對宮, 三合A, 三合B) 地支碼；找不到主軸宮回 null。 */
export function sanfangSizhengBranches(
  data: ChartData,
  axisPalaceCode: string,
): [string, string, string, string] | null {
  const palace = data.palaces[axisPalaceCode];
  if (!palace) return null;
  const b = parseInt(palace.branch, 10);
  const opp = ((b + 6 - 1) % 12) + 1;
  const ta = ((b + 4 - 1) % 12) + 1;
  const tb = ((b + 8 - 1) % 12) + 1;
  const pad = (n: number) => String(n).padStart(2, "0");
  return [pad(b), pad(opp), pad(ta), pad(tb)];
}

/** 宮位連接點：邊宮取內側邊中點，角宮取內側角。與 p_e_artist 一致。 */
export function cellConnectionPoint(cell: CellRect): { x: number; y: number } {
  const isTop = cell.row === 0;
  const isBottom = cell.row === 3;
  const isLeft = cell.col === 0;
  const isRight = cell.col === 3;
  let y: number;
  if (isTop) y = cell.y + cell.h;
  else if (isBottom) y = cell.y;
  else y = cell.y + cell.h / 2;
  let x: number;
  if (isLeft) x = cell.x + cell.w;
  else if (isRight) x = cell.x;
  else x = cell.x + cell.w / 2;
  return { x, y };
}

/** 計算主軸宮的三方四正連線與高亮地支。 */
export function computeSanfang(
  data: ChartData,
  grid: GridLayout,
  axisPalaceCode: string,
): SanfangResult | null {
  const branches = sanfangSizhengBranches(data, axisPalaceCode);
  if (!branches) return null;
  const cells = branches.map((b) => grid.branchToCell(b));
  const pts = cells.map((c) => cellConnectionPoint(c));
  const lines: SanfangLine[] = TRIANGLE_EDGES.map(([i, j]) => ({
    x1: pts[i].x,
    y1: pts[i].y,
    x2: pts[j].x,
    y2: pts[j].y,
  }));
  return { branches, lines, highlightBranches: [...branches] };
}
