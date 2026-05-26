def calculate_hour_stars(hour_branch):
    hour_stars_table = {
        '文昌': ['戌', '酉', '申', '未', '午', '巳', '辰', '卯', '寅', '丑', '子', '亥'],
        '文曲': ['辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑', '寅', '卯'],
        '地空': ['亥', '戌', '酉', '申', '未', '午', '巳', '辰', '卯', '寅', '丑', '子'],
        '地劫': ['亥', '子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌'],
        '台輔': ['午', '未', '申', '酉', '戌', '亥', '子', '丑', '寅', '卯', '辰', '巳'],
        '封誥': ['寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑']
    }
    
    earthly_branches = "子丑寅卯辰巳午未申酉戌亥"
    hour_index = earthly_branches.index(hour_branch)
    
    hour_stars = {}
    for star, positions in hour_stars_table.items():
        hour_stars[star] = positions[hour_index]
    
    return hour_stars

def get_hour_stars(hour_branch):
    return calculate_hour_stars(hour_branch)
