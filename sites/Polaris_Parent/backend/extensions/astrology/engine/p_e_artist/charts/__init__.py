"""
p_e_artist.charts — 圖表類型註冊表 (V0.5)

每種圖表類型提供:
  - data_class:    資料模型類（有 from_dict() 類方法）
  - composer_class: Composer 類（繼承 BaseComposer，有 compose() 方法）
  - family:        資料族（吃哪一種 payload）——**不同族不可互換**

family 存在的理由：呼叫端常把 `list_chart_types()` 直接做成下拉選單，
若不分族，使用者會在「命盤繪圖」節點選到吃 v3 讀數的圖表，一選就爆。
列表時請指定 family（例 `list_chart_types("natal")`）。

用法:
    from p_e_artist.charts import get_chart_type
    info = get_chart_type("natal")
    data = info["data_class"].from_dict(raw_dict)
    composer = info["composer_class"](data, theme, lang="zh")
    layout = composer.compose()
"""

from typing import Dict, Any, List, Optional

# 資料族
FAMILY_NATAL = "natal"           # 吃 chart dict（命盤事實）
FAMILY_STARFIELD = "starfield"   # 吃 p_d_graph_v3 的讀數 payload

# 延遲載入，避免循環引入
_REGISTRY: Dict[str, Dict[str, Any]] = {}


def _single_panel(base, panel: str):
    """把 panel 綁死的薄子類。

    註冊表只存 composer_class、不存預設參數，所以「同一支 composer 的不同
    固定設定」要靠子類表達。呼叫端仍可傳 panel 覆寫（沒人會這麼做，但不擋）。
    """
    return type(
        f"{base.__name__}_{panel}", (base,),
        {"__init__": lambda self, data, theme, panel=panel, **kw:
            base.__init__(self, data, theme, panel=panel, **kw),
         "__doc__": f"{base.__doc__ or ''}（固定 panel={panel}）"},
    )


def _ensure_registry():
    if _REGISTRY:
        return
    # 命盤圖
    from .natal.data import ChartData as NatalData
    from .natal.composer import NatalComposer
    _REGISTRY["natal"] = {
        "data_class": NatalData,
        "composer_class": NatalComposer,
        "family": FAMILY_NATAL,
        "label": "本命盤",
    }
    # v3 星場讀數圖表族。兩種 payload：
    #   StarfieldData  ← palace_readings（A1／A2）
    #   StarEnergyData ← star_energy（A3）
    from .starfield.data import StarfieldData
    from .starfield.sihua_data import SihuaData
    from .starfield.star_data import StarEnergyData
    from .starfield.flow_heatmap import (
        AuxHeatmapComposer, MajorHeatmapComposer,
    )
    from .starfield.palace_chord import PalaceChordComposer
    from .starfield.sihua_sankey import SihuaSankeyComposer
    from .starfield.star_rank import StarRankComposer
    from .starfield.star_waterfall import StarWaterfallComposer
    _REGISTRY["starfield_aux_heatmap"] = {
        "data_class": StarfieldData,
        "composer_class": AuxHeatmapComposer,
        "family": FAMILY_STARFIELD,
        "label": "輔星流量熱力圖",
    }
    _REGISTRY["starfield_major_heatmap"] = {
        "data_class": StarfieldData,
        "composer_class": MajorHeatmapComposer,
        "family": FAMILY_STARFIELD,
        "label": "主星流量熱力圖",
    }
    _REGISTRY["starfield_palace_chord"] = {
        "data_class": StarfieldData,
        "composer_class": PalaceChordComposer,
        "family": FAMILY_STARFIELD,
        "label": "宮位取樣弦圖",
    }
    _REGISTRY["starfield_star_rank"] = {
        "data_class": StarEnergyData,
        "composer_class": StarRankComposer,
        "family": FAMILY_STARFIELD,
        "label": "星曜能量排序",
    }
    _REGISTRY["starfield_star_waterfall"] = {
        "data_class": StarEnergyData,
        "composer_class": StarWaterfallComposer,
        "family": FAMILY_STARFIELD,
        "label": "E 組成瀑布",
    }
    _REGISTRY["starfield_sihua_sankey"] = {
        "data_class": SihuaData,
        "composer_class": SihuaSankeyComposer,
        "family": FAMILY_STARFIELD,
        "label": "四化通道／場強對照",
    }
    # 單面版（各自成頁）。composer 同一支，靠 panel 參數切；
    # 註冊成獨立類型是為了讓產線的圖表代碼與配對鑰匙分得開。
    _REGISTRY["starfield_sihua_channel"] = {
        "data_class": SihuaData,
        "composer_class": _single_panel(SihuaSankeyComposer, "channel"),
        "family": FAMILY_STARFIELD,
        "label": "四化通道值",
    }
    _REGISTRY["starfield_sihua_field"] = {
        "data_class": SihuaData,
        "composer_class": _single_panel(SihuaSankeyComposer, "field"),
        "family": FAMILY_STARFIELD,
        "label": "四化場強",
    }


def get_chart_type(chart_type: str) -> Dict[str, Any]:
    """取得指定圖表類型的 data_class 與 composer_class。"""
    _ensure_registry()
    if chart_type not in _REGISTRY:
        available = ", ".join(_REGISTRY.keys())
        raise ValueError(f"未知的圖表類型: '{chart_type}'。可用: {available}")
    return _REGISTRY[chart_type]


def list_chart_types(family: Optional[str] = None) -> List[str]:
    """列出已註冊的圖表類型；給 family 就只列該族。

    ⚠️ 做成使用者下拉時**務必指定 family** —— 不同族吃的 payload 不同，
    混在一起會讓使用者選到節點餵不了的類型。
    """
    _ensure_registry()
    if family is None:
        return list(_REGISTRY.keys())
    return [k for k, v in _REGISTRY.items() if v.get("family") == family]


def chart_type_label(chart_type: str) -> str:
    """顯示名（下拉的 enumLabels 用）。"""
    _ensure_registry()
    return (_REGISTRY.get(chart_type) or {}).get("label") or chart_type
