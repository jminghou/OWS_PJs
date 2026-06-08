import sxtwl
from datetime import datetime

def get_lichun_date(year):
    """
    獲取指定年份的立春日期和時間
    返回 (月, 日, 時, 分) 的元組
    """
    # 立春通常在2月3-5日之間，我們檢查2月1-10日的範圍
    for day in range(1, 11):
        try:
            lunar = sxtwl.fromSolar(year, 2, day)
            # 節氣編號 3 代表立春
            if lunar.getJieQi() == 3:
                # 立春通常在當日的下午或晚上，為了保險起見
                # 我們設定為當日的23:30（接近一天結束）
                # 這樣可以確保在立春時間不確定的情況下，傾向於使用前一年的年干支
                return (2, day, 23, 30)
        except:
            continue
    
    # 如果沒找到，使用默認值（2月4日23:30）
    return (2, 4, 23, 30)

def get_lunar_new_year_date(year):
    """
    獲取指定西曆年份的農曆新年（正月初一）對應的西曆日期
    返回 (月, 日) 的元組
    
    Args:
        year (int): 西曆年份
    
    Returns:
        tuple: (月, 日) - 該年農曆新年對應的西曆月日
    """
    # 農曆新年通常在西曆1月下旬到2月中旬之間
    for month in [1, 2]:
        for day in range(1, 32):
            try:
                lunar = sxtwl.fromSolar(year, month, day)
                if lunar.getLunarMonth() == 1 and lunar.getLunarDay() == 1:
                    return (month, day)
            except:
                continue
    
    # 如果沒找到，使用默認值（通常不會發生）
    return (2, 1)

def is_after_lichun(year, month, day, hour, minute):
    """
    判斷指定日期時間是否已過立春
    返回 True 表示已過立春，應使用當年干支
    返回 False 表示未過立春，應使用前一年干支
    """
    lichun_month, lichun_day, lichun_hour, lichun_minute = get_lichun_date(year)
    
    # 轉換為可比較的數值
    current_time = month * 10000 + day * 100 + hour + minute / 100
    lichun_time = lichun_month * 10000 + lichun_day * 100 + lichun_hour + lichun_minute / 100
    
    return current_time >= lichun_time

def is_after_lunar_new_year(year, month, day):
    """
    判斷指定日期是否已過農曆新年（正月初一）
    返回 True 表示已過農曆新年，應使用當年農曆年
    返回 False 表示未過農曆新年，應使用前一年農曆年
    
    Args:
        year (int): 西曆年份
        month (int): 西曆月份
        day (int): 西曆日期
    
    Returns:
        bool: True表示已過農曆新年，False表示未過農曆新年
    """
    new_year_month, new_year_day = get_lunar_new_year_date(year)
    
    # 轉換為可比較的數值
    current_date = month * 100 + day
    new_year_date = new_year_month * 100 + new_year_day
    
    return current_date >= new_year_date

def get_correct_year_gz(year, month, day, hour, minute):
    """
    根據農曆新年正確計算年干支
    注意：年干支的計算應該基於農曆新年，而不是立春節氣
    """
    heavenly_stems = "甲乙丙丁戊己庚辛壬癸"
    earthly_branches = "子丑寅卯辰巳午未申酉戌亥"
    
    # 判斷是否已過農曆新年
    if is_after_lunar_new_year(year, month, day):
        # 已過農曆新年，使用當年干支
        target_year = year
    else:
        # 未過農曆新年，使用前一年干支
        target_year = year - 1
    
    # 計算干支（以甲子年為起點，公元4年為甲子年）
    year_offset = target_year - 4
    stem_index = year_offset % 10
    branch_index = year_offset % 12
    
    return heavenly_stems[stem_index] + earthly_branches[branch_index]

def determine_yin_yang_gender(year_stem, gender):
    yang_stems = "甲丙戊庚壬"
    yin_stems = "乙丁己辛癸"
    
    if year_stem in yang_stems:
        return "陽男" if gender == "男" else "陽女"
    elif year_stem in yin_stems:
        return "陰男" if gender == "男" else "陰女"
    else:
        return "未知"

def lunar_to_solar(lunar_year, lunar_month, lunar_day, is_leap=False):
    """
    農曆 → 西曆轉換

    Args:
        lunar_year (int): 農曆年
        lunar_month (int): 農曆月（1-12）
        lunar_day (int): 農曆日（1-30）
        is_leap (bool): 該月是否為閏月

    Returns:
        tuple: 西曆 (year, month, day)

    Raises:
        ValueError: 當農曆日期不存在時（如該月僅 29 天卻輸入 30，或指定閏月不存在）
    """
    try:
        d = sxtwl.fromLunar(lunar_year, lunar_month, lunar_day, is_leap)
    except Exception as e:
        raise ValueError(
            f"無效的農曆日期 {lunar_year}年{'閏' if is_leap else ''}{lunar_month}月{lunar_day}日：{e}"
        )
    return d.getSolarYear(), d.getSolarMonth(), d.getSolarDay()


def calculate_lunar_date(solar_date, gender):
    if len(solar_date) == 4:
        year, month, day, hour = solar_date
        minute = 0
    elif len(solar_date) == 5:
        year, month, day, hour, minute = solar_date
    else:
        raise ValueError("solar_date should contain either 4 or 5 values")
    
    # 使用 sxtwl 模組計算農曆日期
    lunar = sxtwl.fromSolar(year, month, day)
    
    # 獲取農曆年、月、日
    lunar_year = lunar.getLunarYear()
    lunar_month = lunar.getLunarMonth()
    lunar_day = lunar.getLunarDay()
        
    # 獲取時辰
    lunar_hour = (hour + 1) // 2 % 12
    
    # 獲取額外信息
    month_gz = lunar.getMonthGZ()
    day_gz = lunar.getDayGZ()
    is_leap_month = lunar.isLunarLeap()
    week_day = lunar.getWeek()
    
    # 使用修正的年干支計算（考慮農曆新年）
    correct_year_gz = get_correct_year_gz(year, month, day, hour, minute)
    
    # 農曆月份名稱
    lunar_month_names = ["正", "二", "三", "四", "五", "六", "七", "八", "九", "十", "冬", "腊"]
    lunar_month_name = f"{'閏' if is_leap_month else ''}{lunar_month_names[lunar_month - 1]}月"
    
    # 天干地支
    heavenly_stems = "甲乙丙丁戊己庚辛壬癸"
    earthly_branches = "子丑寅卯辰巳午未申酉戌亥"
    
    # 星期
    week_names = ["日", "一", "二", "三", "四", "五", "六"]
    
    # 計算西曆星座
    constellation_dates = [(1, 20), (2, 19), (3, 21), (4, 20), (5, 21), (6, 22), 
                           (7, 23), (8, 23), (9, 23), (10, 24), (11, 23), (12, 22)]
    constellation_names = ["摩羯座", "水瓶座", "雙魚座", "白羊座", "金牛座", "雙子座", 
                           "巨蟹座", "獅子座", "處女座", "天秤座", "天蠍座", "射手座", "摩羯座"]
    constellation_index = len([d for d in constellation_dates if d <= (month, day)]) % 12
    
    year_stem = correct_year_gz[0]  # 取年干支的天干部分
    yin_yang_gender = determine_yin_yang_gender(year_stem, gender)
    
    return {
        "lunar_date": (lunar_year, lunar_month, lunar_day, lunar_hour),
        "year_gz": correct_year_gz,  # 使用修正後的年干支
        "month_gz": f"{heavenly_stems[month_gz.tg]}{earthly_branches[month_gz.dz]}",
        "day_gz": f"{heavenly_stems[day_gz.tg]}{earthly_branches[day_gz.dz]}",
        "is_leap_month": "是" if is_leap_month else "否",
        "lunar_month_name": lunar_month_name,
        "week_day": week_names[week_day],
        "constellation": constellation_names[constellation_index],
        "yin_yang_gender": yin_yang_gender
    }

def get_month_gz_by_year_gz(year_gz, lunar_month):
    heavenly_stems = "甲乙丙丁戊己庚辛壬癸"
    earthly_branches = "子丑寅卯辰巳午未申酉戌亥"
    
    year_stem = year_gz[0]
    year_stem_index = heavenly_stems.index(year_stem)
    
    # 計算月干
    month_stem_index = (year_stem_index * 2 + lunar_month - 1) % 10
    month_stem = heavenly_stems[month_stem_index]
    
    # 計算月支
    month_branch_index = (lunar_month + 1) % 12
    month_branch = earthly_branches[month_branch_index]
    
    return f"{month_stem}{month_branch}"

def get_solar_term(year, month, day):
    lunar = sxtwl.fromSolar(year, month, day)
    jq = lunar.getJieQi()
    if jq == 255:
        return None
    return jq
