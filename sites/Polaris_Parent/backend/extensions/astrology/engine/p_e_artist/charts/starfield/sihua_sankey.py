"""
A4 四化桑基（通道／場強對照）— 佈局計算
==========================================

左右並列兩面桑基：左＝通道值（E×k×w，性質標記），右＝場強（E×g×w，實際進 S總）。

## 並列是論證，不是排版選擇

四化有兩組係數不同的量，而且**排序會相反**（§2 事實③）。任何一面單獨畫，
讀者都會把它讀成「四化的強度」。並排之後，同一顆星在兩邊的高度與名次不同，
這件事自己會說話——所以本 composer 預設同時畫兩面。

## 三個佈局決定

**① 源依各自的量排序，不用固定的祿權科忌序。** 排名換位是這張圖的主題，
   固定序會把它藏成「高度差」，排序才讓它變成「位置差」。
   同一顆星在兩邊用同一個四化色，眼睛才追得回去（本命只有四個源，追得動）。

**② 匯（宮位）兩面用同一個宮序。** 源要看名次變化，匯要看流向差異——
   匯若也各自排序，就沒有東西是固定的，兩面無從比較。

**③ 兩面各自正規化。** 通道值與場強量綱不同，絕對高度不可比；
   每面各自佔滿版面、標百分比，比的是**佔比與名次**，不是絕對值。
"""

from ...core.base_composer import BaseComposer
from ...core.elements import ChartLayout, GroupEl, LineEl, PathEl, RectEl, TextEl
from ...core.path import sankey_ribbon
from ...theme import ThemeConfig
from ._layout import est_w, fmt, q, wrap
from .config import (
    A4_CHANNEL_SUBTITLE,
    A4_CHANNEL_TITLE,
    A4_CROSSREF,
    A4_EMPTY,
    A4_FIELD_SUBTITLE,
    A4_FIELD_TITLE,
    A4_RANK_LEGEND,
    A4_NOTE,
    A4_NOTE_NO_REVERSAL,
    A4_RANK_DOWN,
    A4_RANK_UP,
    A4_SUBTITLE,
    A4_TITLE,
)
from .sihua_data import PANEL_CHANNEL, PANEL_FIELD, SihuaData, SihuaPanel

# 四化 → 色票鍵。必配直接標籤：暗色模式下這四色在色盲模擬會落進同一帶。
_HUA_COLOR = {"祿": "hua_lu", "權": "hua_quan", "科": "hua_ke", "忌": "hua_ji"}


class SihuaSankeyComposer(BaseComposer):
    """SihuaData → A4 對照圖的 ChartLayout。

    ``panel``：both（預設，並列兩面）／channel／field。
    單獨畫某一面是合法的——每面都自帶「這是哪一個量」的標籤——
    但**對照才是這張圖的重點**，所以預設 both。
    """

    def __init__(self, data: SihuaData, theme: ThemeConfig, lang: str = "zh",
                 panel: str = "both", title: str = "", subtitle: str = "",
                 **kwargs):
        super().__init__(data, theme, **kwargs)
        self._lang = lang
        self._panel = (panel or "both").strip()
        self._single = self._panel != "both"
        # 單面不可沿用「兩種讀法」——那個標題在只有一面時是謊
        defaults = {
            PANEL_CHANNEL: (A4_CHANNEL_TITLE, A4_CHANNEL_SUBTITLE),
            PANEL_FIELD: (A4_FIELD_TITLE, A4_FIELD_SUBTITLE),
        }.get(self._panel, (A4_TITLE, A4_SUBTITLE))
        self._title = title or data.title or defaults[0]
        self._subtitle = subtitle or data.subtitle or defaults[1]

    def _panels(self):
        d: SihuaData = self._data
        if self._panel == "both":
            return [d.channel, d.field_]
        if self._panel in (PANEL_CHANNEL, PANEL_FIELD):
            return [d.panel(self._panel)]
        raise ValueError(
            f"未知的 panel「{self._panel}」（可用：both／{PANEL_CHANNEL}／{PANEL_FIELD}）")

    # ── 主流程 ───────────────────────────────────────

    def compose(self) -> ChartLayout:
        d: SihuaData = self._data
        th: ThemeConfig = self._theme
        lo, sz, co = th.dv_layout, th.dv_sizes, th.dv_colors
        panels = self._panels()

        if not any(p.sources for p in panels):
            raise ValueError(A4_EMPTY)

        pad_x, pad_y = lo["pad_x"], lo["pad_y"]
        span = lo["sk_span_single"] if self._single else lo["sk_span"]
        panel_w = (lo["sk_src_label_w"] + lo["sk_node_w"] + span
                   + lo["sk_node_w"] + lo["sk_tgt_label_w"])
        gap = lo["sk_panel_gap"]
        content_w = panel_w * len(panels) + gap * (len(panels) - 1)
        canvas_w = content_w + pad_x * 2

        els = []
        y = pad_y + sz["title"] * 0.85
        els.append(TextEl(self._title, q(pad_x), q(y), cls="dv-title",
                          font_size=sz["title"]))
        y += sz["title"] * 0.4 + lo["title_gap"] + sz["subtitle"] * 0.85
        els.append(TextEl(self._subtitle, q(pad_x), q(y),
                          cls="dv-subtitle", font_size=sz["subtitle"]))

        top = y + lo["header_gap"]
        flow_h = lo["sk_flow_h_single"] if self._single else lo["sk_flow_h"]
        panel_bottom = top
        for i, panel in enumerate(panels):
            px = pad_x + i * (panel_w + gap)
            grp, bottom = self._panel_group(panel, px, top, panel_w,
                                            flow_h, span)
            els.append(grp)
            panel_bottom = max(panel_bottom, bottom)

        # ── 面板之間的分隔線（兩面是兩件事，不是一張圖的左右半）──
        if len(panels) == 2:
            rx = pad_x + panel_w + gap / 2
            els.append(LineEl(q(rx), q(top - lo["header_gap"] * 0.4),
                              q(rx), q(panel_bottom), cls="dv-rule"))

        # ── 註腳 ──
        note_y = panel_bottom + lo["note_gap"]
        notes = [A4_NOTE.replace("**", "")]
        if self._single and A4_CROSSREF.get(self._panel):
            notes.insert(0, A4_CROSSREF[self._panel])
        if len(panels) == 2 and not d.has_reversal:
            notes.append(A4_NOTE_NO_REVERSAL)
        line_h = sz["note"] * lo["note_line_h"]
        for note in notes:
            for line in wrap(note, content_w, sz["note"]):
                note_y += line_h
                els.append(TextEl(line, q(pad_x), q(note_y), cls="dv-note",
                                  font_size=sz["note"]))

        canvas_h = note_y + sz["note"] * 0.5 + pad_y
        bg = RectEl(0, 0, q(canvas_w), q(canvas_h), cls="dv-surface",
                    fill_attr=co["surface"])
        return ChartLayout(canvas_w=q(canvas_w), canvas_h=q(canvas_h),
                           css=th.dataviz_css(), elements=[bg] + els)

    def _shows_rank(self, panel: SihuaPanel) -> bool:
        """該面要不要標名次變化。

        並列模式只標右面（左右對照已經看得出來，兩邊都標是重複）；
        單面模式一定標——它是另一面唯一的線索。
        """
        if not self._data.has_reversal:
            return False
        return self._single or panel.key == PANEL_FIELD

    def _shift_for(self, panel: SihuaPanel, key) -> int:
        """名次變化，正數＝在**本面**排得比另一面前面。"""
        shift = self._data.rank_shift(key) or 0
        return shift if panel.key == PANEL_FIELD else -shift

    # ── 單面 ─────────────────────────────────────────

    def _panel_group(self, panel: SihuaPanel, px: float, py: float,
                     panel_w: float, flow_h: float, span: float):
        d: SihuaData = self._data
        th: ThemeConfig = self._theme
        lo, sz, co = th.dv_layout, th.dv_sizes, th.dv_colors
        node_w = lo["sk_node_w"]
        node_gap = lo["sk_node_gap"]

        src_x = px + lo["sk_src_label_w"]
        tgt_x = src_x + node_w + span

        children = []
        # 面板抬頭。並列模式要「這是哪一個量」來區分左右；單面模式標題就是
        # 那個量，再寫一次只是把同一句話講兩遍（副標已含名稱、公式與意義）。
        hy = py + sz["row_header"] * 0.85
        if not self._single:
            children.append(TextEl(
                f"{panel.label}（{panel.formula}）", q(px), q(hy),
                cls="dv-row-header", font_size=sz["row_header"]))
            hy += sz["row_header"] * 0.5 + sz["row_sub"] * 0.9
        children.append(TextEl(panel.coefficients, q(px), q(hy),
                               cls="dv-row-sub", font_size=sz["row_sub"]))

        # ▲▼ 沒說明相對於什麼，就只是兩個看不懂的符號。
        # 單面模式也標：另一面的資料一直都在，拆開來畫不該把「排序會相反」
        # 這個重點一起弄丟——那正是這張圖存在的理由。
        meaning = "" if self._single else panel.meaning
        if self._shows_rank(panel):
            meaning = (meaning + "　" if meaning else "") + A4_RANK_LEGEND[panel.key]
        if meaning:
            hy += sz["row_sub"] * 0.5 + sz["row_sub"] * 0.9
            children.append(TextEl(meaning, q(px), q(hy),
                                   cls="dv-node-sub", font_size=sz["row_sub"]))

        flow_top = hy + lo["header_gap"]
        grand = panel.grand or 1.0
        sources = panel.sources
        targets = panel.targets_in(d.palace_order)

        # 兩面各自正規化：量綱不同，絕對高度不可比
        src_scale = ((flow_h - node_gap * max(len(sources) - 1, 0)) / grand
                     if sources else 0.0)
        tgt_scale = ((flow_h - node_gap * max(len(targets) - 1, 0)) / grand
                     if targets else 0.0)

        # 節點槽位
        src_slot, y = {}, flow_top
        for s in sources:
            h = s.total * src_scale
            src_slot[s.key] = (y, h)
            y += h + node_gap
        tgt_slot, y = {}, flow_top
        for p in targets:
            h = panel.target_total(p) * tgt_scale
            tgt_slot[p] = (y, h)
            y += h + node_gap
        bottom = max(
            [flow_top]
            + [v[0] + v[1] for v in src_slot.values()]
            + [v[0] + v[1] for v in tgt_slot.values()])

        # ── 流帶（先畫，壓在節點底下）──
        src_cur = {k: v[0] for k, v in src_slot.items()}
        tgt_cur = {k: v[0] for k, v in tgt_slot.items()}
        ribbons = []
        for s in sources:
            color = co.get(_HUA_COLOR.get(s.hua, "muted"), co["muted"])
            for p in targets:                    # 依宮序出帶，兩面同序
                v = s.targets.get(p, 0.0)
                if v <= 0:
                    continue
                h0, h1 = v * src_scale, v * tgt_scale
                ribbons.append(PathEl(
                    sankey_ribbon(src_x + node_w, src_cur[s.key],
                                  tgt_x, tgt_cur[p], h0, h1),
                    cls="dv-ribbon", fill_attr=color, stroke_attr="none",
                    opacity=0.42,
                    title=f"{s.label} → {p}　{fmt(v)}"))
                src_cur[s.key] += h0
                tgt_cur[p] += h1
        children.append(GroupEl(children=ribbons, cls="dv-ribbons",
                                key=f"{panel.key}|ribbons"))

        # ── 源節點 ──
        for i, s in enumerate(sources, 1):
            y0, h = src_slot[s.key]
            color = co.get(_HUA_COLOR.get(s.hua, "muted"), co["muted"])
            node = [RectEl(q(src_x), q(y0), node_w, q(max(h, 1.0)),
                           cls="dv-bar-solid", fill_attr=color)]
            # 標籤：名次 + 星化 + 佔比。名次是這張圖的主詞，放最前面。
            ly = y0 + h / 2 + sz["row_sub"] * 0.35
            node.append(TextEl(
                f"{i}. {s.label}", q(src_x - 6), q(ly), cls="dv-node-label",
                anchor="end", font_size=sz["row_sub"]))
            # 佔比與名次變化同一行，留在標籤欄內——放進流帶區會壓在流帶上，
            # 看起來像是那條流帶的註記。
            sub = f"{panel.pct(s):.0f}%"
            if self._shows_rank(panel):
                shift = self._shift_for(panel, s.key)
                if shift:
                    sub += (f"　{A4_RANK_UP if shift > 0 else A4_RANK_DOWN}"
                            f"{abs(shift)}")
            node.append(TextEl(
                sub, q(src_x - 6), q(ly + sz["row_sub"] * 1.15),
                cls="dv-node-sub", anchor="end", font_size=sz["row_sub"]))
            children.append(GroupEl(children=node, cls="dv-sk-source",
                                    key=f"{panel.key}|{s.star}|{s.hua}"))

        # ── 匯節點 ──
        for p in targets:
            y0, h = tgt_slot[p]
            node = [RectEl(q(tgt_x), q(y0), node_w, q(max(h, 1.0)),
                           cls="dv-bar-solid", fill_attr=co["text_secondary"])]
            node.append(TextEl(
                p, q(tgt_x + node_w + 6), q(y0 + h / 2 + sz["row_sub"] * 0.35),
                cls="dv-node-label", font_size=sz["row_sub"]))
            children.append(GroupEl(children=node, cls="dv-sk-target",
                                    key=f"{panel.key}|→{p}"))

        return GroupEl(children=children, cls="dv-sk-panel",
                       key=panel.key), bottom
