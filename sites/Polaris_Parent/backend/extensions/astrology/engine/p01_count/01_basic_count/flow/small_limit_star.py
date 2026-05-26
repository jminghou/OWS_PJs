"""
小限流动星曜计算模块

该模块负责计算小限的流动星曜，包括:
1. 干系星曜: 擎羊、陀羅、天鉞、天魁、祿存等
2. 支系星曜: 天喜、紅鸞等
通过读取小限宫位信息，获取对应的年干和地支，然后查找对应的星曜位置。
"""

from ..stars.year_g import get_year_g_stars
from ..stars.year_z import get_year_z_stars
from ..stars.moon import get_moon_stars

# 地支對應月份映射表（用於天馬轉小馬）
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

def get_one_horse_star(year_branch):
    """
    根據小限地支取得天馬位置（轉換為小馬）

    Args:
        year_branch (str): 小限地支

    Returns:
        str: 天馬所在地支位置，如果查詢失敗則返回空字符串
    """
    # 將地支轉換為對應的月份
    lunar_month = BRANCH_TO_MONTH.get(year_branch)

    if lunar_month is None:
        return ""

    # 查詢該月份的天馬位置
    moon_stars = get_moon_stars(lunar_month)
    return moon_stars.get("天馬", "")

def extract_year_info_from_one_palace(one_palace_info):
    """
    从小限宫位信息中提取年干支信息
    
    Args:
        one_palace_info (dict): 小限宫位信息
        
    Returns:
        dict: 按宫位和年份组织的年干支信息 {"宮位名": [{"西元年": year, "年干": stem, "年支": branch}, ...]}
    """
    year_info_dict = {}
    
    # 遍历所有小限宫位
    for palace_name, palace_data in one_palace_info.items():
        # 获取西元年、农历年和岁数列表
        if "西元年" in palace_data and "農曆年" in palace_data and "歲數" in palace_data:
            western_years = palace_data["西元年"].split(",")
            lunar_years = palace_data["農曆年"].split(",")
            ages = palace_data["歲數"].split(",")
            
            # 创建该宫位的年份信息列表
            year_info_list = []
            
            # 确保三个列表长度相同
            min_length = min(len(western_years), len(lunar_years), len(ages))
            
            for i in range(min_length):
                western_year = western_years[i].strip()
                lunar_year = lunar_years[i].strip()
                age = ages[i].strip()
                
                # 从农历年中提取年干和年支
                if len(lunar_year) >= 2:
                    year_stem = lunar_year[0]  # 第一个字符为年干
                    year_branch = lunar_year[1]  # 第二个字符为年支
                    
                    # 添加到年份信息列表
                    year_info_list.append({
                        "西元年": western_year,
                        "歲數": age,
                        "年干": year_stem,
                        "年支": year_branch
                    })
            
            # 将该宫位的年份信息保存到结果字典
            if year_info_list:
                year_info_dict[palace_name] = year_info_list
    
    return year_info_dict

def calculate_one_star_position_new_format(one_palace_info, palace_info=None, limit_years=10):
    """
    使用新格式计算小限星曜位置

    Args:
        one_palace_info (dict): 小限宫位信息
        palace_info (dict): 宮位資料（用於獲取宮位干支）
        limit_years (int): 每个宫位限制的年份数量，默认为10

    Returns:
        dict: 小限星曜位置信息（新格式）
    """
    result = {}

    # 提取各小限宫位的年干支信息
    year_info_dict = extract_year_info_from_one_palace(one_palace_info)

    # 需要计算的干系星曜列表和对应的新名称映射
    stem_star_list = ["擎羊", "陀羅", "天鉞", "天魁", "祿存"]
    stem_star_rename = {
        "擎羊": "小羊",
        "陀羅": "小陀",
        "天鉞": "小鉞",
        "天魁": "小魁",
        "祿存": "小祿"
    }

    # 需要计算的支系星曜列表和对应的新名称映射
    branch_star_list = ["天喜", "紅鸞"]
    branch_star_rename = {
        "天喜": "小喜",
        "紅鸞": "小鸞",
        "天馬": "小馬"
    }

    # 遍历所有宫位及其年份信息
    for palace_name, year_info_list in year_info_dict.items():
        # 獲取宮位地支
        palace_branch = one_palace_info[palace_name].get("宮位", "")

        # 獲取宮位天干
        palace_stem = ""
        if palace_info and "宮位資料" in palace_info and palace_name in palace_info["宮位資料"]:
            ganzhi = palace_info["宮位資料"][palace_name].get("干支", "")
            if len(ganzhi) >= 1:
                palace_stem = ganzhi[0]

        # 如果無法獲取宮位干支，跳過此宮位
        if not palace_stem or not palace_branch:
            continue

        # 根據宮位干支查詢星曜位置（固定，不隨年份變化）
        stem_stars_position = get_year_g_stars(palace_stem)
        branch_stars_position = get_year_z_stars(palace_branch)
        horse_position = get_one_horse_star(palace_branch)

        # 创建该宫位的星曜整合数据
        star_data = {}

        # 对每个星曜创建一个位置列表，使用新的命名
        for old_name, new_name in stem_star_rename.items():
            star_data[new_name] = []

        for old_name, new_name in branch_star_rename.items():
            star_data[new_name] = []

        # 限制每个宫位处理的年份数量，避免数据过大
        for year_info in year_info_list[:limit_years]:
            # 收集干系星曜位置，并使用新名称
            for old_name, new_name in stem_star_rename.items():
                if old_name in stem_stars_position:
                    star_data[new_name].append(stem_stars_position[old_name])

            # 收集支系星曜位置，并使用新名称
            for old_name, new_name in branch_star_rename.items():
                if old_name in branch_stars_position:
                    star_data[new_name].append(branch_stars_position[old_name])

            # 計算天馬（小馬）
            if horse_position:
                # 確保小馬列表已初始化
                if "小馬" not in star_data:
                    star_data["小馬"] = []
                star_data["小馬"].append(horse_position)

        # 将星曜位置转换为逗号分隔的字符串
        for star in list(star_data.keys()):
            if star_data[star]:
                star_data[star] = ",".join(star_data[star])
            else:
                # 如果没有收集到任何位置，删除该星曜
                del star_data[star]
        
        # 将该宫位的所有信息存储到结果中，使用新的字段名称
        if palace_name in one_palace_info:
            result[palace_name] = {
                "歲數": one_palace_info[palace_name].get("歲數", ""),
                "小限農曆年": one_palace_info[palace_name].get("農曆年", ""),
                "小限西元年": one_palace_info[palace_name].get("西元年", ""),
                "宮位": one_palace_info[palace_name].get("宮位", ""),
                "小限星曜": [star_data] if star_data else []
            }
    
    return result

# 保留原始格式的函数，以便在需要时使用
def calculate_one_star_position(one_palace_info, limit_years=10):
    """
    计算小限星曜位置
    
    Args:
        one_palace_info (dict): 小限宫位信息
        limit_years (int): 每个宫位限制的年份数量，默认为10
        
    Returns:
        dict: 小限星曜位置信息
    """
    result = {}
    
    # 提取各小限宫位的年干支信息
    year_info_dict = extract_year_info_from_one_palace(one_palace_info)
    
    # 需要计算的干系星曜列表
    stem_star_list = ["擎羊", "陀羅", "天鉞", "天魁", "祿存"]
    
    # 需要计算的支系星曜列表
    branch_star_list = ["天喜", "紅鸞"]
    
    # 遍历所有宫位及其年份信息
    for palace_name, year_info_list in year_info_dict.items():
        # 创建该宫位的星曜年表
        star_years_list = []
        
        # 限制每个宫位处理的年份数量，避免数据过大
        for year_info in year_info_list[:limit_years]:
            year_stem = year_info["年干"]
            year_branch = year_info["年支"]
            western_year = year_info["西元年"]
            age = year_info["歲數"]
            
            # 获取该年干对应的星曜位置
            stem_stars_position = get_year_g_stars(year_stem)
            
            # 获取该地支对应的星曜位置
            branch_stars_position = get_year_z_stars(year_branch)
            
            # 合并需要的干系和支系星曜
            year_stars = {}
            
            # 筛选需要的干系星曜
            for star in stem_star_list:
                if star in stem_stars_position:
                    year_stars[star] = stem_stars_position[star]
            
            # 筛选需要的支系星曜
            for star in branch_star_list:
                if star in branch_stars_position:
                    year_stars[star] = branch_stars_position[star]
            
            # 添加到星曜年表
            star_years_list.append({
                "西元年": western_year,
                "歲數": age,
                "年干": year_stem,
                "年支": year_branch,
                "星曜": year_stars
            })
        
        # 将该宫位的所有信息存储到结果中
        if palace_name in one_palace_info:
            result[palace_name] = {
                "歲數": one_palace_info[palace_name].get("歲數", ""),
                "農曆年": one_palace_info[palace_name].get("農曆年", ""),
                "西元年": one_palace_info[palace_name].get("西元年", ""),
                "宮位": one_palace_info[palace_name].get("宮位", ""),
                "星曜年表": star_years_list
            }
    
    return result

def get_one_star_info(solar_date, basic_data, palace_info, one_palace_data=None, lunar_info=None, use_new_format=True):
    """
    获取小限星曜数据

    Args:
        solar_date: 公历日期 (年, 月, 日, 时, 分)
        basic_data: 基本资料字典
        palace_info: 宫位资料字典
        one_palace_data: 可选的小限宫位数据，如果提供则直接使用
        lunar_info: 历法信息字典(可选)
        use_new_format: 是否使用新格式（默认为True）

    Returns:
        dict: 小限星曜信息
    """
    try:
        # 如果没有提供小限宫位数据，尝试导入one_palace模块计算
        if one_palace_data is None:
            try:
                from ..flow.small_limit_palace import get_one_palace_data
                one_palace_data = get_one_palace_data(solar_date, basic_data, palace_info, lunar_info)
            except ImportError as e:
                print(f"[WARNING]: 无法导入 one_palace 模块: {e}")
                return {"小限資料": {}}

        # 获取小限宫位数据
        one_palace_info = one_palace_data.get("小限宮位", {})

        # 如果小限宫位数据为空，则返回空结果
        if not one_palace_info:
            print("[WARNING]: 小限宫位数据为空")
            return {"小限資料": {}}

        # 根据格式选择使用哪个计算函数
        if use_new_format:
            # 使用新格式计算小限星曜位置（傳入palace_info）
            enhanced_one_palace_info = calculate_one_star_position_new_format(one_palace_info, palace_info)
        else:
            # 使用原格式计算小限星曜位置
            enhanced_one_palace_info = calculate_one_star_position(one_palace_info)

        return {"小限資料": enhanced_one_palace_info}
    except Exception as e:
        print(f"计算小限星曜时发生错误: {str(e)}")
        import traceback
        traceback.print_exc()
        # 返回空字典作为默认值
        return {"小限資料": {}}

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
    
    # 测试计算小限星曜（使用新格式）
    from ..flow.small_limit_palace import get_one_palace_data
    one_palace_data = get_one_palace_data(test_solar_date, test_basic_data, test_palace_info)
    
    enhanced_result = get_one_star_info(test_solar_date, test_basic_data, test_palace_info, one_palace_data, use_new_format=True)
    
    print("\n小限星曜测试结果 (新格式):")
    for palace_name, palace_info in enhanced_result["小限資料"].items():
        print(f"{palace_name}:")
        print(f"  宫位: {palace_info.get('宮位', '')}")
        print(f"  西元年: {palace_info.get('小限西元年', '')}")
        print(f"  小限星曜:")
        for star_set in palace_info.get("小限星曜", []):
            for star, positions in star_set.items():
                print(f"    {star}: {positions}")
    
    # 测试使用原格式
    original_result = get_one_star_info(test_solar_date, test_basic_data, test_palace_info, one_palace_data, use_new_format=False)
    
    print("\n小限星曜测试结果 (原格式):")
    for palace_name, palace_info in original_result["小限資料"].items():
        print(f"{palace_name}:")
        print(f"  宫位: {palace_info.get('宮位', '')}")
        print(f"  西元年: {palace_info.get('西元年', '')}")
        print(f"  星曜年表:")
        for year_info in palace_info.get("星曜年表", []):
            print(f"    {year_info['西元年']}年 ({year_info['年干']}{year_info['年支']}):")
            print(f"      星曜: {year_info['星曜']}")
