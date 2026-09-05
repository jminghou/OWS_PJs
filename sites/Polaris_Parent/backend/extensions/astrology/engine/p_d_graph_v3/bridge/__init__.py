"""
p_d_graph_v3 橋接層 — 命盤編碼基礎設施（vendored 自 p_d_graph，2026-07-11）

這兩個模組是「編碼 → 命盤狀態」的基礎設施，與 v2 向量架構無關：
  chart_parser.py  — encoded_array → ChartState
  palace_stems.py  — 宮位地支環補滿／五虎遁宮干／化祿反推年干

Vendor 原因：讓 p_d_graph_v3 完全自立——將來 v2（p_d_graph/）退役時
整個資料夾可直接刪除，不會斷 v3 的腿。
兩檔僅依賴 p_a_foundation（共用編碼地基，不隨 v2 退役）。

⚠ 若 p_d_graph/bridge/ 的同名檔案修了 bug，記得同步到這裡（反之亦然）。
"""

from .chart_parser import ChartParser, ChartState
from . import palace_stems

__all__ = ["ChartParser", "ChartState", "palace_stems"]
