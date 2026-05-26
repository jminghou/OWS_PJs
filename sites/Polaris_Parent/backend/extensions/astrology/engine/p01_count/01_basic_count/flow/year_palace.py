from ..function.lunar import get_complete_lunar_info
from ..palace.gz import get_palace_gz
from datetime import datetime

def calculate_years_in_palace(birth_year, birth_year_branch, birth_year_stem, age_range=120):
    """
    计算每个宫位对应的年龄、农历年干支和年份
    以命主出生年支为1岁的命宫，以农历为基准

    Args:
        birth_year: 出生年份(西元)
        birth_year_branch: 出生年支
        birth_year_stem: 出生年干
        age_range: 计算的年龄范围

    Returns:
        dict: 每个宫位对应的年龄和年份信息
    """
    # 农历地支顺序，用于确定流年宫位
    earthly_branches = "子丑寅卯辰巳午未申酉戌亥"

    # 建立每个地支对应的年龄和年份信息
    palace_years = {branch: {"歲數": [], "農曆年": [], "西元年": []} for branch in earthly_branches}

    # 天干地支
    heavenly_stems = "甲乙丙丁戊己庚辛壬癸"

    # 设立出生年支在地支中的索引
    birth_branch_index = earthly_branches.index(birth_year_branch)
    birth_stem_index = heavenly_stems.index(birth_year_stem)

    # 计算1岁到age_range岁的每个年龄所对应的年份和宫位
    for age in range(1, age_range + 1):
        year = birth_year + age - 1

        # 使用干支循环直接计算该年的干支
        # 1岁对应出生年，所以偏移量为 age - 1
        years_passed = age - 1
        current_stem_index = (birth_stem_index + years_passed) % 10
        current_branch_index = (birth_branch_index + years_passed) % 12

        year_stem = heavenly_stems[current_stem_index]
        year_branch = earthly_branches[current_branch_index]
        lunar_year_gz = f"{year_stem}{year_branch}"

        # 计算该年对应的宫位地支
        # 以出生年支为起点，每年以顺序累加，对应地支索引
        # 注意：第一年(1岁)对应的宫位就是出生年支
        branch_index = (birth_branch_index + age - 1) % 12
        palace_branch = earthly_branches[branch_index]

        # 将年龄、农历年干支和年份添加到对应宫位的列表中
        palace_years[palace_branch]["歲數"].append(str(age))
        palace_years[palace_branch]["農曆年"].append(lunar_year_gz)
        palace_years[palace_branch]["西元年"].append(str(year))
    
    # 将列表转换为逗号分隔的字符串，仅保留前10个元素
    for branch in palace_years:
        palace_years[branch]["歲數"] = ",".join(palace_years[branch]["歲數"][:10])
        palace_years[branch]["農曆年"] = ",".join(palace_years[branch]["農曆年"][:10])
        palace_years[branch]["西元年"] = ",".join(palace_years[branch]["西元年"][:10])
    
    return palace_years

def get_palace_position(palace_name, palace_info):
    """根据宫位名称获取其所在地支位置"""
    # 首先尝试从新的数据格式中获取
    if palace_name in palace_info and isinstance(palace_info[palace_name], dict) and "宮位" in palace_info[palace_name]:
        return palace_info[palace_name]["宮位"]
    
    # 尝试从直接赋值的格式中获取（如果palace_info[palace_name]是一个直接的地支值）
    if palace_name in palace_info and isinstance(palace_info[palace_name], str) and len(palace_info[palace_name]) == 1:
        return palace_info[palace_name]
    
    # 尝试从重组后的宫位资料中获取
    if "宮位資料" in palace_info and palace_name in palace_info["宮位資料"]:
        if isinstance(palace_info["宮位資料"][palace_name], dict) and "宮位" in palace_info["宮位資料"][palace_name]:
            return palace_info["宮位資料"][palace_name]["宮位"]
    
    # 尝试从老格式中获取
    if "十二宮" in palace_info:
        palaces = palace_info['十二宮'].split(', ')
        for palace in palaces:
            name, position = palace.split('：')
            if name == palace_name:
                return position
    
    print(f"[WARNING]: 无法获取宫位 {palace_name} 的地支位置")
    return None

def get_year_palace_data(solar_date, basic_data, palace_info):
    """
    获取流年宫位数据
    
    Args:
        solar_date: 公历日期 (年, 月, 日, 时, 分)
        basic_data: 基本资料字典
        palace_info: 宫位资料字典
        
    Returns:
        dict: 流年宫位数据
    """
    try:
        birth_year = solar_date[0]
        gender = basic_data.get('性別', basic_data.get('基本資料', {}).get('性別', ''))
        
        # 获取完整的历法信息
        lunar_info = get_complete_lunar_info(solar_date, gender, palace_info, basic_data)

        # 获取出生年干支
        birth_year_stem = lunar_info["曆法數據"]["出生年干"]
        birth_year_branch = lunar_info["曆法數據"]["出生年支"]

        # 宫位名称列表
        palace_names = ["命宮", "兄弟", "夫妻", "子女", "財帛", "疾厄",
                        "遷移", "交友", "官祿", "田宅", "福德", "父母"]

        # 计算每个宫位对应的年龄和年份，以出生年支为1岁的命宫
        palace_years = calculate_years_in_palace(birth_year, birth_year_branch, birth_year_stem)
        
        # 构建流年资料
        year_palace_data = {"流年宮位": {}}
        
        # 遍历所有宫位获取地支信息
        for name in palace_names:
            # 获取宫位的地支
            palace_branch = get_palace_position(name, palace_info)
            
            # 检查宫位地支是否有效
            if palace_branch and palace_branch in palace_years:
                year_palace_data["流年宮位"][name] = {
                    "歲數": palace_years[palace_branch]["歲數"],
                    "農曆年": palace_years[palace_branch]["農曆年"],
                    "西元年": palace_years[palace_branch]["西元年"],
                    "宮位": palace_branch
                }
        
        return year_palace_data
    except Exception as e:
        print(f"计算流年宫位数据时发生错误: {e}")
        return {"流年宮位": {}}

# 保留此函数以兼容旧代码，但内部调用新函数
def integrate_year_palace_data(solar_date, basic_data, palace_info):
    """
    整合流年宫位数据 (为了向后兼容)
    
    Args:
        solar_date: 公历日期 (年, 月, 日, 时, 分)
        basic_data: 基本资料字典
        palace_info: 宫位资料字典
        
    Returns:
        dict: 整合了流年宫位数据的字典
    """
    return get_year_palace_data(solar_date, basic_data, palace_info)
