"""
紫微斗數地基工程 - 映射管理模組
自動載入對照表並提供雙向查詢功能
支援 JSON 與 CSV 格式
"""

import json
import csv
from pathlib import Path
from typing import Dict, Optional


class ZiweiMapping:
    """紫微斗數基礎映射管理器"""

    def __init__(self, data_dir: Path = None):
        if data_dir is None:
            data_dir = Path(__file__).parent.parent / "data"

        self.data_dir = data_dir

        # 載入對照表
        self.palaces = self._load_json("palace_codes.json")
        self.branches = self._load_json("earthly_branch_codes.json")
        self.sihua = self._load_json("sihua_codes.json")
        # 天干（v2.3 新增，容忍舊資料目錄缺檔）
        self.stems = self._load_json_optional("heavenly_stem_codes.json")
        
        # 星曜改由 CSV 載入 (正式名稱為 dim_stars.csv)
        self.star_properties = {} # 儲存完整屬性 (代碼 -> 屬性字典)
        self.stars = self._load_stars_csv("dim_stars.csv")

        # 建立反向映射 (代碼 → 中文名稱)
        self.palaces_reverse = {v: k for k, v in self.palaces.items()}
        # 注意：stars 現在包含 name -> code，而 star_properties 包含 code -> row
        self.stars_reverse = {v: k for k, v in self.stars.items()}
        self.branches_reverse = {v: k for k, v in self.branches.items()}
        self.sihua_reverse = {v: k for k, v in self.sihua.items()}
        self.stems_reverse = {v: k for k, v in self.stems.items()}

    def _load_json(self, filename: str) -> Dict:
        """載入 JSON 檔案"""
        file_path = self.data_dir / filename
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)

    def _load_json_optional(self, filename: str) -> Dict:
        """載入 JSON 檔案，檔案不存在時回傳空字典（供新增對照表向後相容）"""
        file_path = self.data_dir / filename
        if not file_path.exists():
            return {}
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)

    def _load_stars_csv(self, filename: str) -> Dict[str, str]:
        """從 CSV 載入星曜映射 (中文名稱 -> 代碼) 並保存屬性"""
        file_path = self.data_dir / filename
        if not file_path.exists():
            # 回退嘗試舊的 JSON (過渡期)
            old_json = self.data_dir / "star_codes.json"
            if old_json.exists():
                return self._load_json("star_codes.json")
            return {}

        mapping = {}
        with open(file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                name = row.get('name')
                code = row.get('code')
                if name and code:
                    mapping[name] = code
                    self.star_properties[code] = row
                    # 同時支援大寫 key 查詢
                    self.star_properties[code.upper()] = row
        return mapping

    def get_star_properties(self, code: str) -> Optional[Dict]:
        """取得星曜的詳細屬性 (code, category, weight 等)"""
        return self.star_properties.get(code) or self.star_properties.get(code.upper())

    # === 中文 → 代碼 ===
    def get_palace_code(self, name: str) -> Optional[str]:
        """取得宮位代碼 (例: '命宮' → '1')"""
        return self.palaces.get(name)

    def get_star_code(self, name: str) -> Optional[str]:
        """取得星曜代碼 (例: '紫微' → 'POL')"""
        return self.stars.get(name)

    def get_branch_code(self, name: str) -> Optional[str]:
        """取得地支代碼 (例: '子' → '01')"""
        return self.branches.get(name)

    def get_sihua_code(self, name: str) -> Optional[str]:
        """取得四化代碼 (例: '權' → 'PW')"""
        return self.sihua.get(name)

    def get_stem_code(self, name: str) -> Optional[str]:
        """取得天干代碼 (例: '甲' → '01')"""
        return self.stems.get(name)

    # === 代碼 → 中文 ===
    def get_palace_name(self, code: str) -> Optional[str]:
        """取得宮位名稱 (不區分大小寫)"""
        return self.palaces_reverse.get(code.upper())

    def get_star_name(self, code: str) -> Optional[str]:
        """取得星曜名稱 (優先匹配原始編碼，若無則嘗試大寫)"""
        # 先嘗試原始編碼 (為了支援 dHJ 等小寫前綴)
        name = self.stars_reverse.get(code)
        if name:
            return name
        # 再嘗試大寫 (為了支援 pol -> POL)
        return self.stars_reverse.get(code.upper())

    def get_branch_name(self, code: str) -> Optional[str]:
        """取得地支名稱"""
        return self.branches_reverse.get(code)

    def get_sihua_name(self, code: str) -> Optional[str]:
        """取得四化名稱 (不區分大小寫)"""
        return self.sihua_reverse.get(code.upper())

    def get_stem_name(self, code: str) -> Optional[str]:
        """取得天干名稱 (例: '01' → '甲')"""
        return self.stems_reverse.get(code)


# 單例模式
_mapping_instance = None


def get_mapping() -> ZiweiMapping:
    """取得全域映射實例"""
    global _mapping_instance
    if _mapping_instance is None:
        _mapping_instance = ZiweiMapping()
    return _mapping_instance
