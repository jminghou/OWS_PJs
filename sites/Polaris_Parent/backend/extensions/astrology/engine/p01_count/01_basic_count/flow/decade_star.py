"""
大限流动星曜计算模块

该模块负责计算大限的流动星曜，包括:
1. 干系星曜: 大羊(擎羊)、大陀(陀羅)、大鉞(天鉞)、大魁(天魁)、大祿(祿存)等
2. 支系星曜: 大喜(天喜)、大鸞(紅鸞)等
通过读取大限宫位信息，获取对应的年干和地支，然后查找对应的星曜位置。
"""

from ..stars.year_g import get_year_g_stars
from ..stars.year_z import get_year_z_stars
from ..stars.moon import get_moon_stars

def extract_ten_year_stem(ten_palace_info):
    """
    从大限宫位信息中提取年干
    
    Args:
        ten_palace_info (dict): 大限宫位信息
        
    Returns:
        dict: 包含宫位和年干的字典 {"宮位名": "年干"}
    """
    ten_year_stems = {}
    
    # 遍历所有大限宫位
    for palace_name, palace_data in ten_palace_info.items():
        # 从大限名称中提取年干
        limit_name = palace_data.get("大限名稱", "")
        if limit_name and len(limit_name) >= 1:
            year_stem = limit_name[0]  # 取第一个字符作为年干
            ten_year_stems[palace_name] = year_stem
    
    return ten_year_stems

def extract_ten_palace_branch(ten_palace_info):
    """
    从大限宫位信息中提取地支
    
    Args:
        ten_palace_info (dict): 大限宫位信息
        
    Returns:
        dict: 包含宫位和地支的字典 {"宮位名": "地支"}
    """
    ten_palace_branches = {}
    
    # 遍历所有大限宫位
    for palace_name, palace_data in ten_palace_info.items():
        # 直接获取宫位地支
        palace_branch = palace_data.get("宮位", "")
        if palace_branch:
            ten_palace_branches[palace_name] = palace_branch
    
    return ten_palace_branches

# 地支對應月份映射表（用於天馬轉大馬）
BRANCH_TO_MONTH = {
    '寅': 1,   # 正月
    '卯': 2,   # 二月
    '辰': 3,   # 三月
    '巳': 4,   # 四月
    '午': 5,   # 五月
    '未': 6,   # 六月
    '申': 7,   # 七月
    '酉': 8,   # 八月
    '戌': 9,   # 九月
    '亥': 10,  # 十月
    '子': 11,  # 十一月
    '丑': 12   # 十二月
}

# 星曜名称映射表
STAR_NAME_MAPPING = {
    "擎羊": "大羊",
    "陀羅": "大陀",
    "天鉞": "大鉞",
    "天魁": "大魁",
    "祿存": "大祿",
    "天喜": "大喜",
    "紅鸞": "大鸞",
    "天馬": "大馬"
}

def get_ten_horse_star(palace_branch):
    """
    根據大限宮位地支取得天馬位置（轉換為大馬）

    Args:
        palace_branch (str): 大限宮位地支

    Returns:
        str: 天馬所在地支位置，如果查詢失敗則返回空字符串
    """
    # 將地支轉換為對應的月份
    lunar_month = BRANCH_TO_MONTH.get(palace_branch)

    if lunar_month is None:
        return ""

    # 查詢該月份的天馬位置
    moon_stars = get_moon_stars(lunar_month)
    return moon_stars.get("天馬", "")

def calculate_ten_star_position(ten_palace_info):
    """
    计算大限星曜位置
    
    Args:
        ten_palace_info (dict): 大限宫位信息
        
    Returns:
        dict: 大限星曜位置信息
    """
    result = {}
    
    # 提取各大限宫位的年干
    ten_year_stems = extract_ten_year_stem(ten_palace_info)
    
    # 提取各大限宫位的地支
    ten_palace_branches = extract_ten_palace_branch(ten_palace_info)
    
    # 需要计算的干系星曜列表
    stem_star_list = ["擎羊", "陀羅", "天鉞", "天魁", "祿存"]
    
    # 需要计算的支系星曜列表
    branch_star_list = ["天喜", "紅鸞"]
    
    # 遍历所有大限宫位
    for palace_name, year_stem in ten_year_stems.items():
        # 获取该年干对应的星曜位置
        stem_stars_position = get_year_g_stars(year_stem)

        # 获取该地支对应的星曜位置（如果有地支信息）
        branch_stars_position = {}
        if palace_name in ten_palace_branches:
            palace_branch = ten_palace_branches[palace_name]
            branch_stars_position = get_year_z_stars(palace_branch)

        # 筛选需要的干系星曜并转换名称
        palace_stars = {}
        for star in stem_star_list:
            if star in stem_stars_position:
                new_star_name = STAR_NAME_MAPPING.get(star, star)
                palace_stars[new_star_name] = stem_stars_position[star]

        # 筛选需要的支系星曜并转换名称
        for star in branch_star_list:
            if star in branch_stars_position:
                new_star_name = STAR_NAME_MAPPING.get(star, star)
                palace_stars[new_star_name] = branch_stars_position[star]

        # 計算天馬（大馬）
        if palace_name in ten_palace_branches:
            palace_branch = ten_palace_branches[palace_name]
            horse_position = get_ten_horse_star(palace_branch)
            if horse_position:
                palace_stars["大馬"] = horse_position

        # 存储结果
        result[palace_name] = {
            "年干": year_stem,
            "地支": ten_palace_branches.get(palace_name, ""),
            "大限星曜": palace_stars
        }
    
    return result

def get_ten_star_data(solar_date, basic_data, palace_info, ten_palace_data=None):
    """
    【已弃用】获取独立的大限星曜数据（此函数保留仅为兼容性目的）
    请改用 get_ten_star_info 函数获取整合到大限宫位的星曜数据
    
    Args:
        solar_date: 公历日期 (年, 月, 日, 时, 分)
        basic_data: 基本资料字典
        palace_info: 宫位资料字典
        ten_palace_data: 可选的大限宫位数据，如果提供则直接使用
        
    Returns:
        dict: 大限星曜信息
    """
    print("[WARNING]: get_ten_star_data 函数已弃用，请改用 get_ten_star_info 函数")
    
    # 调用增强版函数并提取星曜部分
    enhanced_data = get_ten_star_info(solar_date, basic_data, palace_info, ten_palace_data)
    
    # 从增强版数据中提取独立星曜信息
    result = {"大限星曜": {}}
    
    for palace_name, palace_data in enhanced_data.get("大限資料", {}).items():
        result["大限星曜"][palace_name] = {
            "年干": palace_data.get("年干", ""),
            "地支": palace_data.get("地支", ""),
            "大限星曜": palace_data.get("大限星曜", {})
        }
    
    return result

def get_ten_star_info(solar_date, basic_data, palace_info, ten_palace_data=None):
    """
    获取增强版大限星曜数据，将星曜直接整合到大限宫位数据中
    
    Args:
        solar_date: 公历日期 (年, 月, 日, 时, 分)
        basic_data: 基本资料字典
        palace_info: 宫位资料字典
        ten_palace_data: 可选的大限宫位数据，如果提供则直接使用
        
    Returns:
        dict: 增强版大限星曜信息
    """
    try:
        # 如果没有提供大限宫位数据，尝试导入ten_palace模块计算
        if ten_palace_data is None:
            try:
                from ..flow.decade_palace import get_ten_palace_data
                ten_palace_data = get_ten_palace_data(solar_date, basic_data, palace_info)
            except ImportError as e:
                print(f"[WARNING]: 无法导入 ten_palace 模块: {e}")
                return {"大限資料": {}}
        
        # 获取大限宫位数据
        ten_palace_info = ten_palace_data.get("大限宮位", {}).copy()
        
        # 提取各大限宫位的年干
        ten_year_stems = extract_ten_year_stem(ten_palace_info)
        
        # 提取各大限宫位的地支
        ten_palace_branches = extract_ten_palace_branch(ten_palace_info)
        
        # 需要计算的干系星曜列表
        stem_star_list = ["擎羊", "陀羅", "天鉞", "天魁", "祿存"]
        
        # 需要计算的支系星曜列表
        branch_star_list = ["天喜", "紅鸞"]
        
        # 遍历所有大限宫位，整合星曜信息
        for palace_name, year_stem in ten_year_stems.items():
            if palace_name in ten_palace_info:
                # 获取该年干对应的星曜位置
                stem_stars_position = get_year_g_stars(year_stem)

                # 获取该地支对应的星曜位置（如果有地支信息）
                branch_stars_position = {}
                palace_branch = ten_palace_branches.get(palace_name, "")
                if palace_branch:
                    branch_stars_position = get_year_z_stars(palace_branch)

                # 筛选需要的干系星曜并添加到宫位数据中，同时转换名称
                star_data = {}
                for star in stem_star_list:
                    if star in stem_stars_position:
                        new_star_name = STAR_NAME_MAPPING.get(star, star)
                        star_data[new_star_name] = stem_stars_position[star]

                # 筛选需要的支系星曜并添加到宫位数据中，同时转换名称
                for star in branch_star_list:
                    if star in branch_stars_position:
                        new_star_name = STAR_NAME_MAPPING.get(star, star)
                        star_data[new_star_name] = branch_stars_position[star]

                # 計算天馬（大馬）
                if palace_branch:
                    horse_position = get_ten_horse_star(palace_branch)
                    if horse_position:
                        star_data["大馬"] = horse_position

                # 将星曜信息整合到宫位数据中
                ten_palace_info[palace_name]["年干"] = year_stem
                ten_palace_info[palace_name]["地支"] = palace_branch
                ten_palace_info[palace_name]["大限星曜"] = star_data

                # 将"西元區間"改为"大限西元區間"
                if "西元區間" in ten_palace_info[palace_name]:
                    ten_palace_info[palace_name]["大限西元區間"] = ten_palace_info[palace_name].pop("西元區間")
        
        return {"大限資料": ten_palace_info}
    except Exception as e:
        print(f"计算大限星曜时发生错误: {str(e)}")
        # 返回空字典作为默认值
        return {"大限資料": {}}

# 保留兼容性，将增强版函数别名设为旧函数名
get_enhanced_ten_star_data = get_ten_star_info

# 测试代码，在导入模块时不会执行
if __name__ == "__main__":
    # 模拟测试数据
    test_solar_date = (1990, 1, 1, 12, 0)
    test_basic_data = {
        "性別": "男"
    }
    test_palace_info = {
        "命宮干支": "甲子",
        "命宮": "寅",
        "五行局": "水二局"
    }
    
    # 测试计算增强版大限星曜
    from ..flow.decade_palace import get_ten_palace_data
    ten_palace_data = get_ten_palace_data(test_solar_date, test_basic_data, test_palace_info)
    
    enhanced_result = get_ten_star_info(test_solar_date, test_basic_data, test_palace_info, ten_palace_data)
    
    print("\n增强版大限資料测试结果:")
    for palace_name, palace_info in enhanced_result["大限資料"].items():
        print(f"{palace_name}:")
        print(f"  大限名称: {palace_info.get('大限名稱', '')}")
        print(f"  年干: {palace_info.get('年干', '')}")
        print(f"  地支: {palace_info.get('地支', '')}")
        print(f"  大限西元区间: {palace_info.get('大限西元區間', '')}")
        print(f"  大限星曜: {palace_info.get('大限星曜', {})}")
