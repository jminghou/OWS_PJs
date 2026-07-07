"""
命盤編碼模組（本命盤版本 v2.3）
用於機器學習和數據分析的命盤數據編碼

編碼格式：
- 身宮：Q + 宮位代碼 (2碼)
  範例：Q5（身宮在財帛宮）

- 生年干支：Y + 天干代碼(2碼) + 地支代碼(2碼) = 5碼
  範例：Y0404（丁卯年）
  注意：v2.3 新增。刻意取 5 碼，舊版 ChartParser（只解 4/6 碼標準編碼）
  會因長度不符自動略過，不會誤判為宮位星曜編碼。
  年干為五虎遁之輸入，宮位天干可由此 token 完整重建
  （唯一實作：palace/gz.py calculate_palace_gz）。

- 命主：L + 星曜代碼 (4碼)
  範例：LMAR（命主是武曲）

- 身主：M + 星曜代碼 (4碼)
  範例：MBLE（身主是天梁）

- 性別：G + M/F (2碼)
  範例：GM（男性）、GF（女性）

- 星曜亮度：I + 星曜代碼(3碼) + 正負號(1碼) + 亮度值(1碼) = 5碼
  範例：ISUNP2（太陽 +2）、IMAGN3（廉貞 -3）
  正負號：P（正數）、N（負數）

- 基本星曜：宮位代碼(1碼) + 星曜代碼(3碼) + 地支代碼(2碼) = 6碼
  範例：1POL08（紫微在命宮未位）

- 四化星曜：宮位代碼(1碼) + 星曜代碼(3碼) + 四化代碼(2碼) = 6碼
  範例：1POLPW（紫微化權在命宮）
  注意：四化星曜會同時輸出基本編碼和四化編碼

編碼順序：
1. 身宮（Q + 宮位代碼）
2. 命主（L + 星曜代碼）
3. 身主（M + 星曜代碼）
4. 性別（G + M/F）
5. 生年干支（Y + 天干代碼 + 地支代碼）
6. 身宮星曜（Q + 星曜代碼 + 地支）
7. 星曜亮度（I + 星曜代碼 + 正負號 + 亮度值）
8. 所有宮位星曜（按宮位順序）
"""

import json
from pathlib import Path
from datetime import datetime


def get_config_path():
    """動態取得配置檔案路徑"""
    current_file = Path(__file__).resolve()
    basic_count_dir = current_file.parent.parent
    return basic_count_dir / "config"


def load_encoding_mappings():
    """
    載入所有編碼映射表（從 JSON 配置檔）

    Returns:
        tuple: (palace_map, star_map, earthly_branch_map, sihua_map)
    """
    base_path = get_config_path() / "encoding_mappings"

    # 載入宮位代碼
    with open(base_path / "palace_codes.json", 'r', encoding='utf-8') as f:
        palace_map = json.load(f)

    # 載入星曜代碼
    with open(base_path / "star_codes.json", 'r', encoding='utf-8') as f:
        star_map = json.load(f)

    # 載入地支代碼
    with open(base_path / "earthly_branch_codes.json", 'r', encoding='utf-8') as f:
        earthly_branch_map = json.load(f)

    # 載入四化代碼
    with open(base_path / "sihua_codes.json", 'r', encoding='utf-8') as f:
        sihua_map = json.load(f)

    return palace_map, star_map, earthly_branch_map, sihua_map


def load_heavenly_stem_codes():
    """
    載入天干代碼映射表（v2.3 新增，獨立載入以維持 load_encoding_mappings 的回傳契約）

    Returns:
        dict: {"甲": "01", "乙": "02", ..., "癸": "10"}
    """
    base_path = get_config_path() / "encoding_mappings"

    with open(base_path / "heavenly_stem_codes.json", 'r', encoding='utf-8') as f:
        return json.load(f)


def build_earthly_branch_to_palace_mapping(chart_data, palace_code_map):
    """
    從命盤數據建立「地支→宮位代碼」的動態映射

    Args:
        chart_data (dict): 完整命盤數據
        palace_code_map (dict): 宮位名稱→宮位代碼映射

    Returns:
        dict: {"未": "1", "午": "2", "巳": "3", ...}
    """
    palace_data = chart_data.get("宮位資料", {})
    eb_to_palace = {}

    for palace_name, palace_info in palace_data.items():
        earthly_branch = palace_info.get("宮位", "").strip()
        palace_code = palace_code_map.get(palace_name, "").strip()

        if earthly_branch and palace_code:
            eb_to_palace[earthly_branch] = palace_code

    return eb_to_palace


def extract_sihua_data(chart_data):
    """
    從四化資料提取「星曜→四化類型」映射

    Args:
        chart_data (dict): 完整命盤數據

    Returns:
        dict: {"太陽": "祿", "武曲": "權", "天同": "科", "天相": "忌"}
    """
    sihua_data = chart_data.get("四化資料", {})
    star_to_sihua = {}

    for sihua_type, sihua_info in sihua_data.items():
        star_name = sihua_info.get("星曜", "").strip()

        if star_name and sihua_type:
            star_to_sihua[star_name] = sihua_type

    return star_to_sihua


def encode_acquired_palace(chart_data, palace_code_map, eb_to_palace_map):
    """
    編碼身宮：Q + 宮位代碼

    Args:
        chart_data: 命盤數據
        palace_code_map: 宮位代碼映射
        eb_to_palace_map: 地支→宮位映射

    Returns:
        str: 身宮編碼（如 "Q5"）
    """
    acquired_palace_eb = chart_data.get("命盤數據", {}).get("身宮", "").strip()

    if not acquired_palace_eb:
        return None

    # 查詢身宮地支對應的宮位代碼
    palace_code = eb_to_palace_map.get(acquired_palace_eb)

    if palace_code:
        return f"Q{palace_code}"

    return None


def encode_life_lord(chart_data, star_code_map):
    """
    編碼命主：L + 星曜代碼

    Args:
        chart_data: 命盤數據
        star_code_map: 星曜代碼映射

    Returns:
        str: 命主編碼（如 "LMAR"）
    """
    life_lord_star = chart_data.get("命盤數據", {}).get("命主", "").strip()

    if not life_lord_star:
        return None

    star_code = star_code_map.get(life_lord_star)

    if star_code:
        return f"L{star_code}"

    return None


def encode_merit_lord(chart_data, star_code_map):
    """
    編碼身主：M + 星曜代碼

    Args:
        chart_data: 命盤數據
        star_code_map: 星曜代碼映射

    Returns:
        str: 身主編碼（如 "MBLE"）
    """
    merit_lord_star = chart_data.get("命盤數據", {}).get("身主", "").strip()

    if not merit_lord_star:
        return None

    star_code = star_code_map.get(merit_lord_star)

    if star_code:
        return f"M{star_code}"

    return None


def encode_gender(chart_data):
    """
    編碼性別：G + M/F

    Args:
        chart_data: 命盤數據

    Returns:
        str: 性別編碼（如 "GM" 或 "GF"）
    """
    gender = chart_data.get("基本資料", {}).get("性別", "").strip()

    if gender == "男":
        return "GM"
    elif gender == "女":
        return "GF"

    return None


def encode_year_gz(chart_data, heavenly_stem_map, earthly_branch_map):
    """
    編碼生年干支：Y + 天干代碼 + 地支代碼（v2.3 新增）

    年干支取自曆法數據（sxtwl 農曆年干支，已正確處理農曆年界），
    不可從西元年自行推算。

    Args:
        chart_data: 命盤數據
        heavenly_stem_map: 天干代碼映射
        earthly_branch_map: 地支代碼映射

    Returns:
        str: 生年干支編碼（如 "Y0404" = 丁卯年），資料不足時返回 None
    """
    calendar_data = chart_data.get("曆法數據", {})
    year_stem = calendar_data.get("出生年干", "").strip()
    year_branch = calendar_data.get("出生年支", "").strip()

    # 備援：從 生年干支 欄位拆字
    if not year_stem or not year_branch:
        year_gz = calendar_data.get("生年干支", "").strip()
        if len(year_gz) == 2:
            year_stem, year_branch = year_gz[0], year_gz[1]

    stem_code = heavenly_stem_map.get(year_stem)
    branch_code = earthly_branch_map.get(year_branch)

    if stem_code and branch_code:
        return f"Y{stem_code}{branch_code}"

    return None


def encode_star_brightness(chart_data, star_code_map, earthly_branch_map):
    """
    編碼星曜亮度：I + 星曜代碼 + 正負號 + 亮度值

    Args:
        chart_data: 命盤數據
        star_code_map: 星曜代碼映射
        earthly_branch_map: 地支代碼映射（保留參數以維持接口兼容性，但不使用）

    Returns:
        list: 星曜亮度編碼列表（如 ["ISUNP2", "IMAGN3", ...]）
    """
    brightness_data = chart_data.get("星曜亮度", {})
    brightness_encodings = []

    for star_name, brightness_str in brightness_data.items():
        star_name = star_name.strip()
        brightness_value = brightness_str.strip()

        # 獲取星曜代碼
        star_code = star_code_map.get(star_name)
        if not star_code:
            continue

        # 解析亮度值（正負號 + 數值）
        if brightness_value.startswith("-"):
            sign = "N"
            value = brightness_value[1:]
        elif brightness_value.startswith("+"):
            sign = "P"
            value = brightness_value[1:]
        else:
            sign = "P"
            value = brightness_value

        # 生成編碼：I + 星曜代碼 + 正負號 + 亮度值（移除地支代碼）
        encoding = f"I{star_code}{sign}{value}"
        brightness_encodings.append(encoding)

    return brightness_encodings


def encode_acquired_palace_stars(chart_data, star_code_map, earthly_branch_map, eb_to_palace_map, star_to_sihua_map, sihua_code_map):
    """
    編碼身宮位置的星曜：Q + 星曜代碼 + 地支 或 Q + 星曜代碼 + 四化

    Args:
        chart_data: 命盤數據
        star_code_map: 星曜代碼映射
        earthly_branch_map: 地支代碼映射
        eb_to_palace_map: 地支到宮位的映射
        star_to_sihua_map: 星曜到四化的映射
        sihua_code_map: 四化代碼映射

    Returns:
        list: 身宮星曜編碼列表（如 ["QMAR04", "QMARPW", "QVAN04", ...]）
    """
    # 獲取身宮的地支位置（命盤數據中的身宮直接就是地支）
    acquired_palace_eb = chart_data.get("命盤數據", {}).get("身宮", "").strip()
    if not acquired_palace_eb:
        return []

    # 找出身宮位置的所有星曜
    star_data = chart_data.get("星曜資料", {})
    acquired_stars_encodings = []

    for star_category, stars in star_data.items():
        if not isinstance(stars, dict):
            continue

        for star_name, earthly_branch in stars.items():
            star_name = star_name.strip()
            earthly_branch = earthly_branch.strip()

            # 只編碼身宮位置的星曜
            if earthly_branch != acquired_palace_eb:
                continue

            # 查詢星曜編碼
            star_code = star_code_map.get(star_name)
            if not star_code:
                continue

            # 查詢地支編碼
            eb_code = earthly_branch_map.get(earthly_branch)
            if not eb_code:
                continue

            # 生成基本編碼：Q + 星曜 + 地支
            basic_encoding = f"Q{star_code}{eb_code}"
            acquired_stars_encodings.append(basic_encoding)

            # 檢查是否有四化
            sihua_type = star_to_sihua_map.get(star_name)
            if sihua_type:
                sihua_code = sihua_code_map.get(sihua_type)
                if sihua_code:
                    # 生成四化編碼：Q + 星曜 + 四化（移除地支代碼）
                    sihua_encoding = f"Q{star_code}{sihua_code}"
                    acquired_stars_encodings.append(sihua_encoding)

    return acquired_stars_encodings


def encode_natal_chart(chart_data):
    """
    本命盤編碼主函數

    Args:
        chart_data (dict): 完整命盤數據

    Returns:
        dict: {
            "encoded_array": ["Q5", "LMAR", "MBLE", "QMAR04", "QMARPW", ..., "1POL08", "1POLPW", ...],
            "metadata": {...}
        }
    """
    # 步驟 1: 載入所有映射表
    palace_code_map, star_code_map, earthly_branch_map, sihua_code_map = load_encoding_mappings()

    # 步驟 2: 建立地支→宮位代碼的動態映射
    eb_to_palace_map = build_earthly_branch_to_palace_mapping(chart_data, palace_code_map)

    # 步驟 3: 提取四化資料
    star_to_sihua_map = extract_sihua_data(chart_data)

    # 步驟 4: 編碼身宮、命主、身主（放在最前面）
    encoded_list = []

    # 4.1 身宮編碼
    acquired_palace_code = encode_acquired_palace(chart_data, palace_code_map, eb_to_palace_map)
    if acquired_palace_code:
        encoded_list.append(acquired_palace_code)

    # 4.2 命主編碼
    life_lord_code = encode_life_lord(chart_data, star_code_map)
    if life_lord_code:
        encoded_list.append(life_lord_code)

    # 4.3 身主編碼
    merit_lord_code = encode_merit_lord(chart_data, star_code_map)
    if merit_lord_code:
        encoded_list.append(merit_lord_code)

    # 4.4 性別編碼（G + M/F）
    gender_code = encode_gender(chart_data)
    if gender_code:
        encoded_list.append(gender_code)

    # 4.5 生年干支編碼（Y + 天干代碼 + 地支代碼，v2.3 新增）
    heavenly_stem_map = load_heavenly_stem_codes()
    year_gz_code = encode_year_gz(chart_data, heavenly_stem_map, earthly_branch_map)
    if year_gz_code:
        encoded_list.append(year_gz_code)

    # 4.6 身宮星曜編碼（Q + 星曜代碼 + 地支）
    acquired_palace_stars = encode_acquired_palace_stars(
        chart_data, star_code_map, earthly_branch_map,
        eb_to_palace_map, star_to_sihua_map, sihua_code_map
    )
    encoded_list.extend(acquired_palace_stars)

    # 4.7 星曜亮度編碼（I + 星曜代碼 + 正負號 + 亮度值）
    brightness_encodings = encode_star_brightness(
        chart_data, star_code_map, earthly_branch_map
    )
    encoded_list.extend(brightness_encodings)

    # 步驟 5: 編碼所有宮位星曜
    star_data = chart_data.get("星曜資料", {})

    for star_category, stars in star_data.items():
        if not isinstance(stars, dict):
            continue

        for star_name, earthly_branch in stars.items():
            # 清理數據
            star_name = star_name.strip()
            earthly_branch = earthly_branch.strip()

            # 查詢星曜編碼
            star_code = star_code_map.get(star_name)
            if not star_code:
                # 跳過未知星曜
                continue

            # 查詢地支編碼
            eb_code = earthly_branch_map.get(earthly_branch)
            if not eb_code:
                # 跳過未知地支
                print(f"[WARNING] 未知地支: {earthly_branch} (星曜: {star_name})")
                continue

            # 查詢宮位代碼
            palace_code = eb_to_palace_map.get(earthly_branch)
            if not palace_code:
                # 跳過未知宮位
                print(f"[WARNING] 地支 {earthly_branch} 無對應宮位 (星曜: {star_name})")
                continue

            # 生成基本編碼：宮位 + 星曜 + 地支
            basic_encoding = f"{palace_code}{star_code}{eb_code}"
            encoded_list.append(basic_encoding)

            # 檢查是否有四化
            sihua_type = star_to_sihua_map.get(star_name)
            if sihua_type:
                sihua_code = sihua_code_map.get(sihua_type)
                if sihua_code:
                    # 生成四化編碼：宮位 + 星曜 + 四化（移除地支代碼）
                    sihua_encoding = f"{palace_code}{star_code}{sihua_code}"
                    encoded_list.append(sihua_encoding)

    # 步驟 6: 分離特殊編碼和宮位星曜編碼
    # 特殊編碼：Q5, LMAR, MBLE, GM, Y0404, QMAR04, QMARPW, ISUNP2 等（Q, L, M, G, I, Y 開頭）
    # 宮位星曜編碼：1POL08, 1POLPW, 2HPI07 等（數字或 A-C 開頭）
    special_codes = []
    palace_star_codes = []

    for code in encoded_list:
        first_char = code[0]
        if first_char in ['Q', 'L', 'M', 'G', 'I', 'Y']:
            special_codes.append(code)
        else:
            palace_star_codes.append(code)

    # 宮位順序
    palace_order = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "A", "B", "C"]

    def get_palace_order(encoding):
        palace_code = encoding[0]
        return palace_order.index(palace_code) if palace_code in palace_order else 99

    palace_star_codes.sort(key=get_palace_order)

    # 組合：特殊編碼 + 宮位星曜編碼
    final_encoded_array = special_codes + palace_star_codes

    # 步驟 7: 構建返回結果
    result = {
        "encoded_array": final_encoded_array
    }

    return result


def encode_chart_data(final_data):
    """
    主編碼入口函數（兼容舊接口）

    Args:
        final_data (dict): 完整命盤數據

    Returns:
        dict: 編碼結果
    """
    try:
        # 載入配置（使用動態路徑）
        config_base = get_config_path()
        config_path = config_base / "natal_chart_encoding.json"
        if config_path.exists():
            with open(config_path, 'r', encoding='utf-8') as f:
                config = json.load(f)
        else:
            config = {"encoding_version": "2.3"}

        # 執行本命盤編碼
        natal_encoding = encode_natal_chart(final_data)

        # 構建完整輸出結構（改為陣列格式，與大限、小限一致）
        result = {
            "encoding_version": config.get("encoding_version", "2.1"),
            "encoding_type": "full_chart",
            "natal_chart_encoding": [
                {
                    "chart_type": "natal",
                    "encoded_array": natal_encoding["encoded_array"]
                }
            ]
        }

        return result

    except Exception as e:
        print(f"[ERROR] 編碼失敗: {str(e)}")
        raise


# 測試函數
if __name__ == "__main__":
    print("=" * 70)
    print("本命盤編碼系統測試（v2.3）")
    print("=" * 70)

    # 測試 1: 載入映射表
    print("\n[測試 1] 載入映射表...")
    try:
        palace_map, star_map, eb_map, sihua_map = load_encoding_mappings()
        print(f"  [OK] 宮位映射表載入成功，共 {len(palace_map)} 個宮位")
        print(f"  [OK] 星曜映射表載入成功，共 {len(star_map)} 顆星")
        print(f"  [OK] 地支映射表載入成功，共 {len(eb_map)} 個地支")
        print(f"  [OK] 四化映射表載入成功，共 {len(sihua_map)} 種四化")
    except Exception as e:
        print(f"  [ERROR] 映射表載入失敗: {e}")

    # 測試 2: 使用小銘的命盤測試完整編碼
    print("\n[測試 2] 測試完整編碼（使用小銘的命盤）...")
    test_json_path = Path("docs/demo/19801117_小銘.json")

    if test_json_path.exists():
        with open(test_json_path, 'r', encoding='utf-8') as f:
            test_chart_data = json.load(f)

        try:
            encoding_result = encode_chart_data(test_chart_data)

            print(f"  [OK] 編碼完成")
            print(f"  - 版本: {encoding_result.get('encoding_version')}")
            print(f"  - 編碼數量: {len(encoding_result['本命盤編碼']['encoded_array'])}")
            print(f"  - 前 10 個編碼:")
            for i, code in enumerate(encoding_result['本命盤編碼']['encoded_array'][:10], 1):
                print(f"    {i}. {code}")

        except Exception as e:
            print(f"  [ERROR] 編碼失敗: {e}")
            import traceback
            traceback.print_exc()
    else:
        print(f"  [SKIP] 測試檔案不存在: {test_json_path}")

    print("\n" + "=" * 70)
