"""
主題設定系統
集中管理所有視覺變數，並生成對應的 CSS 字串注入 SVG <style>。

用法:
    # 使用預設主題
    theme = ThemeConfig()

    # 自訂主題（只覆寫想改的部分）
    theme = ThemeConfig({
        "font_family": "童書體, sans-serif",
        "colors": {"star_main": "#E63946"},
        "sizes": {"star_main": 18},
    })

    # 取得 CSS
    css_string = theme.to_css()
"""

from typing import Any


# ── 預設主題定義 ──────────────────────────────────────
_DEFAULTS = {
    # 全局字型
    "font_family": "HarmonyOS Sans TC, Microsoft JhengHei, PingFang TC, Noto Sans TC, sans-serif",
    # 地支兩位碼：明體／襯線，避免黑體類無襯線
    "font_branch": (
        '"Noto Serif TC", "Source Han Serif TC", "LiSong Pro", '
        '"PMingLiU", "Times New Roman", serif'
    ),

    # 顏色
    "colors": {
        "bg":                  "none",      # 命盤畫布底（chart-bg 矩形）；v2 使用 chart_container_bg
        "body_bg":             "#efefef",   # 頁面 body 背景（HTML 環境）
        "chart_container_bg":  "#fafafa",   # 命盤容器背景
        # 地支碼墨色（預設：黑 26%；暗色主題請覆寫為淺色半透明）
        "branch_ink":     "rgba(0, 0, 0, 0.26)",
        "grid_stroke":    "#555555",
        # 中央 2×2 區域底色（與格線下層的 center-bg 矩形）
        "center_bg":      "none",
        "center_text":    "#333333",
        # 中央區命盤 ID 墨色
        "chart_id_ink":   "rgba(0, 0, 0, 0.18)",
        "palace_name":    "#1A1A2E",
        "palace_name_en": "rgba(26,26,46,0.38)",
        "branch":         "#888888",
        "star_main":      "#2C3E50",
        "star_minor":     "#3a4a5c",
        "brightness":     "#888888",
        "sihua_fo":       "#2E7D32",   # 化祿
        "sihua_pw":       "#1565C0",   # 化權
        "sihua_ho":       "#6A1B9A",   # 化科
        "sihua_bi":       "#C62828",   # 化忌
        "sihua_badge_bg": "#111111",   # 四化字母標籤：近黑底
        "sihua_tag_ink":  "#FFFFFF",   # 四化字母標籤：白字
    },

    # 字級 (px)
    "sizes": {
        "palace_name":    11,
        "palace_name_en": 8,
        "branch":         14,
        "star_main":      13,
        "star_minor":     10,
        "brightness":     11,
        "sihua_tag":      12,
        "center_title":   16,
        "center_detail":  13,
    },

    # 線條
    "strokes": {
        "grid_width":     0.5,
    },

    # 佈局
    "layout": {
        "cell_width":     200,
        "cell_height":    200,
        # v2 宮位內距
        "palace_pad_top":     7,
        "palace_pad_right":   9,
        "palace_pad_bottom":  5,
        "palace_pad_left":    9,
        # 主／副星圖示尺寸（v2 規格）
        "icon_main_size":     77,
        "icon_main_gap":      5,
        "icon_sub_size":      43,
        "icon_sub_gap":       1,
        # 四化標籤
        "sihua_badge_size":   21,
        # 中央 ID 距右下邊（px）
        "center_id_inset":    14,
        # 小星文字
        "minor_line_height":  1.5,
        "minor_pad_bottom":   1,
        "minor_separator":    " · ",
        # 宮位 header 與底線
        "header_underline_offset": 24,   # 距宮位頂部
        "header_baseline_offset":  18,   # 文字基線距宮位頂部
        # === 舊版相容（PalaceLayout 仍用，但 v2 composer 已不依賴） ===
        "padding":        4,
        "header_text_y_factor":  0.5,
        "header_line_y_factor":  0.78,
        "star_icon_pad_main": 0.1,
        "star_icon_pad_sub":  0.1,
        "sihua_badge_radius_factor": 0.72,
        "sihua_badge_radius_min":    7.5,
    },
}


def _deep_merge(base: dict, override: dict) -> dict:
    """遞迴合併，override 覆蓋 base 的對應 key。"""
    result = dict(base)
    for k, v in override.items():
        if k in result and isinstance(result[k], dict) and isinstance(v, dict):
            result[k] = _deep_merge(result[k], v)
        else:
            result[k] = v
    return result


class ThemeConfig:
    """
    主題設定物件。存取方式:
        theme.font_family       → str
        theme.font_branch       → 地支碼專用字型（襯線，非黑體）
        theme.colors["bg"]      → str
        theme.sizes["star_main"] → int
        theme.layout["padding"]  → 星曜區與宮位左、右邊線距離
        theme.layout["content_inset_top"] / ["content_inset_bottom"]  → 星曜區與上邊線、footer 上緣距離
        theme.layout["star_icon_pad_main"] / ["star_icon_pad_sub"]  → 主／副星圖留白（越小圖越大）
        theme.layout["header_text_y_factor"] / ["header_line_y_factor"]  → 宮名與其底線在第 0 列內的垂直位置（0~1，乘 _row_h）
    """

    def __init__(self, overrides: dict | None = None):
        merged = _deep_merge(_DEFAULTS, overrides or {})
        self.font_family: str = merged["font_family"]
        self.font_branch: str = merged["font_branch"]
        self.colors: dict = merged["colors"]
        self.sizes: dict = merged["sizes"]
        self.strokes: dict = merged["strokes"]
        self.layout: dict = merged["layout"]

    # ── 便捷存取 ─────────────────────────────────────

    def sihua_color(self, code: str) -> str:
        """FO/PW/HO/BI → 對應顏色。"""
        key = f"sihua_{code.lower()}"
        return self.colors.get(key, self.colors["star_main"])

    # ── CSS 生成 ─────────────────────────────────────

    def to_css(self) -> str:
        """SVG 用：fill / stroke 風格的 CSS（注入到 SVG <style>）。"""
        c = self.colors
        s = self.sizes
        f = self.font_family
        fb = self.font_branch
        sw = self.strokes["grid_width"]

        return f"""\
/* p_e_artist theme — auto-generated (svg) */
.chart-bg {{ fill: {c['bg']}; }}
.grid-line {{ stroke: {c['grid_stroke']}; stroke-width: {sw}; fill: none; }}
.grid-border {{ stroke: {c['grid_stroke']}; stroke-width: {sw}; fill: none; }}
.center-bg {{ fill: {c['center_bg']}; }}
.center-chart-id {{ font-family: monospace; font-size: 10px; fill: {c['chart_id_ink']}; letter-spacing: 0.05em; }}
.palace-name {{ font-family: {f}; font-size: {s['palace_name']}px; fill: {c['palace_name']}; font-weight: bold; letter-spacing: 0.02em; }}
.palace-name-en {{ font-family: {f}; font-size: {s['palace_name_en']}px; fill: {c['palace_name_en']}; letter-spacing: 0.04em; }}
.palace-header-line {{ stroke: {c['grid_stroke']}; stroke-width: {sw}; }}
.branch-name {{ font-family: {fb}; font-size: {s['branch']}px; fill: {c['branch_ink']}; }}
.stars-minor {{ font-family: {f}; font-size: {s['star_minor']}px; fill: {c['star_minor']}; letter-spacing: 0.01em; }}
.sihua-badge {{ fill: {c['sihua_badge_bg']}; stroke: none; }}
.sihua-badge-text {{ font-family: {f}; font-size: {s['sihua_tag']}px; font-weight: bold; fill: {c['sihua_tag_ink']}; stroke: none; }}
.palace-link {{ stroke: #cccccc; stroke-width: 0.5pt; stroke-dasharray: 4 2; fill: none; }}
"""

    def to_html_css(self) -> str:
        """HTML 用：v2 flex / 絕對定位混合佈局的 CSS。"""
        c = self.colors
        s = self.sizes
        f = self.font_family
        fb = self.font_branch
        lo = self.layout

        icon_main = lo["icon_main_size"]
        icon_main_gap = lo["icon_main_gap"]
        icon_sub = lo["icon_sub_size"]
        icon_sub_gap = lo["icon_sub_gap"]
        badge = lo["sihua_badge_size"]
        cw = lo["cell_width"]
        ch = lo["cell_height"]
        pad_top = lo["palace_pad_top"]
        pad_right = lo["palace_pad_right"]
        pad_bottom = lo["palace_pad_bottom"]
        pad_left = lo["palace_pad_left"]
        minor_lh = lo["minor_line_height"]
        minor_pb = lo["minor_pad_bottom"]
        center_inset = lo["center_id_inset"]

        return f"""\
/* p_e_artist theme — auto-generated (html v2) */
* {{ margin: 0; padding: 0; box-sizing: border-box; }}
body {{ background: {c['body_bg']}; display: flex; justify-content: center; padding: 24px; }}

.chart-container {{
  position: relative;
  width: {cw * 4}px; height: {ch * 4}px;
  margin: 20px auto;
  overflow: hidden;
  background: {c['chart_container_bg']};
}}
.gb {{ position: absolute; border: 0.5px solid {c['grid_stroke']}; }}
.gl {{ position: absolute; border-color: {c['grid_stroke']}; border-width: 0.5px; }}

.center-bg {{
  position: absolute; left: {cw}px; top: {ch}px;
  width: {cw * 2}px; height: {ch * 2}px;
  background: {c['center_bg']};
}}
.center-id {{
  position: absolute;
  font-family: monospace; font-size: 10px;
  color: {c['chart_id_ink']}; white-space: nowrap;
  right: {center_inset}px; bottom: {center_inset}px; letter-spacing: 0.05em;
}}

.palace {{
  position: absolute; width: {cw}px; height: {ch}px;
  display: flex; flex-direction: column;
  padding: {pad_top}px {pad_right}px {pad_bottom}px {pad_left}px;
}}
.palace-header {{
  display: flex; justify-content: space-between; align-items: baseline;
  padding-bottom: 3px; border-bottom: 0.5px solid {c['grid_stroke']}; flex-shrink: 0;
}}
.ph-left {{ display: flex; align-items: baseline; gap: 4px; min-width: 0; overflow: hidden; }}
.palace-name {{
  font-family: {f};
  font-size: {s['palace_name']}px; color: {c['palace_name']}; font-weight: 700;
  white-space: nowrap; letter-spacing: 0.02em;
}}
.palace-name-en {{
  font-family: {f};
  font-size: {s['palace_name_en']}px; color: {c['palace_name_en']};
  white-space: nowrap; letter-spacing: 0.04em; text-transform: uppercase;
}}
.branch-name {{
  font-family: {fb};
  font-size: {s['branch']}px; color: {c['branch_ink']}; flex-shrink: 0; line-height: 1;
}}

.stars-area {{ display: flex; flex-direction: column; flex: 1; min-height: 0; }}
.stars-icons {{
  flex: 1; display: flex; flex-direction: column;
  justify-content: center; align-items: center; gap: 0; min-height: 0;
}}
.stars-major-row {{
  display: flex; flex-direction: row; gap: {icon_main_gap}px;
  align-items: center; justify-content: center;
}}

.smw {{ display: block; flex-shrink: 0; }}

.smw-badge {{
  display: inline-grid;
  width: {icon_main}px; height: {icon_main}px;
  flex-shrink: 0;
}}
.smw-badge > * {{ grid-area: 1 / 1 / 2 / 2; }}
.smw-badge .star-major {{ width: {icon_main}px; height: {icon_main}px; display: block; }}
.smw-badge .sihua-badge {{
  justify-self: end; align-self: start;
  width: {badge}px; height: {badge}px; display: block;
}}

.star-major {{ width: {icon_main}px; height: {icon_main}px; display: block; }}
.star-sub   {{ width: {icon_sub}px;  height: {icon_sub}px;  display: block; }}

.stars-sub-row {{ display: flex; flex-wrap: wrap; gap: {icon_sub_gap}px; justify-content: center; }}
.stars-minor {{
  font-family: {f};
  font-size: {s['star_minor']}px; color: {c['star_minor']}; line-height: {minor_lh};
  letter-spacing: 0.01em; flex-shrink: 0; padding-bottom: {minor_pb}px;
  text-align: center;
}}

.palace-links-overlay {{ position: absolute; left: 0; top: 0; pointer-events: none; }}
.palace-link {{ stroke: #999999; stroke-width: 0.5pt; stroke-dasharray: 4 2; fill: none; }}
"""
