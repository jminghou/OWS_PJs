def calculate_palace(lunar_month, lunar_hour, reverse=False):
    # 12宮位的順序
    palaces = ["寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥", "子", "丑"]
    
    # 時辰順序
    hours = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']
    
    # 步驟 a: 從寅宮開始，順數到出生月份
    base_palace_index = (lunar_month - 1) % 12
    
    # 步驟 b: 從子時開始，數到出生時辰
    hour_index = hours.index(lunar_hour)
    steps = -hour_index if reverse else hour_index
    
    # 步驟 c: 從基礎宮位計算得到宮位
    palace_index = (base_palace_index + steps) % 12
    palace = palaces[palace_index]
    
    return palace

def calculate_ming_palace(lunar_month, lunar_hour):
    return calculate_palace(lunar_month, lunar_hour, reverse=True)

def calculate_shen_palace(lunar_month, lunar_hour):
    return calculate_palace(lunar_month, lunar_hour, reverse=False)

