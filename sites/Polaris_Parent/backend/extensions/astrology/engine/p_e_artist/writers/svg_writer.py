"""
SVG Writer (V0.3)
將 ChartLayout 轉換為 SVG 字串。
"""

from xml.sax.saxutils import escape

from .embed_assets import (
    embed_as_data_uri,
    load_star_svg_inner_for_inline,
    resolve_asset_path,
    star_art_bounds,
    svg_viewbox,
)
from ..charts.natal.config import FOURTEEN_MAIN_STAR_CODES, SUB_STAR_SORT_RANK
from ..theme import header_offset
from ..core.elements import (
    ChartLayout, RectEl, TextEl, LineEl, CircleEl, ImageEl, GroupEl, PathEl,
    PalaceEl, PalaceStarItem,
)


_SIHUA_LABEL = {"FO": "F", "PW": "P", "HO": "H", "BI": "I"}

# 圖示原稿規格：星曜＝289 畫框、線寬 5；宮位＝260×80 橫幅、線寬 4.5。
# 用來把宮位圖示與身宮外框的線寬換算成與主星同粗（px）。
_STAR_FRAME_UNITS, _STAR_STROKE_UNITS = 289.0, 5.0
# 宮位圖原稿線寬（全寬 260×80 與半寬 128×68 兩套皆 4.5）。畫框尺寸不寫死，
# 一律讀圖檔自己的 viewBox——疊盤改用半寬版時，版面才不必先知道拿到哪一種。
_PALACE_STROKE_UNITS = 4.5
_FRAME = {"l": 0.0, "t": 0.0, "r": 1.0, "b": 1.0}

# 十四主星圖形下緣佔畫框的最大比例（0.751＝下方約 25% 是留白）。主星列的保留高
# 用這個常數而非逐顆量測值，跨宮位的輔星首列才會落在同一條水平線上。
_MAIN_ART_BOTTOM = max(
    star_art_bounds(f"{c}.svg")["b"] for c in FOURTEEN_MAIN_STAR_CODES)


def _cjk_w(s: str, fs: float) -> float:
    """估算字寬：CJK ≈ 字級寬、拉丁 ≈ 0.55 字級。"""
    return sum(fs if ord(ch) > 0x2E80 else fs * 0.55 for ch in s)


def _star_area(el: PalaceEl, theme, px, py, pw, ph) -> list:
    """星曜區統一版面（單盤/疊盤同一演算法，只差尺寸階層）：

      主星列＝恆鎖上半部（貼齊星曜區頂；只有一顆主星亦同，不做垂直置中）
        └ 其下四化排：每顆星自己的徽章橫排（本命紅在前、各層色在後）
      輔星（＋疊盤流曜）列＝固定網格：首列鎖在「主星＋四化排保留位」之下的
        固定線（無主星、主星無四化皆同一條線），由上往下排、水平置中；
        塞不下時整塊上移恰可容納（不侵入主星區）
        └ 其下四化排（該列有徽章才佔高）
      小星文字列（單行，宮位下緣置中；無圖小星隱藏，多為空）

    尺寸階層＝單盤 77/35/21、疊盤 60/34/16（副星以「5 顆一行不破網格」為準）。
    """
    lo = theme.layout
    pad_left = lo["palace_pad_left"]
    pad_right = lo["palace_pad_right"]
    pad_bottom = lo["palace_pad_bottom"]
    underline_y = header_offset(lo)
    icon_main_gap = lo["icon_main_gap"]
    if el.overlay:
        icon_main = lo.get("overlay_icon_main_size", 60)
        icon_sub = lo.get("overlay_icon_sub_size", 34)
        icon_sub_gap = lo.get("overlay_icon_sub_gap", 2)
        badge = lo.get("overlay_badge_size", 16)
        badge_gap = lo.get("overlay_badge_gap", 2)
        row_gap = lo.get("overlay_row_gap", 3)
    else:
        icon_main = lo["icon_main_size"]
        icon_sub = lo["icon_sub_size"]
        icon_sub_gap = lo["icon_sub_gap"]
        badge = lo["sihua_badge_size"]
        badge_gap = lo.get("sihua_badge_gap", 2)
        row_gap = lo.get("icon_row_gap", 3)

    # 小星文字列佔位（有內容才保留高度）
    minor_lh = lo["minor_line_height"]
    minor_pb = lo["minor_pad_bottom"]
    sep = lo.get("minor_separator", " · ")
    minor_height = (theme.sizes["star_minor"] * minor_lh + minor_pb) \
        if el.minor_labels else 0
    # 地支列（宮格右下角，見 _render_palace_el）：整列保留高度。地支只佔右下一角，
    # 但星曜是置中排的、寬度逼近內寬，逐宮判斷會讓各宮基準線不齊——保留整列最省事
    # 也最可預期（方版直版、單盤疊盤同一套）。
    branch_height = (theme.sizes["branch"] + 2)         if (el.branch_label or el.stem_label) else 0

    out: list = []

    # 四化徽章貼著「圖形」放，而非貼著畫框：圖示畫框內約有 25% 留白，以畫框
    # 為準時徽章會離星曜一大段、看不出是哪顆星在化。attach=False 可退回舊行為。
    attach = lo.get("sihua_badge_attach", True)
    attach_gap = lo.get("sihua_badge_attach_gap", 1)

    def _badge_drop(href, size) -> float:
        """徽章頂緣相對圖示畫框頂的位移。"""
        if not attach:
            return size + 1
        return size * star_art_bounds(href)["b"] + attach_gap

    def _badge_cx(href, ix, size) -> float:
        if not attach:
            return ix + size / 2
        b = star_art_bounds(href)
        return ix + size * (b["l"] + b["r"]) / 2

    # 副星縮小後線條等比變細（原稿同一線寬）；match=1 補到與主星同粗、0＝不補。
    stroke_match = float(lo.get("icon_sub_stroke_match", 1.0))

    def _stroke_scale(size) -> float:
        if size <= 0 or size >= icon_main:
            return 1.0
        return 1.0 + stroke_match * (icon_main / size - 1.0)

    def _badge_row(badges, cx, top):
        """一顆星的四化徽章橫排（置中於 cx）。"""
        drawn = [(b, ink) for (b, ink) in badges if b in _SIHUA_LABEL]
        n = len(drawn)
        if not n:
            return
        bx = cx - (n * badge + (n - 1) * badge_gap) / 2
        for (code, ink) in drawn:
            out.append(ImageEl(
                f"../assets/stars/{_SIHUA_LABEL[code]}.svg",
                bx, top, badge, badge, cls="sihua-badge", ink=ink or "",
            ))
            bx += badge + badge_gap

    # ── 版面高度預算 ──
    majors = el.majors
    # 顯示排序（空劫→煞→輔→雜曜；穩定排序使同碼的本命星與大/小/流 流曜相鄰）
    sub_items = sorted(
        list(el.subs) + list(el.flow_items or []),
        key=lambda it: SUB_STAR_SORT_RANK.get(it.code, len(SUB_STAR_SORT_RANK)),
    )
    # 主星列保留高＝跨宮位固定（不看本宮是哪顆主星），輔星首列才會同一條線。
    # 貼圖形模式下，徽章多半落在畫框下緣的留白內，幾乎不另佔高。
    main_badge_drop = (icon_main * _MAIN_ART_BOTTOM + attach_gap) if attach \
        else (icon_main + 1)
    main_reserved = max(icon_main, main_badge_drop + badge) + badge_gap
    h_majors = 0
    if majors:
        h_majors = main_reserved if any(m.badges for m in majors) else (
            icon_main * _MAIN_ART_BOTTOM if attach else icon_main)

    inner_w = pw - pad_left - pad_right

    def _w_of(it) -> float:
        """單顆圖示邊長：小星曜/流曜帶 scale（<1 縮小），一般副星保持整數。"""
        s = getattr(it, "scale", 1.0) or 1.0
        return icon_sub if s == 1.0 else icon_sub * s

    # 依格寬換行（逐顆累寬，容納混合尺寸）
    lines: list = []
    cur: list = []
    cur_w = 0.0
    for it in sub_items:
        w = _w_of(it)
        add = w if not cur else icon_sub_gap + w
        if cur and cur_w + add > inner_w:
            lines.append(cur)
            cur, cur_w = [it], w
        else:
            cur.append(it)
            cur_w += add
    if cur:
        lines.append(cur)

    line_icon_h = [max(_w_of(it) for it in line) for line in lines]
    line_h = [max([line_icon_h[i]] + [
                  (line_icon_h[i] - _w_of(it)) / 2
                  + _badge_drop(it.href, _w_of(it)) + badge + badge_gap
                  for it in line if it.badges])
              for i, line in enumerate(lines)]

    area_top = py + underline_y
    area_bottom = py + ph - pad_bottom - branch_height - minor_height

    # ── 主星列：恆鎖上半部（貼齊星曜區頂，跨宮位同一水平線） ──
    if majors:
        n = len(majors)
        left = px + (pw - (n * icon_main + (n - 1) * icon_main_gap)) / 2
        for i, m in enumerate(majors):
            ix = left + i * (icon_main + icon_main_gap)
            out.append(ImageEl(
                m.href, ix, area_top, icon_main, icon_main,
                cls="star-major", title=m.label or "", ink=m.ink or "",
            ))
            _badge_row(m.badges, _badge_cx(m.href, ix, icon_main),
                       area_top + _badge_drop(m.href, icon_main))
    majors_bottom = area_top + h_majors

    # ── 輔星網格：首列鎖定固定線＝主星＋四化排保留位之下（不論該宮
    #    有無主星/四化，跨宮位同一條線），由上往下排；塞不下時整塊
    #    上移至恰可容納，但不侵入主星實際佔用區；極端高密度（物理
    #    極限外）時捨棄放不下的尾列，改以「+N」文字收尾──寧可截斷
    #    示意還有更多，也不讓圖示脫框（疊盤多層流曜偶發案例） ──
    subs_grid_top = area_top + main_reserved + row_gap
    floor_y = majors_bottom + (row_gap if majors else 0)
    subs_total = sum(line_h) + row_gap * max(0, len(lines) - 1)
    y = subs_grid_top
    if y + subs_total > area_bottom:
        y = max(area_bottom - subs_total, floor_y)

    overflow_n = 0
    if y + subs_total > area_bottom:
        marker_fs = theme.sizes.get("star_minor", 11)
        marker_h = marker_fs + 4
        avail = area_bottom - floor_y
        keep = len(lines)
        while keep > 0:
            total_h = sum(line_h[:keep]) + row_gap * max(0, keep - 1)
            budget = avail - (marker_h + row_gap if keep < len(lines) else 0)
            if total_h <= budget:
                break
            keep -= 1
        overflow_n = sum(len(line) for line in lines[keep:])
        lines = lines[:keep]
        line_h = line_h[:keep]
        line_icon_h = line_icon_h[:keep]
        subs_total = sum(line_h) + row_gap * max(0, len(lines) - 1)
        y = floor_y

    # ── 輔星＋流曜列（換行；帶 scale 者縮放並於列內垂直置中） ──
    for li, line in enumerate(lines):
        widths = [_w_of(it) for it in line]
        total_w = sum(widths) + icon_sub_gap * (len(line) - 1)
        ix = px + (pw - total_w) / 2
        for it, w in zip(line, widths):
            iy = y + (line_icon_h[li] - w) / 2
            out.append(ImageEl(
                it.href, ix, iy, w, w,
                cls="star-sub", title=it.label or "", ink=it.ink or "",
                stroke_scale=_stroke_scale(w),
            ))
            _badge_row(it.badges, _badge_cx(it.href, ix, w),
                       iy + _badge_drop(it.href, w))
            ix += w + icon_sub_gap
        y += line_h[li] + (row_gap if li < len(lines) - 1 else 0)

    if overflow_n:
        marker_fs = theme.sizes.get("star_minor", 11)
        out.append(TextEl(
            f"+{overflow_n}", px + pw / 2,
            y + (row_gap if lines else 0) + marker_fs * 0.85,
            cls="stars-overflow", anchor="middle", font_size=marker_fs,
        ))

    # ── 整組星曜垂直置中：以「實際圖形」的上下緣為準（畫框留白不算），把主星＋
    #    四化＋輔星當成一塊，置中於星曜區。star_block_valign="top" 退回貼頂
    #    （跨宮位主星同一水平線）。塞滿或溢出的宮位位移為 0，不受影響。 ──
    if out and lo.get("star_block_valign", "center") == "center":
        tops, bottoms = [], []
        for e in out:
            if isinstance(e, ImageEl):
                b = star_art_bounds(e.href) if attach else _FRAME
                tops.append(e.y + e.h * b["t"])
                bottoms.append(e.y + e.h * b["b"])
            elif isinstance(e, TextEl):
                tops.append(e.y - e.font_size)
                bottoms.append(e.y)
        dy = ((area_top + area_bottom) - (min(tops) + max(bottoms))) / 2
        # 上下皆可移（只有輔星的宮位原落在固定線上、偏低，要往上拉），
        # 但圖形不得超出星曜區上下緣
        dy = max(area_top - min(tops), min(dy, area_bottom - max(bottoms)))
        for e in out:
            e.y += dy

    # ── 小星文字列（單行，宮位下緣置中） ──
    if el.minor_labels:
        text = sep.join(el.minor_labels)
        line_top = (py + ph - pad_bottom - branch_height) - minor_height
        line_baseline = line_top + theme.sizes["star_minor"] * 0.85 + (
            (theme.sizes["star_minor"] * (minor_lh - 1)) / 2
        )
        out.append(TextEl(
            text, px + pw / 2, line_baseline,
            cls="stars-minor", anchor="middle",
            font_size=theme.sizes["star_minor"],
        ))

    return out


def _render_palace_el(el: PalaceEl, theme) -> str:
    """v2 視覺：把宮位內容用計算出的絕對座標展開為 SVG 元素。"""
    if theme is None:
        from ..theme import ThemeConfig
        theme = ThemeConfig()

    lo = theme.layout
    pad_right = lo["palace_pad_right"]
    pad_left = lo["palace_pad_left"]
    underline_y = header_offset(lo)
    baseline_y = lo["header_baseline_offset"]

    px, py = el.x, el.y
    pw, ph = el.w, el.h

    children = []

    # ── header：宮名（圖示或文字＋疊層宮名）整組置中 + 底線 ──
    # 視為同一個橫排區塊，量完總寬才決定起點；各自從左緣起算的話，
    # 置中後會散開（疊層宮名與英文名原本都只對齊中文名的右緣）。
    #
    # 宮名圖示（assets/palace/{code}.svg，橫幅式線稿）：palace_name_style="icon" 且
    # 該宮有圖檔時取代文字宮名，整張盤不再依賴語言。身宮＝圖示外加一圈同粗細的外框。
    use_icon = bool(el.name_icon) and lo.get("palace_name_style", "icon") == "icon"
    icon_w = icon_h = frame_pad = stroke_px = 0.0
    half_w = half_h = 0.0
    icon_top = 0.0
    if use_icon:
        icon_h = float(lo.get("palace_icon_height", 16))
        _vw, _vh = svg_viewbox(el.name_icon)
        icon_w = icon_h * _vw / _vh
        # 外框留白一律計入版面（只有身宮真的畫框）：否則有框的那一格圖示會比
        # 別格低 frame_pad，12 宮的宮名就不在同一條線上。
        frame_pad = float(lo.get("palace_body_frame_pad", 2.5))
        # 圖示不再垂直置中於表頭帶，改由頂端固定留白下移——置中時外框上緣
        # 太靠近宮格格線（使用者回報疊在一起）。
        icon_top = py + float(lo.get("palace_icon_top_gap", lo["palace_pad_top"]))
        half_h = float(lo.get("palace_layer_icon_height", icon_h * 0.85))
        # 線寬對齊主星圖示的視覺線寬（整張盤線條一致；疊盤主星較小，線也跟著細）
        main = lo.get("overlay_icon_main_size", 60) if el.overlay else lo["icon_main_size"]
        stroke_px = _STAR_STROKE_UNITS * main / _STAR_FRAME_UNITS

    # head 元素：("icon",)＝本命宮位圖；("licon", href, ink)＝疊層半寬宮位圖；
    #            ("text", 文字, 字級, class, 顏色)
    head: list = []
    if use_icon:
        head.append(("icon",))
    elif el.cn_name:
        head.append(("text", el.cn_name, theme.sizes["palace_name"], "palace-name", ""))
    if el.overlay and el.layer_names:
        # 疊層宮位並列（大限綠／小限深藍／流年淺藍），以層色區分。
        # 有半寬圖示就用圖示，否則退回縮寫文字（大財／小兄／流父）。
        fs_layer = theme.sizes.get("overlay_layer_name", 9)
        icons = list(el.layer_icons) + [("", "")] * len(el.layer_names)
        for (nm, ink_), (href_, iink) in zip(el.layer_names, icons):
            if use_icon and href_:
                head.append(("licon", href_, iink or ink_ or ""))
            else:
                head.append(("text", nm, fs_layer, "palace-name-layer", ink_ or ""))
    if el.en_name:
        head.append(("text", el.en_name, theme.sizes["palace_name_en"],
                     "palace-name-en", ""))

    if head:
        name_gap = lo.get("palace_name_gap", 4)
        icon_block_w = icon_w + 2 * frame_pad

        def _half_w(href: str) -> float:
            vw, vh = svg_viewbox(href)
            return half_h * vw / vh

        def _item_w(it) -> float:
            if it[0] == "icon":
                return icon_block_w
            if it[0] == "licon":
                return _half_w(it[1])
            return _cjk_w(it[1], it[2])

        total_w = sum(_item_w(it) for it in head) + name_gap * (len(head) - 1)
        hx = px + (pw - total_w) / 2
        iy = icon_top + frame_pad                 # 本命圖示上緣（12 宮同一條線）
        mid_y = iy + icon_h / 2                   # 疊層圖示對齊本命圖示的中線
        for it in head:
            if it[0] == "icon":
                ink = el.name_icon_ink or theme.colors.get("palace_name", "")
                children.append(ImageEl(
                    el.name_icon, hx + frame_pad, iy, icon_w, icon_h,
                    cls="palace-icon", ink=ink,
                    stroke_scale=stroke_px / (_PALACE_STROKE_UNITS * icon_h / _vh),
                ))
                if el.is_body:
                    children.append(RectEl(
                        hx, icon_top, icon_block_w, icon_h + 2 * frame_pad,
                        cls="palace-body-frame", rx=1.5,
                        fill_attr="none", stroke_attr=ink, stroke_width=stroke_px,
                    ))
                hx += icon_block_w + name_gap
                continue
            if it[0] == "licon":
                _, href_, iink = it
                lw = _half_w(href_)
                lvh = svg_viewbox(href_)[1]
                children.append(ImageEl(
                    href_, hx, mid_y - half_h / 2, lw, half_h,
                    cls="palace-icon-layer", ink=iink,
                    stroke_scale=stroke_px / (_PALACE_STROKE_UNITS * half_h / lvh),
                ))
                hx += lw + name_gap
                continue
            _, text, fs, cls, fill = it
            children.append(TextEl(
                text, hx, py + baseline_y, cls=cls, anchor="start", font_size=fs,
                fill_attr=fill, stroke_attr=("none" if fill else ""),
            ))
            hx += _cjk_w(text, fs) + name_gap
    # 表頭底線：宮名改成圖示後這條線是多餘的裝飾（圖示本身左右就帶橫線）。
    # 只是不畫線，表頭帶高不變——星曜區起點與 12 宮的對齊都不受影響。
    if lo.get("palace_header_line", False):
        children.append(LineEl(
            px + pad_left, py + underline_y,
            px + pw - pad_right, py + underline_y,
            cls="palace-header-line",
        ))

    # ── 宮格底部一列：宮干在左下、地支在右下（拆開放，中間留給小星文字）。
    #    這一列的高度由 _star_area 保留，星曜與小星文字都不會壓到。 ──
    gz_baseline = py + ph - lo["palace_pad_bottom"]
    if el.stem_label:
        children.append(TextEl(
            el.stem_label, px + pad_left, gz_baseline,
            cls="stem-name", anchor="start",
            font_size=theme.sizes["branch"],
        ))
    if el.branch_label:
        children.append(TextEl(
            el.branch_label, px + pw - pad_right, gz_baseline,
            cls="branch-name", anchor="end",
            font_size=theme.sizes["branch"],
        ))

    # ── 星曜區：單盤/疊盤共走統一版面（尺寸階層見 _star_area） ──
    children.extend(_star_area(el, theme, px, py, pw, ph))
    group = GroupEl(children=children, cls=el.cls)
    return _render_element(group, theme.colors.get("star_ink"))


def _render_element(el, ink: str | None = None) -> str:
    """遞迴地將單一元素轉換為 SVG 片段。ink 非空時為星曜圖示上色。"""
    if isinstance(el, RectEl):
        parts = [f'<rect x="{el.x}" y="{el.y}" width="{el.w}" height="{el.h}"']
        if el.rx:
            parts.append(f' rx="{el.rx}" ry="{el.rx}"')
        if el.cls:
            parts.append(f' class="{el.cls}"')
        if el.fill_attr:
            parts.append(f' fill="{escape(el.fill_attr)}"')
        if el.stroke_attr:
            parts.append(f' stroke="{escape(el.stroke_attr)}"')
        if el.stroke_width:
            parts.append(f' stroke-width="{el.stroke_width:.3g}" stroke-linejoin="round"')
        parts.append('/>')
        return ''.join(parts)

    if isinstance(el, TextEl):
        safe = escape(el.content)
        parts = [f'<text x="{el.x}" y="{el.y}"']
        if el.cls:
            parts.append(f' class="{el.cls}"')
        if el.fill_attr:
            parts.append(f' fill="{escape(el.fill_attr)}"')
        if el.stroke_attr:
            parts.append(f' stroke="{escape(el.stroke_attr)}"')
        if el.anchor != "start":
            parts.append(f' text-anchor="{el.anchor}"')
        if el.dominant_baseline != "auto":
            parts.append(f' dominant-baseline="{el.dominant_baseline}"')
        parts.append(f'>{safe}</text>')
        return ''.join(parts)

    if isinstance(el, CircleEl):
        parts = [f'<circle cx="{el.cx}" cy="{el.cy}" r="{el.r}"']
        if el.cls:
            parts.append(f' class="{el.cls}"')
        if el.fill_attr:
            parts.append(f' fill="{escape(el.fill_attr)}"')
        if el.stroke_attr:
            parts.append(f' stroke="{escape(el.stroke_attr)}"')
        parts.append('/>')
        return ''.join(parts)

    if isinstance(el, LineEl):
        c = f' class="{el.cls}"' if el.cls else ''
        return f'<line x1="{el.x1}" y1="{el.y1}" x2="{el.x2}" y2="{el.y2}"{c}/>'

    if isinstance(el, PathEl):
        parts = [f'<path d="{escape(el.d)}"']
        if el.cls:
            parts.append(f' class="{el.cls}"')
        if el.fill_attr:
            parts.append(f' fill="{escape(el.fill_attr)}"')
        if el.stroke_attr:
            parts.append(f' stroke="{escape(el.stroke_attr)}"')
        if el.opacity < 1:
            parts.append(f' fill-opacity="{el.opacity}"')
        if el.title:
            parts.append(f'><title>{escape(el.title)}</title></path>')
        else:
            parts.append('/>')
        return ''.join(parts)

    if isinstance(el, ImageEl):
        # Illustrator 對 <image> + data URI（尤其內嵌 SVG）常誤判為連結且檔名空白；
        # 星曜 .svg 改為巢狀 <svg> 真內嵌向量。
        # ink 語意：""=沿用預設、色碼=覆寫、"none"=保留原色（中宮任意圖檔用）。
        use_ink = None if el.ink == "none" else (el.ink or ink)
        asset_path = resolve_asset_path(el.href)
        if asset_path and asset_path.lower().endswith(".svg"):
            try:
                vb, inner = load_star_svg_inner_for_inline(
                    asset_path, use_ink, el.stroke_scale)
                title_frag = (
                    f"<title>{escape(el.title)}</title>" if el.title else "")
                cls_attr = f' class="{escape(el.cls)}"' if el.cls else ""
                return (
                    f'<svg xmlns="http://www.w3.org/2000/svg" x="{el.x}" y="{el.y}" '
                    f'width="{el.w}" height="{el.h}" viewBox="{escape(vb)}" '
                    f'preserveAspectRatio="xMidYMid meet"{cls_attr}>'
                    f"{title_frag}{inner}</svg>"
                )
            except (OSError, ValueError):
                pass

        safe_href = escape(embed_as_data_uri(el.href, use_ink))
        parts = [
            f'<image xlink:href="{safe_href}" href="{safe_href}" x="{el.x}" y="{el.y}"'
            f' width="{el.w}" height="{el.h}"',
        ]
        if el.cls:
            parts.append(f' class="{el.cls}"')
        if el.title:
            parts.append(f'><title>{escape(el.title)}</title></image>')
        else:
            parts.append("/>")
        return "".join(parts)

    if isinstance(el, GroupEl):
        attrs = f' class="{el.cls}"' if el.cls else ''
        inner = "\n  ".join(_render_element(c, ink) for c in el.children)
        return f"<g{attrs}>\n  {inner}\n</g>"

    return ""


def to_svg_fragment(layout: ChartLayout, theme=None) -> str:
    """同 to_svg()，但不含 XML 宣告——供內嵌進 HTML 頁面。"""
    header = (
        f'<svg xmlns="http://www.w3.org/2000/svg"'
        f' xmlns:xlink="http://www.w3.org/1999/xlink"'
        f' viewBox="0 0 {layout.canvas_w} {layout.canvas_h}"'
        f' width="{layout.canvas_w}" height="{layout.canvas_h}">\n'
    )

    defs = ""
    if layout.css:
        defs = f"<defs>\n<style>\n{layout.css}\n</style>\n</defs>\n"

    ink = theme.colors.get("star_ink") if theme is not None else None
    parts = []
    for el in layout.elements:
        if isinstance(el, PalaceEl):
            parts.append(_render_palace_el(el, theme))
        else:
            parts.append(_render_element(el, ink))
    body = "\n".join(parts)
    footer = "\n</svg>\n"

    return header + defs + body + footer


def to_svg(layout: ChartLayout, theme=None) -> str:
    """將 ChartLayout 轉換為完整 SVG 字串（含 XML 宣告）。"""
    return ('<?xml version="1.0" encoding="UTF-8"?>\n'
            + to_svg_fragment(layout, theme))
