from .moon import get_moon_stars
from .hour import get_hour_stars

def count_palace_position(start_palace, count, clockwise=True):
    # 定义十二宫位的顺序
    palaces = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']
    start_index = palaces.index(start_palace)
    
    if clockwise:
        # 顺时针数
        target_index = (start_index + count - 1) % 12
    else:
        # 逆时针数
        target_index = (start_index - count + 1) % 12
    
    return palaces[target_index]

def get_days_stars(lunar_month, lunar_day, hour_branch):
    # 获取月系星的位置（包含左辅、右弼）
    moon_stars = get_moon_stars(lunar_month)
    
    # 获取时系星的位置（包含文昌、文曲）
    hour_stars = get_hour_stars(hour_branch)
    
    # 从月系星中提取左辅、右弼的位置
    zuofu_position = moon_stars['左輔']
    youbi_position = moon_stars['右弼']
    
    # 从时系星中提取文昌、文曲的位置
    wenzhang_position = hour_stars['文昌']
    wenqu_position = hour_stars['文曲']
    
    # 计算三台位置（从左辅位置顺时针数）
    santai_position = count_palace_position(zuofu_position, lunar_day, clockwise=True)
    
    # 计算八座位置（从右弼位置逆时针数）
    bazu_position = count_palace_position(youbi_position, lunar_day, clockwise=False)
    
    # 计算恩光位置（从文昌位置顺时针数，再退一步）
    enguang_temp = count_palace_position(wenzhang_position, lunar_day, clockwise=True)
    enguang_position = count_palace_position(enguang_temp, 2, clockwise=False)
    
    # 计算天贵位置（从文曲位置顺时针数，再退一步）
    tiangui_temp = count_palace_position(wenqu_position, lunar_day, clockwise=True)
    tiangui_position = count_palace_position(tiangui_temp, 2, clockwise=False)
    
    # 只返回四颗星的位置
    days_stars = {
        '三台': santai_position,
        '八座': bazu_position,
        '恩光': enguang_position,
        '天貴': tiangui_position
    }
    
    return days_stars
