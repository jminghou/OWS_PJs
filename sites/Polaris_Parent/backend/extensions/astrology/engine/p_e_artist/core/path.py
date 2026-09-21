"""
路徑建構 (V0.5)
===============

弦圖的弧與緞帶、桑基的流帶，都是任意貝茲／弧線 —— 現有的 Rect/Line/Circle
畫不出來。這裡提供組路徑的工具，產物餵給 `PathEl`。

## 為什麼 `PathEl` 存的是字串而不是結構化指令

看起來把路徑拆成 `[("M", x, y), ("A", ...)]` 更「格式無關」，但那會讓前端
必須把指令**重新組回**路徑 —— 又多一份可以組錯的實作。SVG path 語法本來就是
跨渲染器的通用格式（SVG、Canvas 的 `Path2D`、Illustrator／InDesign 都直接吃），
存成算好的字串，前端就沒有算錯的餘地。這正是本專案「幾何只算一次」的延伸。

代價是 composer 不該自己用 f-string 拼 `d`（拼錯不會報錯，只會畫歪），
所以一律走 `PathBuilder`：座標自動量化，指令自動接續。

## 座標量化

所有座標經過 `round(v, 2)`。這不是為了好看：ECMAScript 不要求 `Math.sin/cos`
正確捨入，Node 與瀏覽器的 V8 可能差最後一個 ULP，SSR 時會造成 React
hydration mismatch（交接文件 §7 踩過）。量化讓同一組輸入在任何 runtime
都得到逐字元相同的路徑。
"""

import math

# 預設量化位數。2 位在半徑數百 px 的圖上遠低於一個像素，肉眼不可辨。
NDIGITS = 2


def q(v: float, ndigits: int = NDIGITS) -> float:
    """座標量化。`+ 0.0` 是為了把 -0.0 正規化成 0.0（否則路徑字串會出現 -0）。"""
    return round(float(v), ndigits) + 0.0


def polar(angle: float, radius: float,
          cx: float = 0.0, cy: float = 0.0,
          ndigits: int = NDIGITS) -> tuple:
    """極座標 → 直角座標（已量化）。

    角度慣例：**0 = 正上方（12 點鐘），順時針為正**——與弦圖原型一致。
    刻意不用數學慣例（0 = 正右方、逆時針），因為 A2 是原型的移植，
    換慣例等於在移植時再引入一類錯。

        polar(0, 10)          → (0.0, -10.0)   正上
        polar(math.pi/2, 10)  → (10.0, 0.0)    正右
    """
    return (q(cx + radius * math.sin(angle), ndigits),
            q(cy - radius * math.cos(angle), ndigits))


def _n(v: float, ndigits: int) -> str:
    """數字轉字串：去掉沒有意義的尾隨零，讓路徑字串短且穩定。"""
    v = q(v, ndigits)
    s = f"{v:.{ndigits}f}".rstrip("0").rstrip(".")
    return s or "0"


class PathBuilder:
    """組 SVG path 資料。所有座標自動量化。

        p = PathBuilder()
        p.move_to(*polar(a0, r))
        p.arc_to(r, r, *polar(a1, r), sweep=True)
        p.quad_to(0, 0, *polar(b0, r))
        p.close()
        PathEl(p.d(), cls="chord-ribbon", fill_attr=color)
    """

    def __init__(self, ndigits: int = NDIGITS):
        self._parts: list = []
        self._nd = ndigits

    # ── 指令 ─────────────────────────────────────────

    def move_to(self, x: float, y: float) -> "PathBuilder":
        self._parts.append(f"M{self._p(x, y)}")
        return self

    def line_to(self, x: float, y: float) -> "PathBuilder":
        self._parts.append(f"L{self._p(x, y)}")
        return self

    def quad_to(self, cx: float, cy: float, x: float, y: float) -> "PathBuilder":
        """二次貝茲（一個控制點）。弦圖的緞帶用它往圓心收束。"""
        self._parts.append(f"Q{self._p(cx, cy)} {self._p(x, y)}")
        return self

    def cubic_to(self, c1x: float, c1y: float, c2x: float, c2y: float,
                 x: float, y: float) -> "PathBuilder":
        """三次貝茲（兩個控制點）。桑基的水平流帶用它。"""
        self._parts.append(
            f"C{self._p(c1x, c1y)} {self._p(c2x, c2y)} {self._p(x, y)}")
        return self

    def arc_to(self, rx: float, ry: float, x: float, y: float,
               large_arc: bool = False, sweep: bool = True,
               rotation: float = 0) -> "PathBuilder":
        """橢圓弧到 (x, y)。

        large_arc：走大於 180° 的那一段
        sweep：True＝順時針（正角方向）
        """
        self._parts.append(
            f"A{_n(rx, self._nd)},{_n(ry, self._nd)} {_n(rotation, self._nd)} "
            f"{int(bool(large_arc))},{int(bool(sweep))} {self._p(x, y)}")
        return self

    def close(self) -> "PathBuilder":
        self._parts.append("Z")
        return self

    # ── 產出 ─────────────────────────────────────────

    def d(self) -> str:
        return "".join(self._parts)

    def is_empty(self) -> bool:
        return not self._parts

    def __len__(self) -> int:
        return len(self._parts)

    def _p(self, x: float, y: float) -> str:
        return f"{_n(x, self._nd)},{_n(y, self._nd)}"


def annular_sector(a0: float, a1: float, r_inner: float, r_outer: float,
                   cx: float = 0.0, cy: float = 0.0,
                   ndigits: int = NDIGITS) -> str:
    """環狀扇形（弦圖的弧環段、甜甜圈圖的一片）。

    角度慣例同 `polar()`；a1 > a0。
    """
    large = (a1 - a0) > math.pi
    p = PathBuilder(ndigits)
    p.move_to(*polar(a0, r_outer, cx, cy, ndigits))
    p.arc_to(r_outer, r_outer, *polar(a1, r_outer, cx, cy, ndigits),
             large_arc=large, sweep=True)
    p.line_to(*polar(a1, r_inner, cx, cy, ndigits))
    p.arc_to(r_inner, r_inner, *polar(a0, r_inner, cx, cy, ndigits),
             large_arc=large, sweep=False)
    p.close()
    return p.d()


def chord_ribbon(a0: float, a1: float, b0: float, b1: float, radius: float,
                 cx: float = 0.0, cy: float = 0.0,
                 ndigits: int = NDIGITS) -> str:
    """弦圖緞帶：連接圓周上兩段弧 [a0,a1] 與 [b0,b1]，中央往圓心收束。

    收束用二次貝茲、控制點設在圓心 —— 與弦圖原型同一個做法。
    """
    la = (a1 - a0) > math.pi
    lb = (b1 - b0) > math.pi
    pa0 = polar(a0, radius, cx, cy, ndigits)
    p = PathBuilder(ndigits)
    p.move_to(*pa0)
    p.arc_to(radius, radius, *polar(a1, radius, cx, cy, ndigits),
             large_arc=la, sweep=True)
    p.quad_to(cx, cy, *polar(b0, radius, cx, cy, ndigits))
    p.arc_to(radius, radius, *polar(b1, radius, cx, cy, ndigits),
             large_arc=lb, sweep=True)
    p.quad_to(cx, cy, *pa0)
    p.close()
    return p.d()


def sankey_ribbon(x0: float, y0: float, x1: float, y1: float,
                  thickness0: float, thickness1: float,
                  curvature: float = 0.5,
                  ndigits: int = NDIGITS) -> str:
    """桑基流帶：從 (x0, y0) 起、到 (x1, y1) 止的水平流帶。

    y 為流帶**上緣**；厚度往下長（與 SVG 座標系一致）。
    curvature 0＝直線梯形，0.5＝控制點落在兩端中點（慣用值）。
    """
    cx0 = x0 + (x1 - x0) * curvature
    cx1 = x1 - (x1 - x0) * curvature
    p = PathBuilder(ndigits)
    p.move_to(x0, y0)
    p.cubic_to(cx0, y0, cx1, y1, x1, y1)
    p.line_to(x1, y1 + thickness1)
    p.cubic_to(cx1, y1 + thickness1, cx0, y0 + thickness0, x0, y0 + thickness0)
    p.close()
    return p.d()
