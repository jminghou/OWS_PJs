from ..stars.ziwei import get_ziwei_position
from ..stars.major import get_major_stars
from ..stars.moon import get_moon_stars
from ..stars.hour import get_hour_stars
from ..stars.year_g import get_year_g_stars
from ..stars.year_z import get_year_z_stars
from ..stars.fire_ring import get_fire_ring_stars
from ..stars.general import get_general_stars
from ..stars.birth12 import get_birth12_stars
from ..stars.days import get_days_stars
from ..stars.brightness import get_stars_brightness
from ..stars.four_trans import apply_four_transformations_simplified
from ..stars.branch import get_branch_stars
from ..stars.ten import get_ten_void_star

def get_stars_info(bureau, lunar_day, lunar_month, hour_branch, year_stem, year_branch, palace_info):
    # 計算各星系統的位置
    ziwei_position = get_ziwei_position(bureau, lunar_day)
    major_stars = get_major_stars(ziwei_position)
    moon_stars = get_moon_stars(lunar_month)
    hour_stars = get_hour_stars(hour_branch)
    year_g_stars = get_year_g_stars(year_stem)
    year_z_stars = get_year_z_stars(year_branch)
    fire_ring_stars = get_fire_ring_stars(year_branch, hour_branch)
    general_stars = get_general_stars(year_branch)
    birth12_stars = get_birth12_stars(year_branch)
    days_stars = get_days_stars(lunar_month, lunar_day, hour_branch)
    branch_stars = get_branch_stars(year_branch, palace_info)
    
    # 计算旬空星
    year_gz = year_stem + year_branch
    ten_void_star = {"旬空": get_ten_void_star(year_gz)}
    
    # 将天才星合并到年支星中
    year_z_stars.update(branch_stars)
    
    # 按照計算流程分類
    stars_classification = {
        "主星": {**major_stars, "紫微": ziwei_position},  # 紫微星系統
        "月系星": moon_stars,                              # 月系
        "時系星": hour_stars,                              # 時系
        "年干星": year_g_stars,                            # 年干系
        "年支星": year_z_stars,                            # 年支系（包含天才星）
        "火鈴": fire_ring_stars,                         # 火鈴系統
        "將星": general_stars,                           # 將星系統
        "歲星": birth12_stars,                           # 歲星系統
        "日系星": days_stars,                            # 日系星系統
        "旬空星": ten_void_star                          # 旬空星
    }
    
    # 创建不包含日系星的分类（用于计算亮度）
    stars_for_brightness = {
        "主星": {**major_stars, "紫微": ziwei_position},
        "月系星": moon_stars,
        "時系星": hour_stars,
        "年干星": year_g_stars,
        "年支星": year_z_stars,
        "火鈴": fire_ring_stars,
        "將星": general_stars,
        "歲星": birth12_stars,
        "旬空星": ten_void_star
    }
    
    # 使用简化版的四化数据格式
    four_trans_info = apply_four_transformations_simplified(stars_classification, year_stem)
    stars_brightness = get_stars_brightness(stars_for_brightness)
    
    return stars_classification, stars_brightness, four_trans_info
