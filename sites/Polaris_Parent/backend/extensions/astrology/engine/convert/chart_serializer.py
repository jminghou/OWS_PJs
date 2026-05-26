"""
命盤序列化器
Chart Serializer — ChartState → dict（保留所有標準編碼）

將 ChartState 轉為以 palace_code / star_code / sihua_code 為鍵值的結構，
確保下游圖表程式可透過 CodeRegistry 做跨語言查詢。
"""

from .chart_parser import ChartState


def serialize_chart(chart: ChartState) -> dict:
    """
    將 ChartState 序列化為 JSON 友善的 dict。

    結構:
        {
            "gender": "female",
            "gender_code": "GF",
            "body_palace": "5",
            "life_master": "POL",
            "body_master": "AAC",
            "placements": {
                "1": {
                    "stars": {
                        "POL": {"branch": "03", "brightness": "P3", "sihua": "PW"},
                        "TRE": {"branch": "03", "brightness": "P3", "sihua": null}
                    }
                },
                ...
            },
            "sihua_summary": {
                "FO": {"star": "MAR", "palace": "5"},
                ...
            }
        }
    """
    # --- 基本資訊 ---
    gender_code = "GM" if chart.gender == "male" else "GF"

    # --- 建立 transform 快查表: (star_code, palace_code) → sihua_code ---
    transform_map: dict[tuple[str, str], str] = {}
    for t in chart.transforms:
        transform_map[(t.star_code, t.palace_code)] = t.sihua_code

    # --- placements: palace_code → {stars: {star_code: {...}}} ---
    palaces: dict[str, dict] = {}
    for p in chart.placements:
        pc = p.palace_code
        if pc not in palaces:
            palaces[pc] = {"stars": {}}

        sihua = transform_map.get((p.star_code, pc))
        brightness = chart.brightness.get(p.star_code)

        palaces[pc]["stars"][p.star_code] = {
            "branch": p.branch_code or None,
            "brightness": brightness or None,
            "sihua": sihua,
        }

    # --- sihua_summary: sihua_code → {star, palace} ---
    sihua_summary: dict[str, dict] = {}
    for t in chart.transforms:
        sihua_summary[t.sihua_code] = {
            "star": t.star_code,
            "palace": t.palace_code,
        }

    return {
        "gender": chart.gender,
        "gender_code": gender_code,
        "body_palace": chart.body_palace,
        "life_master": chart.life_master,
        "body_master": chart.body_master,
        "placements": palaces,
        "sihua_summary": sihua_summary,
    }
