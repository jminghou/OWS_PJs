def calculate_fire_ring_stars(year_branch, hour_branch):
    fire_star_table = {
        '寅午戌': ['丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子'],
        '申子辰': ['寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑'],
        '巳酉丑': ['卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑', '寅'],
        '亥卯未': ['酉', '戌', '亥', '子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申']
    }
    
    ring_star_table = {
        '寅午戌': ['卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑', '寅'],
        '申子辰': ['戌', '亥', '子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉'],
        '巳酉丑': ['戌', '亥', '子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉'],
        '亥卯未': ['戌', '亥', '子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉']
    }
    
    earthly_branches = "子丑寅卯辰巳午未申酉戌亥"
    hour_index = earthly_branches.index(hour_branch)
    
    for key in fire_star_table:
        if year_branch in key:
            fire_star = fire_star_table[key][hour_index]
            ring_star = ring_star_table[key][hour_index]
            return {'火星': fire_star, '鈴星': ring_star}
    
    return {'火星': '未知', '鈴星': '未知'}

def get_fire_ring_stars(year_branch, hour_branch):
    return calculate_fire_ring_stars(year_branch, hour_branch)
