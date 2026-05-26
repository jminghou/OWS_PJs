four_transformations = {
    '甲': {'祿': '廉貞', '權': '破軍', '科': '文曲', '忌': '太陽'},
    '乙': {'祿': '天機', '權': '天梁', '科': '紫微', '忌': '太陰'},
    '丙': {'祿': '天同', '權': '天機', '科': '文昌', '忌': '廉貞'},
    '丁': {'祿': '太陰', '權': '天同', '科': '天機', '忌': '巨門'},
    '戊': {'祿': '貪狼', '權': '太陰', '科': '右弼', '忌': '天機'},
    '己': {'祿': '武曲', '權': '貪狼', '科': '天梁', '忌': '文曲'},
    '庚': {'祿': '太陽', '權': '武曲', '科': '天同', '忌': '天相'},
    '辛': {'祿': '巨門', '權': '太陽', '科': '武曲', '忌': '文昌'},
    '壬': {'祿': '天梁', '權': '紫微', '科': '天府', '忌': '武曲'},
    '癸': {'祿': '破軍', '權': '巨門', '科': '太陰', '忌': '貪狼'}
}

def calculate_four_transformations(year_stem):
    return four_transformations.get(year_stem, {})

def apply_four_transformations(stars_info, year_stem):
    transformations = calculate_four_transformations(year_stem)
    four_trans_info = {}
    
    # 创建新格式的四化信息，只包含星曜名称而不包含宫位
    for trans_type, trans_star in transformations.items():
        four_trans_info[trans_type] = {
            'star': trans_star,
            'position': '',  # 保留position键但设为空字符串，保证兼容性
        }
        
        # 查找星曜在宫位中的位置（即使不使用，也进行计算以保持行为一致性）
        for system_name, stars in stars_info.items():
            if trans_star in stars:
                four_trans_info[trans_type]['position'] = stars[trans_star]
                break
    
    return four_trans_info

# 添加一个新的函数，用于生成简化版的四化数据
def apply_four_transformations_simplified(stars_info, year_stem):
    transformations = calculate_four_transformations(year_stem)
    four_trans_info = {}
    
    # 创建简化格式的四化信息，只包含星曜名称
    for trans_type, trans_star in transformations.items():
        four_trans_info[trans_type] = {
            '星曜': trans_star
        }
    
    return four_trans_info
