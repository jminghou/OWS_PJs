from ..core.sxtwl_utils import calculate_lunar_date

def convert_day_to_chinese(day):
    """
    將阿拉伯數字日期轉換為中文農曆日期格式
    
    Args:
        day (int): 農曆日期（1-30）
    
    Returns:
        str: 中文農曆日期格式（如：初一、十五、二十二等）
    """
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

def get_lunar_info(solar_date, gender):
    lunar_data = calculate_lunar_date(solar_date, gender)
    lunar_year, lunar_month, lunar_day, lunar_hour = lunar_data["lunar_date"]
    
    earthly_branches = "子丑寅卯辰巳午未申酉戌亥"
    hour_branch = earthly_branches[lunar_hour]
    
    # 使用數字格式的農曆日期，避免天干地支轉換錯誤
    year_gz = lunar_data['year_gz']
    
    return {
        "農曆生日": f"{lunar_year}年{lunar_month}月{lunar_day}日",
        "農曆干支": f"{lunar_data['year_gz']}年",
        "農曆時辰": f"{hour_branch}時",
        "constellation": lunar_data["constellation"],
        "陰陽": lunar_data["yin_yang_gender"],
        "is_leap_month": lunar_data["is_leap_month"],
        "week_day": lunar_data["week_day"]
    }

def get_zodiac(year_branch):
    zodiac = ["鼠", "牛", "虎", "兔", "龍", "蛇", "馬", "羊", "猴", "雞", "狗", "豬"]
    return zodiac["子丑寅卯辰巳午未申酉戌亥".index(year_branch)]

def format_time_string(year, month, day, hour, minute):
    """
    將時間格式化為 YYYY,MM-DD,hh:mm 格式
    
    Args:
        year (int): 年份
        month (int): 月份
        day (int): 日期
        hour (int): 小時
        minute (int): 分鐘
    
    Returns:
        str: 格式化的時間字串
    """
    return f"{year},{month:02d}-{day:02d},{hour:02d}:{minute:02d}"

def parse_date_time(date_str, time_str):
    """
    解析日期時間字串
    
    Args:
        date_str (str): 日期字串，格式如 "11-17"
        time_str (str): 時間字串，格式如 "18:30"
    
    Returns:
        tuple: (月, 日, 時, 分)
    """
    try:
        if '-' in date_str:
            month, day = map(int, date_str.split('-'))
        else:
            month, day = 1, 1
            
        if ':' in time_str:
            hour, minute = map(int, time_str.split(':'))
        else:
            hour, minute = 0, 0
            
        return month, day, hour, minute
    except:
        return 1, 1, 0, 0

def get_complete_lunar_info(solar_date, gender, palace_info, basic_data):
    """
    整合所有与历法相关的数据处理，包括日历数据和生肖信息，并将数据分为"曆法數據"和"命盤數據"两个部分
    
    参数:
    solar_date (tuple): 阳历日期，格式为(年, 月, 日, 时, 分) - 用於曆法計算的時間
    gender (str): 性别，"男"或"女"
    palace_info (dict): 宫位信息
    basic_data (dict): 基本資料，包含原始時間和太陽時間資料
    
    返回:
    dict: 包含所有历法相关的完整信息，按照"曆法數據"和"命盤數據"拆分
    """
    lunar_data = get_lunar_info(solar_date, gender)
    
    # 直接從 core_sxtwl 獲取原始農曆數字，避免解析複雜的中文格式
    core_lunar_data = calculate_lunar_date(solar_date, gender)
    lunar_year, lunar_month, lunar_day, lunar_hour = core_lunar_data["lunar_date"]
    
    hour_branch = lunar_data["農曆時辰"].replace('時', '')
    year_stem = lunar_data["農曆干支"][0]
    year_branch = lunar_data["農曆干支"][1]
    
    # 獲取年份（從 solar_date 中取得）
    year = solar_date[0]
    
    # 格式化用於曆法計算的時間（太陽時間）
    solar_time_formatted = format_time_string(year, solar_date[1], solar_date[2], solar_date[3], solar_date[4])
    
    # 從 basic_data 中獲取原始鐘錶時間資料
    original_date = basic_data.get('原始出生日期', '')
    original_time = basic_data.get('原始出生時間', '')
    
    # 解析並格式化鐘錶時間
    if original_date and original_time:
        orig_month, orig_day, orig_hour, orig_minute = parse_date_time(original_date, original_time)
        clock_time_formatted = format_time_string(year, orig_month, orig_day, orig_hour, orig_minute)
    else:
        # 如果沒有原始時間資料，使用計算時間作為備用
        clock_time_formatted = solar_time_formatted
    
    # 创建"曆法數據"部分
    calendar_data = {
        "太陽時間": solar_time_formatted,
        "鐘錶時間": clock_time_formatted,
        "農曆出生日期": lunar_data["農曆生日"],
        "閏年": "是" if lunar_data["is_leap_month"] == "是" else "否",
        "出生時辰": lunar_data["農曆時辰"],
        "出生年干": year_stem,
        "出生年支": year_branch,
        "生年干支": lunar_data["農曆干支"].replace('年', ''),
        "星期": lunar_data["week_day"]
    }
    
    # 创建"命盤數據"部分
    chart_data = {
        "生肖": get_zodiac(year_branch),
        "星座": lunar_data.get("constellation", "未知"),
        "陰陽": lunar_data["陰陽"],
        "身宮": palace_info['身宮'],
        "命主": palace_info['命主'],
        "身主": palace_info['身主'],
        "五行局": palace_info['五行局']
    }
    
    # 返回完整信息和解析后的农历数据，便于其他模块使用
    return {
        "曆法數據": calendar_data,
        "命盤數據": chart_data,
        "lunar_month": lunar_month,
        "lunar_day": lunar_day,
        "hour_branch": hour_branch,
        "year_stem": year_stem,
        "year_branch": year_branch
    }
