"""
疊盤各層配色設定 —— 要改配色，改這一份就好。
==================================================

每一「盤層」有兩軌顏色，分別控制該層的星曜與四化：

    star_ink  : 該層的星曜／流曜顏色
    sihua_ink : 該層的四化標記顏色

慣例：本命層星近黑、四化紅（突顯本命四化）；其餘三層星與四化同色，
以「一層一色」快速區分盤別。要調整任何一層，直接改下面對應的色碼即可；
新增或移除盤層也在這裡。

渲染時，這些色碼會透過 star_ink 分軌上色機制（見 writers/embed_assets.py 的
_recolor_svg_ink / _namespace_svg_classes）套到每一層的圖示上——同一顆星圖
以不同層色內嵌不會互相蓋色。
"""

# 疊盤層順序（由底到頂）：本命最底，流年最上。
OVERLAY_LAYER_ORDER = ["natal", "decade", "small", "year"]

# 各層配色。label 供圖例／標籤顯示；star_ink / sihua_ink 為該層兩軌顏色。
OVERLAY_LAYERS = {
    "natal":  {"label": "本命", "star_ink": "#231815", "sihua_ink": "#C62828"},  # 星近黑・四化紅
    "decade": {"label": "大限", "star_ink": "#2E7D32", "sihua_ink": "#2E7D32"},  # 綠
    "small":  {"label": "小限", "star_ink": "#1A237E", "sihua_ink": "#1A237E"},  # 深藍
    "year":   {"label": "流年", "star_ink": "#1E88E5", "sihua_ink": "#1E88E5"},  # 淺藍
}


def layer_colors(layer_key: str) -> dict:
    """取得某層的配色 dict（star_ink / sihua_ink / label）。未知層退回本命。"""
    return OVERLAY_LAYERS.get(layer_key, OVERLAY_LAYERS["natal"])
