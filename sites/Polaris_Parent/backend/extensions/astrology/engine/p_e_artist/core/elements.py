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
    # 資料圖表用：格子/長條的顏色是逐格算出來的（色階映射），無法用 class 表達。
    # 與 class 並用時 CSS 勝出 ⇒ 呈現屬性同時是「CSS 被剝掉時」的印刷保險。
    fill_attr: str = ""         # 非空時輸出 SVG fill 呈現屬性
    stroke_attr: str = ""       # 非空時輸出 SVG stroke
    stroke_width: float = 0     # >0 時輸出 stroke-width（身宮外框：線寬跟著圖示算，class 表達不了）


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
class PathEl:
    """任意路徑（弧、貝茲）。弦圖的緞帶、桑基的流帶、環狀扇形都走這個。

    `d` 是算好的 SVG path 資料字串——不要用 f-string 手拼，
    走 `core.path.PathBuilder` 或其中的 `annular_sector()` /
    `chord_ribbon()` / `sankey_ribbon()`，座標才會自動量化。
    """
    d: str
    cls: str = ""
    fill_attr: str = ""         # 非空時輸出 SVG fill（"none" 表示不填色）
    stroke_attr: str = ""       # 非空時輸出 SVG stroke
    opacity: float = 1.0        # <1 時輸出 fill-opacity（緞帶重疊需要）
    title: str = ""             # 非空時輸出 <title>（滑鼠停留的原生提示）


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
    ink: str = ""        # 單色圖示的上色（空＝沿用渲染時傳入的預設 ink）
    stroke_scale: float = 1.0   # 圖示內線寬倍率（副星縮小後補回線條粗細；1＝原稿）


@dataclass
class GroupEl:
    """元素群組。"""
    children: List = field(default_factory=list)
    cls: str = ""
    # 語意鍵（如 "命宮|左右"）。writer 不畫它；json_writer 照原樣輸出，
    # 讓前端能把互動（hover/點選）掛回原始資料，而不必自己重算幾何。
    key: str = ""


@dataclass
class PalaceStarItem:
    """v2 命盤宮位內的單顆星曜（主／副／流曜）。"""
    code: str
    label: str           # 顯示字（中文名或編碼）
    href: str            # SVG 圖檔路徑
    sihua: str = ""      # FO/PW/HO/BI（空字串代表無；非疊盤模式的角標用）
    ink: str = ""        # 圖示上色（流曜帶層色；空＝預設 star_ink）
    badges: List = field(default_factory=list)  # 疊盤模式：[(四化碼, ink)]，本命在前各層在後
    scale: float = 1.0   # 圖示縮放（小星曜/流曜=small_star_scale；1.0=一般副星）


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
    branch_label: str        # 地支（宮格右下角）："08" 或「未」
    stem_label: str = ""     # 宮干（宮格左下角）："J" 或「癸」；無宮干時為空
    # 宮位圖示（assets/palace/{code}.svg）；空＝無圖檔，writer 退回文字宮名。
    # 用圖示還是文字由主題 layout.palace_name_style 決定，composer 兩者都備好。
    name_icon: str = ""
    name_icon_ink: str = ""  # 宮名圖示顏色（空＝用主題 palace_name；疊盤本命層＝紅）
    is_body: bool = False    # 身宮落在此宮（圖示模式＝加外框；文字模式＝cn_name 已帶「(身)」）
    layer_icons: List = field(default_factory=list)   # [(半寬圖示 href, ink)]，與 layer_names 同序同長
    majors: List = field(default_factory=list)        # PalaceStarItem
    subs: List = field(default_factory=list)          # PalaceStarItem
    minor_labels: List = field(default_factory=list)  # str
    cls: str = ""
    # ── 疊盤（overlay）──
    overlay: bool = False                              # True 時 writer 走疊盤版面
    layer_names: List = field(default_factory=list)    # [(該層宮名, ink)]，表頭並列
    flow_items: List = field(default_factory=list)     # PalaceStarItem（各層流曜，帶層色）


# 整張圖的佈局結果
@dataclass
class ChartLayout:
    """compute_layout() 的回傳值，包含畫布尺寸 + 所有元素。"""
    canvas_w: float
    canvas_h: float
    css: str                    # ThemeConfig.to_css() 產生的共用 CSS（SVG 版）
    elements: List = field(default_factory=list)
