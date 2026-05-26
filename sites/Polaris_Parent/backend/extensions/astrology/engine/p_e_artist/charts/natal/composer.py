"""
命盤佈局計算引擎 (V0.4)
NatalComposer 繼承 BaseComposer，產出格式無關的 ChartLayout。
"""

import os
import sys

_union_root = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
if _union_root not in sys.path:
    sys.path.insert(0, _union_root)

from p_d_graph.exporter.code_registry import CodeRegistry
from p_a_foundation.core.mapping import get_mapping

from ...theme import ThemeConfig
from ...core.base_composer import BaseComposer
from ...core.elements import (
    RectEl, TextEl, LineEl, GroupEl, ChartLayout, PalaceEl, PalaceStarItem,
)
from .data import ChartData, PalaceInfo
from .layout import GridLayout
from .config import FOURTEEN_MAIN_STAR_CODES, MAJOR_STAR_CODES

# 副星（有 SVG 圖檔但非十四主星）
_SUB_STAR_CODES = MAJOR_STAR_CODES - FOURTEEN_MAIN_STAR_CODES

# 宮位碼 → 英文名
_PALACE_EN = {
    "1": "Destiny",   "2": "Siblings",  "3": "Marriage",
    "4": "Children",  "5": "Wealth",    "6": "Health",
    "7": "Mobility",  "8": "Friends",   "9": "Career",
    "A": "Estate",    "B": "Virtue",    "C": "Parents",
}


class NatalComposer(BaseComposer):
    """將命盤 ChartData 計算為格式無關的 ChartLayout。"""

    def __init__(self, data: ChartData, theme: ThemeConfig, lang: str = "zh",
                 triangle_centers=None, **kwargs):
        super().__init__(data, theme, **kwargs)
        self._lang = lang
        # 三方四正 連線中心宮位（palace code）。預設命宮 ["1"]；
        # 可指定其他宮位，如 ["B"] 福德、["1", "B"] 多組同時繪製、[] 不繪。
        self._triangle_centers = (
            list(triangle_centers) if triangle_centers is not None else ["1"]
        )
        self._grid = GridLayout(theme)
        self._reg = CodeRegistry()
        self._map = get_mapping()
        # assets/stars 內實際存在的 SVG 檔名（不含副檔名）→ 有圖檔才顯示中文名，否則顯示編碼
        _artist_root = os.path.normpath(
            os.path.join(os.path.dirname(__file__), "..", ".."))
        _stars_dir = os.path.join(_artist_root, "assets", "stars")
        self._star_svg_codes: frozenset[str] = frozenset(
            fn[:-4] for fn in os.listdir(_stars_dir)
            if fn.lower().endswith(".svg")
        ) if os.path.isdir(_stars_dir) else frozenset()
        # CSS class → font_size 查找表（供 TextEl 攜帶）
        s = theme.sizes
        self._fs = {
            "center-chart-id": s["star_minor"],
            "center-title": s["center_title"],
            "center-detail": s["center_detail"],
            "palace-name": s["palace_name"],
            "palace-name-en": s["palace_name_en"],
            "branch-name": s["branch"],
            "star-brightness": s["brightness"],
            "sihua-tag": s["sihua_tag"],
            "sihua-badge-text": s["sihua_tag"],
            "star-minor": s["star_minor"],
        }

    def _font_size(self, cls: str) -> float:
        """從 CSS class 字串取得對應字級。"""
        for key, size in self._fs.items():
            if key in cls:
                return size
        return 13

    def _star_chart_label(self, code: str) -> str:
        """有對應 SVG 時用註冊中文名；無圖檔時一律顯示編碼。"""
        if code in self._star_svg_codes:
            return self._reg.star_name(code, self._lang)
        return code

    def compose(self) -> ChartLayout:
        """執行佈局計算，回傳 ChartLayout。"""
        elements = []

        # 1. 背景
        elements.append(RectEl(
            0, 0, self._grid.canvas_w, self._grid.canvas_h, cls="chart-bg"))

        # 2. 中央區（center-bg + 命盤 ID）
        elements.append(self._compose_center())

        # 3. 格線（畫在白底之上；中橫／中直不畫中宮內段，保留中宮外框、無內十字）
        elements.append(self._compose_grid())

        # 4. 三方四正 連線（每個 center 4 條：本宮↔對宮、本宮↔三合A、本宮↔三合B、三合A↔三合B）
        for center_code in self._triangle_centers:
            group = self._compose_triangle_group(center_code)
            if group is not None:
                elements.append(group)

        # 5. 十二宮
        for palace in self._data.palaces.values():
            elements.append(self._compose_palace(palace))

        return ChartLayout(
            canvas_w=self._grid.canvas_w,
            canvas_h=self._grid.canvas_h,
            css=self._theme.to_css(),
            elements=elements,
        )

    # ── 三方四正 連線（模組化：以任一宮位為中心發散三角＋對宮）──

    # 4 條連線：本宮↔對宮、本宮↔三合A、本宮↔三合B、三合A↔三合B。
    _TRIANGLE_EDGES = ((0, 1), (0, 2), (0, 3), (2, 3))

    def _compose_triangle_group(self, center_code: str):
        """以 center_code 宮位為中心，生成 4 條虛線組成的 GroupEl。"""
        branches = self._sanfang_sizheng_branches(center_code)
        if branches is None:
            return None
        cells = [self._grid.branch_to_cell(b) for b in branches]
        pts = [self._cell_connection_point(c) for c in cells]
        children = [
            LineEl(pts[i][0], pts[i][1], pts[j][0], pts[j][1], cls="palace-link")
            for (i, j) in self._TRIANGLE_EDGES
        ]
        return GroupEl(
            children=children,
            cls=f"palace-links palace-links-{center_code}",
        )

    def _sanfang_sizheng_branches(self, center_code: str):
        """傳回 (本宮, 對宮, 三合A, 三合B) 的地支碼。三合 = 本宮 ±4 位。"""
        palace = next(
            (p for p in self._data.palaces.values() if p.code == center_code),
            None,
        )
        if palace is None:
            return None
        b = int(palace.branch)
        opp = ((b + 6 - 1) % 12) + 1
        ta = ((b + 4 - 1) % 12) + 1
        tb = ((b + 8 - 1) % 12) + 1
        return f"{b:02d}", f"{opp:02d}", f"{ta:02d}", f"{tb:02d}"

    @staticmethod
    def _cell_connection_point(cell):
        """宮位連接點：邊宮取內側邊中點，角宮取內側角。所有連線端點統一。"""
        is_top, is_bottom = cell.row == 0, cell.row == 3
        is_left, is_right = cell.col == 0, cell.col == 3
        if is_top:
            y = cell.y + cell.height
        elif is_bottom:
            y = cell.y
        else:
            y = cell.y + cell.height / 2
        if is_left:
            x = cell.x + cell.width
        elif is_right:
            x = cell.x
        else:
            x = cell.x + cell.width / 2
        return x, y

    # ── 格線 ──────────────────────────────────────────

    def _compose_grid(self) -> GroupEl:
        cw, ch = self._grid.cell_w, self._grid.cell_h
        W, H = self._grid.canvas_w, self._grid.canvas_h
        children = []

        children.append(RectEl(0, 0, W, H, cls="grid-border"))

        # 水平：y = ch, 2ch, 3ch。僅中橫線 (2ch) 拆成兩段，略過中宮 [cw, 3cw]
        for r in range(1, 4):
            y = r * ch
            if r == 2:
                children.append(LineEl(0, y, cw, y, cls="grid-line"))
                children.append(LineEl(3 * cw, y, W, y, cls="grid-line"))
            else:
                children.append(LineEl(0, y, W, y, cls="grid-line"))

        # 垂直：x = cw, 2cw, 3cw。僅中直線 (2cw) 拆成兩段，略過中宮 [ch, 3ch]
        for c in range(1, 4):
            x = c * cw
            if c == 2:
                children.append(LineEl(x, 0, x, ch, cls="grid-line"))
                children.append(LineEl(x, 3 * ch, x, H, cls="grid-line"))
            else:
                children.append(LineEl(x, 0, x, H, cls="grid-line"))

        return GroupEl(children=children, cls="grid")

    # ── 中央區 ────────────────────────────────────────

    def _compose_center(self) -> GroupEl:
        cr = self._grid.center_rect()
        parts = [RectEl(cr.x, cr.y, cr.width, cr.height, cls="center-bg")]

        cid = (self._data.chart_id or "").strip()
        if not cid:
            return GroupEl(children=parts, cls="center")

        inset = float(self._theme.layout.get("center_id_inset", 6))
        tx = cr.x + cr.width - inset
        ty = cr.y + cr.height - inset
        fs = self._fs["center-chart-id"]
        parts.append(TextEl(
            cid, tx, ty,
            cls="center-chart-id",
            anchor="end",
            font_size=fs,
        ))
        return GroupEl(children=parts, cls="center")

    # ── 單宮佈局（v2 結構化輸出） ────────────────────

    def _compose_palace(self, palace: PalaceInfo) -> PalaceEl:
        cell = self._grid.branch_to_cell(palace.branch)

        # 宮名（中／英）
        pname = self._reg.palace_name(palace.code, self._lang)
        if palace.code == self._data.body_palace:
            pname += "(身)"
        en_name = _PALACE_EN.get(palace.code, "")

        # 地支顯示字（中文）
        branch_cn = self._map.get_branch_name(palace.branch) or palace.branch

        # 星曜分類
        main_stars = [s for s in palace.stars if s.code in FOURTEEN_MAIN_STAR_CODES]
        sub_stars = [s for s in palace.stars if s.code in _SUB_STAR_CODES]
        minor_stars = [s for s in palace.stars if s.code not in MAJOR_STAR_CODES]

        def _to_item(s):
            return PalaceStarItem(
                code=s.code,
                label=self._star_chart_label(s.code),
                href=f"../assets/stars/{s.code}.svg",
                sihua=s.sihua or "",
            )

        majors = [_to_item(s) for s in main_stars]
        subs = [_to_item(s) for s in sub_stars]
        minor_labels = [self._star_chart_label(s.code) for s in minor_stars]

        return PalaceEl(
            x=cell.x, y=cell.y, w=cell.width, h=cell.height,
            code=palace.code,
            cn_name=pname,
            en_name=en_name,
            branch_label=branch_cn,
            majors=majors,
            subs=subs,
            minor_labels=minor_labels,
            cls=f"palace palace-{palace.code}",
        )
