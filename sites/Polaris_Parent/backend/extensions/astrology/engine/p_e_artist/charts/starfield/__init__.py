"""
p_e_artist.charts.starfield — v3 星場讀數圖表族
================================================

一次 `analyze()` 的產物可餵完整族系，故共用同一個資料層 `StarfieldData`：

    A1a  輔星流量熱力圖    AuxHeatmapComposer       ← 已實作
    A1b  主星流量熱力圖    MajorHeatmapComposer     ← 已實作
    A2   宮位取樣弦圖      PalaceChordComposer      ← 已實作
    A3a  星曜 E 排序橫條   StarRankComposer         ← 已實作
    A3b  E 組成瀑布        StarWaterfallComposer    ← 已實作
    A4   四化桑基對照      SihuaSankeyComposer      ← 已實作

三個資料層，對應兩種 payload：

    StarfieldData    ← `palace_readings.build_palace_readings()`   A1／A2
    SihuaData        ← 同上（同一份 payload 的四化雙量切面）        A4
    StarEnergyData   ← `star_energy.build_star_energy()`           A3
"""

from .data import ConservationError, StarfieldData
from .sihua_data import SihuaData
from .star_data import StarEnergyData
from .flow_heatmap import (
    AuxHeatmapComposer, FlowHeatmapComposer, MajorHeatmapComposer,
)
from .palace_chord import PalaceChordComposer
from .sihua_sankey import SihuaSankeyComposer
from .star_rank import StarRankComposer
from .star_waterfall import StarWaterfallComposer

__all__ = [
    "StarfieldData", "SihuaData", "StarEnergyData", "ConservationError",
    "FlowHeatmapComposer", "AuxHeatmapComposer", "MajorHeatmapComposer",
    "PalaceChordComposer", "SihuaSankeyComposer",
    "StarRankComposer", "StarWaterfallComposer",
]
