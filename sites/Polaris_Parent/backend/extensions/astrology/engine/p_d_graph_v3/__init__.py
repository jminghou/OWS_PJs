"""p_d_graph_v3 星場引擎（vendored 最小集）。

只保留 E 計算鏈：config / star_field / lens / engine / star_energy。
視圖層（persona / temperament）與 Markdown 產出層（report_md）未 vendor，
兩個母體基準檔亦未隨行——網站端不提供百分位定位。
"""
from .config import V3Registry, VECTOR_VERSION, ENGINE_VERSION
from .star_field import StarFieldComputer, StarFieldResult
from .lens import PalaceLens, Reading, PALACE_CODES
from .engine import StarFieldEngine, V3Result
from .names import Names
from .star_energy import build_star_energy
from .palace_readings import build_palace_readings

__all__ = [
    "V3Registry", "VECTOR_VERSION", "ENGINE_VERSION",
    "StarFieldComputer", "StarFieldResult",
    "PalaceLens", "Reading", "PALACE_CODES",
    "StarFieldEngine", "V3Result", "Names",
    "build_star_energy", "build_palace_readings",
]
