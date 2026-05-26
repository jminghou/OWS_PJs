from datetime import datetime
from ..palace.subject import calculate_twelve_palaces
# 移除循环导入
# from ..function.lunar import get_complete_lunar_info

def get_one_palace_data(solar_date, basic_data, palace_info, lunar_info=None):
    """
    计算小限宮位数据
    
    Args:
        solar_date: 公历日期 (年, 月, 日, 时, 分)
        basic_data: 基本资料字典
        palace_info: 宫位资料字典
        lunar_info: 历法信息字典(可选)，如果提供则直接使用
        
    Returns:
        dict: 包含小限宮位数据的字典
    """
    try:
        # 移除冗余日志
        # print(f"開始計算小限宮位...")
        
        # 从基本数据中获取性别
        gender = basic_data.get('性別', '男')  # 默认为男性
        
        # 获取年支 - 尝试多种方式获取年支信息
        year_branch = ""
        year_stem = ""
        
        # 1. 首先从传入的lunar_info中获取
        if lunar_info and "year_branch" in lunar_info:
            year_branch = lunar_info["year_branch"]
            if "year_stem" in lunar_info:
                year_stem = lunar_info["year_stem"]
        # 2. 尝试从palace_info中获取
        elif "年支" in palace_info:
            year_branch = palace_info["年支"]
            if "年干" in palace_info:
                year_stem = palace_info["年干"]
        # 3. 尝试从农历干支中提取
        elif "農曆干支" in palace_info:
            year_gz = palace_info["農曆干支"]
            if len(year_gz) >= 2:
                if len(year_gz) >= 1:
                    year_stem = year_gz[0]  # 取干支的第一个字符作为年干
                year_branch = year_gz[1]  # 取干支的第二个字符作为年支
        # 4. 尝试从曆法數據中获取
        elif "曆法數據" in palace_info and "出生年支" in palace_info["曆法數據"]:
            year_branch = palace_info["曆法數據"]["出生年支"]
            if "出生年干" in palace_info["曆法數據"]:
                year_stem = palace_info["曆法數據"]["出生年干"]
        
        # 如果都没有找到，尝试最后一次从日柱等数据中提取
        if not year_branch and "日柱" in palace_info:
            day_gz = palace_info["日柱"]
            if len(day_gz) >= 2:
                year_branch = day_gz[1]  # 在这里我们尝试使用日支作为替代
        
        # 获取出生年
        birth_year = solar_date[0]
        
        if not year_branch:
            # 移除冗余日志
            # print("[WARNING]: 無法獲取年支信息，請確保提供了正確的曆法數據")
            return {"小限宮位": {}}
        
        # 移除冗余日志
        # print(f"基本信息: 性別={gender}, 年支={year_branch}, 出生年={birth_year}")
        
        # 獲取小限表數據
        one_limit_data = read_one_limit_table()
        
        # 確定年支所屬的組合(寅午戌、申子辰等)
        year_branch_group = get_year_branch_group(year_branch)
        
        # 根據年支組合和性別獲取對應的小限宮位表
        key = f"{year_branch_group},{gender}"
        
        # 檢查是否存在對應的小限數據
        if key not in one_limit_data:
            # 移除冗余日志
            # print(f"[WARNING]: 沒有找到與 {year_branch_group} 和 {gender} 匹配的小限數據")
            return {"小限宮位": {}}
            
        one_limit_positions = one_limit_data[key]
        # 移除冗余日志
        # print(f"小限宮位組合: {year_branch_group}, 小限順序: {one_limit_positions[:3]}...")
        
        # 定义12个主要宫位
        main_palace_names = ["命宮", "兄弟", "夫妻", "子女", "財帛", "疾厄", "遷移", "交友", "官祿", "田宅", "福德", "父母"]
        
        # 获取命宫位置，用于计算十二宫位
        ming_palace = None
        
        # 首先尝试从palace_info获取宮位資料中的命宮
        if "宮位資料" in palace_info and "命宮" in palace_info["宮位資料"]:
            if isinstance(palace_info["宮位資料"]["命宮"], dict) and "宮位" in palace_info["宮位資料"]["命宮"]:
                ming_palace = palace_info["宮位資料"]["命宮"]["宮位"]
        
        # 尝试从palace_info中获取命宫位置
        if not ming_palace and "命宮" in palace_info:
            if isinstance(palace_info["命宮"], dict):
                if "宮位" in palace_info["命宮"]:
                    ming_palace = palace_info["命宮"]["宮位"]
                elif "地支" in palace_info["命宮"]:
                    ming_palace = palace_info["命宮"]["地支"]
            elif isinstance(palace_info["命宮"], str) and len(palace_info["命宮"]) == 1:
                ming_palace = palace_info["命宮"]
        
        # 如果上述方法未获取到命宫，尝试直接从宫位资料中获取
        if not ming_palace:
            for key, value in palace_info.items():
                if key == "命宮" and isinstance(value, str) and len(value) == 1:
                    ming_palace = value
                    break
        
        if not ming_palace:
            # 移除冗余日志
            # print("[WARNING]: 無法獲取命宮位置，無法計算十二宮位")
            return {"小限宮位": {}}
        
        # 移除冗余日志
        # print(f"命宮位置: {ming_palace}")
        
        # 使用p02_subject.py中的函数计算十二宫位
        twelve_palaces = calculate_twelve_palaces(ming_palace)
        
        # 创建小限宮位数据
        small_limit_data = {}
        
        # 中文天干地支列表用于生成农历年干支
        heavenly_stems = "甲乙丙丁戊己庚辛壬癸"
        earthly_branches = "子丑寅卯辰巳午未申酉戌亥"

        # 計算出生年干支在列表中的索引（用於干支循環計算）
        birth_stem_index = heavenly_stems.index(year_stem) if year_stem else 0
        birth_branch_index = earthly_branches.index(year_branch) if year_branch else 0

        # 计算120岁内的小限数据
        max_age = 120
        
        for palace_name in main_palace_names:
            # 获取宮位对应的地支 - 直接从计算得到的十二宫位中获取
            palace_branch = twelve_palaces.get(palace_name, "")
            
            if not palace_branch:
                # 移除冗余日志
                # print(f"[WARNING]: 無法獲取宮位 {palace_name} 的地支信息")
                continue
                
            # 找出所有对应于这个宮位的歲數
            age_list = []
            year_list = []
            lunar_year_list = []
            
            for age in range(1, max_age + 1):
                # 根据年龄计算对应的小限宮位
                table_index = (age - 1) % 12  # 从0开始索引
                if table_index < len(one_limit_positions) and one_limit_positions[table_index] == palace_branch:
                    # 计算西元年
                    western_year = birth_year + age - 1  # 出生那年算1岁
                    age_list.append(str(age))
                    year_list.append(str(western_year))

                    # 使用干支循環直接計算農曆年干支（與流年相同的正確方法）
                    # 1歲對應出生年，所以偏移量為 age - 1
                    years_passed = age - 1
                    current_stem_index = (birth_stem_index + years_passed) % 10
                    current_branch_index = (birth_branch_index + years_passed) % 12
                    lunar_year = f"{heavenly_stems[current_stem_index]}{earthly_branches[current_branch_index]}"
                    lunar_year_list.append(lunar_year)
            
            if age_list:
                small_limit_data[palace_name] = {
                    "歲數": ",".join(age_list[:10]),  # 只保留前10个，避免过长
                    "農曆年": ",".join(lunar_year_list[:10]),  # 添加农历年信息
                    "西元年": ",".join(year_list[:10]),   # 年份改为西元年
                    "宮位": palace_branch
                }
        
        # 移除冗余日志
        # print(f"完成小限宮位計算: 總共 {len(small_limit_data)} 個宮位")
        
        return {"小限宮位": small_limit_data}
    except Exception as e:
        import traceback
        print(f"計算小限宮位數據時發生異常: {str(e)}")
        return {"小限宮位": {}}

def get_year_branch_group(year_branch):
    """
    根据年支确定其所属的组合
    
    Args:
        year_branch: 年支(子、丑、寅等)
        
    Returns:
        str: 年支所属的组合(寅午戌、申子辰、巳酉丑、亥卯未)
    """
    if year_branch in "寅午戌":
        return "寅午戌"
    elif year_branch in "申子辰":
        return "申子辰"
    elif year_branch in "巳酉丑":
        return "巳酉丑"
    elif year_branch in "亥卯未":
        return "亥卯未"
    else:
        # 不再輸出警告訊息，直接使用默認組合
        return "寅午戌"  # 返回一个默认组合

def read_one_limit_table():
    """
    获取小限表数据
    
    Returns:
        dict: 包含小限表数据的字典，键为"年支组合,性別"，值为对应的地支列表
    """
    # 直接返回内置的小限表数据
    return {
        "寅午戌,男": ["辰", "巳", "午", "未", "申", "酉", "戌", "亥", "子", "丑", "寅", "卯"],
        "寅午戌,女": ["辰", "卯", "寅", "丑", "子", "亥", "戌", "酉", "申", "未", "午", "巳"],
        "申子辰,男": ["戌", "亥", "子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉"],
        "申子辰,女": ["戌", "酉", "申", "未", "午", "巳", "辰", "卯", "寅", "丑", "子", "亥"],
        "巳酉丑,男": ["未", "申", "酉", "戌", "亥", "子", "丑", "寅", "卯", "辰", "巳", "午"],
        "巳酉丑,女": ["未", "午", "巳", "辰", "卯", "寅", "丑", "子", "亥", "戌", "酉", "申"],
        "亥卯未,男": ["丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥", "子"],
        "亥卯未,女": ["丑", "子", "亥", "戌", "酉", "申", "未", "午", "巳", "辰", "卯", "寅"]
    }
