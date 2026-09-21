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


def _render_sihua_badge(label: str, theme) -> str:
    """四化圖稿：內嵌 assets/stars/{F,P,H,I}.svg（沿用星曜圖檔置換機制）。

    圖稿本身已含底圈與字樣，故不再另繪圓圈與文字。
    """
    if not label:
        return ""
    size = theme.layout["sihua_badge_size"]
    sihua_ink = theme.colors.get("sihua_ink") or theme.colors.get("star_ink")
    href = embed_as_data_uri(f"../assets/stars/{label}.svg", sihua_ink)
    return (
        f'<img src="{escape(href)}" class="sihua-badge" '
        f'width="{size}" height="{size}" alt=""/>'
    )


_SIHUA_LABEL = {"FO": "F", "PW": "P", "HO": "H", "BI": "I"}


def _render_palace(p: PalaceEl, theme) -> str:
    sep = theme.layout.get("minor_separator", " · ")
    ink = theme.colors.get("star_ink")

    # header
    cn = escape(p.cn_name)
    en = escape(p.en_name)
    # 宮名圖示（與 SVG 同一規則：線寬對齊主星；身宮＝同粗細外框，見 theme.py .palace-icon-wrap）
    lo = theme.layout
    use_icon = bool(p.name_icon) and lo.get("palace_name_style", "icon") == "icon"
    if use_icon:
        icon_h = float(lo.get("palace_icon_height", 18))
        main = lo.get("overlay_icon_main_size", 60) if p.overlay else lo["icon_main_size"]
        stroke_px = 5.0 * main / 289.0
        href = embed_as_data_uri(p.name_icon, theme.colors.get("palace_name"),
                                 stroke_px / (4.5 * icon_h / 80.0))
        body = " is-body" if p.is_body else ""
        ph_inner = (f'<span class="palace-icon-wrap{body}">'
                    f'<img class="palace-icon" src="{escape(href)}" alt="{cn}"></span>')
    else:
        ph_inner = f'<span class="palace-name">{cn}</span>'
    if en and not use_icon:
        ph_inner += f'<span class="palace-name-en">{en}</span>'
    # 地支不在表頭裡：與 SVG 一致擺到宮格右下角（見 theme.py .branch-name）
    branch = escape(p.branch_label)
    branch_html = f'<span class="branch-name">{branch}</span>' if branch else ""
    if p.stem_label:                      # 宮干在左下角（與 SVG 一致）
        branch_html += f'<span class="stem-name">{escape(p.stem_label)}</span>'
    header = (
        f'<div class="palace-header{" ph-icon" if use_icon else ""}">'
        f'<div class="ph-left">{ph_inner}</div>'
        f'</div>'
    )

    # majors（每顆＝圖示＋隱藏文字名，供 .text-mode 一鍵切換）
    major_html = ""
    if p.majors:
        items = []
        for m in p.majors:
            href = embed_as_data_uri(m.href, ink)
            title = escape(m.label) if m.label else ""
            badge_label = _SIHUA_LABEL.get(m.sihua, "")
            wrapper_cls = "smw sbw" if badge_label else "smw"
            badge_svg = _render_sihua_badge(badge_label, theme) if badge_label else ""
            label_span = f'<span class="star-label sl-major">{title}</span>' if title else ""
            items.append(
                f'<div class="{wrapper_cls}">'
                f'<img src="{escape(href)}" class="star-major" title="{title}"/>'
                f'{label_span}'
                f'{badge_svg}'
                f'</div>'
            )
        major_html = (
            '<div class="stars-major-row">' + "".join(items) + '</div>'
        )

    # subs（同上：圖示＋隱藏文字名）
    sub_html = ""
    if p.subs:
        items = []
        for s in p.subs:
            href = embed_as_data_uri(s.href, ink)
            title = escape(s.label) if s.label else ""
            badge_label = _SIHUA_LABEL.get(s.sihua, "")
            badge_svg = _render_sihua_badge(badge_label, theme) if badge_label else ""
            label_span = f'<span class="star-label sl-sub">{title}</span>' if title else ""
            items.append(
                f'<div class="ssw{" sbw" if badge_svg else ""}">'
                f'<img src="{escape(href)}" class="star-sub" title="{title}"/>'
                f'{label_span}'
                f'{badge_svg}'
                f'</div>'
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
        f'{header}{stars_area}{branch_html}'
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


def _generic_title(layout: ChartLayout) -> str:
    """從 layout 撈標題文字（第一個 .dv-title）；沒有就用通稱。"""
    for el in layout.elements:
        if isinstance(el, TextEl) and "dv-title" in (el.cls or ""):
            return el.content
    return "圖表預覽"


def _generic_html(layout: ChartLayout, theme) -> str:
    """非命盤 layout 的通用輸出。

    刻意直接內嵌 svg_writer 的產物，而不是另寫一套 div 版面：
    這樣「螢幕上看到的」與「送印的」逐元素相同，交接文件 §8 第三條紀律
    （畫完要真的看）才驗得到真東西——兩套版面演算法就等於在檢查另一張圖。
    """
    from . import svg_writer

    title = escape(_generic_title(layout))
    plane = theme.dv_colors["plane"]
    fig = svg_writer.to_svg_fragment(layout, theme)

    return f"""\
<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title}</title>
<style>
html, body {{ margin: 0; padding: 0; background: {plane}; }}
body {{ padding: 28px 20px 56px; }}
.figure {{ max-width: 100%; overflow-x: auto; }}
.figure svg {{ display: block; max-width: 100%; height: auto; }}
</style>
</head>
<body>
<div class="figure">
{fig}
</div>
</body>
</html>
"""


def to_html(layout: ChartLayout, theme=None) -> str:
    """將 ChartLayout 轉換為完整 HTML 字串。"""
    if theme is None:
        from ..theme import ThemeConfig
        theme = ThemeConfig()

    # 命盤走 v2 flex 版面；其餘（資料圖表）走通用內嵌 SVG 路徑。
    if not any(isinstance(el, PalaceEl) for el in layout.elements):
        return _generic_html(layout, theme)

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
<div class="chart-toolbar">
  <button id="mode-toggle" type="button">文字模式</button>
</div>
<div class="chart-container">
{body}
</div>
<script>
(function () {{
  var btn = document.getElementById('mode-toggle');
  var box = document.querySelector('.chart-container');
  if (!btn || !box) return;
  btn.addEventListener('click', function () {{
    var on = box.classList.toggle('text-mode');
    btn.textContent = on ? '圖示模式' : '文字模式';
  }});
}})();
</script>
</body>
</html>
"""
