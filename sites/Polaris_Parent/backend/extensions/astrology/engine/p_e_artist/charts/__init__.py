"""
p_e_artist.charts — 圖表類型註冊表 (V0.4)

每種圖表類型提供:
  - data_class:    資料模型類（有 from_dict() 類方法）
  - composer_class: Composer 類（繼承 BaseComposer，有 compose() 方法）

用法:
    from p_e_artist.charts import get_chart_type
    info = get_chart_type("natal")
    data = info["data_class"].from_dict(raw_dict)
    composer = info["composer_class"](data, theme, lang="zh")
    layout = composer.compose()
"""

from typing import Dict, Any

# 延遲載入，避免循環引入
_REGISTRY: Dict[str, Dict[str, Any]] = {}


def _ensure_registry():
    if _REGISTRY:
        return
    # 命盤圖
    from .natal.data import ChartData as NatalData
    from .natal.composer import NatalComposer
    _REGISTRY["natal"] = {
        "data_class": NatalData,
        "composer_class": NatalComposer,
    }


def get_chart_type(chart_type: str) -> Dict[str, Any]:
    """取得指定圖表類型的 data_class 與 composer_class。"""
    _ensure_registry()
    if chart_type not in _REGISTRY:
        available = ", ".join(_REGISTRY.keys())
        raise ValueError(f"未知的圖表類型: '{chart_type}'。可用: {available}")
    return _REGISTRY[chart_type]


def list_chart_types() -> list:
    """列出所有已註冊的圖表類型。"""
    _ensure_registry()
    return list(_REGISTRY.keys())
