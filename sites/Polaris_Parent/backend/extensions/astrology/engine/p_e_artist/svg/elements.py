"""
SVG 元素工廠 (V0.2)
所有視覺屬性透過 CSS class 控制，元素只攜帶座標與 class。
"""

from xml.sax.saxutils import escape
from typing import Optional


class SvgElements:
    """低階 SVG 元素建構器 — CSS-class 優先。"""

    @staticmethod
    def rect(
        x: float, y: float, w: float, h: float,
        cls: str = "",
        fill: str = "", stroke: str = "",
        stroke_width: float = 0, rx: float = 0,
    ) -> str:
        parts = [f'<rect x="{x}" y="{y}" width="{w}" height="{h}"']
        if cls:
            parts.append(f' class="{cls}"')
        if fill:
            parts.append(f' fill="{fill}"')
        if stroke:
            parts.append(f' stroke="{stroke}"')
            if stroke_width:
                parts.append(f' stroke-width="{stroke_width}"')
        if rx > 0:
            parts.append(f' rx="{rx}"')
        parts.append('/>')
        return ''.join(parts)

    @staticmethod
    def text(
        content: str, x: float, y: float,
        cls: str = "",
        anchor: str = "start",
        dominant_baseline: str = "auto",
    ) -> str:
        safe = escape(content)
        parts = [f'<text x="{x}" y="{y}"']
        if cls:
            parts.append(f' class="{cls}"')
        if anchor != "start":
            parts.append(f' text-anchor="{anchor}"')
        if dominant_baseline != "auto":
            parts.append(f' dominant-baseline="{dominant_baseline}"')
        parts.append(f'>{safe}</text>')
        return ''.join(parts)

    @staticmethod
    def line(
        x1: float, y1: float, x2: float, y2: float,
        cls: str = "",
    ) -> str:
        c = f' class="{cls}"' if cls else ''
        return f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}"{c}/>'

    @staticmethod
    def image(
        href: str, x: float, y: float, w: float, h: float,
        cls: str = "", title: str = "",
    ) -> str:
        safe_href = escape(href)
        parts = [f'<image href="{safe_href}" x="{x}" y="{y}" width="{w}" height="{h}"']
        if cls:
            parts.append(f' class="{cls}"')
        if title:
            parts.append(f'><title>{escape(title)}</title></image>')
        else:
            parts.append('/>')
        return ''.join(parts)

    @staticmethod
    def group(*children: str, cls: str = "", transform: str = "") -> str:
        attrs = ""
        if cls:
            attrs += f' class="{cls}"'
        if transform:
            attrs += f' transform="{transform}"'
        inner = "\n  ".join(c for c in children if c)
        return f"<g{attrs}>\n  {inner}\n</g>"

    # EXTENSION POINT: path() — 四化貝茲曲線軌跡
    # EXTENSION POINT: style() — 額外嵌入式 CSS
