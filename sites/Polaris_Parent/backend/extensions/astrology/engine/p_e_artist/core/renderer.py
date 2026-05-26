"""
向後相容 (V0.4)
V0.2 的 ChartRenderer 已被 V0.3+ 的 Composer + Writer 架構取代。
保留此模組僅為避免已有的 import 路徑出錯。

若需要直接 SVG 渲染，請改用:
    Chart("natal", data).compute_layout().to_svg()
"""

import warnings as _warnings

_warnings.warn(
    "p_e_artist.core.renderer 已棄用，請改用 Chart('natal', data).compute_layout().to_svg()",
    DeprecationWarning,
    stacklevel=2,
)
