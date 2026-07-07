"""
宮位天干推導橋接
Palace Stems Bridge — chart_json 重建鏈的宮位層

從 ChartState 重建 12 宮的地支佈局與天干：
  1. 年干來源（優先序）：
     a. encoded_array 的 Y token（編碼 v2.3+，由 ChartParser 解出）
     b. 化祿星反推（舊編碼 fallback；十干化祿星彼此不同，反查唯一）
  2. 宮位地支佈局：以星曜 placements 的地支錨定，
     依「宮序順行、地支逆行」環狀規則補滿 12 宮。
  3. 宮干：年干 + 五虎遁。

⚠ 本模組不得複製五虎遁表或四化表 — 一律載入 p01_count 的原始模組
  （palace/gz.py 與 stars/four_trans.py 皆為零依賴純函數檔，以檔案路徑
  載入以避開數字開頭套件名與 p01_count 的重量級 import 鏈）。
  P_Union 與 vendored 引擎中 p01_count 與 p_d_graph 皆為同層目錄。
"""

import sys
import importlib.util
from pathlib import Path
from typing import Dict, Optional

# 確保 p_a_foundation 可被導入（與 chart_parser 相同的 bootstrap）
_union_root = Path(__file__).parent.parent
if str(_union_root) not in sys.path:
    sys.path.insert(0, str(_union_root))

from p_a_foundation.core.mapping import get_mapping

_P01_BASIC = _union_root / "p01_count" / "01_basic_count"

# 宮位代碼固定順序（命宮=1 → 父母=C）
PALACE_ORDER = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "A", "B", "C"]

# 延遲載入快取（載入失敗時為 False，避免重複嘗試）
_gz_module = None
_fo_star_to_stem = None


def _load_module(mod_name: str, rel_path: str):
    """以檔案路徑載入 p01_count 的零依賴純函數模組"""
    path = _P01_BASIC / rel_path
    spec = importlib.util.spec_from_file_location(mod_name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _get_gz_module():
    """取得五虎遁唯一實作（p01_count palace/gz.py）"""
    global _gz_module
    if _gz_module is None:
        try:
            _gz_module = _load_module("p01_palace_gz", "palace/gz.py")
        except Exception as exc:  # noqa: BLE001
            print(f"[WARNING] 無法載入五虎遁模組（宮干將為 None）: {exc}")
            _gz_module = False
    return _gz_module or None


def get_fo_star_to_stem_map() -> Dict[str, str]:
    """化祿星（中文）→ 年干（中文）反查表，來源 p01_count stars/four_trans.py"""
    global _fo_star_to_stem
    if _fo_star_to_stem is None:
        try:
            four_trans = _load_module("p01_four_trans", "stars/four_trans.py")
            _fo_star_to_stem = {
                trans["祿"]: stem
                for stem, trans in four_trans.four_transformations.items()
            }
        except Exception as exc:  # noqa: BLE001
            print(f"[WARNING] 無法載入四化表（年干反推停用）: {exc}")
            _fo_star_to_stem = False
    return _fo_star_to_stem or {}


def derive_year_stem_code_from_transforms(transforms) -> Optional[str]:
    """
    化祿星反推年干代碼（舊編碼無 Y token 時的 fallback）。

    十干化祿星（廉貞/天機/天同/太陰/貪狼/武曲/太陽/巨門/天梁/破軍）
    彼此不同，反查為唯一解。非四化表內的星曜（如大限星）直接略過。

    Args:
        transforms: StarTransform 列表（star_code / palace_code / sihua_code）

    Returns:
        年干代碼（如 "04"=丁），無法推導時 None
    """
    fo_map = get_fo_star_to_stem_map()
    if not fo_map:
        return None

    mapping = get_mapping()
    for t in transforms:
        if t.sihua_code != "FO":
            continue
        star_name = mapping.get_star_name(t.star_code)
        stem_name = fo_map.get(star_name) if star_name else None
        if stem_name:
            return mapping.get_stem_code(stem_name)

    return None


def build_palace_branch_map(placements) -> Dict[str, str]:
    """
    宮位代碼 → 地支代碼（12 宮完整佈局）。

    以任一星曜 placement 的（宮位, 地支）錨定，依環狀規則補滿：
    宮序每 +1（命宮→兄弟→…），地支每 -1（卯→寅→丑→…）。

    Args:
        placements: StarPlacement 列表

    Returns:
        {"1": "04", "2": "03", ...}；無可用錨點時空字典
    """
    anchor = None
    for p in placements:
        if p.palace_code in PALACE_ORDER and p.branch_code and p.branch_code.isdigit():
            branch_num = int(p.branch_code)
            if 1 <= branch_num <= 12:
                anchor = (PALACE_ORDER.index(p.palace_code), branch_num)
                break

    if anchor is None:
        return {}

    anchor_idx, anchor_branch = anchor
    result = {}
    for i, palace_code in enumerate(PALACE_ORDER):
        branch_num = (anchor_branch - 1 - (i - anchor_idx)) % 12 + 1
        result[palace_code] = f"{branch_num:02d}"
    return result


def compute_palace_stems(
    year_stem_code: str,
    palace_branch_map: Dict[str, str],
) -> Dict[str, Optional[str]]:
    """
    年干代碼 + 宮位地支佈局 → 宮位天干代碼（五虎遁）。

    宮干為本命盤固定屬性（大限、流年疊宮時不變），
    一律以本命年干起遁。

    Args:
        year_stem_code: 年干代碼（如 "04"=丁）
        palace_branch_map: build_palace_branch_map 的輸出

    Returns:
        {"1": "10", "2": "09", ...}；無法計算的宮位為 None
    """
    mapping = get_mapping()
    stem_name = mapping.get_stem_name(year_stem_code) if year_stem_code else None
    gz_module = _get_gz_module()

    if not stem_name or gz_module is None:
        return {pc: None for pc in palace_branch_map}

    # calculate_palace_gz 只取年干字（[0]），年支不影響宮干
    palace_gz = gz_module.calculate_palace_gz(f"{stem_name}寅")

    result = {}
    for palace_code, branch_code in palace_branch_map.items():
        branch_name = mapping.get_branch_name(branch_code)
        gz = palace_gz.get(branch_name) if branch_name else None
        result[palace_code] = mapping.get_stem_code(gz[0]) if gz else None
    return result
