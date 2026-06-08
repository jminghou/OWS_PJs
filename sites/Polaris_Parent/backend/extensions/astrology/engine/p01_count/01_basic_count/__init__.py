"""
紫微斗數排盤計算模組（01_basic_count）
從 P_Count_v6 移植，提供純函數調用介面（無 UI、無資料庫操作）

主要功能：
- 本命盤計算
- 流年流月計算（大限、小限、流年）
- 編碼轉換（機器學習格式）

使用範例：
    >>> from p01_count.c01_basic_count import calculate_chart
    >>>
    >>> chart = calculate_chart(
    ...     birth_date=(1987, 11, 17, 14, 30),
    ...     gender="男",
    ...     name="張三"
    ... )
    >>>
    >>> print(chart['chart_id'])
    >>> print(chart['宮位資料']['命宮']['主星'])
"""

from .core.chart_calculator import calculate_chart, calculate_batch_charts
from .core.encoder import encode_chart_data
from .core.encoder_flow import (
    generate_decade_encoding_data,
    generate_small_limit_encoding_data,
    generate_year_flow_encoding_data
)
from .core.id_generator import generate_chart_id, compute_lookup_user_id

__version__ = "1.0.0"
__all__ = [
    # 核心計算
    'calculate_chart',                      # 單一命盤計算
    'calculate_batch_charts',               # 批次命盤計算

    # 編碼轉換
    'encode_chart_data',                    # 本命盤編碼
    'generate_decade_encoding_data',        # 大限編碼
    'generate_small_limit_encoding_data',   # 小限編碼
    'generate_year_flow_encoding_data',     # 流年編碼

    # ID 管理
    'generate_chart_id',                    # 生成命盤 ID
    'compute_lookup_user_id',               # 計算跨批次人物 lookup user_id（無性別）
]
