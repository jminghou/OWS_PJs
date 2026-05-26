"""
向後相容 re-export (V0.4)
實際定義已移至 p_e_artist.charts.natal.config
"""

from .charts.natal.config import (
    FOURTEEN_MAIN_STAR_CODES,
    MAJOR_STAR_CODES,
    STAR_CATEGORY_ORDER,
)

__all__ = [
    "FOURTEEN_MAIN_STAR_CODES",
    "MAJOR_STAR_CODES",
    "STAR_CATEGORY_ORDER",
]
