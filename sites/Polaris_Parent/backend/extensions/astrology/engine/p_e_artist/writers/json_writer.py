"""
JSON Writer (V0.5)
將 ChartLayout 序列化為前端可直接消費的佈局規格。

## 為什麼有這支 writer

交接文件 §7 記到的那次漂移，發生在 **composer 層**：弦圖的 arcPath／ribbonPath
被逐行搬進 React 重寫一遍，然後兩份實作各自演化（座標量化只補在其中一份）。
只要幾何算兩次，遲早會算出兩個答案。

所以前端不重算幾何，改吃這支 writer 的輸出——React 只做上色與互動，
`compose()` 仍是唯一的幾何與數值真源。等於同時拿到「後端產成品」（SVG 走
印刷／InDesign）與「規格由各端渲染」（JSON 走網頁）兩條路的好處。

## 契約

    {
      "canvas":   {"w": float, "h": float},
      "css":      str,                    # SVG 版 class 定義，前端可忽略
      "elements": [Element, ...]
    }

Element 一律帶 "type"；座標皆為絕對值、與 SVG 同一座標系（左上原點、y 向下）。
`key` 是語意鍵（如 "命宮|左右"），前端用它把互動掛回原始讀數資料。
"""

import json

from ..core.elements import (
    ChartLayout, RectEl, TextEl, LineEl, CircleEl, ImageEl, GroupEl, PathEl,
    PalaceEl,
)


def _el(el) -> dict:
    if isinstance(el, RectEl):
        d = {"type": "rect", "x": el.x, "y": el.y, "w": el.w, "h": el.h}
        if el.rx:
            d["rx"] = el.rx
        _paint(d, el.cls, el.fill_attr, el.stroke_attr)
        return d

    if isinstance(el, TextEl):
        d = {"type": "text", "content": el.content, "x": el.x, "y": el.y,
             "fontSize": el.font_size}
        if el.anchor != "start":
            d["anchor"] = el.anchor
        if el.dominant_baseline != "auto":
            d["baseline"] = el.dominant_baseline
        _paint(d, el.cls, el.fill_attr, el.stroke_attr)
        return d

    if isinstance(el, LineEl):
        d = {"type": "line", "x1": el.x1, "y1": el.y1,
             "x2": el.x2, "y2": el.y2}
        _paint(d, el.cls, "", "")
        return d

    if isinstance(el, PathEl):
        # d 是算好的路徑字串：前端直接放進 <path d>，沒有算錯的餘地。
        d = {"type": "path", "d": el.d}
        if el.opacity < 1:
            d["opacity"] = el.opacity
        if el.title:
            d["title"] = el.title
        _paint(d, el.cls, el.fill_attr, el.stroke_attr)
        return d

    if isinstance(el, CircleEl):
        d = {"type": "circle", "cx": el.cx, "cy": el.cy, "r": el.r}
        _paint(d, el.cls, el.fill_attr, el.stroke_attr)
        return d

    if isinstance(el, ImageEl):
        d = {"type": "image", "href": el.href, "x": el.x, "y": el.y,
             "w": el.w, "h": el.h}
        if el.title:
            d["title"] = el.title
        if el.ink:
            d["ink"] = el.ink
        _paint(d, el.cls, "", "")
        return d

    if isinstance(el, GroupEl):
        d = {"type": "group", "children": [_el(c) for c in el.children]}
        if el.key:
            d["key"] = el.key
        _paint(d, el.cls, "", "")
        return d

    if isinstance(el, PalaceEl):
        # PalaceEl 是「語意容器」而非幾何——星曜區的實際版面是在 writer 裡
        # 算的（svg_writer._star_area）。把它原樣丟給前端，等於要前端再實作
        # 一次那套版面演算法，正是本 writer 要避免的那類重複。
        raise TypeError(
            "PalaceEl 無法序列化為佈局規格：它的版面由 writer 決定，"
            "序列化會逼前端重算一次版面。命盤請走 to_svg()／to_html()。")

    raise TypeError(f"json_writer 不支援的元素型別：{type(el).__name__}")


def _paint(d: dict, cls: str, fill: str, stroke: str) -> None:
    if cls:
        d["cls"] = cls
    if fill:
        d["fill"] = fill
    if stroke:
        d["stroke"] = stroke


def to_dict(layout: ChartLayout, theme=None) -> dict:
    """ChartLayout → 佈局規格 dict。"""
    return {
        "canvas": {"w": layout.canvas_w, "h": layout.canvas_h},
        "css": layout.css,
        "elements": [_el(el) for el in layout.elements],
    }


def to_json(layout: ChartLayout, theme=None, indent=None) -> str:
    """ChartLayout → JSON 字串。"""
    return json.dumps(to_dict(layout, theme), ensure_ascii=False,
                      indent=indent,
                      separators=None if indent else (",", ":"))
