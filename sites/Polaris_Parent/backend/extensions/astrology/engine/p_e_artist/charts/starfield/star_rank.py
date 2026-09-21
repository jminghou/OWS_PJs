"""
A3a 星曜能量 E 排序橫條 — 佈局計算
====================================

全盤星曜依 E 由大到小排。橫條長度＝E，顏色分主星／輔星兩色（不是十四色：
星曜數量遠超可辨識上限，靠位置排序已經足夠傳達強弱，顏色只用來分類）。

只算幾何，不算資料。
"""

from ...core.base_composer import BaseComposer
from ...core.elements import ChartLayout, GroupEl, LineEl, RectEl, TextEl
from ...theme import ThemeConfig
from ._layout import est_w, fmt, q, wrap
from .config import (
    A3_LEGEND_AUX,
    A3_LEGEND_MAJOR,
    A3_RANK_NOTE_NATAL,
    A3_RANK_SUBTITLE,
    A3_RANK_TITLE,
)
from .star_data import StarEnergyData

# 空劫狀態的角標（不只靠顏色——狀態必配文字標籤）
_VOID_MARK = {"hit": "空劫", "exempt": "豁免"}

# 四化 → 色票鍵。四類各有其色，不可一律用忌的紅。
# 顏色只是輔助：角標本身已寫明「化祿／化權／化科／化忌」，
# 因為暗色模式下這四色在色盲模擬會落進同一帶，不能只靠顏色分辨。
_HUA_COLOR = {"祿": "hua_lu", "權": "hua_quan", "科": "hua_ke", "忌": "hua_ji"}


class StarRankComposer(BaseComposer):
    """StarEnergyData → A3a 排序橫條的 ChartLayout。"""

    def __init__(self, data: StarEnergyData, theme: ThemeConfig,
                 lang: str = "zh", title: str = "", subtitle: str = "",
                 group: str = "", limit: int = 0, chart_kind: str = "natal",
                 **kwargs):
        super().__init__(data, theme, **kwargs)
        self._lang = lang
        self._title = title or data.title or A3_RANK_TITLE
        self._subtitle = subtitle or data.subtitle or (
            data.formula or A3_RANK_SUBTITLE)
        self._group = (group or "").strip()      # ""＝全部／major／aux
        self._limit = max(0, int(limit or 0))    # 0＝不限
        self._chart_kind = chart_kind

    def _rows(self):
        stars = (self._data.by_group(self._group) if self._group
                 else list(self._data.stars))
        dropped = 0
        if self._limit and len(stars) > self._limit:
            dropped = len(stars) - self._limit
            stars = stars[:self._limit]
        return stars, dropped

    def compose(self) -> ChartLayout:
        th: ThemeConfig = self._theme
        lo, sz, co = th.dv_layout, th.dv_sizes, th.dv_colors
        stars, dropped = self._rows()
        if not stars:
            raise ValueError("沒有可畫的星曜（group 篩選後為空）")

        pad_x, pad_y = lo["pad_x"], lo["pad_y"]
        row_h = lo["rank_row_h"]
        gap = lo["rank_row_gap"]
        label_w = lo["rank_label_w"]
        value_w = lo["rank_value_w"]
        bar_max = lo["rank_bar_max"]

        bar_x = pad_x + label_w
        content_r = bar_x + bar_max + value_w
        canvas_w = content_r + pad_x

        els = []
        y = pad_y + sz["title"] * 0.85
        els.append(TextEl(self._title, q(pad_x), q(y), cls="dv-title",
                          font_size=sz["title"]))
        y += sz["title"] * 0.4 + lo["title_gap"] + sz["subtitle"] * 0.85
        els.append(TextEl(self._subtitle, q(pad_x), q(y),
                          cls="dv-subtitle", font_size=sz["subtitle"]))

        e_max = max(s.e for s in stars) or 1.0
        top = y + lo["header_gap"]

        for i, s in enumerate(stars):
            els.append(self._row(s, top + i * (row_h + gap),
                                 bar_x, bar_max, content_r, e_max))
        bottom = top + len(stars) * (row_h + gap) - gap

        # ── 圖例 ──
        legend_y = bottom + lo["legend_gap"]
        els.append(self._legend(legend_y, pad_x))

        # ── 註腳 ──
        note_y = legend_y + 11 + lo["note_gap"]
        notes = []
        if dropped:
            # 截斷必須明說：不說就讀成「全盤只有這些星」
            notes.append(f"只顯示前 {len(stars)} 名，另有 {dropped} 顆未列。")
        if self._chart_kind == "natal":
            notes.append(A3_RANK_NOTE_NATAL)
        line_h = sz["note"] * lo["note_line_h"]
        for note in notes:
            for line in wrap(note, content_r - pad_x, sz["note"]):
                note_y += line_h
                els.append(TextEl(line, q(pad_x), q(note_y),
                                  cls="dv-note", font_size=sz["note"]))

        canvas_h = note_y + sz["note"] * 0.5 + pad_y
        bg = RectEl(0, 0, q(canvas_w), q(canvas_h), cls="dv-surface",
                    fill_attr=co["surface"])
        return ChartLayout(canvas_w=q(canvas_w), canvas_h=q(canvas_h),
                           css=th.dataviz_css(), elements=[bg] + els)

    # ── 單列 ─────────────────────────────────────────

    def _row(self, s, row_y: float, bar_x: float, bar_max: float,
             content_r: float, e_max: float) -> GroupEl:
        th: ThemeConfig = self._theme
        lo, sz, co = th.dv_layout, th.dv_sizes, th.dv_colors
        row_h = lo["rank_row_h"]
        cy = row_y + row_h / 2
        children = []

        # 星名（＋四化角標）
        name_y = cy + sz["row_header"] * 0.35
        children.append(TextEl(s.name, q(lo["pad_x"]), q(name_y),
                               cls="dv-row-header", font_size=sz["row_header"]))
        x = lo["pad_x"] + est_w(s.name, sz["row_header"]) + 4
        if s.hua:
            children.append(TextEl(
                f"化{s.hua}", q(x), q(name_y), cls="dv-row-sub",
                font_size=sz["row_sub"],
                fill_attr=co.get(_HUA_COLOR.get(s.hua, "muted"), co["muted"])))
            x += est_w(f"化{s.hua}", sz["row_sub"]) + 4
        # 宮位（次要資訊，靠標籤欄右緣收）
        children.append(TextEl(
            s.palace, q(bar_x - 6), q(name_y), cls="dv-row-sub",
            anchor="end", font_size=sz["row_sub"]))

        color = co["series_1"] if s.group == "major" else co["series_2"]
        w = s.e / e_max * bar_max
        children.append(RectEl(
            q(bar_x), q(row_y + (row_h - lo["rank_bar_h"]) / 2),
            q(max(w, 0.5)), lo["rank_bar_h"],
            cls="dv-bar-solid", rx=2, fill_attr=color))

        # 數值 + 空劫狀態角標
        vx = bar_x + w + 7
        children.append(TextEl(
            fmt(s.e), q(vx), q(cy + sz["cell_value"] * 0.35),
            cls="dv-margin-value", font_size=sz["cell_value"],
            fill_attr=co["text_primary"]))
        mark = _VOID_MARK.get(s.void_state)
        if mark:
            children.append(TextEl(
                mark, q(content_r), q(cy + sz["row_sub"] * 0.35),
                cls="dv-row-sub", anchor="end", font_size=sz["row_sub"],
                fill_attr=co["loss"] if s.void_state == "hit" else co["muted"]))

        return GroupEl(children=children, cls="dv-rank-row", key=s.code)

    # ── 圖例 ─────────────────────────────────────────

    def _legend(self, y: float, pad_x: float) -> GroupEl:
        th: ThemeConfig = self._theme
        sz, co = th.dv_sizes, th.dv_colors
        fs, h = sz["note"], 11
        children, x = [], pad_x
        for color, label in ((co["series_1"], A3_LEGEND_MAJOR),
                             (co["series_2"], A3_LEGEND_AUX)):
            children.append(RectEl(q(x), q(y), h, h, cls="dv-bar-solid", rx=2,
                                   fill_attr=color))
            x += h + 6
            children.append(TextEl(label, q(x), q(y + h * 0.8),
                                   cls="dv-legend-label", font_size=fs))
            x += est_w(label, fs) + 18
        return GroupEl(children=children, cls="dv-legend", key="legend")
