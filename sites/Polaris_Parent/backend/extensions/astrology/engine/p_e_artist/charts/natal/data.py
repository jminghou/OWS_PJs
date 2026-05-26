"""
命盤資料模型
將 JSON chart 資料解析為型別明確的 dataclass。
本模組不含任何渲染或佈局邏輯。
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional


@dataclass
class StarInfo:
    """單顆星曜的基礎資訊。"""
    code: str                       # 星曜編碼，例 "POL", "HPI"
    branch: str                     # 所在地支碼，例 "08"
    brightness: Optional[str]       # 亮度碼：P3/P2/P1/P0/N1/N2/N3 或 None
    sihua: Optional[str]            # 四化碼：FO/PW/HO/BI 或 None


@dataclass
class PalaceInfo:
    """一個宮位的完整資訊。"""
    code: str                       # 宮位碼："1"~"9", "A", "B", "C"
    branch: str                     # 該宮所落地支碼
    stars: List[StarInfo] = field(default_factory=list)


@dataclass
class SihuaEntry:
    """四化摘要中的一筆記錄。"""
    sihua_code: str                 # FO / PW / HO / BI
    star_code: str                  # 觸發星曜碼
    palace_code: str                # 落入宮位碼


@dataclass
class ChartData:
    """命盤完整資料，由 JSON 解析而來。"""
    gender_code: str                # GF / GM
    body_palace: str                # 身宮所在宮位碼
    life_master: str                # 命主星碼
    body_master: str                # 身主星碼
    palaces: Dict[str, PalaceInfo] = field(default_factory=dict)
    sihua_summary: List[SihuaEntry] = field(default_factory=list)
    chart_id: str = ""              # 命盤 ID（通常來自 meta.chart_id）

    @classmethod
    def from_dict(cls, data: dict) -> "ChartData":
        """
        解析 JSON dict。接受完整輸出（含 meta/vector）或僅 chart 區塊。
        """
        meta = data.get("meta") or {}
        chart_id = str(meta.get("chart_id") or data.get("chart_id") or "").strip()
        chart = data.get("chart", data)

        palaces: Dict[str, PalaceInfo] = {}
        for palace_code, palace_data in chart.get("placements", {}).items():
            stars: List[StarInfo] = []
            branch = None
            for star_code, star_data in palace_data.get("stars", {}).items():
                stars.append(StarInfo(
                    code=star_code,
                    branch=star_data["branch"],
                    brightness=star_data.get("brightness"),
                    sihua=star_data.get("sihua"),
                ))
                if branch is None:
                    branch = star_data["branch"]
            palaces[palace_code] = PalaceInfo(
                code=palace_code,
                branch=branch or "01",
                stars=stars,
            )

        sihua_list: List[SihuaEntry] = []
        for sihua_code, entry in chart.get("sihua_summary", {}).items():
            sihua_list.append(SihuaEntry(
                sihua_code=sihua_code,
                star_code=entry["star"],
                palace_code=entry["palace"],
            ))

        return cls(
            gender_code=chart.get("gender_code", ""),
            body_palace=chart.get("body_palace", ""),
            life_master=chart.get("life_master", ""),
            body_master=chart.get("body_master", ""),
            palaces=palaces,
            sihua_summary=sihua_list,
            chart_id=chart_id,
        )
