"""
流年宫位数据整合模块

该模块负责整合大限、小限和流年宫位数据，并提供统一接口给flow_rawdata.py使用。
从而使flow_rawdata.py更加精简，增强程序的模块化。
"""

# 使用try-except处理可能的导入错误
try:
    from ..flow.decade_palace import get_ten_palace_data
except ImportError as e:
    print(f"[WARNING] Cannot import decade_palace: {e}")
    # 定义替代函数
    def get_ten_palace_data(solar_date, basic_data, palace_info):
        print("[WARNING] Using fallback function for decade_palace")
        return {"大限宮位": {}}

try:
    from ..flow.small_limit_palace import get_one_palace_data
except ImportError as e:
    print(f"[WARNING] Cannot import small_limit_palace: {e}")
    # 定义替代函数
    def get_one_palace_data(solar_date, basic_data, palace_info, lunar_info=None):
        print("[WARNING] Using fallback function for small_limit_palace")
        return {"小限宮位": {}}

try:
    from ..flow.year_palace import get_year_palace_data
except ImportError as e:
    print(f"[WARNING]: 无法导入 year_palace 模块: {e}")
    # 定义替代函数
    def get_year_palace_data(solar_date, basic_data, palace_info):
        print("[WARNING]: 使用 year_palace ")
        return {"流年宮位": {}}

# 添加ten_star模块的导入
try:
    from ..flow.decade_star import get_ten_star_data, get_enhanced_ten_star_data
except ImportError as e:
    print(f"[WARNING]: 无法导入 ten_star 模块: {e}")
    # 定义替代函数
    def get_ten_star_data(solar_date, basic_data, palace_info, ten_palace_data=None):
        print("[WARNING]: 使用 ten_star ")
        return {"大限星曜": {}}
    
    def get_enhanced_ten_star_data(solar_date, basic_data, palace_info, ten_palace_data=None):
        print("[WARNING]: 使用 ten_star ")
        return {"大限資料": {}}

# 添加ten_4trans模块的导入
try:
    from ..flow.decade_trans import get_ten_4trans_data
except ImportError as e:
    print(f"[WARNING]: 无法导入 ten_4trans 模块: {e}")
    # 定义替代函数
    def get_ten_4trans_data(ten_palace_data):
        print("[WARNING]: 使用 ten_4trans ")
        return {"大限四化": {}}

# 添加one_star模块的导入
try:
    from ..flow.small_limit_star import get_one_star_info
except ImportError as e:
    print(f"[WARNING]: 无法导入 one_star 模块: {e}")
    # 定义替代函数
    def get_one_star_info(solar_date, basic_data, palace_info, one_palace_data=None, lunar_info=None):
        print("[WARNING]: 使用 one_star ")
        return {"小限資料": {}}

# 添加year_star模块的导入
try:
    from ..flow.year_star import get_year_star_info
except ImportError as e:
    print(f"[WARNING]: 无法导入 year_star 模块: {e}")
    # 定义替代函数
    def get_year_star_info(solar_date, basic_data, palace_info, year_palace_data=None, lunar_info=None):
        print("[WARNING]: 使用 year_star ")
        return {"流年資料": {}}

def get_ten_palace_info(solar_date, basic_data, palace_info):
    """
    获取并整合大限宫位数据
    
    Args:
        solar_date: 公历日期 (年, 月, 日, 时, 分)
        basic_data: 基本资料字典
        palace_info: 宫位资料字典
        
    Returns:
        dict: 整合了大限宫位数据的字典
    """
    try:
        ten_palace_data = get_ten_palace_data(solar_date, basic_data, palace_info)
        return ten_palace_data
    except Exception as e:
        print(f"获取大限宫位数据时发生错误: {e}")
        return {"大限宮位": {}}

def get_one_palace_info(solar_date, basic_data, palace_info, lunar_info=None):
    """
    获取并整合小限宫位数据
    
    Args:
        solar_date: 公历日期 (年, 月, 日, 时, 分)
        basic_data: 基本资料字典
        palace_info: 宫位资料字典
        lunar_info: 历法信息字典(可选)
        
    Returns:
        dict: 整合了小限宫位数据的字典
    """
    try:
        one_palace_data = get_one_palace_data(solar_date, basic_data, palace_info, lunar_info)
        return one_palace_data
    except Exception as e:
        print(f"获取小限宫位数据时发生错误: {e}")
        return {"小限宮位": {}}

def get_year_palace_info(solar_date, basic_data, palace_info):
    """
    获取并整合流年宫位数据
    
    Args:
        solar_date: 公历日期 (年, 月, 日, 时, 分)
        basic_data: 基本资料字典
        palace_info: 宫位资料字典
        
    Returns:
        dict: 整合了流年宫位数据的字典
    """
    try:
        year_palace_data = get_year_palace_data(solar_date, basic_data, palace_info)
        return year_palace_data
    except Exception as e:
        print(f"获取流年宫位数据时发生错误: {e}")
        return {"流年宮位": {}}

# 添加获取大限星曜数据的函数
def get_ten_star_info(solar_date, basic_data, palace_info, ten_palace_data=None):
    """
    获取并整合大限星曜数据
    
    Args:
        solar_date: 公历日期 (年, 月, 日, 时, 分)
        basic_data: 基本资料字典
        palace_info: 宫位资料字典
        ten_palace_data: 可选的大限宫位数据，如果提供则直接使用
        
    Returns:
        dict: 整合了大限星曜数据的字典
    """
    try:
        # 如果没有提供大限宫位数据，先获取大限宫位数据
        if ten_palace_data is None:
            ten_palace_data = get_ten_palace_data(solar_date, basic_data, palace_info)
        
        # 获取大限星曜数据
        ten_star_data = get_ten_star_data(solar_date, basic_data, palace_info, ten_palace_data)
        return ten_star_data
    except Exception as e:
        print(f"获取大限星曜数据时发生错误: {e}")
        return {"大限星曜": {}}

# 添加获取增强版大限星曜数据的函数
def get_enhanced_ten_star_info(solar_date, basic_data, palace_info, ten_palace_data=None):
    """
    获取并整合增强版大限星曜数据，将星曜直接整合到大限宫位数据中
    
    Args:
        solar_date: 公历日期 (年, 月, 日, 时, 分)
        basic_data: 基本资料字典
        palace_info: 宫位资料字典
        ten_palace_data: 可选的大限宫位数据，如果提供则直接使用
        
    Returns:
        dict: 增强版大限星曜信息
    """
    try:
        # 如果没有提供大限宫位数据，先获取大限宫位数据
        if ten_palace_data is None:
            ten_palace_data = get_ten_palace_data(solar_date, basic_data, palace_info)
        
        # 获取增强版大限星曜数据
        enhanced_ten_star_data = get_enhanced_ten_star_data(solar_date, basic_data, palace_info, ten_palace_data)
        return enhanced_ten_star_data
    except Exception as e:
        print(f"获取增强版大限星曜数据时发生错误: {e}")
        return {"大限資料": {}}

# 添加获取大限四化数据的函数
def get_ten_4trans_info(enhanced_ten_data):
    """
    获取并整合大限四化数据
    
    Args:
        enhanced_ten_data: 增强版大限数据，包含年干信息
        
    Returns:
        dict: 大限四化数据
    """
    try:
        # 获取大限四化数据
        ten_4trans_data = get_ten_4trans_data(enhanced_ten_data)
        return ten_4trans_data
    except Exception as e:
        print(f"获取大限四化数据时发生错误: {e}")
        return {"大限四化": {}}

# 添加获取小限星曜数据的函数
def get_one_star_info_wrapper(solar_date, basic_data, palace_info, one_palace_data=None, lunar_info=None):
    """
    获取并整合小限星曜数据
    
    Args:
        solar_date: 公历日期 (年, 月, 日, 时, 分)
        basic_data: 基本资料字典
        palace_info: 宫位资料字典
        one_palace_data: 可选的小限宫位数据，如果提供则直接使用
        lunar_info: 历法信息字典(可选)
        
    Returns:
        dict: 整合了小限星曜数据的字典
    """
    try:
        # 如果没有提供小限宫位数据，先获取小限宫位数据
        if one_palace_data is None:
            one_palace_data = get_one_palace_data(solar_date, basic_data, palace_info, lunar_info)
        
        # 获取小限星曜数据，使用新的数据格式
        one_star_data = get_one_star_info(solar_date, basic_data, palace_info, one_palace_data, lunar_info, use_new_format=True)
        return one_star_data
    except Exception as e:
        print(f"获取小限星曜数据时发生错误: {e}")
        return {"小限資料": {}}

# 添加获取流年星曜数据的函数
def get_year_star_info_wrapper(solar_date, basic_data, palace_info, year_palace_data=None, lunar_info=None):
    """
    获取并整合流年星曜数据
    
    Args:
        solar_date: 公历日期 (年, 月, 日, 时, 分)
        basic_data: 基本资料字典
        palace_info: 宫位资料字典
        year_palace_data: 可选的流年宫位数据，如果提供则直接使用
        lunar_info: 历法信息字典(可选)
        
    Returns:
        dict: 整合了流年星曜数据的字典
    """
    try:
        # 如果没有提供流年宫位数据，先获取流年宫位数据
        if year_palace_data is None:
            year_palace_data = get_year_palace_data(solar_date, basic_data, palace_info)
        
        # 获取流年星曜数据
        year_star_data = get_year_star_info(solar_date, basic_data, palace_info, year_palace_data, lunar_info)
        return year_star_data
    except Exception as e:
        print(f"获取流年星曜数据时发生错误: {e}")
        return {"流年資料": {}}

def get_all_palace_info(solar_date, basic_data, palace_info, lunar_info=None):
    """
    获取所有宫位数据（大限、小限、流年）并整合
    
    Args:
        solar_date: 公历日期 (年, 月, 日, 时, 分)
        basic_data: 基本资料字典
        palace_info: 宫位资料字典
        lunar_info: 历法信息字典(可选)
        
    Returns:
        dict: 包含所有宫位数据的字典
    """
    # 创建结果字典
    all_palace_info = {}
    
    # 获取并添加大限宫位数据
    ten_palace_data = get_ten_palace_info(solar_date, basic_data, palace_info)
    all_palace_info.update(ten_palace_data)
    
    # 获取并添加小限宫位数据
    one_palace_data = get_one_palace_info(solar_date, basic_data, palace_info, lunar_info)
    all_palace_info.update(one_palace_data)
    
    # 获取并添加流年宫位数据
    year_palace_data = get_year_palace_info(solar_date, basic_data, palace_info)
    all_palace_info.update(year_palace_data)
    
    # 添加大限星曜数据（不使用增强版，保持数据结构独立）
    ten_star_data = get_ten_star_info(solar_date, basic_data, palace_info, ten_palace_data)
    all_palace_info.update(ten_star_data)
    
    # 添加小限星曜数据
    one_star_data = get_one_star_info_wrapper(solar_date, basic_data, palace_info, one_palace_data, lunar_info)
    all_palace_info.update(one_star_data)
    
    # 添加流年星曜数据
    year_star_data = get_year_star_info_wrapper(solar_date, basic_data, palace_info, year_palace_data, lunar_info)
    all_palace_info.update(year_star_data)
    
    # 添加简化的日志信息
    print("完成大限、小限、流年宮位及星曜計算")
    
    return all_palace_info

# 添加获取增强版宫位数据的函数
def get_enhanced_palace_info(solar_date, basic_data, palace_info, lunar_info=None):
    """
    获取增强版宫位数据，包括将星曜直接整合到大限宫位数据中
    
    Args:
        solar_date: 公历日期 (年, 月, 日, 时, 分)
        basic_data: 基本资料字典
        palace_info: 宫位资料字典
        lunar_info: 历法信息字典(可选)
        
    Returns:
        dict: 包含增强版宫位数据的字典
    """
    # 创建结果字典
    enhanced_palace_info = {}
    
    # 获取大限宫位数据
    ten_palace_data = get_ten_palace_info(solar_date, basic_data, palace_info)
    
    # 获取增强版大限星曜数据（将星曜直接整合到大限宫位数据中）
    enhanced_ten_star_data = get_enhanced_ten_star_data(solar_date, basic_data, palace_info, ten_palace_data)
    enhanced_palace_info.update(enhanced_ten_star_data)
    
    # 获取大限四化数据
    ten_4trans_data = get_ten_4trans_info(enhanced_ten_star_data)
    enhanced_palace_info.update(ten_4trans_data)
    
    # 获取小限宫位数据
    one_palace_data = get_one_palace_info(solar_date, basic_data, palace_info, lunar_info)
    
    # 获取小限星曜数据
    one_star_data = get_one_star_info_wrapper(solar_date, basic_data, palace_info, one_palace_data, lunar_info)
    enhanced_palace_info.update(one_star_data)
    
    # 获取流年宫位数据
    year_palace_data = get_year_palace_info(solar_date, basic_data, palace_info)
    
    # 获取流年星曜数据
    year_star_data = get_year_star_info_wrapper(solar_date, basic_data, palace_info, year_palace_data, lunar_info)
    enhanced_palace_info.update(year_star_data)
    
    # 添加简化的日志信息
    print("Complete calculation")
    
    return enhanced_palace_info
