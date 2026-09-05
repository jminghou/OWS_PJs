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
from ...overlay_config import layer_colors
from ...core.base_composer import BaseComposer
from ...core.elements import (
    RectEl, TextEl, LineEl, CircleEl, ImageEl, GroupEl, ChartLayout,
    PalaceEl, PalaceStarItem,
)
from .data import ChartData, PalaceInfo
from .layout import GridLayout
from .config import (
    FOURTEEN_MAIN_STAR_CODES,
    MAJOR_STAR_CODES,
    SMALL_STAR_CODES,
    SUB_STAR_SORT_RANK,
)

# 副星（有 SVG 圖檔但非十四主星）
_SUB_STAR_CODES = MAJOR_STAR_CODES - FOURTEEN_MAIN_STAR_CODES

# 四化碼 → 圖檔字母（與 writers 的 _SIHUA_LABEL 一致）
_SIHUA_LETTER = {"FO": "F", "PW": "P", "HO": "H", "BI": "I"}

# 圖例分區標題（依語言；缺對應語言時退回中文）
_LEGEND_HEADERS = {
    "main":  {"zh": "主星", "en": "Main Stars"},
    "sub":   {"zh": "輔星", "en": "Minor Stars"},
    "sihua": {"zh": "四化", "en": "Transformations"},
}


def _est_w(s: str, fs: float) -> float:
    """估算字寬：CJK ≈ 字級寬、拉丁 ≈ 0.55 字級。"""
    return sum(fs if ord(ch) > 0x2E80 else fs * 0.55 for ch in str(s))


class NatalComposer(BaseComposer):
    """將命盤 ChartData 計算為格式無關的 ChartLayout。"""

    def __init__(self, data: ChartData, theme: ThemeConfig, lang: str = "zh",
                 triangle_centers=None, show_legend: bool = False,
                 overlay_layers=None, center_content=None, **kwargs):
        super().__init__(data, theme, **kwargs)
        self._lang = lang
        # 是否在命盤下方附圖例對照表（圖示→星名，服務國際化）。
        self._show_legend = show_legend
        # 中宮內容卡（呈現原語 list；由上游節點解析欄位後傳入，本引擎不懂語意）：
        # title/kv/text/note/divider/spacer/color_key/image。空＝維持現狀。
        self._center_content = list(center_content or [])
        # 疊盤層（resolver 輸出）：[{kind, label, palace_ring, sihua, flow_stars}]
        # 非空時每宮改走疊盤版面：表頭並列各層宮名、四化改圖示下方色排、
        # 流曜以層色接在輔星列後。配色見 overlay_config.py。
        self._overlay = [dict(L) for L in (overlay_layers or [])]
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
        grid_w = self._grid.canvas_w
        grid_h = self._grid.canvas_h

        # 0. 先算圖例：需先知道其高度，才能決定畫布總高、並讓背景涵蓋圖例區。
        legend_els, legend_h = ([], 0.0)
        if self._show_legend:
            legend_els, legend_h = self._compose_legend(grid_h)
        canvas_h = grid_h + legend_h

        elements = []

        # 1. 背景（涵蓋命盤＋圖例整個畫布）
        elements.append(RectEl(0, 0, grid_w, canvas_h, cls="chart-bg"))

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

        # 6. 中宮內容卡（畫在三方四正虛線之上＝虛線墊底、卡蓋上）
        elements.extend(self._compose_center_card())

        # 7. 圖例（命盤下方）
        elements.extend(legend_els)

        return ChartLayout(
            canvas_w=grid_w,
            canvas_h=canvas_h,
            css=self._theme.to_css(),
            elements=elements,
        )

    # ── 圖例對照表（圖示 → 星名，服務國際化）────────────

    def _legend_header(self, key: str) -> str:
        d = _LEGEND_HEADERS[key]
        return d.get(self._lang, d["zh"])

    def _compose_legend(self, top_y: float):
        """在命盤下方生成圖例：分區（主星／輔星／四化）列出本盤出現且有圖檔的
        星曜，每列＝圖示＋星名（依 self._lang）。回傳 (元素list, 區塊高度)。"""
        lo = self._theme.layout
        sizes = self._theme.sizes
        W = self._grid.canvas_w

        pad = lo.get("legend_pad_x", 14)
        top_gap = lo.get("legend_top_gap", 20)
        icon = lo.get("legend_icon_size", 22)
        row_h = lo.get("legend_row_h", 30)
        n_cols = int(lo.get("legend_cols", 4))
        header_h = lo.get("legend_header_h", 26)
        section_gap = lo.get("legend_section_gap", 10)
        name_dx = icon + lo.get("legend_icon_text_gap", 8)
        name_fs = sizes.get("legend_name", 11)
        header_fs = sizes.get("legend_header", 12)
        col_w = (W - 2 * pad) / n_cols

        # 收集本盤出現、且有圖檔的星（去重、依主/副分類；與盤面顯示規則一致）
        seen: set[str] = set()
        mains: list[str] = []
        subs: list[str] = []
        sihua_seen: set[str] = set()
        for palace in self._data.palaces.values():
            for st in palace.stars:
                if st.sihua:
                    sihua_seen.add(st.sihua)
                if st.code in seen or st.code not in self._star_svg_codes:
                    continue
                seen.add(st.code)
                if st.code in FOURTEEN_MAIN_STAR_CODES:
                    mains.append(st.code)
                elif st.code in _SUB_STAR_CODES:
                    subs.append(st.code)
        sihua_codes = [c for c in ("FO", "PW", "HO", "BI") if c in sihua_seen]

        sections = []
        if mains:
            sections.append(("main", [
                (f"../assets/stars/{c}.svg", self._reg.star_name(c, self._lang))
                for c in mains]))
        if subs:
            sections.append(("sub", [
                (f"../assets/stars/{c}.svg", self._reg.star_name(c, self._lang))
                for c in subs]))
        if sihua_codes:
            sections.append(("sihua", [
                (f"../assets/stars/{_SIHUA_LETTER[c]}.svg",
                 self._reg.sihua_name(c, self._lang))
                for c in sihua_codes]))

        els = []
        # 命盤與圖例的分隔線
        div_y = top_y + top_gap * 0.5
        els.append(LineEl(pad, div_y, W - pad, div_y, cls="legend-divider"))

        y = top_y + top_gap
        for key, entries in sections:
            els.append(TextEl(
                self._legend_header(key), pad, y + header_fs,
                cls="legend-header", anchor="start", font_size=header_fs))
            y += header_h
            for i, (href, name) in enumerate(entries):
                ex = pad + (i % n_cols) * col_w
                ey = y + (i // n_cols) * row_h
                els.append(ImageEl(
                    href, ex, ey + (row_h - icon) / 2, icon, icon,
                    cls="legend-icon", title=name))
                els.append(TextEl(
                    name, ex + name_dx, ey + row_h / 2 + name_fs * 0.35,
                    cls="legend-name", anchor="start", font_size=name_fs))
            n_rows = (len(entries) + n_cols - 1) // n_cols
            y += n_rows * row_h + section_gap

        legend_h = (y - top_y) + lo.get("legend_bottom_pad", 8)
        return els, legend_h

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
        # 有中宮內容卡時，右下角的預設 chart_id 不再另畫（要顯示由 spec 放 chart_id 項）
        if not cid or self._center_content:
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

    # ── 中宮內容卡（呈現原語 → 元素；垂直置中堆疊） ────

    def _compose_center_card(self) -> list:
        items = self._center_content
        if not items:
            return []
        cr = self._grid.center_rect()
        s = self._theme.sizes
        pad = float(self._theme.layout.get("center_pad", 24))
        cx = cr.x + cr.width / 2
        max_w = cr.width - 2 * pad

        fs_title = s.get("center_title", 16)
        fs_kv = s.get("center_kv", 12)
        fs_kvl = s.get("center_kv_label", 10)
        fs_text = s.get("center_text", 12)
        fs_note = s.get("center_note", 9)
        fs_key = s.get("center_key", 10)

        def h_of(it: dict) -> float:
            t = it.get("type")
            if t == "title":
                return fs_title + 10
            if t == "kv":
                return fs_kv + 7
            if t == "text":
                return fs_text + 6
            if t == "note":
                return fs_note + 5
            if t == "divider":
                return 13
            if t == "spacer":
                return float(it.get("h", 8))
            if t == "color_key":
                return fs_key + 10
            if t == "image":
                return float(it.get("h", 60)) + 8
            return 0.0

        total = sum(h_of(it) for it in items)
        y = cr.y + max(pad, (cr.height - total) / 2)

        els: list = []
        for it in items:
            t = it.get("type")
            h = h_of(it)
            if t == "title":
                els.append(TextEl(str(it.get("text", "")), cx, y + fs_title,
                                  cls="center-title", anchor="middle",
                                  font_size=fs_title))
            elif t == "kv":
                label, value = str(it.get("label", "")), str(it.get("value", ""))
                gap = 8
                wl, wv = _est_w(label, fs_kvl), _est_w(value, fs_kv)
                x0 = cx - (wl + gap + wv) / 2
                base = y + fs_kv
                els.append(TextEl(label, x0, base, cls="center-kv-label",
                                  anchor="start", font_size=fs_kvl))
                els.append(TextEl(value, x0 + wl + gap, base,
                                  cls="center-kv-value", anchor="start",
                                  font_size=fs_kv))
            elif t == "text":
                els.append(TextEl(str(it.get("text", "")), cx, y + fs_text,
                                  cls="center-text", anchor="middle",
                                  font_size=fs_text))
            elif t == "note":
                els.append(TextEl(str(it.get("text", "")), cx, y + fs_note,
                                  cls="center-note", anchor="middle",
                                  font_size=fs_note))
            elif t == "divider":
                w = min(max_w, cr.width * 0.42)
                ly = y + 6
                els.append(LineEl(cx - w / 2, ly, cx + w / 2, ly,
                                  cls="center-divider"))
            elif t == "color_key":
                entries = it.get("items") or []
                seg_gap, dot_r, dot_gap = 14, 4.5, 5
                widths = [dot_r * 2 + dot_gap + _est_w(e.get("label", ""), fs_key)
                          for e in entries]
                x = cx - (sum(widths) + seg_gap * max(0, len(entries) - 1)) / 2
                cyy = y + h / 2 - 2
                for e, w in zip(entries, widths):
                    els.append(CircleEl(x + dot_r, cyy, dot_r,
                                        cls="center-key-dot",
                                        fill_attr=str(e.get("color", "#888")),
                                        stroke_attr="none"))
                    els.append(TextEl(str(e.get("label", "")),
                                      x + dot_r * 2 + dot_gap,
                                      cyy + fs_key * 0.35,
                                      cls="center-key-label", anchor="start",
                                      font_size=fs_key))
                    x += w + seg_gap
            elif t == "image":
                ih = float(it.get("h", 60))
                iw = float(it.get("w", ih))
                els.append(ImageEl(str(it.get("src", "")), cx - iw / 2, y + 2,
                                   iw, ih, cls="center-image", title="",
                                   ink=str(it.get("ink", "none"))))
            y += h
        return [GroupEl(children=els, cls="center-card")]

    # ── 單宮佈局（v2 結構化輸出） ────────────────────

    def _compose_palace(self, palace: PalaceInfo) -> PalaceEl:
        cell = self._grid.branch_to_cell(palace.branch)

        # 宮名：單一語言，由 self._lang 決定（zh / en / ja …）。
        # 名稱來源為 CodeRegistry，切換語言只需改 self._lang，無須改此處。
        pname = self._reg.palace_name(palace.code, self._lang)
        if palace.code == self._data.body_palace:
            pname += "(身)"

        # 宮位干支顯示字（中文）：有宮干顯示「癸卯」，舊資料無宮干退回「卯」
        branch_cn = self._map.get_branch_name(palace.branch) or palace.branch
        stem_cn = self._map.get_stem_name(palace.stem) if palace.stem else None
        if stem_cn:
            branch_cn = f"{stem_cn}{branch_cn}"

        # 星曜分類
        main_stars = [s for s in palace.stars if s.code in FOURTEEN_MAIN_STAR_CODES]
        sub_stars = [s for s in palace.stars if s.code in _SUB_STAR_CODES]
        minor_stars = [s for s in palace.stars if s.code not in MAJOR_STAR_CODES]

        # 小星曜（鸞喜）與運限流曜共用的縮放係數
        small_scale = float(self._theme.layout.get("small_star_scale", 0.5))

        # ── 四化徽章（單盤/疊盤同機制）／疊盤：層宮名、流曜 ──
        overlay = bool(self._overlay)
        bc = palace.branch
        layer_names: list = []
        flow_items: list = []
        badge_map: dict[str, list] = {}
        # 本命四化徽章（紅），排最前
        natal_ink = (self._theme.colors.get("sihua_ink")
                     or self._theme.colors.get("star_ink") or "")
        for s in palace.stars:
            if s.sihua:
                badge_map.setdefault(s.code, []).append((s.sihua, natal_ink))
        if overlay:
            for L in self._overlay:
                cols = layer_colors(str(L.get("kind", "")))
                nm = (L.get("palace_ring") or {}).get(bc, "")
                if nm:
                    layer_names.append((nm, cols["star_ink"]))
                for e in (L.get("sihua") or []):
                    badge_map.setdefault(str(e.get("star_code", "")), []).append(
                        (str(e.get("sihua_code", "")), cols["sihua_ink"]))
                for icon in (L.get("flow_stars") or {}).get(bc, []):
                    if icon in self._star_svg_codes:
                        flow_items.append(PalaceStarItem(
                            code=icon,
                            label=self._star_chart_label(icon),
                            href=f"../assets/stars/{icon}.svg",
                            ink=cols["star_ink"],
                            scale=small_scale,  # 運限流曜一律縮小
                        ))

        def _to_item(s):
            return PalaceStarItem(
                code=s.code,
                label=self._star_chart_label(s.code),
                href=f"../assets/stars/{s.code}.svg",
                sihua=s.sihua or "",
                badges=badge_map.get(s.code, []),
                scale=small_scale if s.code in SMALL_STAR_CODES else 1.0,
            )

        majors = [_to_item(s) for s in main_stars]
        # 顯示排序（空劫→煞→輔→雜曜）在資料層做，SVG/HTML writer 同受惠；
        # SVG writer 對「副星＋流曜」合併清單再做同鍵穩定排序（流曜插組用）
        subs = sorted(
            (_to_item(s) for s in sub_stars),
            key=lambda it: SUB_STAR_SORT_RANK.get(it.code, len(SUB_STAR_SORT_RANK)),
        )
        # 暫時：沒有圖檔的小星曜先隱藏，只保留 assets/stars 內有 SVG 者。
        # 日後補上小星圖檔（或改為文字全顯）時，移除此 if 過濾即可。
        minor_labels = [
            self._star_chart_label(s.code)
            for s in minor_stars
            if s.code in self._star_svg_codes
        ]

        return PalaceEl(
            x=cell.x, y=cell.y, w=cell.width, h=cell.height,
            code=palace.code,
            cn_name=pname,
            en_name="",  # 英文已移除；語言切換改由 self._lang 驅動 cn_name
            branch_label=branch_cn,
            majors=majors,
            subs=subs,
            minor_labels=minor_labels,
            cls=f"palace palace-{palace.code}",
            overlay=overlay,
            layer_names=layer_names,
            flow_items=flow_items,
        )
