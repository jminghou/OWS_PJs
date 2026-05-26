"""
p01_count - 紫微斗數排盤計算模組
"""

# 使用 importlib 導入數字開頭的模組
import importlib.util
import sys
from pathlib import Path

# 動態導入 01_basic_count 模組
_module_path = Path(__file__).parent / "01_basic_count"
spec = importlib.util.spec_from_file_location(
    "p01_count._01_basic_count",
    _module_path / "__init__.py"
)
_basic_count = importlib.util.module_from_spec(spec)
sys.modules["p01_count._01_basic_count"] = _basic_count
spec.loader.exec_module(_basic_count)

# 導出主要功能
calculate_chart = _basic_count.calculate_chart
calculate_batch_charts = _basic_count.calculate_batch_charts
encode_chart_data = _basic_count.encode_chart_data
generate_chart_id = _basic_count.generate_chart_id

__all__ = [
    'calculate_chart',
    'calculate_batch_charts',
    'encode_chart_data',
    'generate_chart_id',
]
