"""
命盤序列化器
Chart Serializer — ChartState → dict（保留所有標準編碼）

將 ChartState 轉為以 palace_code / star_code / sihua_code 為鍵值的結構，
確保下游圖表程式可透過 CodeRegistry 做跨語言查詢。
"""

from .chart_parser import ChartState
from .palace_stems import build_palace_branch_map, compute_palace_stems


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
            "year_gz": {"stem": "04", "branch": "04"},
            "placements": {
                "1": {
                    "stars": {
                        "POL": {"branch": "03", "brightness": "P3", "sihua": "PW"},
                        "TRE": {"branch": "03", "brightness": "P3", "sihua": null}
                    }
                },
                ...
            },
            "palaces": {
                "1": {"branch": "04", "stem": "10"},
                ...
            },
            "sihua_summary": {
                "FO": {"star": "MAR", "palace": "5"},
                ...
            }
        }

    宮位層說明（v2.3 起）:
        - palaces: 12 宮完整佈局。branch 由星曜 placements 錨定後
          依環狀規則補滿；stem 由年干＋五虎遁計算（唯一實作
          p01_count palace/gz.py），年干不可得時為 None。
        - year_gz: 年干支代碼。stem 來自 Y token 或化祿反推；
          branch 僅 Y token 提供（舊編碼反推不到年支時為 None）。
        - 以上皆為新增鍵，placements / sihua_summary 結構不變。
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

    # --- 宮位層: 12 宮地支佈局 + 天干（五虎遁）---
    palace_branch_map = build_palace_branch_map(chart.placements)
    palace_stem_map = (
        compute_palace_stems(chart.year_stem, palace_branch_map)
        if palace_branch_map else {}
    )
    palaces_block = {
        palace_code: {
            "branch": branch_code,
            "stem": palace_stem_map.get(palace_code),
        }
        for palace_code, branch_code in palace_branch_map.items()
    }

    return {
        "gender": chart.gender,
        "gender_code": gender_code,
        "body_palace": chart.body_palace,
        "life_master": chart.life_master,
        "body_master": chart.body_master,
        "year_gz": {
            "stem": chart.year_stem or None,
            "branch": chart.year_branch or None,
        },
        "placements": palaces,
        "palaces": palaces_block,
        "sihua_summary": sihua_summary,
    }
