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
    # 宮位干支字型：與宮名同字型（曾用明體/襯線區隔，2026-07-17 統一）；
    # 主題仍可覆寫此鍵單獨換字型
    "font_branch": "HarmonyOS Sans TC, Microsoft JhengHei, PingFang TC, Noto Sans TC, sans-serif",

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
        # 星曜圖示墨色（渲染時將單色圖示整體換成此色；暗色主題請覆寫為淺色。
        # 疊盤時亦可每盤指定不同 star_ink 做盤別區分）。
        "star_ink":       "#231815",
        # 四化圖示墨色（與星曜分軌；本命四化=紅。未設定時退回 star_ink）。
        "sihua_ink":      "#C62828",
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
        # 中宮內容卡（center_content 原語）
        "center_kv":        12,
        "center_kv_label":  10,
        "center_text":      12,
        "center_note":      9,
        "center_key":       10,
        # 圖例對照表
        "legend_name":    11,
        "legend_header":  12,
        # 疊盤：表頭各層宮名字級（與本命宮名同大小；層以顏色區分）
        "overlay_layer_name": 11,
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
        # 副星 35：讓 5 顆能排一行（5×35+4×gap1=179 ≤ 內寬182），
        # 多數宮位單行落在固定網格線上，與疊盤同一對齊邏輯（原 43 兩行必超高）
        "icon_sub_size":      35,
        "icon_sub_gap":       1,
        # 四化標籤
        "sihua_badge_size":   21,
        "sihua_badge_gap":    2,    # 單盤徽章橫排間距（原寫死於 svg_writer）
        # 徽章貼著「圖形」下緣放（依 assets/stars/_bounds.json 的量測值），而非貼畫框；
        # 畫框下方約 25% 是留白，貼畫框會讓四化離星曜很遠。False＝退回貼畫框。
        "sihua_badge_attach":     True,
        "sihua_badge_attach_gap": 1,    # 圖形下緣到徽章頂的間距
        # 副星線寬補償：原稿線寬一致，副星縮小後線條等比變細。
        # 1.0＝補到與主星同粗（整張盤線條一致）；0＝不補（維持等比縮小的細線）
        "icon_sub_stroke_match":  1.0,
        # 整組星曜（主星＋四化＋輔星）在宮格內的垂直對齊，以實際圖形上下緣為準。
        # "center"＝垂直置中；"top"＝貼頂（跨宮位主星同一水平線）
        "star_block_valign":      "center",
        # 主星區/輔星列/小星列 區塊間距（單盤；疊盤用 overlay_row_gap）
        "icon_row_gap":       3,
        # 小星曜（鸞喜等 SMALL_STAR_CODES）與所有運限流曜的縮放（乘副星尺寸）。
        # 1.0＝與一般副星同尺寸（0.5 曾試過，縮太小無法辨認）
        "small_star_scale":   1.0,
        # 中央 ID 距右下邊（px）
        "center_id_inset":    14,
        # 小星文字
        "minor_line_height":  1.5,
        "minor_pad_bottom":   1,
        "minor_separator":    " · ",
        # 宮名表現："icon"＝宮位圖示（assets/palace/{code}.svg，無圖檔的宮退回文字）；
        # "text"＝文字宮名（隨語言切換）。圖示線寬自動對齊主星，不需另設。
        "palace_name_style":     "icon",
        "palace_header_line":    False,  # 表頭底線（宮名與星曜之間那條橫線）
        # 右下角宮位干支的寫法："code"＝英數代號（天干 A–J ＋ 地支 01–12，
        # 例：癸未→J08，直接沿用系統正規代碼）；"cn"＝中文「癸未」
        "branch_label_style":    "code",
        "palace_icon_height":    18,     # 圖示高（寬＝高×3.25，橫幅式）
        "palace_body_frame_pad": 3,      # 身宮外框與圖示的間距（版面一律留，只有身宮畫框）
        # 疊層（大限／小限／流年）用半寬宮位圖 h{碼}.svg（128×68），以層色上色。
        # 比本命略小＝視覺層級，且一格要並排三層，全寬版放不下。
        "palace_layer_icon_height": 15,
        # 圖示上緣（含外框）距宮格頂的留白：置中時外框會貼到宮格格線
        "palace_icon_top_gap":   7,
        # 圖示模式的表頭帶高（取代 header_underline_offset）
        # ＝ top_gap 7 ＋ 外框 3×2 ＋ 圖示 18 ＋ 底部留白 3
        "palace_icon_header_offset": 34,
        # 宮位 header 與底線
        "header_underline_offset": 24,   # 距宮位頂部
        "header_baseline_offset":  18,   # 文字基線距宮位頂部
        # 疊盤（overlay_layers 非空時生效）：圖示縮小以容納四化排與流曜
        # 尺寸階層＝單盤 77/43/21 × 同一縮放係數 k≈0.78 → 60/34/16
        "overlay_icon_main_size": 60,
        "overlay_icon_sub_size":  34,
        "overlay_icon_sub_gap":   2,
        "overlay_badge_size":     16,   # 星曜圖下方的四化圖尺寸
        "overlay_badge_gap":      2,
        "overlay_row_gap":        3,    # 主星區/輔星列之間的間距
        "overlay_layer_name_gap": 5,    # 表頭各層宮名之間距
        # 圖例對照表（命盤下方；show_legend=True 時生效）
        "legend_pad_x":         14,
        "legend_top_gap":       20,   # 命盤底與圖例首行的間距
        "legend_icon_size":     22,
        "legend_row_h":         30,
        "legend_cols":          4,
        "legend_header_h":      26,
        "legend_section_gap":   10,
        "legend_icon_text_gap": 8,
        "legend_bottom_pad":    8,
        # === 舊版相容（PalaceLayout 仍用，但 v2 composer 已不依賴） ===
        "padding":        4,
        "header_text_y_factor":  0.5,
        "header_line_y_factor":  0.78,
        "star_icon_pad_main": 0.1,
        "star_icon_pad_sub":  0.1,
        "sihua_badge_radius_factor": 0.72,
        "sihua_badge_radius_min":    7.5,
    },

    # ── 資料圖表命名空間 ──────────────────────────────
    # 命盤的 token 全是命盤語彙（palace_name / star_ink / icon_main_size），
    # 資料圖表需要另一套詞彙（色階／系列色／軸線／刻度）。放同一個 ThemeConfig
    # 底下是為了讓命盤頁與圖表頁在 S5 成書裡共用同一本主題，不長成兩套色票。
    #
    # ⚠️ 色票不是用眼睛挑的：以下取自已過 dataviz 驗證器雙模式（亮/暗）
    #    全對比與色盲檢驗的組合，改動前請重跑驗證器。
    "dataviz": {
        "colors": {
            "surface":        "#fcfcfb",   # 圖卡底
            "plane":          "#f9f9f7",   # 頁面底
            "text_primary":   "#0b0b0b",
            "text_secondary": "#52514e",
            "muted":          "#898781",   # 軸標籤／註腳
            "grid":           "#e1e0d9",
            "axis":           "#c3c2b7",
            "border":         "rgba(11,11,11,.10)",
            # 類別色（A2 依取樣關係塗色：對宮／三方。12 宮塗 12 色超出可辨識
            # 上限，少一個顏色反而多一份資訊——結構靠幾何浮出來）
            "series_1":       "#2a78d6",
            "series_2":       "#eb6834",
            "self":           "#52514e",   # 主宮自給＝中性墨，刻意不是序列色
            "arc_base":       "#d5d4cd",
            # 四化四類（暗色模式下 CVD 落 6–8 帶 ⇒ 必配直接標籤，不可只靠顏色）
            "hua_lu":         "#1baf7a",
            "hua_quan":       "#2a78d6",
            "hua_ke":         "#eda100",
            "hua_ji":         "#d03b3b",
            # 狀態色（必配正負號標籤）
            "gain":           "#0ca30c",
            "loss":           "#d03b3b",
            # 色階上的字色（依對比度二選一，見 ink_on）。
            # ⚠️ 深字用**純黑**不是柔黑：兩個字色的可用區間必須接得起來，
            # 否則色階中段會出現「兩種字色都過不了 AA」的死角。
            #   白字達 4.5:1 需要底色亮度 L ≤ 0.183
            #   #0b0b0b 達 4.5:1 需要 L ≥ 0.190   → 0.183~0.190 是死角
            #   #000000 達 4.5:1 需要 L ≥ 0.175   → 無死角（區間重疊）
            # 實例：色階第 7 階 #2a78d6（L=0.185）用柔黑最佳只有 4.46。
            "ink_on_dark":    "#ffffff",
            "ink_on_light":   "#000000",
        },
        # 連續色階（低→高）。13 階是為了讓低值區也拉得開。
        "seq_ramp": [
            "#cde2fb", "#b7d3f6", "#9ec5f4", "#86b6ef", "#6da7ec", "#5598e7",
            "#3987e5", "#2a78d6", "#256abf", "#1c5cab", "#184f95", "#104281",
            "#0d366b",
        ],
        # 暗色主題整條反轉：近零退回暗面（與亮色近零退回淺面對稱），
        # 兩邊都用滿 13 階，低值區才拉得開
        "seq_reverse": False,
        "sizes": {
            "title":       15,
            "subtitle":    11.5,
            "col_header":  11.5,
            "row_header":  12,
            "row_sub":     11,     # 宮位地支
            "cell_value":  11.5,
            "margin_value": 11.5,
            "footer":      11.5,
            "note":        11.5,
        },
        "layout": {
            "cell_w":        66,
            "cell_h":        36,
            "cell_gap":      3,
            "cell_radius":   4,
            "row_header_w":  84,
            "margin_w":      86,   # 右側 S輔 小長條欄
            "margin_bar_max": 54,
            "pad_x":         20,
            "pad_y":         18,
            "title_gap":     8,    # 標題基線 → 副標基線
            "header_gap":    10,   # 副標 → 欄表頭
            "footer_gap":    8,    # 矩陣底 → 全盤Σ 列
            "legend_gap":    18,   # 全盤Σ → 圖例
            "note_gap":      16,   # 圖例 → 註腳
            "note_line_h":   1.7,
            # A3a 排序橫條
            "rank_row_h":    22,
            "rank_row_gap":  3,
            "rank_bar_h":    12,
            "rank_label_w":  132,
            "rank_bar_max":  300,
            "rank_value_w":  92,
            # A3b 瀑布
            "wf_row_h":      30,
            "wf_row_gap":    6,
            "wf_bar_h":      16,
            "wf_label_w":    96,
            "wf_bar_max":    300,
            "wf_note_w":     104,   # 係數說明（×1.2／＋0.08／豁免）的活動範圍
            "wf_value_w":    70,    # 累積值專欄；係數說明不得侵入
            # A4 四化桑基（雙面對照）
            "sk_src_label_w": 92,
            "sk_tgt_label_w": 52,
            "sk_node_w":      10,
            "sk_node_gap":    7,
            "sk_span":        112,   # 源節點 → 匯節點的水平距離（並列模式）
            "sk_flow_h":      250,   # 每面的流量高度（各自正規化）
            "sk_panel_gap":   46,
            # 單面模式：貼著另一面時夠用的比例，單獨成頁就成了窄長條
            # （316×504，長寬比 0.63）。放寬流帶跨距與高度才站得住。
            "sk_span_single": 260,
            "sk_flow_h_single": 300,
            # A2 弦圖
            "chord_radius":     218,   # 弧環外緣
            "chord_ring_w":     15,    # 弧環厚度
            "chord_pad":        0.02,  # 節點之間的間隙（弧度）
            "chord_label_gap":  14,    # 弧環外緣 → 標籤
            "chord_ribbon_inset": 1.5, # 緞帶端點內縮（不壓到弧環）
        },
    },
}


# ── 命盤畫布形狀 ──────────────────────────────────────
# 形狀＝一組 layout 覆寫值，與主題（配色）正交：任何主題都能出方形或直式。
# 檔名 variant 用 key（square 不加後綴，維持既有檔名／既有引用不變）。
CHART_SHAPES = {
    "square": {"label": "正方型", "layout": {}},
    # 直式 3:2（宮格 200×300）。宮寬沒變、只長高，故圖示放大受「宮寬」限制：
    #   主星 85＝兩顆並排的上限
    #   副星 42＝一排 4 顆（4×42+3×1 ≤ 內寬 182），第 5 顆起換行
    # 疊盤走 overlay_* 那套尺寸（見 svg_writer._star_area），故同步等比放大，
    # 否則選了直式只有宮格變高、圖示還是方形的大小。
    "portrait": {"label": "3:2直式", "layout": {
        "cell_height":      300,
        "icon_main_size":   85,
        "icon_sub_size":    42,
        "sihua_badge_size": 24,
        "icon_row_gap":     10,
        # 疊盤：60/34/16 等比放大；副星 41＝一排 4 顆（4×41+3×2 ≤ 182）
        "overlay_icon_main_size": 66,
        "overlay_icon_sub_size":  41,
        "overlay_badge_size":     18,
        "overlay_row_gap":        8,
    }},
}


def header_offset(layout: dict) -> float:
    """表頭帶高（宮格頂到底線）＝星曜區的起點。圖示模式較高，見 palace_icon_header_offset。

    只看 palace_name_style、不看個別宮位有沒有圖檔：12 宮的底線必須同一條水平線。
    SVG／HTML 兩個 writer 都從這裡取值。
    """
    if layout.get("palace_name_style", "icon") == "icon":
        return layout.get("palace_icon_header_offset", layout["header_underline_offset"])
    return layout["header_underline_offset"]


def apply_chart_shape(theme_config: dict | None, shape: str) -> dict:
    """回傳套上形狀覆寫值的主題設定（不改動傳入的 dict）。

    形狀的值蓋過主題自己的同名 layout 值——選了直式就是要直式的宮格與圖示尺寸。
    未知形狀拋 ValueError。
    """
    key = (shape or "square").strip().lower()
    if key not in CHART_SHAPES:
        raise ValueError(
            f"未知的畫布形狀：{shape!r}（可用：{'/'.join(CHART_SHAPES)}）")
    return _deep_merge(theme_config or {}, {"layout": CHART_SHAPES[key]["layout"]})


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
        theme.font_branch       → 宮位干支字型（預設同 font_family，可單獨覆寫）
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
        # 資料圖表命名空間（見 _DEFAULTS["dataviz"]）
        self.dataviz: dict = merged["dataviz"]
        self.dv_colors: dict = self.dataviz["colors"]
        self.dv_sizes: dict = self.dataviz["sizes"]
        self.dv_layout: dict = self.dataviz["layout"]

    # ── 便捷存取 ─────────────────────────────────────

    def sihua_color(self, code: str) -> str:
        """FO/PW/HO/BI → 對應顏色。"""
        key = f"sihua_{code.lower()}"
        return self.colors.get(key, self.colors["star_main"])

    # ── 資料圖表：色階映射 ────────────────────────────

    def seq_ramp(self) -> list:
        """連續色階（已依主題方向排好，低→高）。"""
        ramp = list(self.dataviz["seq_ramp"])
        return ramp[::-1] if self.dataviz.get("seq_reverse") else ramp

    def seq_color(self, t: float) -> str:
        """t ∈ [0,1] → 色階上的顏色。分箱取最近階，不做插值。"""
        ramp = self.seq_ramp()
        t = 0.0 if t is None else max(0.0, min(1.0, float(t)))
        return ramp[round(t * (len(ramp) - 1))]

    @staticmethod
    def _luminance(hex_color: str) -> float:
        """sRGB 相對亮度（WCAG 公式）。"""
        h = hex_color.lstrip("#")
        if len(h) != 6:
            return 1.0
        n = int(h, 16)

        def lin(c: int) -> float:
            c /= 255
            return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4

        return (0.2126 * lin(n >> 16 & 255)
                + 0.7152 * lin(n >> 8 & 255)
                + 0.0722 * lin(n & 255))

    @classmethod
    def contrast(cls, fg: str, bg: str) -> float:
        """WCAG 對比度（1:1 ~ 21:1）。"""
        a, b = cls._luminance(fg), cls._luminance(bg)
        hi, lo = max(a, b), min(a, b)
        return (hi + 0.05) / (lo + 0.05)

    def ink_on(self, hex_color: str) -> str:
        """該底色上該用深字還是淺字。

        取「對比度較高的那一個」，不是拿亮度跟門檻比。門檻法在色階中段
        會挑錯邊——原型用的 L>0.42 就把中藍 #6da7ec 判成該配白字，
        實測對比只有 2.50（深字有 7.8），整條色階中段的數字都低於 AA。
        對比本來就不該用眼睛判斷，也不該用近似門檻判斷：兩邊都算，取大的。
        """
        light = self.dv_colors["ink_on_light"]
        dark = self.dv_colors["ink_on_dark"]
        return (light if self.contrast(light, hex_color)
                >= self.contrast(dark, hex_color) else dark)

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
.branch-name, .stem-name {{ font-family: {fb}; font-size: {s['branch']}px; fill: {c['branch_ink']}; }}
.stars-minor {{ font-family: {f}; font-size: {s['star_minor']}px; fill: {c['star_minor']}; letter-spacing: 0.01em; }}
.stars-overflow {{ font-family: {f}; font-size: {s['star_minor']}px; fill: {c['star_minor']}; font-weight: bold; opacity: 0.7; }}
.sihua-badge {{ fill: {c['sihua_badge_bg']}; stroke: none; }}
.sihua-badge-text {{ font-family: {f}; font-size: {s['sihua_tag']}px; font-weight: bold; fill: {c['sihua_tag_ink']}; stroke: none; }}
.palace-link {{ stroke: #cccccc; stroke-width: 0.5pt; stroke-dasharray: 4 2; fill: none; }}
.palace-name-layer {{ font-family: {f}; font-size: {s['overlay_layer_name']}px; font-weight: 600; letter-spacing: 0.02em; }}
.center-title {{ font-family: {f}; font-size: {s['center_title']}px; fill: {c['palace_name']}; font-weight: bold; letter-spacing: 0.06em; }}
.center-kv-label {{ font-family: {f}; font-size: {s['center_kv_label']}px; fill: {c['branch']}; }}
.center-kv-value {{ font-family: {f}; font-size: {s['center_kv']}px; fill: {c['center_text']}; }}
.center-text {{ font-family: {f}; font-size: {s['center_text']}px; fill: {c['center_text']}; }}
.center-note {{ font-family: monospace; font-size: {s['center_note']}px; fill: {c['chart_id_ink']}; letter-spacing: 0.05em; }}
.center-divider {{ stroke: {c['grid_stroke']}; stroke-width: {sw}; }}
.center-key-label {{ font-family: {f}; font-size: {s['center_key']}px; fill: {c['center_text']}; }}
.legend-divider {{ stroke: {c['grid_stroke']}; stroke-width: {sw}; }}
.legend-header {{ font-family: {f}; font-size: {s['legend_header']}px; fill: {c['palace_name']}; font-weight: bold; letter-spacing: 0.04em; }}
.legend-name {{ font-family: {f}; font-size: {s['legend_name']}px; fill: {c['star_ink']}; }}
"""

    def dataviz_css(self) -> str:
        """資料圖表用：SVG <style> 的 class 定義。

        逐格算出來的顏色（色階、系列色）走呈現屬性 fill=""，不在這裡；
        這裡只放「整類元素共用」的字型、字級、線條。
        """
        c = self.dv_colors
        s = self.dv_sizes
        f = self.font_family

        return f"""\
/* p_e_artist theme — auto-generated (dataviz) */
.dv-surface {{ fill: {c['surface']}; }}
.dv-title {{ font-family: {f}; font-size: {s['title']}px; fill: {c['text_primary']}; font-weight: 600; letter-spacing: 0.02em; }}
.dv-subtitle {{ font-family: {f}; font-size: {s['subtitle']}px; fill: {c['muted']}; }}
.dv-col-header {{ font-family: {f}; font-size: {s['col_header']}px; fill: {c['muted']}; }}
.dv-row-header {{ font-family: {f}; font-size: {s['row_header']}px; fill: {c['text_primary']}; font-weight: 550; }}
.dv-row-sub {{ font-family: {f}; font-size: {s['row_sub']}px; fill: {c['muted']}; }}
.dv-cell {{ stroke: none; }}
/* 空格＝極淡實底、不描邊：一張 12×8 的矩陣多半過半是空的，
   空格若加虛線框，整片沒有資料的區域會比有資料的區域更搶眼。 */
.dv-cell-empty {{ fill: {c['grid']}; stroke: none; }}
.dv-cell-value {{ font-family: {f}; font-size: {s['cell_value']}px; }}
.dv-cell-empty-value {{ font-family: {f}; font-size: {s['row_sub']}px; fill: {c['muted']}; }}
.dv-peak {{ fill: none; stroke-width: 1.5; }}
.dv-bar {{ fill: {c['series_1']}; fill-opacity: 0.32; stroke: none; }}
.dv-margin-value {{ font-family: {f}; font-size: {s['margin_value']}px; fill: {c['text_secondary']}; }}
.dv-footer {{ font-family: {f}; font-size: {s['footer']}px; fill: {c['muted']}; }}
.dv-footer-strong {{ font-family: {f}; font-size: {s['footer']}px; fill: {c['text_primary']}; font-weight: 600; }}
.dv-rule {{ stroke: {c['grid']}; stroke-width: 1; }}
.dv-note {{ font-family: {f}; font-size: {s['note']}px; fill: {c['muted']}; }}
.dv-legend-label {{ font-family: {f}; font-size: {s['note']}px; fill: {c['muted']}; }}
.dv-bar-solid {{ stroke: none; }}
.dv-bar-flat {{ stroke: none; }}
.dv-connector {{ stroke: {c['axis']}; stroke-width: 1; stroke-dasharray: 2 2; }}
.dv-arc {{ stroke: none; }}
.dv-arc-self {{ stroke: none; }}
.dv-ribbon {{ stroke: none; }}
.dv-node-label {{ font-family: {f}; font-size: {s['col_header']}px; fill: {c['text_primary']}; }}
.dv-node-sub {{ font-family: {f}; font-size: {s['row_sub']}px; fill: {c['muted']}; }}
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
        name_gap = lo.get("palace_name_gap", 4)   # 宮名/英文名/疊層宮名之間距
        p_icon_h = lo.get("palace_icon_height", 18)
        p_icon_w = round(p_icon_h * 260 / 80, 2)
        p_frame_pad = lo.get("palace_body_frame_pad", 3)
        p_top_gap = lo.get("palace_icon_top_gap", lo["palace_pad_top"])
        p_stroke = round(5.0 * icon_main / 289.0, 3)   # 與主星同粗（見 svg_writer）
        hdr_off = header_offset(lo)
        hdr_line = (f"{sw}px solid {c['grid_stroke']}"
                    if lo.get("palace_header_line", False) else "none")

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
/* 宮名置中；地支已移出表頭（絕對定位於宮格右下角），故不再左右分置 */
.palace-header {{
  display: flex; justify-content: center; align-items: baseline;
  padding-bottom: 3px; border-bottom: {hdr_line}; flex-shrink: 0;
}}
/* 圖示模式：表頭帶固定高（宮格頂～底線），圖示垂直置中；與 SVG 同一幾何 */
/* 圖示模式：表頭帶固定高（宮格頂～星曜區），圖示由頂端固定留白下移；與 SVG 同一幾何 */
.palace-header.ph-icon {{
  height: {hdr_off}px; margin-top: -{pad_top}px; padding-bottom: 0;
  padding-top: {p_top_gap}px; align-items: flex-start;
}}
.palace-icon-wrap {{ display: block; line-height: 0; border: {p_stroke}px solid transparent; padding: {p_frame_pad}px; }}
.palace-icon-wrap.is-body {{ border-color: {c['palace_name']}; border-radius: 1.5px; }}
.palace-icon {{ display: block; width: {p_icon_w}px; height: {p_icon_h}px; }}
.ph-left {{ display: flex; align-items: baseline; gap: {name_gap}px; min-width: 0; overflow: hidden; }}
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
/* 地支：宮格右下角（與 SVG 同一視覺語言）。星曜區底部已保留同高的一列，
   不會互相壓到——高度見 svg_writer._star_area 的 branch_height。 */
.branch-name, .stem-name {{
  position: absolute; bottom: {pad_bottom}px;
  font-family: {fb};
  font-size: {s['branch']}px; color: {c['branch_ink']}; line-height: 1;
}}
.branch-name {{ right: {pad_right}px; }}
.stem-name {{ left: {pad_left}px; }}

/* padding-bottom＝地支那一列：與 SVG 的 branch_height 同值，星曜不壓到地支 */
.stars-area {{
  display: flex; flex-direction: column; flex: 1; min-height: 0;
  padding-bottom: {s['branch'] + 2}px;
}}
.stars-icons {{
  flex: 1; display: flex; flex-direction: column;
  justify-content: center; align-items: center; gap: 0; min-height: 0;
}}
.stars-major-row {{
  display: flex; flex-direction: row; gap: {icon_main_gap}px;
  align-items: flex-start; justify-content: center;
}}

.smw {{ display: flex; flex-direction: column; align-items: center; flex-shrink: 0; }}
.ssw {{ display: flex; flex-direction: column; align-items: center; flex-shrink: 0; }}

/* 四化徽章＝星曜圖示正下方（主/副星共用；與 SVG／疊盤同一視覺語言） */
.sbw {{ display: flex; flex-direction: column; align-items: center; flex-shrink: 0; }}
.sbw .sihua-badge {{
  width: {badge}px; height: {badge}px; display: block; margin-top: 1px;
}}

.star-major {{ width: {icon_main}px; height: {icon_main}px; display: block; }}
.star-sub   {{ width: {icon_sub}px;  height: {icon_sub}px;  display: block; }}

.stars-sub-row {{ display: flex; flex-wrap: wrap; gap: {icon_sub_gap}px; justify-content: center; align-items: flex-start; }}

/* ── 圖示↔文字 一鍵切換（.text-mode 掛在 .chart-container 上） ── */
.star-label {{
  display: none; font-family: {f}; white-space: nowrap; line-height: 1.4;
}}
.sl-major {{ font-size: {s['star_main']}px; font-weight: 700; color: {c['star_main']}; }}
.sl-sub   {{ font-size: {s['star_minor']}px; color: {c['star_minor']}; }}
.chart-container.text-mode .star-major,
.chart-container.text-mode .star-sub {{ display: none; }}
.chart-container.text-mode .star-label {{ display: inline-block; }}
.chart-container.text-mode .stars-major-row {{ gap: 10px; }}
.chart-container.text-mode .stars-sub-row {{ gap: 6px; }}

.chart-toolbar {{ position: fixed; top: 12px; right: 16px; z-index: 10; }}
.chart-toolbar button {{
  font-family: {f}; font-size: 12px; padding: 4px 12px; cursor: pointer;
  color: {c['palace_name']}; background: {c['chart_container_bg']};
  border: 1px solid {c['grid_stroke']}; border-radius: 4px;
}}
.stars-minor {{
  font-family: {f};
  font-size: {s['star_minor']}px; color: {c['star_minor']}; line-height: {minor_lh};
  letter-spacing: 0.01em; flex-shrink: 0; padding-bottom: {minor_pb}px;
  text-align: center;
}}

.palace-links-overlay {{ position: absolute; left: 0; top: 0; pointer-events: none; }}
.palace-link {{ stroke: #999999; stroke-width: 0.5pt; stroke-dasharray: 4 2; fill: none; }}
"""
