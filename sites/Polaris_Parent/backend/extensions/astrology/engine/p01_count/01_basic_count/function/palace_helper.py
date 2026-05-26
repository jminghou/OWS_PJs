from ..palace.ming_shen import calculate_ming_palace, calculate_shen_palace
from ..palace.subject import calculate_twelve_palaces, format_twelve_palaces
from ..palace.gz import get_palace_gz, format_palace_gz
from ..palace.bureau import get_bureau
from ..palace.body import calculate_ming_shen_masters

def get_palace_info(lunar_date, lunar_hour, year_gz):
    # 解析農曆日期字符串
    parts = lunar_date.replace('年', '-').replace('月', '-').replace('日', '').split('-')
    lunar_year, lunar_month, lunar_day = map(int, parts)
    
    lunar_hour = lunar_hour[0]

    ming_palace = calculate_ming_palace(lunar_month, lunar_hour)
    shen_palace = calculate_shen_palace(lunar_month, lunar_hour)
    twelve_palaces = calculate_twelve_palaces(ming_palace)
    palace_gz = get_palace_gz(year_gz, twelve_palaces)
    
    ming_palace_gz = palace_gz[ming_palace]
    bureau = get_bureau(ming_palace_gz)

    year_branch = year_gz[1]
    ming_master, shen_master = calculate_ming_shen_masters(ming_palace, year_branch)

    palace_info = {
        "命宮": ming_palace,
        "身宮": shen_palace,
        "十二宮": format_twelve_palaces(twelve_palaces),
        "宮位干支": format_palace_gz(palace_gz, twelve_palaces),
        "命宮干支": ming_palace_gz,
        "五行局": bureau,
        "命主": ming_master,
        "身主": shen_master
    }

    return palace_info

def organize_palace_info(palace_info):
    """
    重新组织宫位信息，将十二宫和宫位干支格式化为更易于使用的结构
    
    参数:
    palace_info (dict): 由get_palace_info函数返回的原始宫位信息
    
    返回:
    dict: 重新组织后的宫位信息
    """
    # 重新組織宮位資料
    palace_list = palace_info['十二宮'].split(', ')
    palace_gz_list = palace_info['宮位干支'].split(', ')
    reorganized_palace_info = {}
    
    # 定義宮位順序
    palace_names = [
        '命宮', '兄弟', '夫妻', '子女', '財帛', '疾厄',
        '遷移', '交友', '官祿', '田宅', '福德', '父母'
    ]
    
    # 處理十二宮位和宮位干支
    for palace, palace_gz in zip(palace_list, palace_gz_list):
        name, value = palace.split('：')
        if name in palace_names:
            reorganized_palace_info[name] = {
                '宮位': value,
                '干支': palace_gz.split('：')[1]
            }
    
    return reorganized_palace_info

def get_complete_palace_info(lunar_date, lunar_hour, year_gz):
    """
    获取完整的宫位信息，包括基础宫位数据和重新组织的宫位结构
    
    参数:
    lunar_date (str): 农历日期
    lunar_hour (str): 农历时辰
    year_gz (str): 年干支
    
    返回:
    dict: 包含原始宫位信息和重新组织后的宫位数据
    """
    # 获取基础宫位信息
    palace_info = get_palace_info(lunar_date, lunar_hour, year_gz)
    
    # 获取重新组织的宫位数据
    organized_palace_info = organize_palace_info(palace_info)
    
    return {
        "palace_info": palace_info,
        "reorganized_palace_info": organized_palace_info
    }
