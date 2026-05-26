"""
HTML Writer (V0.5 — v2 layout)
將 ChartLayout 轉換為 v2 風格 HTML：
  - chart-container (relative)
  - 格線/中央：絕對定位
  - 12 宮位：以 flexbox 排版（PalaceEl 由 composer 結構化提供）
"""

from html import escape
from typing import Optional

from .embed_assets import embed_as_data_uri
from ..core.elements import (
    ChartLayout, RectEl, TextEl, LineEl, CircleEl, ImageEl, GroupEl,
    PalaceEl,
)


def _pos_style(**kw) -> str:
    return '; '.join(f"{k.replace('_', '-')}: {v}" for k, v in kw.items())


def _render_grid_group(el: GroupEl) -> str:
    """格線：用 .gb（外框）/.gl（內線）class，inline 樣式僅控制位置/尺寸。"""
    parts = []
    for c in el.children:
        if isinstance(c, RectEl):
            style = _pos_style(
                left=f"{c.x}px", top=f"{c.y}px",
                width=f"{c.w}px", height=f"{c.h}px",
            )
            parts.append(f'<div class="gb" style="{style}"></div>')
        elif isinstance(c, LineEl):
            if c.y1 == c.y2:
                x = min(c.x1, c.x2)
                w = abs(c.x2 - c.x1)
                style = _pos_style(
                    left=f"{x}px", top=f"{c.y1}px",
                    width=f"{w}px", height="0px",
                    border_top_style="solid",
                )
            else:
                y = min(c.y1, c.y2)
                h = abs(c.y2 - c.y1)
                style = _pos_style(
                    left=f"{c.x1}px", top=f"{y}px",
                    width="0px", height=f"{h}px",
                    border_left_style="solid",
                )
            parts.append(f'<div class="gl" style="{style}"></div>')
    return "\n  ".join(parts)


def _render_center_group(el: GroupEl) -> str:
    parts = []
    for c in el.children:
        if isinstance(c, RectEl) and "center-bg" in c.cls:
            parts.append('<div class="center-bg"></div>')
        elif isinstance(c, TextEl) and "center-chart-id" in c.cls:
            parts.append(f'<span class="center-id">{escape(c.content)}</span>')
    return "\n  ".join(parts)


def _render_sihua_badge_svg(label: str, theme) -> str:
    """v2 風格：21×21 內嵌 SVG，黑底白字。"""
    if not label:
        return ""
    lo = theme.layout
    size = lo["sihua_badge_size"]
    half = size / 2
    fs = theme.sizes["sihua_tag"]
    bg = theme.colors["sihua_badge_bg"]
    ink = theme.colors["sihua_tag_ink"]
    f = theme.font_family
    text_y = half + fs * 0.35
    return (
        f'<svg class="sihua-badge" width="{size}" height="{size}" '
        f'viewBox="0 0 {size} {size}" xmlns="http://www.w3.org/2000/svg">'
        f'<circle cx="{half}" cy="{half}" r="{half}" fill="{bg}"/>'
        f'<text x="{half}" y="{text_y}" text-anchor="middle" '
        f'fill="{ink}" font-family="{f}" font-size="{fs}" font-weight="bold">'
        f'{escape(label)}</text></svg>'
    )


_SIHUA_LABEL = {"FO": "F", "PW": "P", "HO": "H", "BI": "I"}


def _render_palace(p: PalaceEl, theme) -> str:
    sep = theme.layout.get("minor_separator", " · ")

    # header
    cn = escape(p.cn_name)
    en = escape(p.en_name)
    ph_inner = f'<span class="palace-name">{cn}</span>'
    if en:
        ph_inner += f'<span class="palace-name-en">{en}</span>'
    branch = escape(p.branch_label)
    header = (
        f'<div class="palace-header">'
        f'<div class="ph-left">{ph_inner}</div>'
        f'<span class="branch-name">{branch}</span>'
        f'</div>'
    )

    # majors
    major_html = ""
    if p.majors:
        items = []
        for m in p.majors:
            href = embed_as_data_uri(m.href)
            title = escape(m.label) if m.label else ""
            badge_label = _SIHUA_LABEL.get(m.sihua, "")
            if badge_label:
                wrapper_cls = "smw smw-badge"
                badge_svg = _render_sihua_badge_svg(badge_label, theme)
            else:
                wrapper_cls = "smw"
                badge_svg = ""
            items.append(
                f'<div class="{wrapper_cls}">'
                f'<img src="{escape(href)}" class="star-major" title="{title}"/>'
                f'{badge_svg}'
                f'</div>'
            )
        major_html = (
            '<div class="stars-major-row">' + "".join(items) + '</div>'
        )

    # subs
    sub_html = ""
    if p.subs:
        items = []
        for s in p.subs:
            href = embed_as_data_uri(s.href)
            title = escape(s.label) if s.label else ""
            items.append(
                f'<img src="{escape(href)}" class="star-sub" title="{title}"/>'
            )
        sub_html = (
            '<div class="stars-sub-row">' + "".join(items) + '</div>'
        )

    # icons wrapper
    icons_html = ""
    if major_html or sub_html:
        icons_html = (
            f'<div class="stars-icons">{major_html}{sub_html}</div>'
        )

    # minors
    minor_html = ""
    if p.minor_labels:
        text = sep.join(escape(s) for s in p.minor_labels)
        minor_html = f'<div class="stars-minor">{text}</div>'

    stars_area = (
        f'<div class="stars-area">{icons_html}{minor_html}</div>'
    )

    style = _pos_style(left=f"{p.x}px", top=f"{p.y}px")
    cls = p.cls or f"palace palace-{p.code}"
    return (
        f'<div class="{cls}" style="{style}">'
        f'{header}{stars_area}'
        f'</div>'
    )


def _render_palace_links_group(group: GroupEl, theme) -> str:
    """三方四正 連線群組：用單一絕對定位 SVG overlay 渲染所有 LineEl 子節點。"""
    cw = theme.layout["cell_width"]
    ch = theme.layout["cell_height"]
    W, H = cw * 4, ch * 4
    lines = []
    for c in group.children:
        if isinstance(c, LineEl):
            cls = escape(c.cls or "")
            lines.append(
                f'<line x1="{c.x1}" y1="{c.y1}" x2="{c.x2}" y2="{c.y2}" '
                f'class="{cls}"/>'
            )
    group_cls = escape(group.cls or "palace-links")
    return (
        f'<svg class="palace-links-overlay {group_cls}" '
        f'width="{W}" height="{H}" xmlns="http://www.w3.org/2000/svg">'
        + "".join(lines) +
        f'</svg>'
    )


def _render_top_level(el, theme) -> str:
    """渲染 layout 頂層元素。"""
    if isinstance(el, RectEl) and "chart-bg" in el.cls:
        # v2：背景由 chart-container 提供，不再輸出 chart-bg div
        return ""

    if isinstance(el, GroupEl):
        if "grid" in el.cls:
            return _render_grid_group(el)
        if "center" in el.cls:
            return _render_center_group(el)
        if "palace-links" in el.cls:
            return _render_palace_links_group(el, theme)
        return ""

    if isinstance(el, PalaceEl):
        return _render_palace(el, theme)

    return ""


def to_html(layout: ChartLayout, theme=None) -> str:
    """將 ChartLayout 轉換為完整 HTML 字串。"""
    if theme is None:
        from ..theme import ThemeConfig
        theme = ThemeConfig()

    css = theme.to_html_css()

    body_parts = []
    for el in layout.elements:
        rendered = _render_top_level(el, theme)
        if rendered:
            body_parts.append(rendered)
    body = "\n".join(body_parts)

    return f"""\
<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>紫微斗數命盤</title>
<style>
{css}
</style>
</head>
<body>
<div class="chart-container">
{body}
</div>
</body>
</html>
"""
