def calculate_bureau(ming_palace_gz):
    stem, branch = ming_palace_gz[0], ming_palace_gz[1]
    
    stem_groups = {
        '甲乙': 0, '丙丁': 1, '戊己': 2, '庚辛': 3, '壬癸': 4
    }
    
    branch_groups = {
        '子丑': 0, '寅卯': 1, '辰巳': 2, '午未': 3, '申酉': 4, '戌亥': 5
    }
    
    bureaus = [
        ['金四局', '水二局', '火六局', '金四局', '水二局', '火六局'],
        ['水二局', '火六局', '土五局', '水二局', '火六局', '土五局'],
        ['火六局', '土五局', '木三局', '火六局', '土五局', '木三局'],
        ['土五局', '木三局', '金四局', '土五局', '木三局', '金四局'],
        ['木三局', '金四局', '水二局', '木三局', '金四局', '水二局']
    ]
    
    stem_group = next((k for k in stem_groups if stem in k), None)
    branch_group = next((k for k in branch_groups if branch in k), None)
    
    if stem_group is None or branch_group is None:
        return "未知"
    
    return bureaus[stem_groups[stem_group]][branch_groups[branch_group]]

def get_bureau(ming_palace_gz):
    return calculate_bureau(ming_palace_gz)
