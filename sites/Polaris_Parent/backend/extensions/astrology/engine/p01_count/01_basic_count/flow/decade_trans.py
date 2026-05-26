"""
大限四化计算模块

该模块负责计算大限的四化情况，包括:
1. 根据大限年干查询对应的四化星曜
2. 将每个大限的四化星曜整合成特定格式
"""

from ..stars.four_trans import calculate_four_transformations

def get_ten_4trans_data(ten_palace_data):
    """
    获取大限四化数据
    
    Args:
        ten_palace_data (dict): 大限宫位数据
        
    Returns:
        dict: 大限四化数据
    """
    # 获取大限宫位数据
    ten_palace_info = ten_palace_data.get("大限資料", {})
    if not ten_palace_info:
        return {"大限四化": {}}
    
    # 初始化结果字典，包含四个四化类型
    result = {
        "祿": {"大限順序": [], "年干": [], "星曜": []},
        "權": {"大限順序": [], "年干": [], "星曜": []},
        "科": {"大限順序": [], "年干": [], "星曜": []},
        "忌": {"大限順序": [], "年干": [], "星曜": []}
    }
    
    # 按大限顺序整理宫位信息
    sorted_palace_info = sorted(ten_palace_info.items(), 
                               key=lambda x: int(x[1].get("大限順序", "0")))
    
    # 处理每个大限的信息
    for palace_name, palace_data in sorted_palace_info:
        # 获取大限顺序和年干
        ten_order = palace_data.get("大限順序", "")
        year_stem = palace_data.get("年干", "")
        
        if year_stem:
            # 获取四化信息
            four_trans = calculate_four_transformations(year_stem)
            
            # 将四化信息添加到结果中
            for trans_type, star in four_trans.items():
                if trans_type in result:
                    result[trans_type]["大限順序"].append(ten_order)
                    result[trans_type]["年干"].append(year_stem)
                    result[trans_type]["星曜"].append(star)
    
    # 将列表转换为逗号分隔的字符串
    for trans_type in result:
        result[trans_type]["大限順序"] = ",".join(result[trans_type]["大限順序"])
        result[trans_type]["年干"] = ",".join(result[trans_type]["年干"])
        result[trans_type]["星曜"] = ",".join(result[trans_type]["星曜"])
    
    return {"大限四化": result}

# 测试代码
if __name__ == "__main__":
    # 示例数据
    test_ten_palace_data = {
        "大限資料": {
            "命宮": {
                "大限順序": "1",
                "大限名稱": "甲戌限",
                "年干": "甲"
            },
            "兄弟": {
                "大限順序": "2",
                "大限名稱": "乙亥限",
                "年干": "乙"
            },
            "夫妻": {
                "大限順序": "3",
                "大限名稱": "丙子限",
                "年干": "丙"
            }
        }
    }
    
    # 计算大限四化
    ten_4trans_data = get_ten_4trans_data(test_ten_palace_data)
    
    # 打印结果
    print("\n大限四化测试结果:")
    for trans_type, trans_data in ten_4trans_data["大限四化"].items():
        print(f"{trans_type}:")
        for key, value in trans_data.items():
            print(f"  {key}: {value}")
