def calculate_ming_shen_masters(ming_palace, year_branch):
    # 命主身主對應表
    masters_table = {
        "子": ("貪狼", "鈴星"),
        "丑": ("巨門", "天相"),
        "寅": ("祿存", "天梁"),
        "卯": ("文曲", "天同"),
        "辰": ("廉貞", "文昌"),
        "巳": ("武曲", "天機"),
        "午": ("破軍", "火星"),
        "未": ("武曲", "天相"),
        "申": ("廉貞", "天梁"),
        "酉": ("文曲", "天同"),
        "戌": ("祿存", "文昌"),
        "亥": ("巨門", "天機")
    }
    
    ming_master = masters_table[ming_palace][0]
    shen_master = masters_table[year_branch][1]
    
    return ming_master, shen_master
