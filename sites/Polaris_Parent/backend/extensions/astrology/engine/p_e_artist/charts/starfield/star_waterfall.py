"""
A3b E 組成瀑布 — 佈局計算
==========================

一顆星的 E 怎麼算出來的：基準 → 亮度 → 影響加成 → 空劫 → E，
每一步都標出係數，可回溯到引擎的真源表。

橫式（步驟為列）而非傳統直式柱：中文步驟標籤在直式柱下方會擠成一團，
橫式讓「亮度 廟」「影響加成」這種標籤有地方放。

## 兩件不可畫錯的事

* **沒有「四化」這一步**（§2 事實④）。四化不乘進 E，它唯一的作用是讓帶四化的
  星豁免空劫，效果在「空劫」那一步。圖上必須寫出這句話——否則讀者會把
  「四化沒出現」讀成漏畫。
* **零變化不可畫成增益**。delta 為 0 的步用中性色、不加正負號；
  只有真的有增減才上 gain/loss 色，且一律配正負號文字（不只靠顏色）。
"""

from ...core.base_composer import BaseComposer
from ...core.elements import ChartLayout, GroupEl, LineEl, RectEl, TextEl
from ...theme import ThemeConfig
from ._layout import est_w, fmt, q, wrap
from .config import A3_WF_SIHUA_NOTE, A3_WF_SUBTITLE, A3_WF_TITLE
from .star_data import StarCard, StarEnergyData, pick_representative

_EPS = 1e-9


class StarWaterfallComposer(BaseComposer):
    """StarEnergyData → A3b 瀑布的 ChartLayout。

    一張圖只畫一顆星（瀑布拆的是「這顆星的 E 怎麼算出來的」）。要畫哪一顆有兩種
    指定法，可以單用也可以合用：

    ``palace``：把候選限縮在某一宮（宮名「命宮」或地支「未」皆可）。
    ``star``：指名到星（星曜代碼或中文名）。

    沒指名時挑哪一顆＝``star_data.pick_representative()``（主星優先，見該函式的
    說明：純比 E 會讓有空劫的宮位永遠畫出空劫，主星消失）。只給 ``palace``＝
    該宮的代表星；兩個都留空＝全盤的代表星。

    一顆星在一張盤裡只會出現一次，所以只給 ``star`` 就已經唯一，``palace``
    純粹是「我不知道命宮裡有誰、給我那一宮的主角」時的入口。
    """

    def __init__(self, data: StarEnergyData, theme: ThemeConfig,
                 lang: str = "zh", star: str = "", palace: str = "",
                 title: str = "", subtitle: str = "", **kwargs):
        super().__init__(data, theme, **kwargs)
        self._lang = lang
        self._star_key = (star or "").strip()
        self._palace_key = (palace or "").strip()
        self._title = title
        self._subtitle = subtitle or data.subtitle or A3_WF_SUBTITLE

    def _card(self) -> StarCard:
        d: StarEnergyData = self._data
        if not d.stars:
            raise ValueError("payload 沒有任何星曜")

        pool = d.stars
        if self._palace_key:
            pool = d.in_palace(self._palace_key)
            if not pool:
                raise ValueError(
                    f"宮位「{self._palace_key}」沒有星（可用："
                    f"{'、'.join(d.palace_names())}）")

        if self._star_key:
            card = next((s for s in pool
                         if s.code == self._star_key or s.name == self._star_key),
                        None)
            if card is None:
                where = f"{self._palace_key}裡" if self._palace_key else ""
                raise ValueError(
                    f"{where}找不到星曜「{self._star_key}」"
                    f"（可用：{'、'.join(s.name for s in pool[:8])}"
                    f"{'…' if len(pool) > 8 else ''}）")
            return card

        # 沒指名＝挑代表星（主星優先，理由見 pick_representative）
        card = pick_representative(pool)
        if card is None:                       # pool 非空時走不到，防禦性
            raise ValueError("找不到可畫的星曜")
        return card

    def compose(self) -> ChartLayout:
        th: ThemeConfig = self._theme
        lo, sz, co = th.dv_layout, th.dv_sizes, th.dv_colors
        card = self._card()

        pad_x, pad_y = lo["pad_x"], lo["pad_y"]
        row_h = lo["wf_row_h"]
        gap = lo["wf_row_gap"]
        label_w = lo["wf_label_w"]
        note_w = lo["wf_note_w"]
        bar_max = lo["wf_bar_max"]

        bar_x = pad_x + label_w
        # 累積值有自己的專欄；係數說明只在 note_w 這段內浮動，不得侵入——
        # 讓說明跟著長條末端自由浮動的話，最長的那一步會撞上右欄的數字。
        value_x = bar_x + bar_max + note_w
        content_r = value_x + lo["wf_value_w"]
        canvas_w = content_r + pad_x

        els = []
        # 標題：星名 · 宮位（地支）· 亮度
        bits = [card.name, f"{card.palace}（{card.branch}）"]
        if card.brightness:
            bits.append(card.brightness)
        if card.hua:
            bits.append(f"化{card.hua}")
        title = self._title or f"{A3_WF_TITLE}：{' · '.join(bits)}"

        y = pad_y + sz["title"] * 0.85
        els.append(TextEl(title, q(pad_x), q(y), cls="dv-title",
                          font_size=sz["title"]))
        y += sz["title"] * 0.4 + lo["title_gap"] + sz["subtitle"] * 0.85
        els.append(TextEl(self._data.formula or self._subtitle, q(pad_x), q(y),
                          cls="dv-subtitle", font_size=sz["subtitle"]))

        # 尺度：涵蓋所有步驟到達過的最大值（含中途高於 E 的情形——
        # 被空劫砍過的星，影響加成後的峰值比 E 高，用 E 當尺度會爆框）
        peak = max([abs(st.to) for st in card.steps]
                   + [abs(st.frm) for st in card.steps] + [1e-6])
        top = y + lo["header_gap"]

        for i, st in enumerate(card.steps):
            els.append(self._step_row(st, card, top + i * (row_h + gap),
                                      bar_x, bar_max, value_x, content_r, peak))
        bottom = top + len(card.steps) * (row_h + gap) - gap

        # ── 註腳：四化位置說明（必出）＋ 反事實（有才出）──
        rule_y = bottom + lo["footer_gap"]
        els.append(LineEl(q(pad_x), q(rule_y), q(content_r), q(rule_y),
                          cls="dv-rule"))
        note_y = rule_y + lo["footer_gap"]
        notes = [A3_WF_SIHUA_NOTE]
        for key in ("without_sihua", "without_void"):
            cf = (card.counterfactual or {}).get(key) or {}
            if cf.get("text"):
                notes.append(f"反事實：{cf['text']}。")
        if not card.adjusted:
            notes.append("本星未受任何調整，E ＝ 亮度倍率。")

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

    # ── 單步 ─────────────────────────────────────────

    def _step_row(self, st, card, row_y: float, bar_x: float, bar_max: float,
                  value_x: float, content_r: float, peak: float) -> GroupEl:
        th: ThemeConfig = self._theme
        lo, sz, co = th.dv_layout, th.dv_sizes, th.dv_colors
        row_h, bar_h = lo["wf_row_h"], lo["wf_bar_h"]
        cy = row_y + row_h / 2
        by = row_y + (row_h - bar_h) / 2
        children = []

        is_total = st.role == "total"
        children.append(TextEl(
            st.label, q(bar_x - 8), q(cy + sz["row_header"] * 0.35),
            cls="dv-row-header" if is_total else "dv-row-sub",
            anchor="end",
            font_size=sz["row_header"] if is_total else sz["row_sub"]))

        scale = bar_max / peak
        if is_total:
            # 合計列：從 0 起算的實心長條
            w = abs(st.to) * scale
            children.append(RectEl(
                q(bar_x), q(by), q(max(w, 0.5)), bar_h,
                cls="dv-bar-solid", rx=2, fill_attr=co["text_secondary"]))
            vx = bar_x + w + 7
        else:
            # 步驟列：浮動長條（from → to）
            lo_v, hi_v = min(st.frm, st.to), max(st.frm, st.to)
            x0, w = bar_x + lo_v * scale, (hi_v - lo_v) * scale
            if abs(st.delta) <= _EPS:
                # 零變化：中性色細標記。畫成綠色向上＝謊報有增益。
                children.append(RectEl(
                    q(x0 - 1), q(by), 2, bar_h,
                    cls="dv-bar-flat", fill_attr=co["axis"]))
            else:
                color = co["gain"] if st.delta > 0 else co["loss"]
                children.append(RectEl(
                    q(x0), q(by), q(max(w, 1.0)), bar_h,
                    cls="dv-bar-solid", rx=2, fill_attr=color))
            # 連到下一步的導引線（起點高度）
            children.append(LineEl(
                q(bar_x + st.frm * scale), q(row_y - lo["wf_row_gap"]),
                q(bar_x + st.frm * scale), q(by), cls="dv-connector"))
            vx = bar_x + hi_v * scale + 7

        # 係數說明（引擎給的 note，如 ×1.75／＋0.17／豁免）。
        # 跟著長條末端浮動，但夾在累積值專欄之前——長步驟才不會撞上右欄數字。
        if st.note:
            neutral = abs(st.delta) <= _EPS or is_total
            nx = min(vx, value_x - est_w(st.note, sz["cell_value"]) - 8)
            children.append(TextEl(
                st.note, q(max(nx, bar_x)), q(cy + sz["cell_value"] * 0.35),
                cls="dv-margin-value", font_size=sz["cell_value"],
                fill_attr=(co["text_secondary"] if neutral
                           else (co["gain"] if st.delta > 0 else co["loss"]))))

        # 該步之後的累積值（右緣對齊成一欄；合計列不重複箭頭）
        if not is_total:
            children.append(TextEl(
                f"→ {fmt(st.to)}", q(content_r), q(cy + sz["row_sub"] * 0.35),
                cls="dv-row-sub", anchor="end", font_size=sz["row_sub"]))
        else:
            children.append(TextEl(
                fmt(st.to), q(content_r), q(cy + sz["cell_value"] * 0.35),
                cls="dv-margin-value", anchor="end",
                font_size=sz["cell_value"], fill_attr=co["text_primary"]))

        return GroupEl(children=children, cls="dv-wf-row",
                       key=f"{card.code}|{st.key}")
