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
}

# 星曜分類優先序
STAR_CATEGORY_ORDER = ["M1", "M2", "M3", "S1", "S2", "S3", "S4", "B2", "B1", "O1", "O2"]
