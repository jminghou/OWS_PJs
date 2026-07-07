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
    stem: Optional[str] = None      # 宮位天干碼 "01"~"10"（五虎遁）；舊 chart_json 無此資訊時 None
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

        # 宮位層（chart_json v2.3+）：每宮顯式 branch + stem（五虎遁宮干）。
        # 舊 chart_json 無此區塊時退回星曜推斷（stem 為 None）。
        palace_meta = chart.get("palaces") or {}
        placements = chart.get("placements", {})

        palaces: Dict[str, PalaceInfo] = {}
        # 聯集：有 palaces 區塊時空宮也建 PalaceInfo（修正空宮缺格與 branch 誤設 "01" 問題）
        for palace_code in list(placements.keys()) + [
            pc for pc in palace_meta if pc not in placements
        ]:
            stars: List[StarInfo] = []
            inferred_branch = None
            for star_code, star_data in (placements.get(palace_code, {}).get("stars") or {}).items():
                stars.append(StarInfo(
                    code=star_code,
                    branch=star_data["branch"],
                    brightness=star_data.get("brightness"),
                    sihua=star_data.get("sihua"),
                ))
                if inferred_branch is None:
                    inferred_branch = star_data["branch"]
            pmeta = palace_meta.get(palace_code) or {}
            palaces[palace_code] = PalaceInfo(
                code=palace_code,
                branch=pmeta.get("branch") or inferred_branch or "01",
                stem=pmeta.get("stem"),
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
