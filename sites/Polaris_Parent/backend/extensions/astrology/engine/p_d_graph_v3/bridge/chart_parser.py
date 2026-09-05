"""
命盤解碼器
Chart Parser Bridge

將 encoded_array（一組編碼字串）解碼為結構化的 ChartState，
作為知識圖譜建構的輸入。

encoded_array 範例:
  ["GF", "Q5", "LPOL", "MAAC", "1POL03", "1TRE03", "1POLPW", "IPOLP3", ...]

依賴：
  p_a_foundation — SpecialCodeDecoder, ZiweiMapping
"""

import sys
from pathlib import Path
from dataclasses import dataclass, field
from typing import Optional, List

# 確保 p_a_foundation 可被導入
_union_root = Path(__file__).parent.parent.parent
if str(_union_root) not in sys.path:
    sys.path.insert(0, str(_union_root))

from p_a_foundation.core.special_decoder import SpecialCodeDecoder
from p_a_foundation.core.mapping import get_mapping

from .palace_stems import derive_year_stem_code_from_transforms


# 四化代碼集合
_SIHUA_CODES = {"FO", "PW", "HO", "BI"}


@dataclass
class StarPlacement:
    """星曜配置：一顆星落在某宮某支"""
    star_code: str          # e.g. "POL"
    palace_code: str        # e.g. "1"
    branch_code: str = ""   # e.g. "03", 可為空


@dataclass
class StarTransform:
    """星曜四化：一顆星在某宮化為某四化"""
    star_code: str          # e.g. "POL"
    palace_code: str        # e.g. "1"
    sihua_code: str         # e.g. "PW"
    layer: str = "natal"    # natal（生年四化）/ decade / year / small（運限四化）


@dataclass
class ChartState:
    """
    命盤狀態：解碼後的結構化表示

    由 ChartParser.parse() 產生，為 GraphBuilder 的輸入。
    """
    gender: str = ""                                    # "male" or "female"
    body_palace: str = ""                               # 身宮宮位 e.g. "5"
    life_master: str = ""                               # 命主星曜 e.g. "POL"
    body_master: str = ""                               # 身主星曜 e.g. "AAC"
    year_stem: str = ""                                 # 年干代碼 e.g. "04"（丁），Y token 或化祿反推
    year_branch: str = ""                               # 年支代碼 e.g. "04"（卯），僅 Y token 提供
    placements: List[StarPlacement] = field(default_factory=list)
    transforms: List[StarTransform] = field(default_factory=list)
    brightness: dict = field(default_factory=dict)      # {star_code: brightness_code}

    # 衍生的便利索引（由 _build_indices 填充）
    _palace_stars: dict = field(default_factory=dict, repr=False)
    _star_palace: dict = field(default_factory=dict, repr=False)
    _star_branch: dict = field(default_factory=dict, repr=False)

    def _build_indices(self):
        """從 placements 建立便利索引"""
        self._palace_stars.clear()
        self._star_palace.clear()
        self._star_branch.clear()

        seen_placements = set()
        for p in self.placements:
            key = (p.star_code, p.palace_code, p.branch_code or "")
            if key in seen_placements:
                # 避免資料重複時同星同宮被重複計數（例如 PPO 重複）
                continue
            seen_placements.add(key)

            self._palace_stars.setdefault(p.palace_code, []).append(p.star_code)
            self._star_palace[p.star_code] = p.palace_code
            if p.branch_code:
                self._star_branch[p.star_code] = p.branch_code

    def get_stars_in_palace(self, palace_code: str) -> list:
        """取得某宮位的所有星曜"""
        return self._palace_stars.get(palace_code, [])

    def get_palace_of_star(self, star_code: str) -> Optional[str]:
        """取得某星曜所在的宮位"""
        return self._star_palace.get(star_code)

    def get_branch_of_star(self, star_code: str) -> Optional[str]:
        """取得某星曜所在的地支"""
        return self._star_branch.get(star_code)

    def get_brightness(self, star_code: str) -> str:
        """取得某星曜的亮度編碼，預設 P0"""
        return self.brightness.get(star_code, "P0")

    def get_co_residents(self, star_code: str) -> list:
        """取得與某星曜同宮的其他星曜"""
        palace = self._star_palace.get(star_code)
        if not palace:
            return []
        return [s for s in self._palace_stars.get(palace, []) if s != star_code]

    @property
    def occupied_palaces(self) -> list:
        """有星曜的宮位列表"""
        return list(self._palace_stars.keys())

    def summary(self) -> dict:
        """返回命盤摘要"""
        return {
            "gender": self.gender,
            "body_palace": self.body_palace,
            "life_master": self.life_master,
            "body_master": self.body_master,
            "total_placements": len(self.placements),
            "total_transforms": len(self.transforms),
            "brightness_count": len(self.brightness),
            "occupied_palaces": len(self._palace_stars),
        }


class ChartParser:
    """
    命盤解碼器

    將 encoded_array 解碼為 ChartState。

    用法:
        parser = ChartParser()
        chart = parser.parse(["GF", "Q5", "LPOL", "MAAC", "1POL03", "IPOLP3"])
    """

    def __init__(self):
        self._special = SpecialCodeDecoder()
        self._mapping = get_mapping()

    def parse(self, encoded_array: list) -> ChartState:
        """
        解析命盤編碼陣列

        Args:
            encoded_array: 編碼字串列表，例如
                ["GF", "Q5", "LPOL", "MAAC", "1POL03", "1TRE03", "1POLPW", "IPOLP3"]

        Returns:
            ChartState 結構化命盤資料
        """
        chart = ChartState()

        for code in encoded_array:
            code = code.strip()
            if not code:
                continue
            self._parse_single(code, chart)

        # 舊編碼（v2.2 以前）無 Y token → 由化祿星反推年干（十干化祿星唯一）
        if not chart.year_stem:
            derived = derive_year_stem_code_from_transforms(chart.transforms)
            if derived:
                chart.year_stem = derived

        chart._build_indices()
        return chart

    def _parse_single(self, code: str, chart: ChartState) -> None:
        """解析單個編碼"""
        prefix = code[0].upper()

        # 運限四化 token：T{宮}{星}{化}{層}（8碼），如 T1BREFOD（大限破軍化祿於1宮）
        if prefix == "T":
            self._parse_fortune_sihua(code, chart)
            return

        # 特殊編碼：G (性別), Q (身宮), L (命主), M (身主), I (亮度), Y (生年干支)
        if prefix in ("G", "Q", "L", "M", "I", "Y"):
            self._parse_special(code, chart)
            return

        # 標準編碼：宮位+星曜+後綴 (4碼或6碼)
        if len(code) in (4, 6):
            self._parse_standard(code, chart)

    #: 運限四化 token 尾碼 → 層別
    _LAYER_MARKERS = {"D": "decade", "Y": "year", "S": "small"}

    def _parse_fortune_sihua(self, code: str, chart: ChartState) -> None:
        """
        解析運限四化 token：T{宮位}{星碼3}{四化2}{層碼1}（8碼），如 T1BREFOD。

        與生年四化（6碼標準碼，layer=natal）並行進 chart.transforms；
        star_field 通道疊加制會把兩層四化相加於同一通道（雙化 = 加乘）。
        """
        if len(code) != 8:
            return
        palace_code = code[1]
        star_code = code[2:5]
        sihua_code = code[5:7].upper()
        layer = self._LAYER_MARKERS.get(code[7].upper())
        if sihua_code not in _SIHUA_CODES or layer is None:
            return
        chart.transforms.append(StarTransform(
            star_code=star_code,
            palace_code=palace_code,
            sihua_code=sihua_code,
            layer=layer,
        ))

    def _parse_special(self, code: str, chart: ChartState) -> None:
        """解析特殊編碼"""
        result = self._special.decode(code)
        code_type = result["type"]

        if code_type == "gender":
            chart.gender = result["value"]

        elif code_type == "body_palace_location":
            chart.body_palace = result["palace"]

        elif code_type in ("body_palace_star_only", "body_palace_star"):
            if "palace" in result:
                chart.body_palace = result["palace"]

        elif code_type == "life_master":
            chart.life_master = result["star"]

        elif code_type == "body_master":
            chart.body_master = result["star"]

        elif code_type == "brightness":
            star = result["star"]
            value = result["value"]
            if value >= 0:
                brightness_code = f"P{value}"
            else:
                brightness_code = f"N{abs(value)}"
            chart.brightness[star] = brightness_code

        elif code_type == "year_gz":
            chart.year_stem = result["stem"]
            chart.year_branch = result["branch"]

    def _parse_standard(self, code: str, chart: ChartState) -> None:
        """解析標準編碼 (4碼或6碼)"""
        palace_code = code[0]
        star_code = code[1:4]

        if len(code) == 6:
            suffix = code[4:6]
        else:
            suffix = "00"

        suffix_upper = suffix.upper()

        if suffix_upper in _SIHUA_CODES:
            # 四化編碼: 1POLPW → 命宮紫微化權
            chart.transforms.append(StarTransform(
                star_code=star_code,
                palace_code=palace_code,
                sihua_code=suffix_upper,
            ))
        else:
            # 地支編碼或無後綴: 1POL03 → 命宮紫微在寅
            branch = suffix if suffix != "00" else ""
            chart.placements.append(StarPlacement(
                star_code=star_code,
                palace_code=palace_code,
                branch_code=branch,
            ))
