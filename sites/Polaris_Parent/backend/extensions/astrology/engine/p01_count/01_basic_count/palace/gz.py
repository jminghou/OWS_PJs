def calculate_palace_gz(year_gz):
    heavenly_stems = "甲乙丙丁戊己庚辛壬癸"
    earthly_branches = "寅卯辰巳午未申酉戌亥子丑"
    
    gz_table = {
        "甲": "丙丁戊己庚辛壬癸甲乙丙丁",
        "己": "丙丁戊己庚辛壬癸甲乙丙丁",
        "乙": "戊己庚辛壬癸甲乙丙丁戊己",
        "庚": "戊己庚辛壬癸甲乙丙丁戊己",
        "丙": "庚辛壬癸甲乙丙丁戊己庚辛",
        "辛": "庚辛壬癸甲乙丙丁戊己庚辛",
        "丁": "壬癸甲乙丙丁戊己庚辛壬癸",
        "壬": "壬癸甲乙丙丁戊己庚辛壬癸",
        "戊": "甲乙丙丁戊己庚辛壬癸甲乙",
        "癸": "甲乙丙丁戊己庚辛壬癸甲乙"
    }
    
    year_stem = year_gz[0]
    palace_gz = {}
    
    for i, branch in enumerate(earthly_branches):
        stem = gz_table[year_stem][i]
        palace_gz[branch] = f"{stem}{branch}"
    
    return palace_gz

def format_palace_gz(palace_gz, twelve_palaces):
    palace_names = ["命宮", "兄弟", "夫妻", "子女", "財帛", "疾厄", "遷移", "奴僕", "官祿", "田宅", "福德", "父母"]
    return ", ".join([f"{name}：{palace_gz[palace]}" for name, palace in zip(palace_names, twelve_palaces.values())])

def get_palace_gz(year_gz, twelve_palaces):
    # 无论twelve_palaces是否为空，都直接返回所有地支的干支对应表
    return calculate_palace_gz(year_gz)  # 直接返回所有地支的干支
