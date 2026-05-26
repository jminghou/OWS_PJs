"""
統一編碼查詢中心
Code Registry — Unified Code Lookup for Star / Palace / Sihua

載入 p_a_foundation/data/ 下的標準編碼，提供跨語言查詢介面。
所有 serializer 透過此模組將 code → 顯示名稱，
圖表程式也可直接 import 此模組做多語言切換。

用法:
    reg = CodeRegistry()
    reg.star_name("POL")          # "紫微"
    reg.star_name("POL", "en")    # "Polaris"
    reg.palace_name("1")          # "命宮"
    reg.sihua_name("FO")          # "化祿"
"""

import csv
import json
import os
from typing import Optional


class CodeRegistry:
    """統一編碼查詢：star / palace / sihua / dimension"""

    def __init__(self, foundation_data_dir: Optional[str] = None,
                 graph_data_dir: Optional[str] = None):
        """
        Args:
            foundation_data_dir: p_a_foundation/data/ 路徑
            graph_data_dir: p_d_graph/data/ 路徑
        """
        if foundation_data_dir is None:
            _here = os.path.dirname(__file__)
            foundation_data_dir = os.path.join(
                _here, os.pardir, os.pardir, "p_a_foundation", "data"
            )
        if graph_data_dir is None:
            _here = os.path.dirname(__file__)
            graph_data_dir = os.path.join(_here, os.pardir, "data")

        self._foundation_dir = os.path.normpath(foundation_data_dir)
        self._graph_dir = os.path.normpath(graph_data_dir)

        # 星曜: {code: {"zh": str, "en": str}}
        self._stars: dict[str, dict] = {}
        # 宮位: {code: {"zh": str}}  (反轉 palace_codes.json)
        self._palaces: dict[str, dict] = {}
        # 四化: {code: {"zh": str}}  (反轉 sihua_codes.json)
        self._sihua: dict[str, dict] = {}
        # 維度: {dim_name: {"idx": int, "name_zh": str, "group": str, ...}}
        self._dims: dict[str, dict] = {}

        self._load_stars()
        self._load_palaces()
        self._load_sihua()
        self._load_dimensions()

    # ------------------------------------------------------------------
    # 載入
    # ------------------------------------------------------------------

    def _load_stars(self):
        path = os.path.join(self._foundation_dir, "star_properties.csv")
        if not os.path.exists(path):
            return
        with open(path, "r", encoding="utf-8-sig") as f:
            for row in csv.DictReader(f):
                code = row.get("code", "").strip()
                if not code:
                    continue
                self._stars[code] = {
                    "zh": row.get("name", "").strip(),
                    "en": row.get("name_en", "").strip(),
                }

    def _load_palaces(self):
        path = os.path.join(self._foundation_dir, "palace_codes.json")
        if not os.path.exists(path):
            return
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        # 原始格式: {"命宮": "1", ...} → 反轉為 {"1": {"zh": "命宮"}}
        for zh_name, code in data.items():
            self._palaces[code] = {"zh": zh_name}

        # 補充英文名稱
        _palace_en = {
            "1": "Life", "2": "Siblings", "3": "Marriage",
            "4": "Offspring", "5": "Wealth", "6": "Health",
            "7": "Travel", "8": "Social", "9": "Career",
            "A": "Property", "B": "Fortune", "C": "Parents",
            "Q": "Body", "L": "Life Master", "M": "Body Master",
        }
        for code, en in _palace_en.items():
            if code in self._palaces:
                self._palaces[code]["en"] = en
            else:
                self._palaces[code] = {"zh": code, "en": en}

    def _load_sihua(self):
        path = os.path.join(self._foundation_dir, "sihua_codes.json")
        if not os.path.exists(path):
            return
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        # 原始格式: {"忌": "BI", ...} → 反轉
        _sihua_en = {"FO": "Fortune", "PW": "Power", "HO": "Honor", "BI": "Bane"}
        for zh_name, code in data.items():
            self._sihua[code] = {
                "zh": f"化{zh_name}",
                "en": _sihua_en.get(code, code),
            }

    def _load_dimensions(self):
        path = os.path.join(self._graph_dir, "dimension_definitions.csv")
        if not os.path.exists(path):
            return
        with open(path, "r", encoding="utf-8-sig") as f:
            for row in csv.DictReader(f):
                name = row.get("name", "").strip()
                if not name:
                    continue
                try:
                    idx = int(row.get("dim", -1))
                except ValueError:
                    idx = -1
                self._dims[name] = {
                    "idx": idx,
                    "name_zh": row.get("name_zh", "").strip(),
                    "group": row.get("group", "").strip(),
                    "group_name": row.get("group_name", "").strip(),
                    "source_type": row.get("source_type", "").strip(),
                    "description": row.get("description", "").strip(),
                }

    # ------------------------------------------------------------------
    # 查詢 API
    # ------------------------------------------------------------------

    def star_name(self, code: str, lang: str = "zh") -> str:
        """星曜編碼 → 顯示名稱。找不到回傳原碼。"""
        entry = self._stars.get(code)
        if not entry:
            return code
        return entry.get(lang, entry.get("zh", code))

    def star_info(self, code: str) -> dict:
        """星曜完整資訊 dict，找不到回傳空 dict。"""
        return self._stars.get(code, {})

    def palace_name(self, code: str, lang: str = "zh") -> str:
        """宮位編碼 → 顯示名稱。"""
        entry = self._palaces.get(code)
        if not entry:
            return code
        return entry.get(lang, entry.get("zh", code))

    def palace_info(self, code: str) -> dict:
        return self._palaces.get(code, {})

    def sihua_name(self, code: str, lang: str = "zh") -> str:
        """四化編碼 → 顯示名稱。"""
        entry = self._sihua.get(code)
        if not entry:
            return code
        return entry.get(lang, entry.get("zh", code))

    def sihua_info(self, code: str) -> dict:
        return self._sihua.get(code, {})

    def dim_info(self, dim_name: str) -> dict:
        """維度名稱 → 完整資訊 dict。"""
        return self._dims.get(dim_name, {})

    def dim_name_zh(self, dim_name: str) -> str:
        """維度名稱 → 中文名。"""
        info = self._dims.get(dim_name)
        return info["name_zh"] if info else dim_name

    # ------------------------------------------------------------------
    # 反查：維度名稱 → 相關編碼
    # ------------------------------------------------------------------

    def dim_to_star_code(self, dim_name: str) -> Optional[str]:
        """
        嘗試從維度名稱反推星曜編碼。
        例: "major_pol" → "POL", "support_lha" → "LHA"
        """
        # 規則: major_xxx / support_xxx / brake_xxx / void_xxx → XXX (大寫後三碼)
        parts = dim_name.split("_", 1)
        if len(parts) == 2 and parts[0] in ("major", "support", "brake", "void"):
            candidate = parts[1].upper()
            if candidate in self._stars:
                return candidate
        return None

    # ------------------------------------------------------------------
    # 列舉
    # ------------------------------------------------------------------

    @property
    def all_star_codes(self) -> list[str]:
        return list(self._stars.keys())

    @property
    def palace_codes_12(self) -> list[str]:
        """12 正宮編碼（不含 Q/L/M）"""
        return ["1", "2", "3", "4", "5", "6", "7", "8", "9", "A", "B", "C"]

    @property
    def sihua_codes(self) -> list[str]:
        return ["FO", "PW", "HO", "BI"]

    @property
    def all_dims(self) -> dict[str, dict]:
        return dict(self._dims)
