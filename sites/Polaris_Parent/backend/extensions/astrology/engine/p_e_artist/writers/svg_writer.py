"""
SVG Writer (V0.3)
將 ChartLayout 轉換為 SVG 字串。
"""

from xml.sax.saxutils import escape

from .embed_assets import (
    embed_as_data_uri,
    load_star_svg_inner_for_inline,
    resolve_star_asset_path,
)
from ..core.elements import (
    ChartLayout, RectEl, TextEl, LineEl, CircleEl, ImageEl, GroupEl,
    PalaceEl, PalaceStarItem,
)


_SIHUA_LABEL = {"FO": "F", "PW": "P", "HO": "H", "BI": "I"}


def _render_palace_el(el: PalaceEl, theme) -> str:
    """v2 視覺：把宮位內容用計算出的絕對座標展開為 SVG 元素。"""
    if theme is None:
        from ..theme import ThemeConfig
        theme = ThemeConfig()

    lo = theme.layout
    pad_top = lo["palace_pad_top"]
    pad_right = lo["palace_pad_right"]
    pad_bottom = lo["palace_pad_bottom"]
    pad_left = lo["palace_pad_left"]
    icon_main = lo["icon_main_size"]
    icon_main_gap = lo["icon_main_gap"]
    icon_sub = lo["icon_sub_size"]
    icon_sub_gap = lo["icon_sub_gap"]
    badge_size = lo["sihua_badge_size"]
    minor_lh = lo["minor_line_height"]
    minor_pb = lo["minor_pad_bottom"]
    sep = lo.get("minor_separator", " · ")
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

    # ── stars 區域幾何 ──
    minor_height = theme.sizes["star_minor"] * minor_lh + minor_pb
    stars_area_top = py + underline_y
    stars_area_bottom = py + ph - pad_bottom
    icons_top = stars_area_top
    icons_bottom = stars_area_bottom - (minor_height if el.minor_labels else 0)
    icons_h = icons_bottom - icons_top

    has_majors = bool(el.majors)
    has_subs = bool(el.subs)
    icons_total_h = (icon_main if has_majors else 0) + (icon_sub if has_subs else 0)
    icons_y_start = icons_top + (icons_h - icons_total_h) / 2

    # ── majors 行 ──
    if has_majors:
        n = len(el.majors)
        total_w = n * icon_main + (n - 1) * icon_main_gap
        left_x = px + (pw - total_w) / 2
        for i, m in enumerate(el.majors):
            ix = left_x + i * (icon_main + icon_main_gap)
            iy = icons_y_start
            children.append(ImageEl(
                m.href, ix, iy, icon_main, icon_main,
                cls="star-major", title=m.label or "",
            ))
            badge_label = _SIHUA_LABEL.get(m.sihua, "")
            if badge_label:
                # v2：圖示右上角
                bx = ix + icon_main - badge_size
                by = iy
                cx = bx + badge_size / 2
                cy = by + badge_size / 2
                children.append(CircleEl(
                    cx, cy, badge_size / 2,
                    cls="sihua-badge",
                    fill_attr=theme.colors["sihua_badge_bg"],
                    stroke_attr="none",
                ))
                fs = theme.sizes["sihua_tag"]
                children.append(TextEl(
                    badge_label, cx, cy + fs * 0.35,
                    cls="sihua-badge-text", anchor="middle",
                    font_size=fs,
                    fill_attr=theme.colors["sihua_tag_ink"],
                    stroke_attr="none",
                ))

    # ── subs 行 ──
    if has_subs:
        n = len(el.subs)
        total_w = n * icon_sub + (n - 1) * icon_sub_gap
        left_x = px + (pw - total_w) / 2
        sub_y = icons_y_start + (icon_main if has_majors else 0)
        for i, s in enumerate(el.subs):
            ix = left_x + i * (icon_sub + icon_sub_gap)
            children.append(ImageEl(
                s.href, ix, sub_y, icon_sub, icon_sub,
                cls="star-sub", title=s.label or "",
            ))
            badge_label = _SIHUA_LABEL.get(s.sihua, "")
            if badge_label:
                bx = ix + icon_sub - badge_size
                by = sub_y
                cx = bx + badge_size / 2
                cy = by + badge_size / 2
                children.append(CircleEl(
                    cx, cy, badge_size / 2,
                    cls="sihua-badge",
                    fill_attr=theme.colors["sihua_badge_bg"],
                    stroke_attr="none",
                ))
                fs = theme.sizes["sihua_tag"]
                children.append(TextEl(
                    badge_label, cx, cy + fs * 0.35,
                    cls="sihua-badge-text", anchor="middle",
                    font_size=fs,
                    fill_attr=theme.colors["sihua_tag_ink"],
                    stroke_attr="none",
                ))

    # ── minor 文字（單行，宮位下緣置中） ──
    if el.minor_labels:
        text = sep.join(el.minor_labels)
        # 單行 baseline：行盒 top + font_size * 0.85
        line_top = stars_area_bottom - minor_height
        line_baseline = line_top + theme.sizes["star_minor"] * 0.85 + (
            (theme.sizes["star_minor"] * (minor_lh - 1)) / 2
        )
        children.append(TextEl(
            text, px + pw / 2, line_baseline,
            cls="stars-minor", anchor="middle",
            font_size=theme.sizes["star_minor"],
        ))

    # 包成 group
    group = GroupEl(children=children, cls=el.cls)
    return _render_element(group)


def _render_element(el) -> str:
    """遞迴地將單一元素轉換為 SVG 片段。"""
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
        asset_path = resolve_star_asset_path(el.href)
        if asset_path and asset_path.lower().endswith(".svg"):
            try:
                vb, inner = load_star_svg_inner_for_inline(asset_path)
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

        safe_href = escape(embed_as_data_uri(el.href))
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
        inner = "\n  ".join(_render_element(c) for c in el.children)
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

    parts = []
    for el in layout.elements:
        if isinstance(el, PalaceEl):
            parts.append(_render_palace_el(el, theme))
        else:
            parts.append(_render_element(el))
    body = "\n".join(parts)
    footer = "\n</svg>\n"

    return header + defs + body + footer
