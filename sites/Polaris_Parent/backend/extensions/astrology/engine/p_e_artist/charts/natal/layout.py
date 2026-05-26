"""
命盤幾何佈局引擎
提供畫布級 GridLayout 與宮位級 PalaceLayout（7×7 網格系統）。
"""

from dataclasses import dataclass
from typing import List, Optional, Set, Tuple
from ...theme import ThemeConfig

# 地支碼 → 4×4 格位 (row, col)，固定物理佈局，不受主題影響
BRANCH_GRID_MAP = {
    "01": (3, 2),  "02": (3, 1),  "03": (3, 0),  "04": (2, 0),
    "05": (1, 0),  "06": (0, 0),  "07": (0, 1),  "08": (0, 2),
    "09": (0, 3),  "10": (1, 3),  "11": (2, 3),  "12": (3, 3),
}


@dataclass
class CellRect:
    """一個格位的像素空間矩形。"""
    x: float
    y: float
    width: float
    height: float
    row: int
    col: int


class GridLayout:
    """4×4 中空方陣的畫布級佈局。"""

    def __init__(self, theme: ThemeConfig):
        lo = theme.layout
        self.cell_w: float = lo["cell_width"]
        self.cell_h: float = lo["cell_height"]
        self.canvas_w: float = 4 * self.cell_w
        self.canvas_h: float = 4 * self.cell_h

    def branch_to_cell(self, branch_code: str) -> CellRect:
        row, col = BRANCH_GRID_MAP[branch_code]
        return CellRect(
            x=col * self.cell_w, y=row * self.cell_h,
            width=self.cell_w, height=self.cell_h,
            row=row, col=col,
        )

    def center_rect(self) -> CellRect:
        return CellRect(
            x=self.cell_w, y=self.cell_h,
            width=2 * self.cell_w, height=2 * self.cell_h,
            row=1, col=1,
        )


class PalaceLayout:
    """
    宮位內部 6×6 正方形網格排版系統。

    ┌──┬──┬──┬──┬──┬──┐
    │       宮名          │  row 0  ─ 宮名 header
    ├──┼──┼──┼──┼──┼──┤
    │  │ 主1  │ 主2  │  │  row 1 ┐
    │  │ (2×2)│ (2×2)│  │  row 2 ┘ 主星區
    ├──┼──┼──┼──┼──┼──┤
    │  │ s │ s │ t │ t │  │  row 3 ┐ 副星+小星（cols 1-4）
    │  │ s │ t │ t │ t │  │  row 4 ┘
    ├──┼──┼──┼──┼──┼──┤
    │  │ t │ t │ t │ t │地支│  row 5  ─ 溢出 + 地支
    └──┴──┴──┴──┴──┴──┘

    主星定位（rows 1-2）：
      2 顆 → cols 1-2 / cols 3-4
      1 顆 → 絕對置中
      0 顆 → 留空

    副星+小星混合區（rows 3-4, cols 1-4）：
      有圖副星優先，不滿時接續純文字小星，共 8 格
      溢出到 row 5 cols 1-4（4 格），row 5 col 5 = 地支
      總計最多 12 格
    """

    COLS = 6
    ROWS = 6
    STAR_ROW_START = 3    # 副星/小星從第 3 行開始
    STAR_ROW_END = 4      # 到第 4 行（含）
    OVERFLOW_ROW = 5      # 溢出行
    BRANCH_COL = 5        # 地支所在欄

    def __init__(self, cell: CellRect, theme: ThemeConfig):
        lo = theme.layout
        self._cell = cell
        self._pad = lo["padding"]

        inner_w = cell.width - 2 * self._pad
        self._col_w = inner_w / self.COLS
        self._row_h = cell.height / self.ROWS
        # 宮名／底線垂直位置（theme.layout，不改網格列數）
        self._header_text_y_factor = float(lo.get("header_text_y_factor", 0.5))
        self._header_line_y_factor = float(lo.get("header_line_y_factor", 0.78))

    # ── 宮名（row 0）──────────────────────────────

    def header_center(self) -> Tuple[float, float]:
        """宮名文字中心 (x, y)。"""
        x = self._cell.x + self._cell.width / 2
        y = self._cell.y + self._row_h * self._header_text_y_factor
        return (x, y)

    def header_line_y(self) -> float:
        """宮名底線 Y。"""
        return self._cell.y + self._row_h * self._header_line_y_factor

    # ── 主星（rows 1-2）──────────────────────────

    def main_star_rect(self, index: int, total: int,
                       padding: float = 1,
                       ) -> Tuple[float, float, float, float]:
        """第 index 顆主星的圖示 (x, y, w, h)，每顆佔 2×2 格。"""
        if total == 1:
            # 絕對置中：在整個宮位寬度取中心，跨 rows 1-2
            gx, gy, _, gh = self.grid_rect(1, 0, 2, self.COLS)
            side = min(self._cell.width, gh) - 2 * padding
            cx = self._cell.x + self._cell.width / 2
            cy = gy + gh / 2
            return (cx - side / 2, cy - side / 2, side, side)
        # 2 顆 → cols 1-2 / cols 3-4
        col = 1 if index == 0 else 3
        return self._centered_square(1, col, 2, 2, padding)

    # ── 網格座標 ───────────────────────────────────

    def grid_rect(self, row: int, col: int,
                  rowspan: int = 1, colspan: int = 1,
                  ) -> Tuple[float, float, float, float]:
        """指定格位的像素區域 (x, y, w, h)。"""
        x = self._cell.x + self._pad + col * self._col_w
        y = self._cell.y + row * self._row_h
        return (x, y, colspan * self._col_w, rowspan * self._row_h)

    def _centered_square(self, row: int, col: int,
                         rowspan: int = 1, colspan: int = 1,
                         padding: float = 2,
                         ) -> Tuple[float, float, float, float]:
        gx, gy, gw, gh = self.grid_rect(row, col, rowspan, colspan)
        side = min(gw, gh) - 2 * padding
        return (gx + (gw - side) / 2, gy + (gh - side) / 2, side, side)

    def centered_square_icon(self, row: int, col: int,
                             padding: float = 2,
                             ) -> Tuple[float, float, float, float]:
        """單格內置中正方形圖示。"""
        return self._centered_square(row, col, 1, 1, padding)

    def text_center(self, row: int, col: int) -> Tuple[float, float]:
        """格位中央文字定位點 (x, y)，適合 anchor=middle。"""
        gx, gy, gw, gh = self.grid_rect(row, col)
        return (gx + gw / 2, gy + gh * 0.62)

    # ── 地支（row 6, col 6）──────────────────────

    def branch_rect(self) -> Tuple[float, float, float, float]:
        """地支黑底方塊 (x, y, w, h)。"""
        return self.grid_rect(self.OVERFLOW_ROW, self.BRANCH_COL)

    def branch_text(self) -> Tuple[float, float]:
        """地支文字中心 (x, y)。"""
        return self.text_center(self.OVERFLOW_ROW, self.BRANCH_COL)

    # ── 副星/小星 slot 索引 → (row, col) ────────

    # 可用欄位：cols 1-4（col 0 和 col 5 留空）
    _USABLE_COLS = [1, 2, 3, 4]

    def star_slot(self, index: int) -> Optional[Tuple[int, int]]:
        """
        第 index 個副星/小星的 (row, col)。
        rows 3-4 的 cols 1-4 共 8 格
        → 溢出到 row 5 的 cols 1-4 共 4 格（col 5 為地支）
        → 總計 12 格。超過回傳 None。
        """
        uc = self._USABLE_COLS
        n_per_row = len(uc)  # 4
        main_rows = self.STAR_ROW_END - self.STAR_ROW_START + 1  # 2
        main_slots = n_per_row * main_rows  # 8
        if index < main_slots:
            row = self.STAR_ROW_START + index // n_per_row
            col = uc[index % n_per_row]
            return (row, col)
        overflow_idx = index - main_slots
        if overflow_idx < n_per_row:  # row 6 cols 1-5
            return (self.OVERFLOW_ROW, uc[overflow_idx])
        return None

    @property
    def col_w(self) -> float:
        return self._col_w

    @property
    def row_h(self) -> float:
        return self._row_h
