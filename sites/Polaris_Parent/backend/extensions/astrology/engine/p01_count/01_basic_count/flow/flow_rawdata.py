from ..flow.flow_palace import get_enhanced_palace_info

def get_flowdata(solar_date, basic_data, palace_info, lunar_info=None):
    """
    获取所有流年数据（使用增强版数据格式）
    
    Args:
        solar_date: 公历日期 (年, 月, 日, 时, 分)
        basic_data: 基本资料字典
        palace_info: 宫位资料字典
        lunar_info: 历法信息字典(可选)
        
    Returns:
        dict: 包含各种流年数据的字典，使用增强版格式（大限資料、小限資料、流年資料等）
    """
    # 获取并整合所有宫位数据（大限資料、小限資料、流年）
    flow_data = get_enhanced_palace_info(solar_date, basic_data, palace_info, lunar_info)
    
    # 添加一個簡化的進度日誌
    # print("Complete data calculation")
    
    # 返回所有流年数据（使用增强版格式）
    return flow_data

# 保留此函数仅为兼容性目的
def get_enhanced_flowdata(solar_date, basic_data, palace_info, lunar_info=None):
    """
    获取增强版流年数据（包含大限星曜、小限星曜和流年星曜）- 此函数仅为兼容性保留
    现在 get_flowdata 已直接返回增强版数据，请直接使用 get_flowdata
    
    Args:
        solar_date: 公历日期 (年, 月, 日, 时, 分)
        basic_data: 基本资料字典
        palace_info: 宫位资料字典
        lunar_info: 历法信息字典(可选)
        
    Returns:
        dict: 包含增强版流年数据的字典（大限資料、小限資料、流年資料）
    """
    print("[WARNING]: get_enhanced_flowdata 函数已不再需要，请直接使用 get_flowdata，它现在已返回增强版数据")
    return get_flowdata(solar_date, basic_data, palace_info, lunar_info)
