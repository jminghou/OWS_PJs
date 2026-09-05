"""
命盤圖結構常數
"""

# 十四顆主星（與 p_a_foundation/data/star_properties.csv 前 14 筆一致）— 圖示邊長為其他有圖檔星曜的 2 倍
FOURTEEN_MAIN_STAR_CODES = frozenset({
    "POL", "HPI", "SUN", "MAR", "HAR", "MAG", "TRE", "MOO",
    "AWO", "GGA", "MIN", "BLE", "VAN", "BRE",
})

# 以 SVG 圖示呈現的星曜編碼（須與 assets/stars/{code}.svg 檔名一致）
MAJOR_STAR_CODES = {
    # 十四主星
    "POL", "HPI", "SUN", "MAR", "HAR", "MIN", "BLE",
    "MAG", "AWO", "GGA", "TRE", "MOO", "VAN", "BRE",
    # 六吉、祿馬、四煞、空劫、截空（見 assets/stars/）
    "LHA", "RHA", "AAC", "AAR", "CPA", "CAI", "DIV", "HHO",
    "GLA", "STO", "FSP", "CHI", "EVO", "MAE", "INT",
    # 桃花星（已備圖檔）
    "RPH", "HJO",
}

# 小星曜：以副星尺寸 × small_star_scale 呈現（運限流曜亦同縮放）
SMALL_STAR_CODES = frozenset({"RPH", "HJO"})

# 副星／流曜顯示排序（2026-07-17 定案）：空劫 → 煞星 → 輔星（六吉＋祿馬）→ 雜曜。
# 同碼者（本命星＋其大/小/流 流曜）以穩定排序自然相鄰成組：本命在前、層序在後。
# 未列出的碼一律排最後（保持出現序）。
SUB_STAR_DISPLAY_ORDER = [
    "EVO", "MAE",                              # 空劫：地空 地劫
    "GLA", "STO", "FSP", "CHI",                # 四煞：擎羊 陀羅 火星 鈴星
    "LHA", "RHA", "AAC", "AAR", "CPA", "CAI",  # 六吉：左輔 右弼 文昌 文曲 天魁 天鉞
    "DIV", "HHO",                              # 祿存 天馬
    "INT", "RPH", "HJO",                       # 雜曜：截空 紅鸞 天喜
]
SUB_STAR_SORT_RANK = {c: i for i, c in enumerate(SUB_STAR_DISPLAY_ORDER)}

# 星曜分類優先序
STAR_CATEGORY_ORDER = ["M1", "M2", "M3", "S1", "S2", "S3", "S4", "B2", "B1", "O1", "O2"]
