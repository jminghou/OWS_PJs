"""
p_e_artist — 紫微斗數圖表渲染器
====================================

V0.5: 命盤之外加入資料圖表（v3 星場讀數），並新增 JSON 佈局規格出口

用法:
    from p_e_artist import Chart

    # 命盤
    chart = Chart("natal", data).set_theme({...}).compute_layout()
    chart.to_svg("output.svg")
    chart.to_html("output.html")

    # 資料圖表（吃 p_d_graph_v3.palace_readings 的 payload）
    chart = Chart("starfield_aux_heatmap", readings_payload)
    chart.to_svg("a1.svg")     # 印刷／InDesign／S5 成書
    chart.to_json("a1.json")   # 前端渲染：幾何仍由 composer 算好，前端不重算
    chart.to_html("a1.html")   # 自我檢核用預覽（內嵌的就是送印那份 SVG）

    # V0.3 相容: 省略類型 → 預設 "natal"
    chart = Chart(data).compute_layout()
    chart.to_svg("output.svg")

一條原則：`compose()` 是幾何與數值的唯一真源，writers 只負責上色與封裝。
"""

# ⚠️ 這個版號是**出圖檔的快取鍵**的一部分（見 PolarisUI 的
# `artist/chart_table.render_signature()`）。改了畫面內容就要動它，否則舊圖會
# 一直被當成現行版端出來——2026-08-12 的瀑布選星修正就是這樣：程式改好了，
# 使用者重新整理看到的還是那張畫著地空的舊圖。
__version__ = "0.5.8"

from .theme import ThemeConfig
from .core.elements import ChartLayout
from .charts import get_chart_type, list_chart_types
from .writers import svg_writer, html_writer, json_writer


def _initial_theme() -> ThemeConfig:
    """
    預設載入 themes/default/theme.json（若存在且可讀），否則為程式內建 _DEFAULTS。
    如此在 Chart(...) 未呼叫 set_theme 時，仍會套用 default 主題資料夾的設定。
    """
    try:
        from .theme_manager import ThemeManager

        return ThemeConfig(ThemeManager.load_theme("default"))
    except (FileNotFoundError, OSError, ValueError):
        return ThemeConfig()


class Chart:
    """
    公開 Facade — 唯一的使用者進入點。

    V0.4: Chart(chart_type, data) — 支援多種圖表類型
    V0.3: Chart(data) — 向後相容，預設 "natal"
    """

    def __init__(self, chart_type_or_data, data: dict | None = None, lang: str = "zh",
                 **composer_kwargs):
        # V0.3 相容: Chart(data) → Chart("natal", data)
        if isinstance(chart_type_or_data, dict):
            chart_type = "natal"
            raw_data = chart_type_or_data
        else:
            chart_type = chart_type_or_data
            raw_data = data

        if raw_data is None:
            raise ValueError("必須提供圖表資料 (dict)")

        info = get_chart_type(chart_type)
        self._chart_type = chart_type
        self._chart_data = info["data_class"].from_dict(raw_data)
        self._composer_class = info["composer_class"]
        self._lang = lang
        # 額外參數轉發給 composer（例如 triangle_centers=["1", "B"]）
        self._composer_kwargs = composer_kwargs
        self._theme = _initial_theme()
        self._layout: ChartLayout | None = None

    def set_theme(self, overrides: dict) -> "Chart":
        """覆寫主題設定。回傳 self 以支援鏈式呼叫。"""
        self._theme = ThemeConfig(overrides)
        return self

    # ── 佈局 + 輸出 ──────────────────────────────────

    def compute_layout(self) -> "Chart":
        """計算佈局，產出格式無關的中間表示。回傳 self。"""
        composer = self._composer_class(
            self._chart_data, self._theme,
            lang=self._lang, **self._composer_kwargs)
        self._layout = composer.compose()
        return self

    def to_svg(self, path: str | None = None) -> str:
        """輸出 SVG。若提供 path 則同時寫入檔案。"""
        if self._layout is None:
            self.compute_layout()
        svg_str = svg_writer.to_svg(self._layout, self._theme)
        if path:
            self._write_file(path, svg_str)
        return svg_str

    def to_html(self, path: str | None = None) -> str:
        """輸出 HTML。若提供 path 則同時寫入檔案。"""
        if self._layout is None:
            self.compute_layout()
        html_str = html_writer.to_html(self._layout, self._theme)
        if path:
            self._write_file(path, html_str)
        return html_str

    def to_json(self, path: str | None = None, indent=None) -> str:
        """輸出佈局規格 JSON（前端渲染用；幾何仍由 composer 算好）。

        資料圖表專用——命盤的 PalaceEl 是語意容器，序列化會逼前端重算版面，
        故 json_writer 會直接報錯。
        """
        if self._layout is None:
            self.compute_layout()
        json_str = json_writer.to_json(self._layout, self._theme, indent=indent)
        if path:
            self._write_file(path, json_str)
        return json_str

    def layout_dict(self) -> dict:
        """同 to_json()，但回傳 dict（API 直接吐 JSON 時免二次編碼）。"""
        if self._layout is None:
            self.compute_layout()
        return json_writer.to_dict(self._layout, self._theme)

    # ── 內部 ────────────────────────────────────────

    @staticmethod
    def _write_file(path: str, content: str):
        import os
        os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
