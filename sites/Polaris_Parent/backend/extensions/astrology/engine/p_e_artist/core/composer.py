"""
向後相容 re-export (V0.4)
實際定義已移至 p_e_artist.charts.natal.composer
"""

from ..charts.natal.composer import NatalComposer

# 保留舊名稱
ChartComposer = NatalComposer

__all__ = ["ChartComposer", "NatalComposer"]
