"""
流年流动星曜计算模块

该模块负责计算流年的流动星曜，包括:
1. 干系星曜: 擎羊、陀羅、天鉞、天魁、祿存等
2. 支系星曜: 天喜、紅鸞等
通过读取流年宫位信息，获取对应的年干和地支，然后查找对应的星曜位置。
"""

from ..stars.year_g import get_year_g_stars
from ..stars.year_z import get_year_z_stars
from ..stars.moon import get_moon_stars

def extract_year_info_from_year_palace(year_palace_info):
    """
    从流年宫位信息中提取年干支信息
    
    Args:
        year_palace_info (dict): 流年宫位信息
        
    Returns:
        dict: 按宫位和年份组织的年干支信息 {"宮位名": [{"西元年": year, "年干": stem, "年支": branch}, ...]}
    """
    year_info_dict = {}
    
    # 遍历所有流年宫位
    for palace_name, palace_data in year_palace_info.items():
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

# 地支對應月份映射表（用於天馬轉流馬）
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

def get_year_horse_star(year_branch):
    """
    根據流年地支取得天馬位置（轉換為年馬）

    Args:
        year_branch (str): 流年地支

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

def calculate_year_star_position(year_palace_info, limit_years=10):
    """
    计算流年星曜位置
    
    Args:
        year_palace_info (dict): 流年宫位信息
        limit_years (int): 每个宫位限制的年份数量，默认为10
        
    Returns:
        dict: 流年星曜位置信息（新格式）
    """
    result = {}
    
    # 提取各流年宫位的年干支信息
    year_info_dict = extract_year_info_from_year_palace(year_palace_info)
    
    # 需要计算的干系星曜列表和对应的新名称映射
    stem_star_list = ["擎羊", "陀羅", "天鉞", "天魁", "祿存"]
    stem_star_rename = {
        "擎羊": "年羊",
        "陀羅": "年陀",
        "天鉞": "年鉞",
        "天魁": "年魁",
        "祿存": "年祿"
    }

    # 需要计算的支系星曜列表和对应的新名称映射
    branch_star_list = ["天喜", "紅鸞"]
    branch_star_rename = {
        "天喜": "年喜",
        "紅鸞": "年鸞",
        "天馬": "年馬"
    }
    
    # 遍历所有宫位及其年份信息
    for palace_name, year_info_list in year_info_dict.items():
        # 创建该宫位的星曜整合数据
        star_data = {}
        
        # 对每个星曜创建一个位置列表，使用新的命名
        for old_name, new_name in stem_star_rename.items():
            star_data[new_name] = []
        
        for old_name, new_name in branch_star_rename.items():
            star_data[new_name] = []
        
        # 限制每个宫位处理的年份数量，避免数据过大
        for year_info in year_info_list[:limit_years]:
            year_stem = year_info["年干"]
            year_branch = year_info["年支"]
            
            # 获取该年干对应的星曜位置
            stem_stars_position = get_year_g_stars(year_stem)
            
            # 获取该地支对应的星曜位置
            branch_stars_position = get_year_z_stars(year_branch)
            
            # 收集干系星曜位置，并使用新名称
            for old_name, new_name in stem_star_rename.items():
                if old_name in stem_stars_position:
                    star_data[new_name].append(stem_stars_position[old_name])

            # 收集支系星曜位置，并使用新名称
            for old_name, new_name in branch_star_rename.items():
                if old_name in branch_stars_position:
                    star_data[new_name].append(branch_stars_position[old_name])

            # 計算天馬（年馬）
            horse_position = get_year_horse_star(year_branch)
            if horse_position:
                # 確保年馬列表已初始化
                if "年馬" not in star_data:
                    star_data["年馬"] = []
                star_data["年馬"].append(horse_position)
        
        # 将星曜位置转换为逗号分隔的字符串
        for star in list(star_data.keys()):
            if star_data[star]:
                star_data[star] = ",".join(star_data[star])
            else:
                # 如果没有收集到任何位置，删除该星曜
                del star_data[star]
        
        # 将该宫位的所有信息存储到结果中，使用新的字段名称
        if palace_name in year_palace_info:
            result[palace_name] = {
                "歲數": year_palace_info[palace_name].get("歲數", ""),
                "流年農曆年": year_palace_info[palace_name].get("農曆年", ""),
                "流年西元年": year_palace_info[palace_name].get("西元年", ""),
                "宮位": year_palace_info[palace_name].get("宮位", ""),
                "流年星曜": [star_data] if star_data else []
            }
    
    return result

def get_year_star_info(solar_date, basic_data, palace_info, year_palace_data=None, lunar_info=None):
    """
    获取流年星曜数据
    
    Args:
        solar_date: 公历日期 (年, 月, 日, 时, 分)
        basic_data: 基本资料字典
        palace_info: 宫位资料字典
        year_palace_data: 可选的流年宫位数据，如果提供则直接使用
        lunar_info: 历法信息字典(可选)
        
    Returns:
        dict: 流年星曜信息
    """
    try:
        # 如果没有提供流年宫位数据，尝试导入year_palace模块计算
        if year_palace_data is None:
            try:
                from ..flow.year_palace import get_year_palace_data
                year_palace_data = get_year_palace_data(solar_date, basic_data, palace_info)
            except ImportError as e:
                print(f"[WARNING]: 无法导入 year_palace 模块: {e}")
                return {"流年資料": {}}
        
        # 获取流年宫位数据
        year_palace_info = year_palace_data.get("流年宮位", {})
        
        # 如果流年宫位数据为空，则返回空结果
        if not year_palace_info:
            print("[WARNING]: 流年宫位数据为空")
            return {"流年資料": {}}
        
        # 计算流年星曜位置
        enhanced_year_palace_info = calculate_year_star_position(year_palace_info)
        
        return {"流年資料": enhanced_year_palace_info}
    except Exception as e:
        print(f"计算流年星曜时发生错误: {str(e)}")
        import traceback
        traceback.print_exc()
        # 返回空字典作为默认值
        return {"流年資料": {}}

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
    
    # 测试计算流年星曜
    from ..flow.year_palace import get_year_palace_data
    year_palace_data = get_year_palace_data(test_solar_date, test_basic_data, test_palace_info)
    
    enhanced_result = get_year_star_info(test_solar_date, test_basic_data, test_palace_info, year_palace_data)
    
    print("\n流年星曜测试结果:")
    for palace_name, palace_info in enhanced_result["流年資料"].items():
        print(f"{palace_name}:")
        print(f"  宫位: {palace_info.get('宮位', '')}")
        print(f"  西元年: {palace_info.get('流年西元年', '')}")
        print(f"  流年星曜:")
        for star_set in palace_info.get("流年星曜", []):
            for star, positions in star_set.items():
                print(f"    {star}: {positions}")
