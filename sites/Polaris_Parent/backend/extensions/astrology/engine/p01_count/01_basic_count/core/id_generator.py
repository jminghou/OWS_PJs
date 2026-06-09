"""
ID 生成工具模組

用於生成命盤唯一識別碼 (chart_id)
格式: YYYYMMDDGnnnnnnnnn (18 位整數)
- YYYYMMDD: 鐘錶時間出生年月日 (8位)
- G: 性別碼，1 代表男，2 代表女 (1位)
- nnnnnnnnn: 姓名雜湊值 (9位數字)
"""

import hashlib
import re
from datetime import datetime


def compute_lookup_user_id(name: str, clock_time: str) -> int:
    """
    產生跨批次人物 lookup 用的 user_id（無性別 hash，60-bit BIGINT）

    這是 account.users.user_id 的計算公式。新批次（研究筆記）沒有 Gender 欄位，
    無法重算 chart_id，但可用相同的 (Name, Clock time) 算出同一個 user_id 來
    對應到舊批次已上傳的人物。

    參數:
        name (str): JSON 頂層 "Name" 欄位
        clock_time (str): JSON 頂層 "Clock time" 欄位（如 "25 April 1902 at 07:15"）

    返回:
        int: 60-bit user_id（PostgreSQL BIGINT 範圍內的正整數）
    """
    unique_key = f"{name}|{clock_time}"
    hash_value = hashlib.sha256(unique_key.encode('utf-8')).hexdigest()
    return int(hash_value[:15], 16)


def hash_name_to_int(name):
    """
    使用 SHA256 雜湊姓名，轉換為 9 位整數

    參數:
        name (str): 姓名（原名）

    返回:
        int: 9 位整數雜湊值
    """
    if not name:
        raise ValueError("姓名不能為空")

    # 統一使用 UTF-8 編碼
    name_bytes = name.encode('utf-8')

    # 計算 SHA256 雜湊值
    hash_object = hashlib.sha256(name_bytes)
    hash_hex = hash_object.hexdigest()

    # 取前 8 位 16 進位字元 (32 bits)，轉為整數後對 10^9 取模
    # 確保結果為 9 位數
    hash_int = int(hash_hex[:8], 16)
    return hash_int % 1000000000


def generate_chart_id(birth_date, gender, original_name):
    """
    生成命盤唯一識別碼 (18 位 BIGINT)

    參數:
        birth_date (str): 出生日期，格式可為 "YYYY-MM-DD" 或 "YYYY,MM-DD"
        gender (str): 性別，"男" 或 "女"（或 "M" 或 "F"）
        original_name (str): 原名

    返回:
        int: 18 位唯一識別碼

    範例:
        >>> generate_chart_id("1980-11-17", "男", "Jermaine")
        198011171077594112 (範例數值)
    """
    # 驗證輸入
    if not birth_date or not gender or not original_name:
        raise ValueError("出生日期、性別、原名都不能為空")

    # 處理日期格式（支援 "YYYY-MM-DD" 或 "YYYY,MM-DD"）
    date_str = birth_date.replace(',', '-').strip()

    try:
        # 解析日期
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        date_val = int(dt.strftime("%Y%m%d"))  # YYYYMMDD as int
    except ValueError:
        raise ValueError(f"日期格式錯誤: {birth_date}，應為 YYYY-MM-DD 或 YYYY,MM-DD")

    # 處理性別碼
    gender = gender.strip()
    if gender == "男" or gender.upper() == "M":
        gender_code = 1
    elif gender == "女" or gender.upper() == "F":
        gender_code = 2
    else:
        raise ValueError(f"性別錯誤: {gender}，應為 '男'、'女'、'M' 或 'F'")

    # 生成姓名雜湊 (9位)
    name_hash = hash_name_to_int(original_name)

    # 組合成完整 ID (18位)
    # 結構: YYYYMMDD (8位) + G (1位) + Hash (9位)
    chart_id = (date_val * 10**10) + (gender_code * 10**9) + name_hash

    return chart_id


def validate_chart_id(chart_id):
    """
    驗證 chart_id 格式是否正確

    參數:
        chart_id (int 或 str): 待驗證的 ID

    返回:
        bool: 格式是否正確
    """
    if chart_id is None:
        return False
    
    try:
        id_str = str(chart_id)
        # 必須是 18 位數字
        if not id_str.isdigit() or len(id_str) != 18:
            return False
        
        # 提取生日部分進行基本驗證
        date_str = id_str[:8]
        datetime.strptime(date_str, "%Y%m%d")
        
        # 提取性別碼
        gender_code = int(id_str[8])
        if gender_code not in [1, 2]:
            return False
            
        return True
    except (ValueError, IndexError):
        return False


def parse_chart_id(chart_id):
    """
    解析 chart_id，提取各部分資訊

    參數:
        chart_id (int 或 str): 命盤 ID

    返回:
        dict: 包含 birth_date, gender_code, name_hash 的字典
    """
    if not validate_chart_id(chart_id):
        raise ValueError(f"無效的 chart_id 格式: {chart_id}")

    id_int = int(chart_id)
    
    # 使用數學運算提取
    # Hash (後 9 位)
    name_hash = id_int % 10**9
    
    # Gender (中間 1 位)
    gender_code_val = (id_int // 10**9) % 10
    gender_code = 'm' if gender_code_val == 1 else 'f'
    
    # Birth Date (前 8 位)
    date_val = id_int // 10**10
    date_str = str(date_val)
    birth_date = f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:8]}"

    return {
        'birth_date': birth_date,
        'gender_code': gender_code,
        'name_hash': str(name_hash).zfill(9)
    }


# 測試用程式碼（僅在直接執行此檔案時運行）
if __name__ == "__main__":
    print("=== ID 生成工具測試 (BIGINT 版) ===\n")

    # 測試案例 1
    test_id = generate_chart_id("1980-11-17", "男", "Jermaine")
    print(f"測試 1: {test_id}")
    print(f"型別: {type(test_id)}")
    print(f"格式驗證: {validate_chart_id(test_id)}")
    print(f"解析結果: {parse_chart_id(test_id)}\n")

    # 測試案例 2
    test_id2 = generate_chart_id("1993,01-20", "女", "Ailee")
    print(f"測試 2: {test_id2}")
    print(f"格式驗證: {validate_chart_id(test_id2)}")
    print(f"解析結果: {parse_chart_id(test_id2)}\n")

    # 測試案例 3：相同姓名應產生相同雜湊
    id_a = generate_chart_id("2000-01-01", "男", "測試")
    id_b = generate_chart_id("2000-01-01", "男", "測試")
    print(f"測試 3 (相同輸入):")
    print(f"  ID A: {id_a}")
    print(f"  ID B: {id_b}")
    print(f"  相同: {id_a == id_b}\n")

    # 測試案例 4：不同姓名應產生不同雜湊
    id_c = generate_chart_id("2000-01-01", "男", "小明")
    id_d = generate_chart_id("2000-01-01", "男", "小華")
    print(f"測試 4 (不同姓名):")
    print(f"  ID C: {id_c}")
    print(f"  ID D: {id_d}")
    print(f"  不同: {id_c != id_d}\n")

    print("=== 測試完成 ===")
