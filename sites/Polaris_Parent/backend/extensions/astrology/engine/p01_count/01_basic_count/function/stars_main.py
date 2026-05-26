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
from ..stars.four_trans import apply_four_transformations, apply_four_transformations_simplified
from ..stars.branch import get_branch_stars
from ..stars.ten import get_ten_void_star
from collections import OrderedDict

def get_stars_info(bureau, lunar_day, lunar_month, hour_branch, year_stem, year_branch, palace_info):
    # 計算各星系統的位置（与f03_stars.py相同）
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
    
    # 创建一个包含所有星曜的原始字典，用于后续重新分类
    all_stars = {
        "主星": {**major_stars, "紫微": ziwei_position},
        "月系星": moon_stars,
        "時系星": hour_stars,
        "年干星": year_g_stars,
        "年支星": year_z_stars,
        "火鈴": fire_ring_stars,
        "將星": general_stars,
        "歲星": birth12_stars,
        "日系星": days_stars,
        "旬空星": ten_void_star
    }
    
    # 根据 星曜重新分類.md 进行重新分类
    # 初始化一个有序字典，将主星放在最前面，将星和岁星放在最后
    stars_classification = OrderedDict()
    
    # 主星放在最前面
    stars_classification["主星"] = {**major_stars, "紫微": ziwei_position}
    
    # 新的分類類別
    stars_classification.update({
        "輔星": {},
        "煞星空劫": {},

        "人際星": {},
        "貴人星": {},
        "是非星": {},
        "靈性星": {},
        "才華星": {},
        "吉星": {},
        "兇星": {}
    })
    
    # 將星和歲星放在最后
    stars_classification["將星"] = general_stars
    stars_classification["歲星"] = birth12_stars
    
    # 辅星：左輔、右弼、文昌、文曲、天鉞、天魁、祿存、天馬
    stars_classification["輔星"]["左輔"] = moon_stars.get("左輔", "")
    stars_classification["輔星"]["右弼"] = moon_stars.get("右弼", "")
    stars_classification["輔星"]["天馬"] = moon_stars.get("天馬", "")
    stars_classification["輔星"]["文昌"] = hour_stars.get("文昌", "")
    stars_classification["輔星"]["文曲"] = hour_stars.get("文曲", "")
    stars_classification["輔星"]["天鉞"] = year_g_stars.get("天鉞", "")
    stars_classification["輔星"]["天魁"] = year_g_stars.get("天魁", "")
    stars_classification["輔星"]["祿存"] = year_g_stars.get("祿存", "")
    
    
    # 煞星：火星、鈴星、擎羊、陀羅、地空、地劫
    stars_classification["煞星空劫"]["火星"] = fire_ring_stars.get("火星", "")
    stars_classification["煞星空劫"]["鈴星"] = fire_ring_stars.get("鈴星", "")
    stars_classification["煞星空劫"]["擎羊"] = year_g_stars.get("擎羊", "")
    stars_classification["煞星空劫"]["陀羅"] = year_g_stars.get("陀羅", "")
    stars_classification["煞星空劫"]["地空"] = hour_stars.get("地空", "")
    stars_classification["煞星空劫"]["地劫"] = hour_stars.get("地劫", "")

    
    
    # 人際星：天姚、天喜、紅鸞
    stars_classification["人際星"]["天姚"] = moon_stars.get("天姚", "")
    stars_classification["人際星"]["天喜"] = year_z_stars.get("天喜", "")
    stars_classification["人際星"]["紅鸞"] = year_z_stars.get("紅鸞", "")
    
    # 貴人星：台輔、天官、天貴、天德
    stars_classification["貴人星"]["台輔"] = hour_stars.get("台輔", "")
    stars_classification["貴人星"]["天官"] = year_g_stars.get("天官", "")
    stars_classification["貴人星"]["天貴"] = days_stars.get("天貴", "")
    stars_classification["貴人星"]["天德"] = year_z_stars.get("天德", "")
    
    # 是非星：咸池、蜚廉
    stars_classification["是非星"]["咸池"] = year_z_stars.get("咸池", "")
    stars_classification["是非星"]["蜚廉"] = year_z_stars.get("蜚廉", "")
    
    # 靈性星：天巫、華蓋、天虛、天哭、寡宿
    stars_classification["靈性星"]["天巫"] = moon_stars.get("天巫", "")
    stars_classification["靈性星"]["華蓋"] = year_z_stars.get("華蓋", "")
    stars_classification["靈性星"]["天虛"] = year_z_stars.get("天虛", "")
    stars_classification["靈性星"]["天哭"] = year_z_stars.get("天哭", "")
    stars_classification["靈性星"]["寡宿"] = year_z_stars.get("寡宿", "")
    
    # 才華星：龍池、鳳閣、天才
    stars_classification["才華星"]["龍池"] = year_z_stars.get("龍池", "")
    stars_classification["才華星"]["鳳閣"] = year_z_stars.get("鳳閣", "")
    stars_classification["才華星"]["天才"] = year_z_stars.get("天才", "")
    
    # 吉星：封誥、天福、解神、天壽、三台、八座、恩光
    stars_classification["吉星"]["封誥"] = hour_stars.get("封誥", "")
    stars_classification["吉星"]["天福"] = year_g_stars.get("天福", "")
    stars_classification["吉星"]["解神"] = year_z_stars.get("解神", "")
    stars_classification["吉星"]["天壽"] = year_z_stars.get("天壽", "")
    stars_classification["吉星"]["三台"] = days_stars.get("三台", "")
    stars_classification["吉星"]["八座"] = days_stars.get("八座", "")
    stars_classification["吉星"]["恩光"] = days_stars.get("恩光", "")
    
    # 兇星：陰煞、天刑、孤辰、破碎、大耗、劫殺、天月
    stars_classification["兇星"]["陰煞"] = moon_stars.get("陰煞", "")
    stars_classification["兇星"]["天刑"] = moon_stars.get("天刑", "")
    stars_classification["兇星"]["孤辰"] = year_z_stars.get("孤辰", "")
    stars_classification["兇星"]["破碎"] = year_z_stars.get("破碎", "")
    stars_classification["兇星"]["大耗"] = year_z_stars.get("大耗", "")
    stars_classification["兇星"]["劫殺"] = year_z_stars.get("劫殺", "")
    stars_classification["兇星"]["天月"] = moon_stars.get("天月", "")
    stars_classification["兇星"]["截空"] = year_g_stars.get("截空", "")
    stars_classification["兇星"]["旬空"] = ten_void_star.get("旬空", "")
    
    # 清理空值
    for category in list(stars_classification.keys()):
        stars_classification[category] = {k: v for k, v in stars_classification[category].items() if v}
        if not stars_classification[category]:
            del stars_classification[category]
    
    # 创建用于计算亮度的星曜信息（不包含日系星）
    stars_for_brightness = {k: v for k, v in stars_classification.items()}
    
    # 使用简化版的四化数据格式
    four_trans_info = apply_four_transformations_simplified(all_stars, year_stem)
    stars_brightness = get_stars_brightness(stars_for_brightness)
    
    return stars_classification, stars_brightness, four_trans_info

def organize_stars_in_palaces(stars_info, palace_info):
    """重新组织星曜在宫位中的分布"""
    palaces = palace_info['十二宮'].split(', ')
    palaces = [p.split('：')[1] for p in palaces]
    
    # 根据新的分类创建宫位中的星曜分布，保持主星在前，将星和岁星在后的顺序
    stars_in_palaces = {palace: OrderedDict([
        ("主星", []),      # 主要星曜
        ("輔星", []),      # 辅星
        ("煞星空劫", []),      # 煞星

        ("人際星", []),    # 人际星
        ("貴人星", []),    # 贵人星
        ("是非星", []),    # 是非星
        ("靈性星", []),    # 灵性星
        ("才華星", []),    # 才华星
        ("吉星", []),      # 吉星
        ("兇星", []),      # 凶星
        ("將星", []),      # 将星系统
        ("歲星", [])       # 岁星系统
    ]) for palace in palaces}
    
    # 将星曜分配到对应的宫位
    for category, stars in stars_info.items():
        for star, position in stars.items():
            if position in stars_in_palaces:
                stars_in_palaces[position][category].append(star)
    
    return stars_in_palaces
