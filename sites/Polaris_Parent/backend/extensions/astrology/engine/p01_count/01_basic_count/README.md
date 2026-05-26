# P_Union - p01_count/01_basic_count

紫微斗數排盤計算核心模組

## 概述

本模組提供紫微斗數命盤的完整計算功能，包含：
- 本命盤計算（宮位、星曜、四化）
- 流年流月計算（大限、小限、流年）
- 命盤數據編碼轉換（供機器學習使用）

本模組為純函數調用介面，不包含 UI 或資料庫操作，可供其他 P_Union 模組直接調用。

## 功能特點

- ✅ **純函數調用**：無需 Flask 或 UI，直接調用函數即可
- ✅ **完整計算**：支援本命盤 + 流年流月完整計算
- ✅ **批次處理**：支援一次計算多個命盤
- ✅ **編碼轉換**：提供 ML 格式的命盤編碼
- ✅ **模組化設計**：預留三層架構擴展空間

## 安裝依賴

確保 P_Union 虛擬環境已安裝以下依賴：

```bash
cd d:/P_Polaris_Parent/1_run/P_Union
venv/Scripts/python.exe -m pip install sxtwl>=2.0.7 python-dateutil>=2.8.2
```

## 快速開始

### 基本使用

```python
import sys
sys.path.insert(0, 'd:/P_Polaris_Parent/1_run/P_Union')

from p01_count import calculate_chart

# 計算單一命盤
chart = calculate_chart(
    birth_date=(1987, 11, 17, 14, 30),  # (年, 月, 日, 時, 分)
    gender="男",
    name="張三",
    birthplace="台北"
)

# 查看結果
print(f"命盤 ID: {chart['chart_id']}")
print(f"命宮: {chart['宮位資料']['命宮']}")
print(f"紫微星位置: {chart['星曜資料']['紫微']['宮位']}")
```

### 批次計算

```python
from p01_count import calculate_batch_charts

charts = [
    {"birth_date": (1987, 11, 17, 14, 30), "gender": "男", "name": "張三"},
    {"birth_date": (1990, 5, 20, 8, 15), "gender": "女", "name": "李四"},
]

def show_progress(current, total):
    print(f"處理進度: {current}/{total}")

results = calculate_batch_charts(charts, progress_callback=show_progress)

for result in results:
    if 'error' in result:
        print(f"錯誤: {result['error']}")
    else:
        print(f"完成: {result['chart_id']}")
```

### 編碼轉換

```python
from p01_count import calculate_chart, encode_chart_data

# 先計算命盤
chart = calculate_chart(
    birth_date=(1987, 11, 17, 14, 30),
    gender="男"
)

# 進行編碼
encoded = encode_chart_data(chart)
print(f"編碼版本: {encoded['encoding_version']}")
print(f"編碼陣列長度: {len(encoded['encoded_array'])}")
```

## API 文件

### calculate_chart()

計算單一紫微斗數命盤

**參數：**

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| birth_date | tuple | ✅ | 出生日期時間 (year, month, day, hour, minute) |
| gender | str | ✅ | 性別，"男" 或 "女" |
| name | str | ❌ | 姓名（預設: ""） |
| birthplace | str | ❌ | 出生地（預設: ""） |
| time_type | str | ❌ | 時間類型："solar_time" 或 "clock_time"（預設: "solar_time"） |
| include_flow | bool | ❌ | 是否計算流年流月（預設: True） |

**返回值：**

```python
{
    'chart_id': int,          # 18 位 BIGINT 命盤 ID
    '基本資料': dict,          # 姓名、性別、出生地等
    '曆法數據': dict,          # 農曆、節氣資訊
    '命盤數據': dict,          # 命盤基礎數據
    '宮位資料': dict,          # 十二宮位資料
    '星曜資料': dict,          # 星曜位置資料
    '星曜亮度': dict,          # 星曜廟旺平陷
    '四化資料': dict,          # 四化飛星
    '大限資料': dict,          # 大限資料（若 include_flow=True）
    '小限資料': dict,          # 小限資料（若 include_flow=True）
    '流年資料': dict,          # 流年資料（若 include_flow=True）
}
```

### calculate_batch_charts()

批次計算多個命盤

**參數：**

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| charts_data | list | ✅ | 命盤資料列表，每個元素為 dict，包含 birth_date, gender 等參數 |
| progress_callback | callable | ❌ | 進度回調函數，簽名: callback(current: int, total: int) |

**返回值：**

返回 list，每個元素為一個命盤計算結果 dict（格式同 calculate_chart）

### encode_chart_data()

將命盤數據編碼為機器學習格式

**參數：**

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| chart_data | dict | ✅ | 命盤數據（由 calculate_chart 返回） |

**返回值：**

```python
{
    'encoding_version': str,    # 編碼版本號
    'encoded_array': list,      # 編碼後的數值陣列
    'metadata': dict            # 編碼元資訊
}
```

### generate_chart_id()

生成命盤唯一識別碼 (BIGINT)

**參數：**

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| date_str | str | ✅ | 日期字串，格式: "YYYY-MM-DD" |
| gender | str | ✅ | 性別，"男" 或 "女" |
| name | str | ✅ | 姓名 |

**返回值：**

返回 18 位整數，格式: `YYYYMMDDGnnnnnnnnn`
- `YYYYMMDD`: 出生日期
- `G`: 性別 (1:男, 2:女)
- `nnnnnnnnn`: 9 位姓名雜湊數字

## 模組結構

```
01_basic_count/
├── __init__.py              # 主要導出介面
├── interfaces/              # [預留] 未來 p00_api 介面層
├── models/                  # [預留] 未來 p00_api 模型層
├── core/                    # 核心運算層
│   ├── chart_calculator.py  # 命盤計算器（整合 processor + fn_rawdata）
│   ├── encoder.py           # 編碼轉換
│   ├── sxtwl_utils.py       # 天文曆法計算
│   └── id_generator.py      # ID 生成器
├── palace/                  # 宮位計算（5 個模組）
├── stars/                   # 星曜計算（14 個模組）
├── flow/                    # 流年計算（9 個模組）
├── function/                # 功能函數（6 個模組）
├── config/                  # 配置檔案（JSON）
├── utils/                   # 工具函數
└── tests/                   # 測試程式
```

## 使用範例

### 範例 1：僅計算本命盤（不含流年）

```python
from p01_count import calculate_chart

chart = calculate_chart(
    birth_date=(1990, 5, 20, 8, 15),
    gender="女",
    name="測試用戶",
    include_flow=False  # 不計算流年流月
)

print(f"命盤 ID: {chart['chart_id']}")
print(f"命宮: {chart['宮位資料']['命宮']}")
```

### 範例 2：查看星曜分佈

```python
from p01_count import calculate_chart

chart = calculate_chart(
    birth_date=(1987, 11, 17, 14, 30),
    gender="男"
)

# 遍歷所有星曜
for star_name, star_info in chart['星曜資料'].items():
    print(f"{star_name} 在 {star_info['宮位']} 宮")
```

### 範例 3：查看四化飛星

```python
from p01_count import calculate_chart

chart = calculate_chart(
    birth_date=(1987, 11, 17, 14, 30),
    gender="男"
)

sihua = chart['四化資料']
print(f"祿: {sihua.get('祿', 'N/A')}")
print(f"權: {sihua.get('權', 'N/A')}")
print(f"科: {sihua.get('科', 'N/A')}")
print(f"忌: {sihua.get('忌', 'N/A')}")
```

### 範例 4：批次計算並儲存

```python
from p01_count import calculate_batch_charts
import json

charts = [
    {"birth_date": (1987, 11, 17, 14, 30), "gender": "男", "name": "張三"},
    {"birth_date": (1990, 5, 20, 8, 15), "gender": "女", "name": "李四"},
    {"birth_date": (1985, 3, 10, 10, 0), "gender": "男", "name": "王五"},
]

results = calculate_batch_charts(charts)

# 儲存結果
for result in results:
    if 'error' not in result:
        filename = f"{result['chart_id']}.json"
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
        print(f"已儲存: {filename}")
```

## 測試

執行測試以驗證功能：

```bash
cd d:/P_Polaris_Parent/1_run/P_Union
venv/Scripts/python.exe p01_count/01_basic_count/tests/test_basic.py
```

預期輸出：

```
============================================================
P_Union/p01_count/01_basic_count 功能測試
============================================================

=== 測試 1: 基本命盤計算 ===
[OK] 命盤 ID: 19871117m2ed9e99
[OK] 命盤數據包含: 14 個主要欄位
[OK] 基本計算測試通過

=== 測試 2: 僅計算本命盤（不含流年） ===
[OK] 命盤 ID: 19900520f3714536
[OK] 已排除流年資料
[OK] 無流年測試通過

=== 測試 3: 批次計算 ===
[OK] 命盤 1 ID: 19871117md2b2f3a
[OK] 命盤 2 ID: 19900520f1a68b81
[OK] 批次計算測試通過

=== 測試 4: 編碼轉換 ===
[OK] 編碼版本: 2.2
[OK] 編碼陣列長度: XXX
[OK] 編碼測試通過

============================================================
[OK] All tests passed！
============================================================
```

## 技術細節

### 依賴庫

- **sxtwl** (>= 2.0.7): 天文曆法計算庫，提供農曆轉換、節氣計算等功能
- **python-dateutil** (>= 2.8.2): 日期時間處理工具

### 時間類型說明

- **solar_time（真太陽時）**：依據出生地經緯度計算的真實太陽時間，更符合傳統命理要求
- **clock_time（鐘錶時間）**：標準時區時間

### 編碼系統

本模組提供的編碼系統可將命盤數據轉換為固定長度的數值陣列，適合用於：
- 機器學習訓練
- 資料庫儲存優化
- 命盤比對分析

編碼版本：2.2

## 未來擴展

本模組已預留三層架構空間：

1. **interfaces/** - 未來建立 p00_api 時，可在此定義 API 介面
2. **models/** - 未來建立 p00_api 時，可在此定義數據模型
3. **核心層** - 當前實現層，提供純函數調用

當需要建立 Web API 或其他介面時，只需：
1. 在 `p00_api/interfaces/` 中定義介面層（如 Flask routes）
2. 在 `p00_api/models/` 中定義數據模型（如 Pydantic schemas）
3. 介面層調用本模組的核心函數即可

## 版本資訊

- **版本**: 1.0.0
- **移植來源**: P_Count_v6
- **移植日期**: 2026-01-01
- **Python 版本**: >= 3.8

## 授權

本模組為 P_Polaris_Parent 專案的一部分。

## 聯絡資訊

如有問題或建議，請聯絡專案維護者。
