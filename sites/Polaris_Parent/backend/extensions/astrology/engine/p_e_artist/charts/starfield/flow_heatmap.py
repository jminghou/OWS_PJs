"""
A1 流量熱力圖 — 佈局計算（輔星／主星兩半共用）
================================================

12 宮 × N 欄的矩陣，格值＝該欄流入該宮的**流量**（E×w）。兩個變體：

  輔星版  欄＝八組輔星（左右／魁鉞／昌曲…），列合計＝S輔
  主星版  欄＝十四主星維度（排序力／承載力／作用力…），列合計＝S力

兩者只差資料來源與幾句文案，版面演算法完全相同——所以共用一個基底類別，
變體只覆寫 GROUP 與文案常數。分成兩份實作的話，日後調版面得改兩個地方，
而它們本來就該長得一樣（讀者要能左右對照）。

⚠️ 輔星版與主星版的一個實質差異：輔星類權為 0，flow 不入 S總；主星類權
為 1，flow 就是入 S力 的量。所以副標對「流量」的說明兩邊不同，不可共用。

本模組只算幾何，不算資料：所有數值取自 `StarfieldData`（已在 from_dict()
跑過守恆檢核）。座標一律量化到 2 位小數——交接文件 §7 的 SSR 三角函數雷
是同一個病根（浮點尾數在不同 runtime 不保證一致），熱力圖雖不用三角函數，
但量化讓 SVG 與 JSON 的輸出可逐位元比對，也讓 diff 看得懂。
"""

from ...core.base_composer import BaseComposer
from ...core.elements import ChartLayout, GroupEl, LineEl, RectEl, TextEl
from ...theme import ThemeConfig
from .config import (
    A1_AUX_MARGIN_LABEL,
    A1_AUX_SUBTITLE,
    A1_AUX_TITLE,
    A1_EMPTY_MARK,
    A1_FOOTER_CAVEAT,
    A1_FOOTER_LABEL,
    A1_AUX_LEGEND_PEAK,
    A1_MAJOR_LEGEND_PEAK,
    A1_MAJOR_MARGIN_LABEL,
    A1_MAJOR_NOTE,
    A1_MAJOR_SUBTITLE,
    A1_MAJOR_TITLE,
    FLOW_EPS,
)
from ._layout import est_w as _est_w, fmt as _fmt, q as _q, wrap as _wrap
from .data import StarfieldData

# 非本命盤的取樣作用域警語（§2 事實①）：流年／小限盤只取樣主宮與對宮，
# 三方退出，Σw 不再是 2.8，欄合計的可比性也跟著變。
_SCOPE_CAVEAT = {
    "year": "流年盤：取樣作用域僅主宮與對宮（三方退出），Σw 與本命盤不同。",
    "minor": "小限盤：取樣作用域僅主宮與對宮（三方退出），Σw 與本命盤不同。",
}


class FlowHeatmapComposer(BaseComposer):
    """StarfieldData → 流量熱力圖的 ChartLayout（輔星／主星共用基底）。"""

    GROUP: str = "aux"            # aux / major
    TITLE: str = A1_AUX_TITLE
    SUBTITLE: str = A1_AUX_SUBTITLE
    MARGIN_LABEL: str = A1_AUX_MARGIN_LABEL
    LEGEND_PEAK: str = A1_AUX_LEGEND_PEAK
    EXTRA_NOTE: str = ""
    # 欄多的變體要窄一點，否則畫布寬到不成比例（十四欄 × 66 接近 1200px）
    CELL_W: float = 0.0           # 0＝用主題的預設

    def __init__(self, data: StarfieldData, theme: ThemeConfig,
                 lang: str = "zh", title: str = "", subtitle: str = "",
                 cell_w: float = 0.0, **kwargs):
        super().__init__(data, theme, **kwargs)
        self._lang = lang
        self._title = title or data.title or self.TITLE
        self._subtitle = subtitle or data.subtitle or self.SUBTITLE
        self._cell_w = cell_w or self.CELL_W

    # ── 主流程 ───────────────────────────────────────

    def compose(self) -> ChartLayout:
        d: StarfieldData = self._data
        th: ThemeConfig = self._theme
        lo = th.dv_layout
        sz = th.dv_sizes
        co = th.dv_colors

        groups = d.columns(self.GROUP)
        order = d.order
        n_col = len(groups)
        if not groups:
            raise ValueError(
                f"payload 沒有 {self.GROUP} 側的欄位——舊版 payload 缺 "
                f"meta.major_dims？請確認 palace_readings 是新版。")

        cell_w = self._cell_w or lo["cell_w"]
        cell_h = lo["cell_h"]
        gap = lo["cell_gap"]
        pad_x = lo["pad_x"]
        pad_y = lo["pad_y"]

        matrix_x = pad_x + lo["row_header_w"]
        matrix_w = n_col * cell_w + (n_col - 1) * gap
        margin_x = matrix_x + matrix_w + gap
        content_r = margin_x + lo["margin_w"]
        canvas_w = content_r + pad_x

        els = []

        # ── 抬頭 ──
        y = pad_y + sz["title"] * 0.85
        els.append(TextEl(self._title, _q(pad_x), _q(y), cls="dv-title",
                          font_size=sz["title"]))
        y += sz["title"] * 0.4 + lo["title_gap"] + sz["subtitle"] * 0.85
        els.append(TextEl(self._subtitle, _q(pad_x), _q(y),
                          cls="dv-subtitle", font_size=sz["subtitle"]))

        # ── 欄表頭（底對齊於首列上緣）──
        y += lo["header_gap"] + sz["col_header"] * 0.85
        for i, g in enumerate(groups):
            cx = matrix_x + i * (cell_w + gap) + cell_w / 2
            els.append(TextEl(g, _q(cx), _q(y), cls="dv-col-header",
                              anchor="middle", font_size=sz["col_header"]))
        els.append(TextEl(self.MARGIN_LABEL, _q(content_r), _q(y),
                          cls="dv-col-header", anchor="end",
                          font_size=sz["col_header"]))

        # ── 色階 domain：全矩陣最大值（不是逐列最大，否則跨列不可比）──
        matrix = d.matrix(self.GROUP)
        vals = [matrix[p][g] for p in order for g in groups]
        vmax = max(vals) if vals else 0.0
        row_max_total = max((d.row_total(p, self.GROUP) for p in order),
                            default=0.0)

        # ── 資料列 ──
        top = y + lo["header_gap"]
        for ri, pname in enumerate(order):
            row_y = top + ri * (cell_h + gap)
            els.append(self._row(pname, row_y, matrix_x, margin_x,
                                 vmax, row_max_total))

        matrix_bottom = top + len(order) * (cell_h + gap) - gap

        # ── 全盤Σ 列 ──
        rule_y = matrix_bottom + lo["footer_gap"]
        els.append(LineEl(_q(pad_x), _q(rule_y), _q(content_r), _q(rule_y),
                          cls="dv-rule"))
        foot_y = rule_y + lo["footer_gap"] + sz["footer"] * 0.85
        els.append(TextEl(A1_FOOTER_LABEL,
                          _q(matrix_x - gap * 2), _q(foot_y),
                          cls="dv-footer", anchor="end",
                          font_size=sz["footer"]))
        totals = d.col_totals(self.GROUP)
        col_max = max((totals[g] for g in groups), default=0.0)
        for i, g in enumerate(groups):
            v = totals[g]
            cx = matrix_x + i * (cell_w + gap) + cell_w / 2
            strong = abs(v - col_max) <= FLOW_EPS and col_max > 0
            els.append(TextEl(
                _fmt(v), _q(cx), _q(foot_y),
                cls="dv-footer-strong" if strong else "dv-footer",
                anchor="middle", font_size=sz["footer"]))
        els.append(TextEl(_fmt(d.grand_total(self.GROUP)), _q(content_r), _q(foot_y),
                          cls="dv-footer", anchor="end",
                          font_size=sz["footer"]))

        # ── 圖例 ──
        legend_y = foot_y + lo["legend_gap"]
        els.append(self._legend(legend_y, pad_x, content_r, vmax))

        # ── 註腳（欄合計不是總量；非本命盤另有作用域警語）──
        note_y = legend_y + lo["cell_h"] * 0.5 + lo["note_gap"]
        notes = [A1_FOOTER_CAVEAT]
        if self.EXTRA_NOTE:
            notes.append(self.EXTRA_NOTE)
        scope = _SCOPE_CAVEAT.get(d.chart_kind)
        if scope:
            notes.append(scope)
        line_h = sz["note"] * lo["note_line_h"]
        for note in notes:
            for line in _wrap(note, content_r - pad_x, sz["note"]):
                note_y += line_h
                els.append(TextEl(line, _q(pad_x), _q(note_y),
                                  cls="dv-note", font_size=sz["note"]))

        canvas_h = note_y + sz["note"] * 0.5 + pad_y

        # 底板：印刷時需要實心底，且讓 HTML 預覽有卡片感
        bg = RectEl(0, 0, _q(canvas_w), _q(canvas_h), cls="dv-surface",
                    fill_attr=co["surface"])

        return ChartLayout(
            canvas_w=_q(canvas_w),
            canvas_h=_q(canvas_h),
            css=th.dataviz_css(),
            elements=[bg] + els,
        )

    # ── 單列 ─────────────────────────────────────────

    def _row(self, pname: str, row_y: float, matrix_x: float,
             margin_x: float, vmax: float, row_max_total: float) -> GroupEl:
        d: StarfieldData = self._data
        th: ThemeConfig = self._theme
        lo, sz, co = th.dv_layout, th.dv_sizes, th.dv_colors
        cell_w = self._cell_w or lo["cell_w"]
        cell_h, gap = lo["cell_h"], lo["cell_gap"]
        rx = lo["cell_radius"]

        row = d.matrix(self.GROUP)[pname]
        cy = row_y + cell_h / 2
        children = []

        # 列表頭：宮名 + 地支
        name_y = cy + sz["row_header"] * 0.35
        children.append(TextEl(pname, _q(lo["pad_x"]), _q(name_y),
                               cls="dv-row-header",
                               font_size=sz["row_header"]))
        branch = d.branch_of(pname)
        if branch:
            bx = lo["pad_x"] + _est_w(pname, sz["row_header"]) + 4
            children.append(TextEl(branch, _q(bx), _q(name_y),
                                   cls="dv-row-sub", font_size=sz["row_sub"]))

        # 該列最強格（peak）——比較的是同一列內的值
        row_max = max(row.values()) if row else 0.0

        for i, g in enumerate(d.columns(self.GROUP)):
            v = row[g]
            x = matrix_x + i * (cell_w + gap)
            cell = GroupEl(cls="dv-cell-group", key=f"{pname}|{g}")

            if v <= FLOW_EPS:
                cell.children.append(RectEl(
                    _q(x), _q(row_y), _q(cell_w), _q(cell_h),
                    cls="dv-cell-empty", rx=rx, fill_attr=co["grid"]))
                cell.children.append(TextEl(
                    A1_EMPTY_MARK, _q(x + cell_w / 2),
                    _q(cy + sz["row_sub"] * 0.35),
                    cls="dv-cell-empty-value", anchor="middle",
                    font_size=sz["row_sub"], fill_attr=co["muted"]))
            else:
                bg = th.seq_color(v / vmax if vmax > 0 else 0.0)
                ink = th.ink_on(bg)
                cell.children.append(RectEl(
                    _q(x), _q(row_y), _q(cell_w), _q(cell_h),
                    cls="dv-cell", rx=rx, fill_attr=bg))
                cell.children.append(TextEl(
                    _fmt(v), _q(x + cell_w / 2),
                    _q(cy + sz["cell_value"] * 0.35),
                    cls="dv-cell-value", anchor="middle",
                    font_size=sz["cell_value"], fill_attr=ink))
                if abs(v - row_max) <= FLOW_EPS:
                    # 峰值框用該格的字色描邊：底色是逐格算的，
                    # 固定描邊色在色階兩端會其中一端看不見
                    cell.children.append(RectEl(
                        _q(x + 2), _q(row_y + 2),
                        _q(cell_w - 4), _q(cell_h - 4),
                        cls="dv-peak", rx=max(rx - 1, 0),
                        fill_attr="none", stroke_attr=ink))
            children.append(cell)

        # 右緣：S輔 小長條 + 數值。
        # 數值右對齊到固定的欄右緣——若跟著長條末端浮動，沒有長條的零值列
        # 會貼到最左，整欄數字參差，讀不成一欄。
        s_row = d.row_total(pname, self.GROUP)
        bar_w = (s_row / row_max_total * lo["margin_bar_max"]) if row_max_total > 0 else 0.0
        bar_h = 9
        if bar_w > 0:
            children.append(RectEl(
                _q(margin_x), _q(cy - bar_h / 2), _q(bar_w), bar_h,
                cls="dv-bar", fill_attr=co["series_1"]))
        children.append(TextEl(
            _fmt(s_row), _q(margin_x + lo["margin_w"]),
            _q(cy + sz["margin_value"] * 0.35),
            cls="dv-margin-value", anchor="end",
            font_size=sz["margin_value"], fill_attr=co["text_secondary"]))

        return GroupEl(children=children, cls="dv-row", key=pname)

    # ── 圖例 ─────────────────────────────────────────

    def _legend(self, y: float, pad_x: float, content_r: float,
                vmax: float) -> GroupEl:
        th: ThemeConfig = self._theme
        sz, co = th.dv_sizes, th.dv_colors
        fs = sz["note"]
        h = 11
        children = []

        # 峰值圖例：空心框（與格上的 peak 框同語彙）
        x = pad_x
        children.append(RectEl(_q(x), _q(y), h, h, cls="dv-peak", rx=2,
                               fill_attr="none",
                               stroke_attr=co["text_primary"]))
        x += h + 6
        children.append(TextEl(self.LEGEND_PEAK, _q(x), _q(y + h * 0.8),
                               cls="dv-legend-label", font_size=fs))
        x += _est_w(self.LEGEND_PEAK, fs) + 22

        # 色階：逐階畫實心方塊（不用 <linearGradient>，
        # 印刷端與各 writer 對漸層的支援度不一，分階反而穩且可讀）
        children.append(TextEl("0", _q(x), _q(y + h * 0.8),
                               cls="dv-legend-label", anchor="end",
                               font_size=fs))
        x += 5
        ramp = th.seq_ramp()
        step = 9
        for i, c in enumerate(ramp):
            children.append(RectEl(_q(x + i * step), _q(y), step, h,
                                   cls="dv-cell", fill_attr=c))
        x += len(ramp) * step + 5
        children.append(TextEl(_fmt(vmax), _q(x), _q(y + h * 0.8),
                               cls="dv-legend-label", font_size=fs))

        return GroupEl(children=children, cls="dv-legend", key="legend")


class AuxHeatmapComposer(FlowHeatmapComposer):
    """輔星版：欄＝八組輔星，列合計＝S輔（不入 S總，但流量照列）。"""

    GROUP = "aux"
    TITLE = A1_AUX_TITLE
    SUBTITLE = A1_AUX_SUBTITLE
    MARGIN_LABEL = A1_AUX_MARGIN_LABEL
    LEGEND_PEAK = A1_AUX_LEGEND_PEAK


class MajorHeatmapComposer(FlowHeatmapComposer):
    """主星版：欄＝十四主星維度，列合計＝S力（實際進 S總 的力量）。"""

    GROUP = "major"
    TITLE = A1_MAJOR_TITLE
    SUBTITLE = A1_MAJOR_SUBTITLE
    MARGIN_LABEL = A1_MAJOR_MARGIN_LABEL
    LEGEND_PEAK = A1_MAJOR_LEGEND_PEAK
    EXTRA_NOTE = A1_MAJOR_NOTE
    CELL_W = 50          # 十四欄；沿用 66 會讓畫布接近 1200px
