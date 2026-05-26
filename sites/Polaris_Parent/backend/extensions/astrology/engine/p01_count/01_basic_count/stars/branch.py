def get_palace_by_branch(year_branch):
    """根据年支获取对应的宫位名称"""
    branch_palace_table = {
        '子': '命宮', '丑': '父母', '寅': '福德', '卯': '田宅',
        '辰': '官祿', '巳': '僕役', '午': '遷移', '未': '疾厄',
        '申': '財帛', '酉': '子女', '戌': '夫妻', '亥': '兄弟'
    }
    return branch_palace_table.get(year_branch)

def get_palace_position(palace_name, palace_info):
    """根据宫位名称获取其所在地支位置"""
    palaces = palace_info['十二宮'].split(', ')
    for palace in palaces:
        name, position = palace.split('：')
        if name == palace_name:
            return position
    return None

def count_palace_steps(start_palace, year_branch):
    """计算从起始宫位顺时针数到目标地支的步数"""
    palaces = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']
    start_index = palaces.index(start_palace)
    target_index = palaces.index(year_branch)
    steps = (target_index - start_index) % 12
    return (start_index + steps) % 12

def get_branch_stars(year_branch, palace_info):
    """计算支系诸星的位置"""
    # 获取天才星对应的宫位名称和位置
    tiancai_palace_name = get_palace_by_branch(year_branch)
    tiancai_position = get_palace_position(tiancai_palace_name, palace_info)
    
    # 获取身宫位置并计算天寿星位置
    shen_palace = palace_info['身宮']
    palaces = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']
    target_index = count_palace_steps(shen_palace, year_branch)
    shouxing_position = palaces[target_index]
    
    # 返回支系诸星的位置
    branch_stars = {
        '天才': tiancai_position,
        '天壽': shouxing_position
    }
    
    return branch_stars
