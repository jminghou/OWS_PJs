# p_e_artist 繪圖引擎操作說明

`p_e_artist` 是一個專門用來視覺化渲染「紫微斗數命盤」的繪圖引擎，能將命盤資料轉換為精美的 SVG 或 HTML 圖像，並支援多種主題（Themes）切換。

---

## 1. 啟動方式

專案內建了一個測試與開發用的進入點，會自動讀取測試資料，並為**所有已安裝的主題**生成對應的命盤圖與預覽縮圖。

### 執行步驟：
1. 開啟終端機 (Terminal)。
2. 確認目前位於專案根目錄（即 `P_Union` 資料夾下）。
3. 輸入以下指令執行：
   ```bash
   python -m p_e_artist
   ```

### 執行結果：
程式執行後，會進行以下動作：
* 在 `p_e_artist/output/` 目錄下生成各主題的完整輸出檔（例如 `chart_default.svg`, `chart_dark.html`）。
* 在各個主題的專屬資料夾（例如 `p_e_artist/themes/dark/`）內，自動生成一張 `preview.svg` 作為該主題的縮圖預覽。

---

## 2. 新增主題方式

本專案採用類似 WordPress 的資料夾式主題管理系統。如果您想要設計一款全新的主題（例如：粉紅櫻花風），請依照以下步驟進行：

### 步驟 1：建立主題資料夾
在 `p_e_artist/themes/` 目錄下，建立一個新的資料夾，資料夾名稱即為「主題 ID」（例如 `sakura`）。

### 步驟 2：建立 `theme.json` 設定檔
在該資料夾內新增一個 `theme.json` 檔案。檔案內容必須包含主題的 Metadata 以及您想要**覆寫 (Override)** 的設計參數（`config`）。

**範例：`themes/sakura/theme.json`**
```json
{
    "name": "粉紅櫻花 (Sakura)",
    "description": "充滿春天氣息的粉色系主題。",
    "author": "Your Name",
    "version": "1.0",
    "config": {
        "font_family": "Microsoft JhengHei, sans-serif",
        "colors": {
            "bg": "#FFF0F5",
            "grid_stroke": "#FF69B4",
            "center_bg": "#FFE4E1",
            "palace_name": "#C71585",
            "star_main": "#DB7093"
        }
    }
}
```
> **提示**：`config` 裡面的參數只需填寫您想改變的部分。未填寫的參數（如格子大小、字體大小）會自動繼承系統的預設值。可參考 `p_e_artist/theme.py` 內的 `_DEFAULTS` 字典查看所有可用的參數。

### 步驟 3：生成預覽圖
完成設定檔後，再次執行 `python -m p_e_artist`。系統會自動偵測到新主題，並在您的 `sakura` 資料夾內生成一張 `preview.svg`，讓您立刻預覽設計效果！

---

## 3. 更換主題方式 (API 呼叫)

如果您要在其他主程式（例如網頁後端或排盤主程式）中動態指定並更換主題，請透過 `ThemeManager` 載入主題設定，並傳給 `Chart` 物件。

**Python 程式碼範例：**

```python
import json
from p_e_artist import Chart
from p_e_artist.theme_manager import ThemeManager

# 1. 準備命盤 JSON 資料
with open("your_chart_data.json", "r", encoding="utf-8") as f:
    data = json.load(f)

# 2. 決定要使用的主題 ID (對應 themes/ 下的資料夾名稱)
target_theme_id = "dark" 

# 3. 透過 ThemeManager 載入該主題的設定
theme_config = ThemeManager.load_theme(target_theme_id)

# 4. 建立圖表物件、套用主題並計算佈局
chart = Chart(data).set_theme(theme_config).compute_layout()

# 5. 輸出為 SVG 或 HTML 檔案
chart.to_svg("output_chart.svg")
chart.to_html("output_chart.html")
```

透過這種方式，您可以讓使用者在前端介面選擇喜歡的主題，後端再根據選擇的 `theme_id` 動態渲染出對應風格的命盤圖。

---

## 4. 新增圖表類型（開發指南）

V0.4 起，本專案採用**插件式架構**，所有圖表類型都放在 `charts/` 目錄下，各自獨立。目前已實作的圖表類型為 `natal`（紫微斗數命盤圖）。

### 架構概覽

```
p_e_artist/
├── core/
│   ├── elements.py          # 共用：繪圖元素（RectEl, TextEl, LineEl...）
│   └── base_composer.py     # 共用：抽象基底類 BaseComposer
├── charts/
│   ├── __init__.py          # 圖表類型註冊表
│   ├── natal/               # 命盤圖（已實作）
│   │   ├── data.py
│   │   ├── layout.py
│   │   ├── config.py
│   │   └── composer.py      # NatalComposer(BaseComposer)
│   └── <your_chart>/        # ← 您的新圖表類型
│       ├── data.py
│       └── composer.py
├── writers/
│   ├── svg_writer.py        # 共用：元素 → SVG
│   └── html_writer.py       # 共用：元素 → HTML
└── theme.py                 # 共用：主題設定
```

**核心設計原則：**

| 層次 | 職責 | 共用 / 專用 |
|------|------|-------------|
| `core/elements.py` | 定義可繪製的元素類型 | 共用 — 所有圖表共用 |
| `core/base_composer.py` | 抽象介面 `compose() → ChartLayout` | 共用 — 所有圖表繼承 |
| `charts/<type>/composer.py` | 將資料轉成元素列表 | 專用 — 每種圖表自己實作 |
| `charts/<type>/data.py` | 該圖表的資料模型 | 專用 — 每種圖表自己定義 |
| `writers/` | 將元素列表轉成 SVG / HTML | 共用 — 不需知道圖表類型 |
| `theme.py` | 顏色、字型、尺寸管理 | 共用 — 可按需擴充 key |

### 步驟 1：建立圖表子模組

在 `p_e_artist/charts/` 目錄下建立一個新資料夾，例如 `line`（折線圖）：

```
p_e_artist/charts/line/
├── __init__.py
├── data.py
└── composer.py
```

### 步驟 2：定義資料模型 (`data.py`)

建立該圖表的資料類別，必須提供 `from_dict(cls, data: dict)` 類方法：

```python
# charts/line/data.py
from dataclasses import dataclass, field
from typing import List

@dataclass
class Point:
    x: float
    y: float

@dataclass
class Series:
    name: str
    points: List[Point] = field(default_factory=list)

@dataclass
class LineData:
    title: str
    series: List[Series] = field(default_factory=list)

    @classmethod
    def from_dict(cls, data: dict) -> "LineData":
        # 從 JSON dict 解析為 LineData
        ...
```

### 步驟 3：實作 Composer (`composer.py`)

繼承 `BaseComposer`，實作 `compose()` 方法，將資料計算為 `ChartLayout`：

```python
# charts/line/composer.py
from ...core.base_composer import BaseComposer
from ...core.elements import (
    RectEl, TextEl, LineEl, GroupEl, ChartLayout,
)
from ...theme import ThemeConfig
from .data import LineData

class LineComposer(BaseComposer):
    """將折線圖資料計算為格式無關的 ChartLayout。"""

    def __init__(self, data: LineData, theme: ThemeConfig, **kwargs):
        super().__init__(data, theme, **kwargs)

    def compose(self) -> ChartLayout:
        elements = []

        # 1. 背景
        elements.append(RectEl(0, 0, 800, 600, cls="chart-bg"))

        # 2. 您的繪圖邏輯...
        #    使用 RectEl, TextEl, LineEl, ImageEl, GroupEl
        #    組合出想要的圖表

        return ChartLayout(
            canvas_w=800,
            canvas_h=600,
            css=self._theme.to_css(),
            elements=elements,
        )
```

### 步驟 4：註冊圖表類型

在 `charts/__init__.py` 的 `_ensure_registry()` 函式中新增一筆：

```python
def _ensure_registry():
    if _REGISTRY:
        return

    # 既有：命盤圖
    from .natal.data import ChartData as NatalData
    from .natal.composer import NatalComposer
    _REGISTRY["natal"] = {
        "data_class": NatalData,
        "composer_class": NatalComposer,
    }

    # 新增：折線圖
    from .line.data import LineData
    from .line.composer import LineComposer
    _REGISTRY["line"] = {
        "data_class": LineData,
        "composer_class": LineComposer,
    }
```

### 步驟 5：使用新圖表

完成後即可透過統一 API 使用：

```python
from p_e_artist import Chart

# 折線圖
chart = Chart("line", data).set_theme({...}).compute_layout()
chart.to_svg("line_chart.svg")
chart.to_html("line_chart.html")

# 命盤圖：預設會讀取 themes/default/theme.json（可省略 set_theme）
chart = Chart("natal", data).compute_layout()
chart.to_svg("natal_chart.svg")
```

### 如果需要新的元素類型

目前 `core/elements.py` 提供：`RectEl`、`TextEl`、`LineEl`、`ImageEl`、`GroupEl`。

若新圖表需要新元素（如圓形、折線路徑），步驟如下：

1. 在 `core/elements.py` 新增 dataclass（如 `CircleEl`、`PathEl`）
2. 在 `writers/svg_writer.py` 的 `_render_element()` 中加入對應的 SVG 轉換
3. 在 `writers/html_writer.py` 的 `_render_element()` 中加入對應的 HTML 轉換

### 查看已註冊的圖表類型

```python
from p_e_artist.charts import list_chart_types
print(list_chart_types())  # ['natal', 'line', ...]
```
