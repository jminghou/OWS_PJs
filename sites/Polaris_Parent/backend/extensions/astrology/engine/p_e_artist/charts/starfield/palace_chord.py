"""
A2 宮位取樣弦圖 — 佈局計算
============================

12 個宮位排成一圈，每條弦＝一組星曜從**所在宮**流向**被取樣宮**的量。
粗端為來源、細端為去向。弧上的深色內環＝該宮的**主宮自給量**（自己餵自己）。

## 三個決定

**① 用 flow 不用 contribution**（§2 事實②）。輔星類權為 0，
   拿 contribution 建的弦圖，輔星那一版會整片是 0。

**② 依「取樣關係」塗色，不依宮位**（§8）。12 宮塗 12 色遠超可辨識上限，
   三合局 4 色也過不了色盲全對比檢驗。改成對宮／三方兩色之後，三合局的結構
   靠幾何自己浮出來——少一個顏色反而多一份資訊。
   主宮自給用中性墨畫成內環，刻意不是序列色（它不是「另一種關係」，
   而是「沒有流動」）。

**③ 角度慣例 0＝正上方、順時針**，與原型一致（見 `core.path.polar`）。

## 標籤

宮名與地支**同半徑、垂直堆疊**。放不同半徑會在圓的左右兩側水平相撞——
這是原型渲染出來才看見的，測試驗不到。
"""

import math

from ...core.base_composer import BaseComposer
from ...core.elements import ChartLayout, GroupEl, PathEl, RectEl, TextEl
from ...core.path import annular_sector, chord_ribbon, polar
from ...theme import ThemeConfig
from ._layout import est_w, fmt, q, wrap
from .config import (
    A2_LEGEND_OPPOSITE,
    A2_LEGEND_SELF,
    A2_LEGEND_TRINE,
    A2_NOTE,
    A2_SUBTITLE,
    A2_TITLE,
)
from .data import StarfieldData

# 取樣關係 → 色票鍵。主宮不在此表：它畫成弧上的內環，不畫成弦。
_REL_COLOR = {"對宮": "series_1", "三方": "series_2"}

# 去向端收窄比例——這是「方向」的唯一視覺線索（弦圖本身沒有箭頭）
TAPER = 0.42


class PalaceChordComposer(BaseComposer):
    """StarfieldData → A2 弦圖的 ChartLayout。

    ``kind``：畫哪一種流量——major（預設，實際進 S力 的量）／aux／all。
    """

    def __init__(self, data: StarfieldData, theme: ThemeConfig,
                 lang: str = "zh", kind: str = "major", title: str = "",
                 subtitle: str = "", **kwargs):
        super().__init__(data, theme, **kwargs)
        self._lang = lang
        self._kind = (kind or "major").strip()
        self._title = title or data.title or A2_TITLE
        self._subtitle = subtitle or data.subtitle or A2_SUBTITLE

    # ── 幾何 ─────────────────────────────────────────

    def _arcs(self):
        """各宮的弧段（角度依「流入＋流出」總量分配）與其內部切分。

        回傳 ``(arcs, segments)``：
            arcs      [{palace, a0, a1, total, self_flow}]
            segments  {(src, dst): (a0, a1) 在來源弧上, ...} 與同鍵的去向弧上區間
        """
        d: StarfieldData = self._data
        lo = self._theme.dv_layout
        order = d.order
        n = len(order)
        pad = lo["chord_pad"]
        edges = d.flows[self._kind]

        self_of = {p: d.self_flow(p, self._kind) for p in order}
        total_of = {}
        for p in order:
            t = self_of[p]
            for qn in order:
                if qn == p:
                    continue
                t += edges.get((p, qn), None).flow if (p, qn) in edges else 0.0
                t += edges.get((qn, p), None).flow if (qn, p) in edges else 0.0
            total_of[p] = t

        grand = sum(total_of.values()) or 1.0
        span = math.tau - n * pad * 2

        arcs, ang = [], -pad
        for p in order:
            ang += pad
            w = total_of[p] / grand * span
            arcs.append({"palace": p, "a0": ang, "a1": ang + w,
                         "total": total_of[p], "self_flow": self_of[p]})
            ang += w + pad

        # 弧內切分：自給段留在弧首，其後依對手宮序「先出後入」——
        # 兩端用同一組 (src, dst) 當鍵，緞帶才配得起來
        cursor = {a["palace"]: a["a0"] for a in arcs}
        out_seg, in_seg = {}, {}
        for p in order:
            if self_of[p] > 0:
                cursor[p] += self_of[p] / grand * span
            for qn in order:
                if qn == p:
                    continue
                out = edges.get((p, qn))
                if out and out.flow > 0:
                    w = out.flow / grand * span
                    out_seg[(p, qn)] = (cursor[p], cursor[p] + w)
                    cursor[p] += w
                inn = edges.get((qn, p))
                if inn and inn.flow > 0:
                    w = inn.flow / grand * span
                    in_seg[(qn, p)] = (cursor[p], cursor[p] + w)
                    cursor[p] += w
        return arcs, out_seg, in_seg

    # ── 主流程 ───────────────────────────────────────

    def compose(self) -> ChartLayout:
        d: StarfieldData = self._data
        th: ThemeConfig = self._theme
        lo, sz, co = th.dv_layout, th.dv_sizes, th.dv_colors

        if self._kind not in d.flows:
            raise ValueError(
                f"未知的流量類別「{self._kind}」（可用：{'、'.join(d.flows)}）")

        R = lo["chord_radius"]
        RW = lo["chord_ring_w"]
        pad_x, pad_y = lo["pad_x"], lo["pad_y"]
        label_gap = lo["chord_label_gap"]

        # 畫布：圓 + 標籤環 + 上方抬頭 + 下方圖例與註腳
        label_room = label_gap + sz["col_header"] * 2.4
        diameter = (R + label_room) * 2
        canvas_w = diameter + pad_x * 2
        cx = canvas_w / 2

        head_h = (sz["title"] * 1.25 + lo["title_gap"] + sz["subtitle"] * 1.2
                  + lo["header_gap"])
        cy = pad_y + head_h + R + label_room

        els = []
        y = pad_y + sz["title"] * 0.85
        els.append(TextEl(self._title, q(pad_x), q(y), cls="dv-title",
                          font_size=sz["title"]))
        y += sz["title"] * 0.4 + lo["title_gap"] + sz["subtitle"] * 0.85
        els.append(TextEl(self._subtitle, q(pad_x), q(y),
                          cls="dv-subtitle", font_size=sz["subtitle"]))

        arcs, out_seg, in_seg = self._arcs()

        # ── 緞帶（先畫，壓在弧環底下）──
        ribbons = []
        r_ribbon = R - RW - lo["chord_ribbon_inset"]
        for e in d.edges(self._kind):
            if e.is_self or e.flow <= 0:
                continue                     # 自給畫成內環，不畫成弦
            s = out_seg.get((e.src, e.dst))
            t = in_seg.get((e.src, e.dst))
            if not s or not t:
                continue
            tc, thw = (t[0] + t[1]) / 2, (t[1] - t[0]) * TAPER / 2
            color = co.get(_REL_COLOR.get(e.relation, "series_2"))
            ribbons.append(PathEl(
                chord_ribbon(s[0], s[1], tc - thw, tc + thw, r_ribbon, cx, cy),
                cls="dv-ribbon", fill_attr=color, stroke_attr="none",
                opacity=0.48,
                title=f"{e.src} → {e.dst}（{e.relation}）{fmt(e.flow)}"))
        els.append(GroupEl(children=ribbons, cls="dv-ribbons", key="ribbons"))

        # ── 弧環＋標籤 ──
        for a in arcs:
            els.append(self._arc(a, cx, cy, R, RW, label_gap))

        circle_bottom = cy + R + label_room

        # ── 圖例 ──
        legend_y = circle_bottom + lo["legend_gap"]
        els.append(self._legend(legend_y, pad_x))

        # ── 註腳 ──
        note_y = legend_y + 11 + lo["note_gap"]
        line_h = sz["note"] * lo["note_line_h"]
        for line in wrap(A2_NOTE, canvas_w - pad_x * 2, sz["note"]):
            note_y += line_h
            els.append(TextEl(line, q(pad_x), q(note_y), cls="dv-note",
                              font_size=sz["note"]))

        canvas_h = note_y + sz["note"] * 0.5 + pad_y
        bg = RectEl(0, 0, q(canvas_w), q(canvas_h), cls="dv-surface",
                    fill_attr=co["surface"])
        return ChartLayout(canvas_w=q(canvas_w), canvas_h=q(canvas_h),
                           css=th.dataviz_css(), elements=[bg] + els)

    # ── 單弧 ─────────────────────────────────────────

    def _arc(self, a, cx: float, cy: float, R: float, RW: float,
             label_gap: float) -> GroupEl:
        d: StarfieldData = self._data
        th: ThemeConfig = self._theme
        sz, co = th.dv_sizes, th.dv_colors
        p = a["palace"]
        children = [PathEl(
            annular_sector(a["a0"], a["a1"], R - RW, R, cx, cy),
            cls="dv-arc", fill_attr=co["arc_base"], stroke_attr="none",
            title=f"{p}　流入＋流出 {fmt(a['total'])}")]

        # 主宮自給＝弧首的深色內環（中性墨；它不是「另一種關係」，是沒有流動）
        if a["self_flow"] > 0 and a["total"] > 0:
            w = (a["a1"] - a["a0"]) * (a["self_flow"] / a["total"])
            children.append(PathEl(
                annular_sector(a["a0"], a["a0"] + w, R - RW, R, cx, cy),
                cls="dv-arc-self", fill_attr=co["self"], stroke_attr="none",
                opacity=0.72,
                title=f"{p}　主宮自給 {fmt(a['self_flow'])}"))

        # 宮名與地支同半徑、垂直堆疊——不同半徑會在圓的左右兩側水平相撞
        mid = (a["a0"] + a["a1"]) / 2
        lx, ly = polar(mid, R + label_gap, cx, cy)
        dx = lx - cx
        anchor = "middle" if abs(dx) < 14 else ("start" if dx > 0 else "end")
        children.append(TextEl(p, q(lx), q(ly), cls="dv-node-label",
                               anchor=anchor, font_size=sz["col_header"]))
        branch = d.branch_of(p)
        if branch:
            children.append(TextEl(
                branch, q(lx), q(ly + sz["row_sub"] * 1.15),
                cls="dv-node-sub", anchor=anchor, font_size=sz["row_sub"]))
        return GroupEl(children=children, cls="dv-arc-group", key=p)

    # ── 圖例 ─────────────────────────────────────────

    def _legend(self, y: float, pad_x: float) -> GroupEl:
        th: ThemeConfig = self._theme
        sz, co = th.dv_sizes, th.dv_colors
        fs, h = sz["note"], 11
        children, x = [], pad_x
        for color, label in ((co["series_1"], A2_LEGEND_OPPOSITE),
                             (co["series_2"], A2_LEGEND_TRINE),
                             (co["self"], A2_LEGEND_SELF)):
            children.append(RectEl(q(x), q(y), h, h, cls="dv-bar-solid", rx=2,
                                   fill_attr=color))
            x += h + 6
            children.append(TextEl(label, q(x), q(y + h * 0.8),
                                   cls="dv-legend-label", font_size=fs))
            x += est_w(label, fs) + 16
        return GroupEl(children=children, cls="dv-legend", key="legend")
