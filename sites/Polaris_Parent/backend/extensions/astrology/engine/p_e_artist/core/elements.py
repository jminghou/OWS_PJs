"""
佈局中間表示層 (V0.3)
格式無關的元素定義，由 Composer 產生，由各 Writer 消費。
每個元素攜帶絕對座標 + CSS class，不含任何格式特定標記。
"""

from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class RectEl:
    """矩形。"""
    x: float
    y: float
    w: float
    h: float
    cls: str = ""
    rx: float = 0          # 圓角半徑（0 = 直角）


@dataclass
class TextEl:
    """文字。y 座標為 SVG 基線語義（baseline）。"""
    content: str
    x: float
    y: float
    cls: str = ""
    anchor: str = "start"       # start | middle | end
    font_size: float = 13       # px，供 HTML writer 做基線→頂邊轉換
    dominant_baseline: str = "auto"  # auto | central（與 SVG 一致）
    fill_attr: str = ""         # 非空時輸出 SVG fill 呈現屬性（避免繼承成黑字）
    stroke_attr: str = ""       # 非空時輸出 SVG stroke（如 none）


@dataclass
class LineEl:
    """直線。"""
    x1: float
    y1: float
    x2: float
    y2: float
    cls: str = ""


@dataclass
class CircleEl:
    """圓形（圓心 + 半徑）。"""
    cx: float
    cy: float
    r: float
    cls: str = ""
    fill_attr: str = ""         # 非空時輸出 SVG fill（可與 class 並用）
    stroke_attr: str = ""      # 非空時輸出 SVG stroke（如 none 避免描邊）


@dataclass
class ImageEl:
    """外部圖片引用。"""
    href: str
    x: float
    y: float
    w: float
    h: float
    cls: str = ""
    title: str = ""


@dataclass
class GroupEl:
    """元素群組。"""
    children: List = field(default_factory=list)
    cls: str = ""


@dataclass
class PalaceStarItem:
    """v2 命盤宮位內的單顆星曜（主／副）。"""
    code: str
    label: str           # 顯示字（中文名或編碼）
    href: str            # SVG 圖檔路徑
    sihua: str = ""      # FO/PW/HO/BI（空字串代表無）


@dataclass
class PalaceEl:
    """
    v2 命盤宮位語意化容器。
    Writer 自行決定排版：HTML 走 flex；SVG 走計算後的絕對座標。
    """
    x: float
    y: float
    w: float
    h: float
    code: str                # 1~9 / A / B / C
    cn_name: str
    en_name: str
    branch_label: str        # 顯示用干支字（中文；有宮干「癸卯」、無宮干「卯」）
    majors: List = field(default_factory=list)        # PalaceStarItem
    subs: List = field(default_factory=list)          # PalaceStarItem
    minor_labels: List = field(default_factory=list)  # str
    cls: str = ""


# 整張圖的佈局結果
@dataclass
class ChartLayout:
    """compute_layout() 的回傳值，包含畫布尺寸 + 所有元素。"""
    canvas_w: float
    canvas_h: float
    css: str                    # ThemeConfig.to_css() 產生的共用 CSS（SVG 版）
    elements: List = field(default_factory=list)
