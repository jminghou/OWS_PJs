"""
p_e_artist — 紫微斗數圖表渲染器
====================================

V0.4: 多圖表類型架構 — 插件式 Composer 模組

用法:
    from p_e_artist import Chart

    # V0.4: 明確指定圖表類型
    chart = Chart("natal", data).set_theme({...}).compute_layout()
    chart.to_svg("output.svg")
    chart.to_html("output.html")

    # V0.3 相容: 省略類型 → 預設 "natal"
    chart = Chart(data).compute_layout()
    chart.to_svg("output.svg")
"""

__version__ = "0.4.0"

from .theme import ThemeConfig
from .core.elements import ChartLayout
from .charts import get_chart_type, list_chart_types
from .writers import svg_writer, html_writer


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

    # ── 內部 ────────────────────────────────────────

    @staticmethod
    def _write_file(path: str, content: str):
        import os
        os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
