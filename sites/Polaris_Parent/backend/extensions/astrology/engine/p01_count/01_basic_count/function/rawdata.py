from .lunar import get_lunar_info, get_complete_lunar_info
from .palace_helper import get_complete_palace_info
from .stars_main import get_stars_info, organize_stars_in_palaces
from ..flow.flow_rawdata import get_flowdata
import re

def convert_lunar_date_to_chinese(lunar_date_str):
    """
    將數字格式的農曆日期轉換為中文格式
    例如：'1980年10月10日' -> '庚申年十月初十'
    
    Args:
        lunar_date_str (str): 數字格式的農曆日期，如 "1980年10月10日"
    
    Returns:
        str: 中文格式的農曆日期，如 "庚申年十月初十"
    """
    # 解析數字格式的農曆日期
    match = re.match(r'(\d+)年(\d+)月(\d+)日', lunar_date_str)
    if not match:
        return lunar_date_str  # 如果格式不匹配，返回原字串
    
    year, month, day = map(int, match.groups())
    
    # 計算該年的天干地支
    heavenly_stems = "甲乙丙丁戊己庚辛壬癸"
    earthly_branches = "子丑寅卯辰巳午未申酉戌亥"
    
    # 計算干支（以甲子年為起點，公元4年為甲子年）
    year_offset = year - 4
    stem_index = year_offset % 10
    branch_index = year_offset % 12
    year_gz = heavenly_stems[stem_index] + earthly_branches[branch_index]
    
    # 月份名稱轉換
    lunar_month_names = ["正", "二", "三", "四", "五", "六", "七", "八", "九", "十", "冬", "腊"]
    month_name = f"{lunar_month_names[month - 1]}月"
    
    # 日期轉換為中文格式
    def convert_day_to_chinese(day):
        chinese_numbers = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"]
        
        if day <= 10:
            return f"初{chinese_numbers[day]}"
        elif day < 20:
            return f"十{chinese_numbers[day - 10]}"
        elif day == 20:
            return "二十"
        elif day < 30:
            return f"二十{chinese_numbers[day - 20]}"
        else:  # day == 30
            return "三十"
    
    day_chinese = convert_day_to_chinese(day)
    
    return f"{year_gz}年{month_name}{day_chinese}"

def format_data(title, data, indent=0):
    indent_str = "  " * indent
    formatted = f"{indent_str}{title}:\n"
    
    for key, value in data.items():
        if isinstance(value, dict):
            formatted += format_data(key, value, indent + 1)
        else:
            formatted += f"{indent_str}  {key}: {value}\n"
    
    return formatted

def get_all_data(solar_date, basic_data):
    # 获取基础农历信息
    lunar_data = get_lunar_info(solar_date, basic_data.get('性別', basic_data.get('基本資料', {}).get('性別', '')))
    
    # 获取完整宫位信息
    complete_palace_data = get_complete_palace_info(
        lunar_data["農曆生日"], 
        lunar_data["農曆時辰"], 
        lunar_data["農曆干支"]
    )
    
    # 提取原始宫位信息和重组后的宫位数据
    palace_info = complete_palace_data["palace_info"]
    reorganized_palace_info = complete_palace_data["reorganized_palace_info"]
    
    # 使用新函数获取完整的历法信息，傳遞 basic_data 參數
    gender = basic_data.get('性別', basic_data.get('基本資料', {}).get('性別', ''))
    complete_lunar_info = get_complete_lunar_info(solar_date, gender, palace_info, basic_data)
    
    # 从完整历法信息中提取所需数据
    lunar_month = complete_lunar_info["lunar_month"]
    lunar_day = complete_lunar_info["lunar_day"]
    hour_branch = complete_lunar_info["hour_branch"]
    year_stem = complete_lunar_info["year_stem"]
    year_branch = complete_lunar_info["year_branch"]
    
    # 获取星曜信息
    stars_info, stars_brightness, four_trans_info = get_stars_info(
        palace_info["五行局"], 
        lunar_day, 
        lunar_month, 
        hour_branch, 
        year_stem, 
        year_branch,
        palace_info
    )
    stars_in_palaces = organize_stars_in_palaces(stars_info, palace_info)
    
    # 修改日誌訊息為更簡潔的形式
    print("完成本命盤計算")
    
    # 将重组后的宫位资料添加到palace_info中，以便flow函数可以访问
    palace_info["宮位資料"] = reorganized_palace_info

    # 获取流年数据（包括大限資料、小限資料和流年資料）
    flow_data = get_flowdata(solar_date, basic_data, palace_info, complete_lunar_info)
    
    # 创建结果字典
    result = {
        # 历法数据和命盘数据
        '曆法數據': complete_lunar_info['曆法數據'].copy(),
        '命盤數據': complete_lunar_info['命盤數據'],       
        # 宫位和星曜数据
        '宮位資料': reorganized_palace_info,
        '星曜資料': stars_info,
        '星曜亮度': stars_brightness,
        '四化資料': four_trans_info,
    }
    
    # 在最後階段將農曆出生日期轉換為中文格式（用於顯示）
    if '農曆出生日期' in result['曆法數據']:
        result['曆法數據']['農曆出生日期'] = convert_lunar_date_to_chinese(
            result['曆法數據']['農曆出生日期']
        )
    
    # 添加流年数据（增强版）
    if "大限資料" in flow_data:
        result['大限資料'] = flow_data['大限資料']
    
    if "大限四化" in flow_data:
        result['大限四化'] = flow_data['大限四化']
    
    if "小限資料" in flow_data:
        result['小限資料'] = flow_data['小限資料']
    
    if "流年資料" in flow_data:
        result['流年資料'] = flow_data['流年資料']
    
    return result

# 提供一个新的函数，专门获取增强版数据结构，方便未来使用
def get_enhanced_data(solar_date, basic_data):
    # 获取基础农历信息
    lunar_data = get_lunar_info(solar_date, basic_data.get('性別', basic_data.get('基本資料', {}).get('性別', '')))
    
    # 获取完整宫位信息
    complete_palace_data = get_complete_palace_info(
        lunar_data["農曆生日"], 
        lunar_data["農曆時辰"], 
        lunar_data["農曆干支"]
    )
    
    # 提取原始宫位信息和重组后的宫位数据
    palace_info = complete_palace_data["palace_info"]
    reorganized_palace_info = complete_palace_data["reorganized_palace_info"]
    
    # 使用新函数获取完整的历法信息，傳遞 basic_data 參數
    gender = basic_data.get('性別', basic_data.get('基本資料', {}).get('性別', ''))
    complete_lunar_info = get_complete_lunar_info(solar_date, gender, palace_info, basic_data)
    
    # 从完整历法信息中提取所需数据
    lunar_month = complete_lunar_info["lunar_month"]
    lunar_day = complete_lunar_info["lunar_day"]
    hour_branch = complete_lunar_info["hour_branch"]
    year_stem = complete_lunar_info["year_stem"]
    year_branch = complete_lunar_info["year_branch"]
    
    # 获取星曜信息
    stars_info, stars_brightness, four_trans_info = get_stars_info(
        palace_info["五行局"], 
        lunar_day, 
        lunar_month, 
        hour_branch, 
        year_stem, 
        year_branch,
        palace_info
    )
    stars_in_palaces = organize_stars_in_palaces(stars_info, palace_info)
    
    # 修改日誌訊息為更簡潔的形式
    print("完成本命盤計算")
    
    # 获取流年数据（已是增强版）
    flow_data = get_flowdata(solar_date, basic_data, palace_info, complete_lunar_info)
    
    # 創建結果字典
    result = {
        # 历法数据和命盘数据
        '曆法數據': complete_lunar_info['曆法數據'].copy(),
        '命盤數據': complete_lunar_info['命盤數據'],       
        # 宫位和星曜数据
        '宮位資料': reorganized_palace_info,
        '星曜資料': stars_info,
        '星曜亮度': stars_brightness,
        '四化資料': four_trans_info,
        # 流年数据（使用增强版结构）
        '大限資料': flow_data.get('大限資料', {}),
        '大限四化': flow_data.get('大限四化', {}),
        '小限資料': flow_data.get('小限資料', {}),
        '流年資料': flow_data.get('流年資料', {})
    }
    
    # 在最後階段將農曆出生日期轉換為中文格式（用於顯示）
    if '農曆出生日期' in result['曆法數據']:
        result['曆法數據']['農曆出生日期'] = convert_lunar_date_to_chinese(
            result['曆法數據']['農曆出生日期']
        )
    
    return result
