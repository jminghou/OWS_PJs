"""
命盤計算核心模組
整合自 P_Count_v6 的 processor.py 和 fn_rawdata.py
提供純函數調用的排盤計算功能（無 UI、無資料庫操作）
"""

from ..function.rawdata import get_all_data
from ..function.basic import get_basic_info
from .id_generator import generate_chart_id
from .encoder import encode_chart_data
from .encoder_flow import (
    generate_decade_encoding_data,
    generate_small_limit_encoding_data,
    generate_year_flow_encoding_data
)


def calculate_chart(
    birth_date: tuple,
    gender: str,
    name: str = "",
    birthplace: str = "",
    time_type: str = "solar_time",
    calendar_type: str = "solar",
    is_leap_month: bool = False,
    include_flow: bool = True,
    include_encoding: bool = True,
    **kwargs
) -> dict:
    """
    計算單一紫微斗數命盤

    Args:
        birth_date: 出生日期時間 (year, month, day, hour, minute)
                   - calendar_type="solar"：西元日期，例如 (1987, 11, 17, 14, 30)
                   - calendar_type="lunar"：農曆日期，例如 (1987, 10, 26, 0, 0)
                     （函式會先轉成西元，再走相同排盤流程）
        gender: 性別，"男" 或 "女"
        name: 姓名（可選）
        birthplace: 出生地（可選）
        time_type: 時間類型
                  - "solar_time": 太陽時間（真太陽時）
                  - "clock_time": 鐘錶時間
        calendar_type: 輸入曆法
                  - "solar": 西元（預設）
                  - "lunar": 農曆，birth_date 視為農曆年月日，內部轉西元後排盤
        is_leap_month: 農曆輸入時，該月是否為閏月（calendar_type="lunar" 時生效）
        include_flow: 是否計算流年流月（大限、小限、流年）
        include_encoding: 是否包含快速條件編碼（本命盤、大限、小限、流年編碼）
        **kwargs: 其他可選參數

    Returns:
        dict: 完整命盤資料，包含以下欄位：
            {
                'chart_id': 198711171000000000,  # 18 位 BIGINT 命盤 ID
                '基本資料': {...},
                '曆法數據': {...},
                '命盤數據': {...},
                '宮位資料': {...},
                '星曜資料': {...},
                '星曜亮度': {...},
                '四化資料': {...},
                '大限資料': {...},  # 如果 include_flow=True
                '小限資料': {...},  # 如果 include_flow=True
                '流年資料': {...},  # 如果 include_flow=True
                '快速條件編碼': {...},  # 如果 include_encoding=True
            }

    Example:
        >>> chart = calculate_chart(
        ...     birth_date=(1987, 11, 17, 14, 30),
        ...     gender="男",
        ...     name="張三",
        ...     birthplace="台北"
        ... )
        >>> print(chart['chart_id'])
        >>> print(chart['宮位資料']['命宮']['主星'])
    """
    # 農曆輸入：先轉成西元日期，之後完全走西元排盤流程
    # （chart_id、get_all_data、曆法數據、編碼皆只依賴此西元 birth_date）
    if calendar_type == "lunar":
        from .sxtwl_utils import lunar_to_solar
        lunar_year, lunar_month, lunar_day = birth_date[0], birth_date[1], birth_date[2]
        hour = birth_date[3] if len(birth_date) > 3 else 0
        minute = birth_date[4] if len(birth_date) > 4 else 0
        solar_year, solar_month, solar_day = lunar_to_solar(
            lunar_year, lunar_month, lunar_day, is_leap_month
        )
        birth_date = (solar_year, solar_month, solar_day, hour, minute)

    # 組裝 basic_data 字典
    basic_data = {
        '命盤主': name or '未命名',
        '性別': gender,
        '出生地': birthplace or '',
        'time_type': time_type,
    }

    # 記錄原始輸入曆法供溯源（不影響計算）
    if calendar_type == "lunar":
        basic_data['輸入曆法'] = '農曆'

    # 新增其他可選參數
    basic_data.update(kwargs)

    # 呼叫核心計算函數（來自 fn_rawdata.py 的 get_all_data）
    # 這個函數會整合所有宮位、星曜、流年等計算
    final_data = get_all_data(birth_date, basic_data)
    # get_all_data 不寫入「基本資料」；encode_gender() 只讀 chart_data["基本資料"]["性別"]。
    # 若缺少則不會產生 GM/GF，下游 ChartParser 無法還原性別，匯出 meta 會誤為 GF。
    final_data["基本資料"] = get_basic_info(basic_data)["基本資料"]

    # 生成命盤 ID
    # 直接從 birth_date 產生日期字串
    date_part = f"{birth_date[0]}-{birth_date[1]:02d}-{birth_date[2]:02d}"
    chart_id = generate_chart_id(date_part, gender, name or '未命名')
    final_data['chart_id'] = chart_id

    # 如果需要編碼，進行完整編碼
    if include_encoding:
        try:
            # 初始化快速條件編碼區塊
            fast_encoding = {}

            # 步驟1: 本命盤編碼
            natal_encoding = encode_chart_data(final_data)
            fast_encoding.update(natal_encoding)

            # 提取本命盤編碼陣列，供流年編碼使用
            natal_array = natal_encoding['natal_chart_encoding'][0]['encoded_array']

            # 步驟2: 大限編碼（傳遞本命盤編碼）
            decade_encoding = generate_decade_encoding_data(final_data, natal_array)
            fast_encoding.update(decade_encoding)

            # 步驟3: 小限編碼（傳遞本命盤編碼）
            small_limit_encoding = generate_small_limit_encoding_data(final_data, natal_array)
            fast_encoding.update(small_limit_encoding)

            # 步驟4: 流年編碼（傳遞本命盤編碼）
            year_flow_encoding = generate_year_flow_encoding_data(final_data, natal_array)
            fast_encoding.update(year_flow_encoding)

            # 將編碼加入命盤資料
            final_data['快速條件編碼'] = fast_encoding

        except Exception as e:
            print(f"警告：編碼失敗 - {str(e)}")
            # 編碼失敗不影響主流程，繼續返回命盤數據

    return final_data


def calculate_batch_charts(
    charts_data: list,
    progress_callback: callable = None
) -> list:
    """
    批次計算多個命盤

    Args:
        charts_data: 命盤資料列表，每個元素為 dict，包含 birth_date, gender 等參數
                    例如: [
                        {"birth_date": (1987, 11, 17, 14, 30), "gender": "男", "name": "張三"},
                        {"birth_date": (1990, 5, 20, 8, 15), "gender": "女", "name": "李四"},
                    ]
        progress_callback: 進度回調函數（可選）
                          函數簽名: callback(current: int, total: int)

    Returns:
        list: 計算結果列表，每個元素為一個命盤 dict

    Example:
        >>> charts = [
        ...     {"birth_date": (1987, 11, 17, 14, 30), "gender": "男", "name": "張三"},
        ...     {"birth_date": (1990, 5, 20, 8, 15), "gender": "女", "name": "李四"},
        ... ]
        >>> def show_progress(current, total):
        ...     print(f"處理中: {current}/{total}")
        >>> results = calculate_batch_charts(charts, progress_callback=show_progress)
    """
    results = []
    total = len(charts_data)

    for i, chart_params in enumerate(charts_data, 1):
        try:
            # 計算命盤
            result = calculate_chart(**chart_params)
            results.append(result)

            # 呼叫進度回調
            if progress_callback:
                progress_callback(i, total)

        except Exception as e:
            # 記錄錯誤但繼續處理其他命盤
            error_result = {
                'error': str(e),
                'input_params': chart_params
            }
            results.append(error_result)

            if progress_callback:
                progress_callback(i, total)

    return results
