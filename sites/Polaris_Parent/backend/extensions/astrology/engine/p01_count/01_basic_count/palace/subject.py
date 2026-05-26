def calculate_twelve_palaces(ming_palace):
    palaces = ["寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥", "子", "丑"]
    palace_names = ["命宮", "兄弟", "夫妻", "子女", "財帛", "疾厄", "遷移", "交友", "官祿", "田宅", "福德", "父母"]
    
    ming_index = palaces.index(ming_palace)
    twelve_palaces = {}
    
    for i, name in enumerate(palace_names):
        palace_index = (ming_index - i) % 12  # 使用減法來逆推
        twelve_palaces[name] = palaces[palace_index]
    
    return twelve_palaces

def format_twelve_palaces(twelve_palaces):
    return ", ".join([f"{name}：{palace}" for name, palace in twelve_palaces.items()])
