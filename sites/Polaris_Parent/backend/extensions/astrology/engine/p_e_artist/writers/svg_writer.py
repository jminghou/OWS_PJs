"""
SVG Writer (V0.3)
將 ChartLayout 轉換為 SVG 字串。
"""

from xml.sax.saxutils import escape

from .embed_assets import (
    embed_as_data_uri,
    load_star_svg_inner_for_inline,
    resolve_asset_path,
)
from ..charts.natal.config import SUB_STAR_SORT_RANK
from ..core.elements import (
    ChartLayout, RectEl, TextEl, LineEl, CircleEl, ImageEl, GroupEl,
    PalaceEl, PalaceStarItem,
)


_SIHUA_LABEL = {"FO": "F", "PW": "P", "HO": "H", "BI": "I"}


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
    underline_y = lo["header_underline_offset"]
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

    out: list = []

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
    maj_badge_h = (badge + badge_gap) if any(m.badges for m in majors) else 0
    h_majors = (icon_main + maj_badge_h) if majors else 0

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
    line_h = [line_icon_h[i]
              + ((badge + badge_gap) if any(it.badges for it in line) else 0)
              for i, line in enumerate(lines)]

    area_top = py + underline_y
    area_bottom = py + ph - pad_bottom - minor_height

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
            _badge_row(m.badges, ix + icon_main / 2, area_top + icon_main + 1)
    majors_bottom = area_top + h_majors

    # ── 輔星網格：首列鎖定固定線＝主星＋四化排保留位之下（不論該宮
    #    有無主星/四化，跨宮位同一條線），由上往下排；塞不下時整塊
    #    上移至恰可容納，但不侵入主星實際佔用區；極端高密度（物理
    #    極限外）時捨棄放不下的尾列，改以「+N」文字收尾──寧可截斷
    #    示意還有更多，也不讓圖示脫框（疊盤多層流曜偶發案例） ──
    subs_grid_top = area_top + icon_main + badge + badge_gap + row_gap
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
            ))
            _badge_row(it.badges, ix + w / 2, y + line_icon_h[li] + 1)
            ix += w + icon_sub_gap
        y += line_h[li] + (row_gap if li < len(lines) - 1 else 0)

    if overflow_n:
        marker_fs = theme.sizes.get("star_minor", 11)
        out.append(TextEl(
            f"+{overflow_n}", px + pw / 2,
            y + (row_gap if lines else 0) + marker_fs * 0.85,
            cls="stars-overflow", anchor="middle", font_size=marker_fs,
        ))

    # ── 小星文字列（單行，宮位下緣置中） ──
    if el.minor_labels:
        text = sep.join(el.minor_labels)
        line_top = (py + ph - pad_bottom) - minor_height
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
    underline_y = lo["header_underline_offset"]
    baseline_y = lo["header_baseline_offset"]

    px, py = el.x, el.y
    pw, ph = el.w, el.h

    children = []

    # ── header：宮名（中／英）+ 地支 + 底線 ──
    if el.cn_name:
        t = TextEl(
            el.cn_name, px + pad_left, py + baseline_y,
            cls="palace-name", anchor="start",
            font_size=theme.sizes["palace_name"],
        )
        children.append(t)
    if el.overlay and el.layer_names:
        # 疊層宮名並列（大限綠／小限深藍／流年淺藍），以層色區分
        fs_layer = theme.sizes.get("overlay_layer_name", 9)
        name_gap = theme.layout.get("overlay_layer_name_gap", 5)
        lx = px + pad_left + _cjk_w(el.cn_name, theme.sizes["palace_name"]) + name_gap
        for nm, ink_ in el.layer_names:
            children.append(TextEl(
                nm, lx, py + baseline_y,
                cls="palace-name-layer", anchor="start",
                font_size=fs_layer,
                fill_attr=ink_ or "", stroke_attr="none",
            ))
            lx += _cjk_w(nm, fs_layer) + name_gap
    if el.en_name:
        # 估算中文名寬：中文字 ≈ 字級寬，加上 4px gap
        cn_w = sum(
            theme.sizes["palace_name"] if ord(ch) > 0x2E80
            else theme.sizes["palace_name"] * 0.55
            for ch in el.cn_name
        )
        en_x = px + pad_left + cn_w + 4
        children.append(TextEl(
            el.en_name, en_x, py + baseline_y,
            cls="palace-name-en", anchor="start",
            font_size=theme.sizes["palace_name_en"],
        ))
    if el.branch_label:
        children.append(TextEl(
            el.branch_label, px + pw - pad_right, py + baseline_y,
            cls="branch-name", anchor="end",
            font_size=theme.sizes["branch"],
        ))
    children.append(LineEl(
        px + pad_left, py + underline_y,
        px + pw - pad_right, py + underline_y,
        cls="palace-header-line",
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

    if isinstance(el, ImageEl):
        # Illustrator 對 <image> + data URI（尤其內嵌 SVG）常誤判為連結且檔名空白；
        # 星曜 .svg 改為巢狀 <svg> 真內嵌向量。
        # ink 語意：""=沿用預設、色碼=覆寫、"none"=保留原色（中宮任意圖檔用）。
        use_ink = None if el.ink == "none" else (el.ink or ink)
        asset_path = resolve_asset_path(el.href)
        if asset_path and asset_path.lower().endswith(".svg"):
            try:
                vb, inner = load_star_svg_inner_for_inline(asset_path, use_ink)
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


def to_svg(layout: ChartLayout, theme=None) -> str:
    """將 ChartLayout 轉換為完整 SVG 字串。"""
    header = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
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
