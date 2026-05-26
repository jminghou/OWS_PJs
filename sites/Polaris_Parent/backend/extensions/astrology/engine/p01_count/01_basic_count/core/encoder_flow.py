"""
流動編碼處理模組
負責處理大限、流年、小限的編碼轉換

核心原則：
1. 從實際大限資料讀取宮位順序（不假設順逆行）
2. 第1大限 = 本命盤編碼（特殊處理）
3. 宮位映射從實際順序推導（支援陽男/陰女順行，陰男/陽女逆行）
4. 排除本命盤的 Q/I 字首和前4碼
5. 保留 6 碼宮位編碼和 8 碼本命四化編碼
6. 保持星曜代碼和地支不變（只替換宮位代碼）
7. 不包含 9 碼大限四化編碼（已移除，待使用新方式重新計算）
"""

from pathlib import Path
import json
from typing import Dict, List, Optional, Tuple

# ==================== 設定區 ====================

PALACE_NAME_TO_CODE = {
    "命宮": "1", "兄弟": "2", "夫妻": "3", "子女": "4",
    "財帛": "5", "疾厄": "6", "遷移": "7", "交友": "8",
    "官祿": "9", "田宅": "A", "福德": "B", "父母": "C"
}

PALACE_CODE_ORDER = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C']

# 地支順序（用於計算宮位）
EARTHLY_BRANCH_ORDER = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"]

# 小限星曜代碼（從 map_星曜代碼_大小限流.csv）
SMALL_LIMIT_STAR_CODES = {
    "小羊": "sGL",  # Small Glaive
    "小陀": "sST",  # Small Spinning-Top
    "小魁": "sCP",  # Small Celestial-Patron
    "小鉞": "sCA",  # Small Celestial-Aide
    "小祿": "sDI",  # Small Dividend
    "小馬": "sHH",  # Small Heavenly-Horse
    "小鸞": "sRP",  # Small Red-Phoenix
    "小喜": "sHJ"   # Small Heavenly-Joy
}

# 流年星曜代碼（從 map_星曜代碼_大小限流.csv）
YEAR_FLOW_STAR_CODES = {
    "年羊": "yGL",  # Year Glaive
    "年陀": "yST",  # Year Spinning-Top
    "年魁": "yCP",  # Year Celestial-Patron
    "年鉞": "yCA",  # Year Celestial-Aide
    "年祿": "yDI",  # Year Dividend
    "年馬": "yHH",  # Year Heavenly-Horse
    "年鸞": "yRP",  # Year Red-Phoenix
    "年喜": "yHJ"   # Year Heavenly-Joy
}


# ==================== 資料讀取 ====================

def load_chart_data(json_path: str) -> Dict:
    """載入命盤 JSON 資料"""
    with open(json_path, 'r', encoding='utf-8') as f:
        return json.load(f)


def extract_natal_encoding(chart_data: Dict) -> List[str]:
    """
    提取本命盤編碼（排除 Q/I 字首、前4碼、9碼大限四化）

    Returns:
        List[str]: 純淨的本命盤編碼（包含 6 碼的宮位編碼和 8 碼的本命四化編碼）
    """
    # 檢查是否有本命盤編碼
    if "快速條件編碼" not in chart_data:
        raise ValueError("JSON 中沒有找到「快速條件編碼」區段")

    encoding_section = chart_data["快速條件編碼"]

    # 支援兩種欄位名稱和格式：
    # 1. natal_chart_encoding（新格式，陣列）
    # 2. 本命盤編碼（舊格式，物件）
    if "natal_chart_encoding" in encoding_section:
        # 新格式：陣列格式 [{ "chart_type": "natal", "encoded_array": [...] }]
        natal_chart_list = encoding_section["natal_chart_encoding"]
        if isinstance(natal_chart_list, list) and len(natal_chart_list) > 0:
            natal_encoding = natal_chart_list[0]["encoded_array"]
        else:
            raise ValueError("natal_chart_encoding 格式錯誤")
    elif "本命盤編碼" in encoding_section:
        # 舊格式：物件格式 { "encoded_array": [...] }
        natal_encoding = encoding_section["本命盤編碼"]["encoded_array"]
    else:
        raise ValueError("找不到本命盤編碼資料（natal_chart_encoding 或 本命盤編碼）")

    clean_encoding = []
    for code in natal_encoding:
        # 排除前4碼特殊編碼
        if code in ["Q5", "LMAR", "MBLE", "GM"]:
            continue
        # 排除 Q 字首（身宮相關）
        if code.startswith("Q"):
            continue
        # 排除 I 字首（亮度相關）
        if code.startswith("I"):
            continue
        # 保留 6 碼的宮位編碼和 8 碼的本命四化編碼
        # 排除 9 碼的大限四化編碼（以 'd' 結尾）
        if len(code) == 6 or len(code) == 8:
            clean_encoding.append(code)

    return clean_encoding


def extract_decade_data(chart_data: Dict) -> Dict:
    """提取大限資料"""
    if "大限資料" not in chart_data:
        raise ValueError("JSON 中沒有找到「大限資料」區段")
    return chart_data["大限資料"]


def extract_small_limit_data(chart_data: Dict) -> Dict:
    """提取小限資料"""
    if "小限資料" not in chart_data:
        raise ValueError("JSON 中沒有找到「小限資料」區段")
    return chart_data["小限資料"]


def extract_year_flow_data(chart_data: Dict) -> Dict:
    """提取流年資料"""
    if "流年資料" not in chart_data:
        raise ValueError("JSON 中沒有找到「流年資料」區段")
    return chart_data["流年資料"]


def extract_star_positions(chart_data: Dict) -> Dict[str, str]:
    """
    從星曜資料提取星曜的地支位置

    Returns:
        Dict[str, str]: {星曜名稱: 地支}
    """
    if "星曜資料" not in chart_data:
        raise ValueError("JSON 中沒有找到「星曜資料」區段")

    star_data = chart_data["星曜資料"]
    star_positions = {}

    # 提取所有類別的星曜位置
    # 星曜資料的格式是 {類別: {星曜名: 地支}}
    for category, category_data in star_data.items():
        if isinstance(category_data, dict):
            for star_name, star_branch in category_data.items():
                # 直接是 {星曜名: 地支} 的格式
                if isinstance(star_branch, str):
                    star_positions[star_name] = star_branch

    return star_positions


def load_star_codes() -> Dict[str, str]:
    """
    載入星曜代碼映射

    Returns:
        Dict[str, str]: {星曜名稱: 星曜代碼}
    """
    config_base = Path(__file__).resolve().parent.parent / "config"
    star_codes_path = config_base / "encoding_mappings" / "star_codes.json"
    with open(star_codes_path, 'r', encoding='utf-8') as f:
        return json.load(f)


def load_branch_codes() -> Dict[str, str]:
    """
    載入地支代碼映射

    Returns:
        Dict[str, str]: {地支: 地支代碼}
    """
    config_base = Path(__file__).resolve().parent.parent / "config"
    branch_codes_path = config_base / "encoding_mappings" / "earthly_branch_codes.json"
    with open(branch_codes_path, 'r', encoding='utf-8') as f:
        return json.load(f)


# ==================== 宮位映射計算 ====================

def build_decade_palace_mapping(decade_data: Dict, target_decade_order: int) -> Dict[str, str]:
    """
    建立特定大限的宮位映射表

    Args:
        decade_data: 大限資料
        target_decade_order: 目標大限順序（1-12）

    Returns:
        Dict[str, str]: {本命宮位代碼: 大限宮位代碼}

    核心原則：從實際大限順序推導，不假設順逆行方向

    範例（第2大限，父母宮當命宮）:
        父母(C) → 大限命宮(1)
        福德(B) → 大限兄弟(2)
        田宅(A) → 大限夫妻(3)
        ...
        命宮(1) → 大限父母(C)
    """
    # 步驟1: 將12個宮位按「大限順序」排序
    sorted_palaces = sorted(
        decade_data.items(),
        key=lambda x: int(x[1]["大限順序"])
    )

    # 步驟2: 建立映射表
    mapping = {}

    # 從目標大限順序開始，循環建立映射
    for i in range(12):
        # 計算在排序陣列中的索引（考慮循環）
        palace_index = (target_decade_order - 1 + i) % 12

        # 取得該宮位的資訊
        palace_name = sorted_palaces[palace_index][0]
        natal_palace_code = PALACE_NAME_TO_CODE[palace_name]

        # 對應到大限的第 i 個宮位
        decade_palace_code = PALACE_CODE_ORDER[i]

        # 建立映射
        mapping[natal_palace_code] = decade_palace_code

    return mapping


def calculate_palace_in_decade(star_branch: str, decade_start_branch: str) -> str:
    """
    計算星曜在大限盤中的宮位代碼

    Args:
        star_branch: 星曜的地支位置（如 "亥"）
        decade_start_branch: 大限命宮的地支位置（如 "申"）

    Returns:
        str: 宮位代碼（1-9, A-C）

    範例:
        大限2（甲申限），命宮在「申」
        廉貞在「亥」
        從申順數到亥：申(1) → 酉(2) → 戌(3) → 亥(4)
        廉貞在大限2的子女宮 → 返回 "4"
    """
    try:
        start_index = EARTHLY_BRANCH_ORDER.index(decade_start_branch)
        star_index = EARTHLY_BRANCH_ORDER.index(star_branch)
    except ValueError as e:
        raise ValueError(f"地支不在順序表中: {e}")

    # 計算相對位置（從大限命宮順時針數）
    relative_position = (star_index - start_index) % 12

    # 返回對應的宮位代碼
    return PALACE_CODE_ORDER[relative_position]


# ==================== 編碼轉換 ====================

def convert_to_decade_encoding(
    natal_encoding: List[str],
    palace_mapping: Dict[str, str]
) -> List[str]:
    """
    將本命盤編碼轉換為大限盤編碼

    Args:
        natal_encoding: 本命盤編碼陣列（包含 6 碼和 8 碼編碼）
        palace_mapping: 宮位映射表

    Returns:
        List[str]: 大限盤編碼陣列（包含 6 碼和 8 碼編碼）

    說明:
        - 6 碼編碼格式: 宮位(1) + 星曜(2-4) + 地支(5-6)
        - 8 碼編碼格式: 宮位(1) + 星曜(2-4) + 四化(5-6) + 地支(7-8)
        - 只替換第1碼（宮位代碼），其他部分完全保持不變
    """
    decade_encoding = []

    for code in natal_encoding:
        # 提取宮位代碼（第1碼）
        natal_palace = code[0]

        # 查詢映射表
        decade_palace = palace_mapping.get(natal_palace)

        if decade_palace is None:
            # 理論上不應該發生
            print(f"警告：找不到宮位 {natal_palace} 的映射")
            continue

        # 組合新編碼：大限宮位 + 剩餘部分（星曜+地支 或 星曜+四化+地支）
        decade_code = decade_palace + code[1:]
        decade_encoding.append(decade_code)

    return decade_encoding


def generate_decade_star_encodings(
    decade_order: int,
    decade_start_branch: str,
    decade_star_data: Dict[str, str],
    star_codes: Dict[str, str],
    branch_codes: Dict[str, str]
) -> List[str]:
    """
    為特定大限生成大限星曜編碼

    Args:
        decade_order: 大限順序（1-12）
        decade_start_branch: 該大限命宮的地支位置
        decade_star_data: 該大限的星曜資料 {"大羊": "丑", "大陀": "亥", ...}
        star_codes: 星曜名稱 → 星曜代碼映射
        branch_codes: 地支 → 地支代碼映射

    Returns:
        List[str]: 8個大限星曜編碼

    編碼格式: {宮位代碼}{星曜代碼}{地支代碼}
    範例: 7dGL02 (大羊在遷移宮的丑位)
    """
    encodings = []

    for star_name, star_branch in decade_star_data.items():
        # 1. 查詢星曜代碼
        if star_name not in star_codes:
            print(f"警告：找不到大限星曜 {star_name} 的編碼")
            continue

        star_code = star_codes[star_name]

        # 2. 查詢地支代碼
        if star_branch not in branch_codes:
            print(f"警告：找不到地支 {star_branch} 的編碼")
            continue

        branch_code = branch_codes[star_branch]

        # 3. 計算星曜在大限盤中的宮位代碼
        palace_code = calculate_palace_in_decade(star_branch, decade_start_branch)

        # 4. 組合編碼：宮位 + 星曜 + 地支
        encoding = f"{palace_code}{star_code}{branch_code}"
        encodings.append(encoding)

    return encodings


def generate_small_limit_star_encodings(
    small_limit_start_branch: str,
    small_limit_star_data: Dict[str, str],
    cycle_index: int,
    branch_codes: Dict[str, str]
) -> List[str]:
    """
    為特定小限生成小限星曜編碼

    Args:
        small_limit_start_branch: 該小限命宮的地支位置
        small_limit_star_data: 該宮位的小限星曜資料（含逗號分隔的地支字串）
                               例如: {"小羊": "丑,丑,丑,...", "小陀": "亥,亥,亥,..."}
        cycle_index: 循環索引（0-9），用於從逗號分隔的字串中取得對應的地支
        branch_codes: 地支 → 地支代碼映射

    Returns:
        List[str]: 8個小限星曜編碼

    編碼格式: {宮位代碼}{星曜代碼}{地支代碼}
    範例: 7sGL02 (小羊在遷移宮的丑位)
    """
    encodings = []

    for star_name, branch_string in small_limit_star_data.items():
        # 1. 從逗號分隔的字串中取得該循環的地支
        branches = branch_string.split(",")
        if cycle_index >= len(branches):
            print(f"警告：小限星曜 {star_name} 的循環索引 {cycle_index} 超出範圍")
            continue

        star_branch = branches[cycle_index]

        # 2. 查詢星曜代碼
        if star_name not in SMALL_LIMIT_STAR_CODES:
            print(f"警告：找不到小限星曜 {star_name} 的編碼")
            continue

        star_code = SMALL_LIMIT_STAR_CODES[star_name]

        # 3. 查詢地支代碼
        if star_branch not in branch_codes:
            print(f"警告：找不到地支 {star_branch} 的編碼")
            continue

        branch_code = branch_codes[star_branch]

        # 4. 計算星曜在小限盤中的宮位代碼
        palace_code = calculate_palace_in_decade(star_branch, small_limit_start_branch)

        # 5. 組合編碼：宮位 + 星曜 + 地支
        encoding = f"{palace_code}{star_code}{branch_code}"
        encodings.append(encoding)

    return encodings


def generate_year_flow_star_encodings(
    year_flow_start_branch: str,
    year_flow_star_data: Dict[str, str],
    cycle_index: int,
    branch_codes: Dict[str, str]
) -> List[str]:
    """
    為特定流年生成流年星曜編碼

    Args:
        year_flow_start_branch: 該流年命宮的地支位置
        year_flow_star_data: 該宮位的流年星曜資料（含逗號分隔的地支字串）
                             例如: {"年羊": "酉,子,卯,...", "年陀": "未,戌,丑,..."}
        cycle_index: 循環索引（0-9），用於從逗號分隔的字串中取得對應的地支
        branch_codes: 地支 → 地支代碼映射

    Returns:
        List[str]: 8個流年星曜編碼

    編碼格式: {宮位代碼}{星曜代碼}{地支代碼}
    範例: 7yGL02 (年羊在遷移宮的丑位)
    """
    encodings = []

    for star_name, branch_string in year_flow_star_data.items():
        # 1. 從逗號分隔的字串中取得該循環的地支
        branches = branch_string.split(",")
        if cycle_index >= len(branches):
            print(f"警告：流年星曜 {star_name} 的循環索引 {cycle_index} 超出範圍")
            continue

        star_branch = branches[cycle_index]

        # 2. 查詢星曜代碼
        if star_name not in YEAR_FLOW_STAR_CODES:
            print(f"警告：找不到流年星曜 {star_name} 的編碼")
            continue

        star_code = YEAR_FLOW_STAR_CODES[star_name]

        # 3. 查詢地支代碼
        if star_branch not in branch_codes:
            print(f"警告：找不到地支 {star_branch} 的編碼")
            continue

        branch_code = branch_codes[star_branch]

        # 4. 計算星曜在流年盤中的宮位代碼
        palace_code = calculate_palace_in_decade(star_branch, year_flow_start_branch)

        # 5. 組合編碼：宮位 + 星曜 + 地支
        encoding = f"{palace_code}{star_code}{branch_code}"
        encodings.append(encoding)

    return encodings


# ==================== 主要處理函數 ====================

def calculate_decade_chart_encoding(chart_data: Dict) -> List[Dict]:
    """
    計算所有12個大限的編碼（包含大限星曜編碼）

    Args:
        chart_data: 完整的命盤資料

    Returns:
        List[Dict]: 12個大限的編碼資料
    """
    # 提取必要資料
    natal_encoding = extract_natal_encoding(chart_data)
    decade_data = extract_decade_data(chart_data)

    # 載入星曜編碼映射（用於大限星曜）
    star_codes = load_star_codes()
    branch_codes = load_branch_codes()

    all_decade_encodings = []

    # 處理12個大限
    for decade_order in range(1, 13):
        # 找出該大限對應的宮位資訊
        target_palace = None
        for palace_name, info in decade_data.items():
            if int(info["大限順序"]) == decade_order:
                target_palace = (palace_name, info)
                break

        if target_palace is None:
            print(f"錯誤：找不到大限順序 {decade_order} 的資料")
            continue

        palace_name, palace_info = target_palace

        # 特殊處理第1大限（與本命盤相同）
        if decade_order == 1:
            encoded_array = natal_encoding.copy()
        else:
            # 建立映射表
            palace_mapping = build_decade_palace_mapping(decade_data, decade_order)
            # 轉換編碼
            encoded_array = convert_to_decade_encoding(natal_encoding, palace_mapping)

        # 生成大限星曜編碼
        try:
            if "大限星曜" in palace_info:
                decade_star_encodings = generate_decade_star_encodings(
                    decade_order,
                    palace_info["宮位"],  # 該大限命宮的地支
                    palace_info["大限星曜"],  # {"大羊": "丑", "大陀": "亥", ...}
                    star_codes,
                    branch_codes
                )
                # 將大限星曜編碼加到編碼陣列最後
                encoded_array.extend(decade_star_encodings)
        except Exception as e:
            print(f"警告：大限 {decade_order} 的星曜編碼生成失敗 - {str(e)}")

        # 組合該大限的完整資訊
        decade_encoding_info = {
            "decade_order": str(decade_order),
            "age_range": palace_info["大限歲數"],
            "year_range": palace_info["大限西元區間"],
            "decade_name": palace_info["大限名稱"],
            "palace_position": palace_info["宮位"],
            "encoded_array": encoded_array
        }

        all_decade_encodings.append(decade_encoding_info)

    return all_decade_encodings


def calculate_small_limit_encoding(chart_data: Dict) -> List[Dict]:
    """
    計算所有120個小限的編碼（包含小限星曜編碼）

    Args:
        chart_data: 完整的命盤資料

    Returns:
        List[Dict]: 120個小限的編碼資料（1-120歲）

    說明:
        - 每個宮位有10次循環（共12宮位 × 10次 = 120歲）
        - 第1歲小限與本命盤相同
        - 其他小限根據宮位順序建立映射並轉換編碼
    """
    # 提取必要資料
    natal_encoding = extract_natal_encoding(chart_data)
    decade_data = extract_decade_data(chart_data)  # 用於建立宮位映射
    small_limit_data = extract_small_limit_data(chart_data)
    branch_codes = load_branch_codes()

    all_small_limit_encodings = []

    # 建立年齡到宮位的映射（用於查找每個年齡對應的宮位資料）
    age_to_palace = {}
    for palace_name, palace_info in small_limit_data.items():
        ages = palace_info["歲數"].split(",")
        lunar_years = palace_info["小限農曆年"].split(",")
        western_years = palace_info["小限西元年"].split(",")

        for i, age in enumerate(ages):
            age_to_palace[int(age)] = {
                "palace_name": palace_name,
                "palace_position": palace_info["宮位"],
                "lunar_year": lunar_years[i],
                "western_year": western_years[i],
                "cycle_index": i,
                "small_limit_stars": palace_info["小限星曜"][0] if palace_info["小限星曜"] else {}
            }

    # 處理120個小限（1-120歲）
    for age in range(1, 121):
        if age not in age_to_palace:
            print(f"警告：找不到年齡 {age} 的小限資料")
            continue

        age_info = age_to_palace[age]

        # 找出該小限對應的宮位在大限順序中的位置
        # 所有年齡（包括第1歲）都需要進行宮位映射
        # 例如：1歲小限命宮在田宅（戌位），不是本命盤命宮（未位）
        palace_order = None
        for palace_name, decade_info in decade_data.items():
            if palace_name == age_info["palace_name"]:
                palace_order = int(decade_info["大限順序"])
                break

        if palace_order is None:
            print(f"錯誤：找不到宮位 {age_info['palace_name']} 的順序")
            continue

        # 建立映射表（複用大限的宮位映射邏輯）
        palace_mapping = build_decade_palace_mapping(decade_data, palace_order)
        # 轉換編碼
        encoded_array = convert_to_decade_encoding(natal_encoding, palace_mapping)

        # 生成小限星曜編碼
        try:
            if age_info["small_limit_stars"]:
                small_limit_star_encodings = generate_small_limit_star_encodings(
                    age_info["palace_position"],  # 該小限命宮的地支
                    age_info["small_limit_stars"],  # {"小羊": "丑,丑,...", "小陀": "亥,亥,..."}
                    age_info["cycle_index"],  # 循環索引（0-9）
                    branch_codes
                )
                # 將小限星曜編碼加到編碼陣列最後
                encoded_array.extend(small_limit_star_encodings)
        except Exception as e:
            print(f"警告：年齡 {age} 的小限星曜編碼生成失敗 - {str(e)}")

        # 組合該小限的完整資訊
        small_limit_encoding_info = {
            "age": str(age),
            "lunar_year": age_info["lunar_year"],
            "western_year": age_info["western_year"],
            "palace_position": age_info["palace_position"],
            "encoded_array": encoded_array
        }

        all_small_limit_encodings.append(small_limit_encoding_info)

    return all_small_limit_encodings


def calculate_year_flow_encoding(chart_data: Dict) -> List[Dict]:
    """
    計算所有120個流年的編碼（包含流年星曜編碼）

    Args:
        chart_data: 完整的命盤資料

    Returns:
        List[Dict]: 120個流年的編碼資料（1-120歲）

    說明:
        - 每個宮位有10次循環（共12宮位 × 10次 = 120歲）
        - 所有年齡都需要進行宮位映射
        - 流年起始宮位與小限不同（例如：1歲流年命宮在父母宮申位）
    """
    # 提取必要資料
    natal_encoding = extract_natal_encoding(chart_data)
    decade_data = extract_decade_data(chart_data)  # 用於建立宮位映射
    year_flow_data = extract_year_flow_data(chart_data)
    branch_codes = load_branch_codes()

    all_year_flow_encodings = []

    # 建立年齡到宮位的映射（用於查找每個年齡對應的宮位資料）
    age_to_palace = {}
    for palace_name, palace_info in year_flow_data.items():
        ages = palace_info["歲數"].split(",")
        lunar_years = palace_info["流年農曆年"].split(",")
        western_years = palace_info["流年西元年"].split(",")

        for i, age in enumerate(ages):
            age_to_palace[int(age)] = {
                "palace_name": palace_name,
                "palace_position": palace_info["宮位"],
                "lunar_year": lunar_years[i],
                "western_year": western_years[i],
                "cycle_index": i,
                "year_flow_stars": palace_info["流年星曜"][0] if palace_info["流年星曜"] else {}
            }

    # 處理120個流年（1-120歲）
    for age in range(1, 121):
        if age not in age_to_palace:
            print(f"警告：找不到年齡 {age} 的流年資料")
            continue

        age_info = age_to_palace[age]

        # 找出該流年對應的宮位在大限順序中的位置
        # 所有年齡都需要進行宮位映射
        # 例如：1歲流年命宮在父母（申位），不是本命盤命宮（未位）
        palace_order = None
        for palace_name, decade_info in decade_data.items():
            if palace_name == age_info["palace_name"]:
                palace_order = int(decade_info["大限順序"])
                break

        if palace_order is None:
            print(f"錯誤：找不到宮位 {age_info['palace_name']} 的順序")
            continue

        # 建立映射表（複用大限的宮位映射邏輯）
        palace_mapping = build_decade_palace_mapping(decade_data, palace_order)
        # 轉換編碼
        encoded_array = convert_to_decade_encoding(natal_encoding, palace_mapping)

        # 生成流年星曜編碼
        try:
            if age_info["year_flow_stars"]:
                year_flow_star_encodings = generate_year_flow_star_encodings(
                    age_info["palace_position"],  # 該流年命宮的地支
                    age_info["year_flow_stars"],  # {"年羊": "酉,子,...", "年陀": "未,戌,..."}
                    age_info["cycle_index"],  # 循環索引（0-9）
                    branch_codes
                )
                # 將流年星曜編碼加到編碼陣列最後
                encoded_array.extend(year_flow_star_encodings)
        except Exception as e:
            print(f"警告：年齡 {age} 的流年星曜編碼生成失敗 - {str(e)}")

        # 組合該流年的完整資訊
        year_flow_encoding_info = {
            "age": str(age),
            "lunar_year": age_info["lunar_year"],
            "western_year": age_info["western_year"],
            "palace_position": age_info["palace_position"],
            "encoded_array": encoded_array
        }

        all_year_flow_encodings.append(year_flow_encoding_info)

    return all_year_flow_encodings


# ==================== 輸出處理 ====================

def append_decade_encoding_to_json(json_path: str) -> None:
    """
    計算大限編碼並追加到 JSON 檔案

    Args:
        json_path: 已存在的命盤 JSON 檔案路徑

    流程:
        1. 讀取 JSON（包含本命盤編碼和大限資料）
        2. 提取並清理本命盤編碼
        3. 計算12個大限的宮位映射
        4. 轉換編碼
        5. 追加到 "快速條件編碼" > "decade_chart_encoding"
        6. 更新 encoding_version 為 "2.3"
        7. 寫回原 JSON 檔案
    """
    # 讀取原始資料
    chart_data = load_chart_data(json_path)

    # 計算大限編碼
    decade_encodings = calculate_decade_chart_encoding(chart_data)

    # 將大限編碼加入資料中
    if "快速條件編碼" not in chart_data:
        chart_data["快速條件編碼"] = {}

    chart_data["快速條件編碼"]["decade_chart_encoding"] = decade_encodings

    # 更新版本號
    chart_data["快速條件編碼"]["encoding_version"] = "2.3"
    chart_data["快速條件編碼"]["encoding_type"] = "full_chart"

    # UTF-8、縮排 2，與專案其他 JSON 輸出一致
    json_str = json.dumps(chart_data, ensure_ascii=False, indent=2)

    # 寫回原 JSON 檔案
    with open(json_path, 'w', encoding='utf-8') as f:
        f.write(json_str)

    print(f"大限編碼已成功追加：{json_path}")
    print(f"   - 共計算 {len(decade_encodings)} 個大限")
    print(f"   - 編碼版本：2.3")


def append_small_limit_encoding_to_json(json_path: str) -> None:
    """
    計算小限編碼並追加到 JSON 檔案

    Args:
        json_path: 已存在的命盤 JSON 檔案路徑

    流程:
        1. 讀取 JSON（包含本命盤編碼、大限資料、小限資料）
        2. 提取並清理本命盤編碼
        3. 計算120個小限的宮位映射
        4. 轉換編碼
        5. 追加到 "快速條件編碼" > "small_limit_encoding"
        6. 更新 encoding_version 為 "2.4"
        7. 寫回原 JSON 檔案
    """
    # 讀取原始資料
    chart_data = load_chart_data(json_path)

    # 計算小限編碼
    small_limit_encodings = calculate_small_limit_encoding(chart_data)

    # 將小限編碼加入資料中
    if "快速條件編碼" not in chart_data:
        chart_data["快速條件編碼"] = {}

    chart_data["快速條件編碼"]["small_limit_encoding"] = small_limit_encodings

    # 更新版本號
    chart_data["快速條件編碼"]["encoding_version"] = "2.4"
    chart_data["快速條件編碼"]["encoding_type"] = "full_chart"

    # UTF-8、縮排 2，與專案其他 JSON 輸出一致
    json_str = json.dumps(chart_data, ensure_ascii=False, indent=2)

    # 寫回原 JSON 檔案
    with open(json_path, 'w', encoding='utf-8') as f:
        f.write(json_str)

    print(f"小限編碼已成功追加：{json_path}")
    print(f"   - 共計算 {len(small_limit_encodings)} 個小限（1-120歲）")
    print(f"   - 編碼版本：2.4")


def append_year_flow_encoding_to_json(json_path: str) -> None:
    """
    計算流年編碼並追加到 JSON 檔案

    Args:
        json_path: 已存在的命盤 JSON 檔案路徑

    流程:
        1. 讀取 JSON（包含本命盤編碼、大限資料、流年資料）
        2. 提取並清理本命盤編碼
        3. 計算120個流年的宮位映射
        4. 轉換編碼
        5. 追加到 "快速條件編碼" > "year_flow_encoding"
        6. 更新 encoding_version 為 "2.5"
        7. 寫回原 JSON 檔案
    """
    # 讀取原始資料
    chart_data = load_chart_data(json_path)

    # 計算流年編碼
    year_flow_encodings = calculate_year_flow_encoding(chart_data)

    # 將流年編碼加入資料中
    if "快速條件編碼" not in chart_data:
        chart_data["快速條件編碼"] = {}

    chart_data["快速條件編碼"]["year_flow_encoding"] = year_flow_encodings

    # 更新版本號
    chart_data["快速條件編碼"]["encoding_version"] = "2.5"
    chart_data["快速條件編碼"]["encoding_type"] = "full_chart"

    # UTF-8、縮排 2，與專案其他 JSON 輸出一致
    json_str = json.dumps(chart_data, ensure_ascii=False, indent=2)

    # 寫回原 JSON 檔案
    with open(json_path, 'w', encoding='utf-8') as f:
        f.write(json_str)

    print(f"流年編碼已成功追加：{json_path}")
    print(f"   - 共計算 {len(year_flow_encodings)} 個流年（1-120歲）")
    print(f"   - 編碼版本：2.5")


# ==================== 測試函數 ====================

def test_decade_encoding():
    """測試函數：產生 v6.json"""
    import shutil

    input_path = "docs/demo/19801117_小銘_v5.json"
    output_path = "docs/demo/19801117_小銘_v6.json"

    # 複製 v5 到 v6
    shutil.copy(input_path, output_path)
    print(f"已複製：{input_path} -> {output_path}")

    # 追加大限編碼
    append_decade_encoding_to_json(output_path)
    print(f"\n測試完成！")
    print(f"請檢查檔案：{output_path}")


# ==================== 新增：供 chart_calculator 使用的包裝函數 ====================

def generate_decade_encoding_data(chart_data: Dict, natal_encoding_array: Optional[List[str]] = None) -> Dict:
    """
    生成大限編碼數據（供 chart_calculator 使用）

    Args:
        chart_data: 完整命盤數據
        natal_encoding_array: 本命盤編碼陣列（可選，如果提供則不從 chart_data 中提取）

    Returns:
        dict: {'decade_chart_encoding': [...]}
    """
    # 如果提供了本命盤編碼，臨時加入 chart_data
    if natal_encoding_array is not None:
        temp_chart_data = chart_data.copy()
        temp_chart_data['快速條件編碼'] = {
            'natal_chart_encoding': [
                {
                    'chart_type': 'natal',
                    'encoded_array': natal_encoding_array
                }
            ]
        }
        decade_encoding_list = calculate_decade_chart_encoding(temp_chart_data)
    else:
        decade_encoding_list = calculate_decade_chart_encoding(chart_data)

    return {'decade_chart_encoding': decade_encoding_list}


def generate_small_limit_encoding_data(chart_data: Dict, natal_encoding_array: Optional[List[str]] = None) -> Dict:
    """
    生成小限編碼數據（供 chart_calculator 使用）

    Args:
        chart_data: 完整命盤數據
        natal_encoding_array: 本命盤編碼陣列（可選，如果提供則不從 chart_data 中提取）

    Returns:
        dict: {'small_limit_encoding': [...]}
    """
    # 如果提供了本命盤編碼，臨時加入 chart_data
    if natal_encoding_array is not None:
        temp_chart_data = chart_data.copy()
        temp_chart_data['快速條件編碼'] = {
            'natal_chart_encoding': [
                {
                    'chart_type': 'natal',
                    'encoded_array': natal_encoding_array
                }
            ]
        }
        small_limit_encoding_list = calculate_small_limit_encoding(temp_chart_data)
    else:
        small_limit_encoding_list = calculate_small_limit_encoding(chart_data)

    return {'small_limit_encoding': small_limit_encoding_list}


def generate_year_flow_encoding_data(chart_data: Dict, natal_encoding_array: Optional[List[str]] = None) -> Dict:
    """
    生成流年編碼數據（供 chart_calculator 使用）

    Args:
        chart_data: 完整命盤數據
        natal_encoding_array: 本命盤編碼陣列（可選，如果提供則不從 chart_data 中提取）

    Returns:
        dict: {'year_flow_encoding': [...]}
    """
    # 如果提供了本命盤編碼，臨時加入 chart_data
    if natal_encoding_array is not None:
        temp_chart_data = chart_data.copy()
        temp_chart_data['快速條件編碼'] = {
            'natal_chart_encoding': [
                {
                    'chart_type': 'natal',
                    'encoded_array': natal_encoding_array
                }
            ]
        }
        year_flow_encoding_list = calculate_year_flow_encoding(temp_chart_data)
    else:
        year_flow_encoding_list = calculate_year_flow_encoding(chart_data)

    return {'year_flow_encoding': year_flow_encoding_list}


# ==================== 主程式 ====================

if __name__ == "__main__":
    print("=== 大限編碼測試程式 ===\n")
    test_decade_encoding()
