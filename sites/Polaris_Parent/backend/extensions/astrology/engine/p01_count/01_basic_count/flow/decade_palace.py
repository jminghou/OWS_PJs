# from ..core.core_import import import_data
from ..core.sxtwl_utils import calculate_lunar_date
from ..palace.bureau import get_bureau
from ..palace.subject import calculate_twelve_palaces
from ..palace.gz import get_palace_gz
import re
from datetime import datetime

def get_ten_palace_info(yin_yang_gender, bureau, twelve_palaces, solar_date, palace_gz):
    """
    根据阴阳性别和局数计算大限宫位
    
    Args:
        yin_yang_gender: 阴阳性别 (陽男/陽女/陰男/陰女)
        bureau: 五行局 (如 "水二局", "火六局" 等)
        twelve_palaces: 十二宫位字典
        solar_date: 公历日期 (年, 月, 日, 时, 分)
        palace_gz: 宫位干支字典
        
    Returns:
        dict: 大限宫位信息
    """
    # 十二宫位的顺序，与 p02_subject.py 保持一致
    palace_order = ["命宮", "兄弟", "夫妻", "子女", "財帛", "疾厄", "遷移", "交友", "官祿", "田宅", "福德", "父母"]
    
    # 提取局数
    # 使用正则表达式从局数中提取数字
    match = re.search(r'([二三四五六])', bureau)
    if match:
        # 将中文数字转换为阿拉伯数字
        chinese_num = match.group(1)
        num_map = {'二': 2, '三': 3, '四': 4, '五': 5, '六': 6}
        bureau_number = num_map.get(chinese_num, 2)  # 默认使用2
    else:
        # 如果无法提取到局数，则默认使用2
        bureau_number = 2
        # 移除冗余日志
        # print(f"[WARNING]: 无法从 '{bureau}' 中提取局数，默认使用 2")
    
    # 提取五行类型
    bureau_type = bureau[0] if bureau else '水'  # 默认使用水
    
    # 大限起始年龄
    start_age = bureau_number
    
    # 获取出生年份
    birth_year = solar_date[0]
    
    # 存储大限宫位信息
    ten_palace_data = {}
    
    # 完全按照大限表_正确合并.csv来定义年龄范围
    # 初始化年龄范围字典，默认为空
    age_ranges = {}
    
    # 根据阴阳性别和局数确定大限年龄范围
    if yin_yang_gender == "陽男":
        if bureau_number == 2:  # 水二局
            age_ranges = {
                "命宮": (2, 11),
                "兄弟": (112, 121),
                "夫妻": (102, 111),
                "子女": (92, 101),
                "財帛": (82, 91),
                "疾厄": (72, 81),
                "遷移": (62, 71),
                "交友": (52, 61),
                "官祿": (42, 51),
                "田宅": (32, 41),
                "福德": (22, 31),
                "父母": (12, 21)
            }
        elif bureau_number == 3:  # 木三局
            age_ranges = {
                "命宮": (3, 12),
                "兄弟": (113, 122),
                "夫妻": (103, 112),
                "子女": (93, 102),
                "財帛": (83, 92),
                "疾厄": (73, 82),
                "遷移": (63, 72),
                "交友": (53, 62),
                "官祿": (43, 52),
                "田宅": (33, 42),
                "福德": (23, 32),
                "父母": (13, 22)
            }
        elif bureau_number == 4:  # 金四局
            age_ranges = {
                "命宮": (4, 13),
                "兄弟": (114, 123),
                "夫妻": (104, 113),
                "子女": (94, 103),
                "財帛": (84, 93),
                "疾厄": (74, 83),
                "遷移": (64, 73),
                "交友": (54, 63),
                "官祿": (44, 53),
                "田宅": (34, 43),
                "福德": (24, 33),
                "父母": (14, 23)
            }
        elif bureau_number == 5:  # 土五局
            age_ranges = {
                "命宮": (5, 14),
                "兄弟": (115, 124),
                "夫妻": (105, 114),
                "子女": (95, 104),
                "財帛": (85, 94),
                "疾厄": (75, 84),
                "遷移": (65, 74),
                "交友": (55, 64),
                "官祿": (45, 54),
                "田宅": (35, 44),
                "福德": (25, 34),
                "父母": (15, 24)
            }
        elif bureau_number == 6:  # 火六局
            age_ranges = {
                "命宮": (6, 15),
                "兄弟": (116, 125),
                "夫妻": (106, 115),
                "子女": (96, 105),
                "財帛": (86, 95),
                "疾厄": (76, 85),
                "遷移": (66, 75),
                "交友": (56, 65),
                "官祿": (46, 55),
                "田宅": (36, 45),
                "福德": (26, 35),
                "父母": (16, 25)
            }
            
    # 逆行（陰男、陽女）：命→兄弟→夫妻…，第二大限進兄弟宮
    elif yin_yang_gender == "陰男":
        if bureau_number == 2:  # 水二局
            age_ranges = {
                "命宮": (2, 11),
                "兄弟": (12, 21),
                "夫妻": (22, 31),
                "子女": (32, 41),
                "財帛": (42, 51),
                "疾厄": (52, 61),
                "遷移": (62, 71),
                "交友": (72, 81),
                "官祿": (82, 91),
                "田宅": (92, 101),
                "福德": (102, 111),
                "父母": (112, 121)
            }
        elif bureau_number == 3:  # 木三局
            age_ranges = {
                "命宮": (3, 12),
                "兄弟": (13, 22),
                "夫妻": (23, 32),
                "子女": (33, 42),
                "財帛": (43, 52),
                "疾厄": (53, 62),
                "遷移": (63, 72),
                "交友": (73, 82),
                "官祿": (83, 92),
                "田宅": (93, 102),
                "福德": (103, 112),
                "父母": (113, 122)
            }
        elif bureau_number == 4:  # 金四局
            age_ranges = {
                "命宮": (4, 13),
                "兄弟": (14, 23),
                "夫妻": (24, 33),
                "子女": (34, 43),
                "財帛": (44, 53),
                "疾厄": (54, 63),
                "遷移": (64, 73),
                "交友": (74, 83),
                "官祿": (84, 93),
                "田宅": (94, 103),
                "福德": (104, 113),
                "父母": (114, 123)
            }
        elif bureau_number == 5:  # 土五局
            age_ranges = {
                "命宮": (5, 14),
                "兄弟": (15, 24),
                "夫妻": (25, 34),
                "子女": (35, 44),
                "財帛": (45, 54),
                "疾厄": (55, 64),
                "遷移": (65, 74),
                "交友": (75, 84),
                "官祿": (85, 94),
                "田宅": (95, 104),
                "福德": (105, 114),
                "父母": (115, 124)
            }
        elif bureau_number == 6:  # 火六局
            age_ranges = {
                "命宮": (6, 15),
                "兄弟": (16, 25),
                "夫妻": (26, 35),
                "子女": (36, 45),
                "財帛": (46, 55),
                "疾厄": (56, 65),
                "遷移": (66, 75),
                "交友": (76, 85),
                "官祿": (86, 95),
                "田宅": (96, 105),
                "福德": (106, 115),
                "父母": (116, 125)
            }

    # 順行（陽男、陰女）：命→父母→福德…，第二大限進父母宮
    elif yin_yang_gender == "陰女":
        if bureau_number == 2:  # 水二局
            age_ranges = {
                "命宮": (2, 11),
                "父母": (12, 21),
                "福德": (22, 31),
                "田宅": (32, 41),
                "官祿": (42, 51),
                "交友": (52, 61),
                "遷移": (62, 71),
                "疾厄": (72, 81),
                "財帛": (82, 91),
                "子女": (92, 101),
                "夫妻": (102, 111),
                "兄弟": (112, 121)
            }
        elif bureau_number == 3:  # 木三局
            age_ranges = {
                "命宮": (3, 12),
                "父母": (13, 22),
                "福德": (23, 32),
                "田宅": (33, 42),
                "官祿": (43, 52),
                "交友": (53, 62),
                "遷移": (63, 72),
                "疾厄": (73, 82),
                "財帛": (83, 92),
                "子女": (93, 102),
                "夫妻": (103, 112),
                "兄弟": (113, 122)
            }
        elif bureau_number == 4:  # 金四局
            age_ranges = {
                "命宮": (4, 13),
                "父母": (14, 23),
                "福德": (24, 33),
                "田宅": (34, 43),
                "官祿": (44, 53),
                "交友": (54, 63),
                "遷移": (64, 73),
                "疾厄": (74, 83),
                "財帛": (84, 93),
                "子女": (94, 103),
                "夫妻": (104, 113),
                "兄弟": (114, 123)
            }
        elif bureau_number == 5:  # 土五局
            age_ranges = {
                "命宮": (5, 14),
                "父母": (15, 24),
                "福德": (25, 34),
                "田宅": (35, 44),
                "官祿": (45, 54),
                "交友": (55, 64),
                "遷移": (65, 74),
                "疾厄": (75, 84),
                "財帛": (85, 94),
                "子女": (95, 104),
                "夫妻": (105, 114),
                "兄弟": (115, 124)
            }
        elif bureau_number == 6:  # 火六局
            age_ranges = {
                "命宮": (6, 15),
                "父母": (16, 25),
                "福德": (26, 35),
                "田宅": (36, 45),
                "官祿": (46, 55),
                "交友": (56, 65),
                "遷移": (66, 75),
                "疾厄": (76, 85),
                "財帛": (86, 95),
                "子女": (96, 105),
                "夫妻": (106, 115),
                "兄弟": (116, 125)
            }
    
    # 如果没有匹配到上述情况，使用默认规则
    if not age_ranges:
        # 移除冗余日志
        # print(f"[WARNING]: 未找到与 {yin_yang_gender} 和 {bureau} 匹配的大限表，使用默认计算方式")
        # 对于陽女或其他未知类型，使用顺序递增的方式
        for i, palace_name in enumerate(palace_order):
            age_range_start = start_age + i * 10
            age_range_end = age_range_start + 9
            palace_location = twelve_palaces[palace_name]
            
            # 计算西元区间
            start_year = birth_year + age_range_start - 1
            end_year = birth_year + age_range_end - 1
            
            # 获取大限名称（宫位干支）
            palace_branch = palace_location  # 宫位地支
            palace_gz_name = palace_gz.get(palace_branch, "")  # 宫位干支
            limit_name = f"{palace_gz_name}限" if palace_gz_name else f"{palace_branch}限"
            
            ten_palace_data[palace_name] = {
                "大限順序": str(i + 1),
                "大限名稱": limit_name,
                "大限歲數": f"{age_range_start}-{age_range_end}",
                "西元區間": f"{start_year}-{end_year}",
                "宮位": palace_location
            }
        return ten_palace_data

    # 为每个宫位设置相应的大限顺序和年龄范围
    # 大限顺序按照从命宮开始的人生阶段顺序
    if yin_yang_gender == "陽男":
        order_map = {
            "命宮": 1,
            "父母": 2,
            "福德": 3,
            "田宅": 4,
            "官祿": 5,
            "交友": 6,
            "遷移": 7,
            "疾厄": 8,
            "財帛": 9,
            "子女": 10,
            "夫妻": 11,
            "兄弟": 12
        }
    elif yin_yang_gender == "陰男":
        order_map = {
            "命宮": 1,
            "兄弟": 2,
            "夫妻": 3,
            "子女": 4,
            "財帛": 5,
            "疾厄": 6,
            "遷移": 7,
            "交友": 8,
            "官祿": 9,
            "田宅": 10,
            "福德": 11,
            "父母": 12
        }
    elif yin_yang_gender == "陰女":
        order_map = {
            "命宮": 1,
            "父母": 2,
            "福德": 3,
            "田宅": 4,
            "官祿": 5,
            "交友": 6,
            "遷移": 7,
            "疾厄": 8,
            "財帛": 9,
            "子女": 10,
            "夫妻": 11,
            "兄弟": 12
        }
    else:
        # 其他情况使用默认顺序
        order_map = {name: i+1 for i, name in enumerate(palace_order)}
    
    # 生成最终大限宫位数据
    for palace_name in palace_order:
        if palace_name in age_ranges:
            age_range = age_ranges[palace_name]
            palace_location = twelve_palaces[palace_name]
            palace_order_index = order_map.get(palace_name, 0)
            
            # 计算西元区间
            start_year = birth_year + age_range[0] - 1
            end_year = birth_year + age_range[1] - 1
            
            # 获取大限名称（宫位干支）
            palace_branch = palace_location  # 宫位地支
            palace_gz_name = palace_gz.get(palace_branch, "")  # 宫位干支
            limit_name = f"{palace_gz_name}限" if palace_gz_name else f"{palace_branch}限"
            
            ten_palace_data[palace_name] = {
                "大限順序": str(palace_order_index),
                "大限名稱": limit_name,
                "大限歲數": f"{age_range[0]}-{age_range[1]}",
                "西元區間": f"{start_year}-{end_year}",
                "宮位": palace_location
            }
        else:
            # 移除冗余日志
            # print(f"[WARNING]: 未找到 {palace_name} 对应的大限年龄范围")
            pass
    
    return ten_palace_data

def calculate_ten_palace(solar_date, basic_data, palace_info):
    """
    计算大限宫位
    
    Args:
        solar_date: 公历日期 (年, 月, 日, 时, 分)
        basic_data: 基本资料字典
        palace_info: 宫位资料字典
        
    Returns:
        dict: 大限宫位信息
    """
    try:
        # 获取性别
        gender = basic_data.get('性別', '')
        if not gender:
            # 移除冗余日志
            # print(f"[WARNING]: 未提供性别信息，使用默认值 '男'")
            gender = '男'
        
        # 计算农历日期和阴阳性别
        lunar_info = calculate_lunar_date(solar_date, gender)
        yin_yang_gender = lunar_info["yin_yang_gender"]
        # 移除冗余日志
        # print(f"陰陽性別: {yin_yang_gender}")
        
        # 获取年干支
        year_gz = lunar_info["year_gz"]
        
        # 从命宫干支获取五行局
        ming_palace_gz = palace_info.get("命宮干支", "")
        
        # 如果直接获取失败，尝试从宮位干支中提取
        if not ming_palace_gz:
            # 尝试方法1：从宮位干支格式化字符串中提取
            palace_gz_str = palace_info.get("宮位干支", "")
            if palace_gz_str:
                palace_gz_parts = palace_gz_str.split(", ")
                for part in palace_gz_parts:
                    if part.startswith("命宮："):
                        ming_palace_gz = part.split("：")[1]
                        # 移除冗余日志
                        # print(f"从宮位干支字符串中提取到命宮干支: {ming_palace_gz}")
                        break
            
            # 尝试方法2：看是否有重组后的宮位資料结构
            if not ming_palace_gz and "reorganized_palace_info" in palace_info:
                reorganized = palace_info["reorganized_palace_info"]
                if "命宮" in reorganized and "干支" in reorganized["命宮"]:
                    ming_palace_gz = reorganized["命宮"]["干支"]
                    # 移除冗余日志
                    # print(f"从reorganized_palace_info中提取到命宮干支: {ming_palace_gz}")
            
            # 尝试方法3：如果已知命宮和年干支，可以重新计算命宮干支
            if not ming_palace_gz:
                ming_palace = palace_info.get("命宮", "")
                if ming_palace and "year_gz" in lunar_info:
                    year_gz = lunar_info["year_gz"]
                    palace_gz_dict = get_palace_gz(year_gz, {})  # 获取所有地支对应的干支
                    if ming_palace in palace_gz_dict:
                        ming_palace_gz = palace_gz_dict[ming_palace]
                        # 移除冗余日志
                        # print(f"通过命宮地支和年干支重新计算得到命宮干支: {ming_palace_gz}")
        
        # 如果仍未找到，则使用默认值
        if not ming_palace_gz:
            # 移除冗余日志
            # print(f"[WARNING]: 未找到命宮干支信息，使用默认值 '甲子'")
            ming_palace_gz = "甲子"
        
        bureau = get_bureau(ming_palace_gz)
        # 移除冗余日志
        # print(f"五行局: {bureau}, 命宮干支: {ming_palace_gz}")
        
        # 获取十二宫位
        ming_palace = palace_info.get("命宮", "")
        if not ming_palace:
            # 移除冗余日志
            # print(f"[WARNING]: 未找到命宮信息，使用默认值 '寅'")
            ming_palace = "寅"
        
        twelve_palaces = calculate_twelve_palaces(ming_palace)
        # 移除冗余日志
        # print(f"命宮: {ming_palace}, 十二宮位: {twelve_palaces}")
        
        # 获取宫位干支
        palace_gz = get_palace_gz(year_gz, twelve_palaces)
        
        # 计算大限宫位
        ten_palace_data = get_ten_palace_info(yin_yang_gender, bureau, twelve_palaces, solar_date, palace_gz)
        
        return ten_palace_data
    except Exception as e:
        print(f"計算大限宮位時發生錯誤: {str(e)}")
        # 返回空字典作为默认值
        return {}

def get_ten_palace_data(solar_date, basic_data, palace_info):
    """
    获取大限宫位数据的外部接口
    
    Args:
        solar_date: 公历日期 (年, 月, 日, 时, 分)
        basic_data: 基本资料字典
        palace_info: 宫位资料字典
        
    Returns:
        dict: 大限宫位信息
    """
    return {"大限宮位": calculate_ten_palace(solar_date, basic_data, palace_info)}

# 测试代码，在导入模块时不会执行
if __name__ == "__main__":
    # 模拟测试数据
    test_solar_date = (1990, 1, 1, 12, 0)
    test_basic_data = {
        "性別": "男"
    }
    test_palace_info = {
        "命宮干支": "甲子",
        "命宮": "寅",
        "五行局": "水二局"
    }
    
    # 测试计算大限宫位
    result = get_ten_palace_data(test_solar_date, test_basic_data, test_palace_info)
    print("\n测试结果:")
    for palace_name, palace_info in result["大限宮位"].items():
        print(f"{palace_name}: {palace_info}")
