"""
v3 引擎 — 高階 API
StarFieldEngine

流程：
  encoded_array
    → ChartParser（復用 v2）
    → StarFieldComputer（88 維星場 ＋ 事實表）
    → PalaceLens × 13（12 宮讀數 ＋ 身宮錨點讀數，S力/S勢/S化 拆欄＋四化場）
    → V3Result

身宮錨點（規格書 §6）：
  - 狀態層唯一新增：body_anchor 指標（出生即定，永不隨時空層移動）
  - 讀數層：第 13 格 = 鏡頭取樣(身宮位置)，連同宿主宮位身分一起存

選用層（規格書 §3.4）：
  - layers={"minor": False, "flow": False} 預設沉睡
  - 開關不改變維度數；啟用層記入 layer_signature，跨盤比較必須同簽章
"""

from dataclasses import dataclass, field
from typing import Optional

from .config import V3Registry, VECTOR_VERSION
from .star_field import StarFieldComputer, StarFieldResult
from .lens import PalaceLens, PALACE_CODES, Reading
from .bridge.chart_parser import ChartParser
from .bridge import palace_stems


DEFAULT_LAYERS = {"minor": False, "flow": False}


def _infer_chart_kind(chart) -> str:
    """
    盤別推斷（natal/decade/year/small）——chart_scope 盤別取樣作用域用。

    首選訊號＝運限四化 T-token 的層別（流年/小限盤由 encoder 必附該層四化）；
    備援＝運限流曜的小寫星碼前綴（y*/s*/d*）。流年與小限互斥
    （流年盤帶 decade+year、小限盤帶 decade+small），故 year/small 先判。
    """
    layers = {t.layer for t in chart.transforms}
    prefixes = {p.star_code[0] for p in chart.placements
                if p.star_code and p.star_code[0] in ("d", "s", "y")}
    if "year" in layers or "y" in prefixes:
        return "year"
    if "small" in layers or "s" in prefixes:
        return "small"
    if "decade" in layers or "d" in prefixes:
        return "decade"
    return "natal"


@dataclass
class V3Result:
    """v3 分析結果"""
    vector: list                     # 96 維星場向量（本命 88 有值＋8 運限流曜維）
    star_field: StarFieldResult      # 事實表（星曜/空劫/四化）
    readings: dict                   # {宮位代碼: Reading} × 12
    body_reading: Optional[Reading]  # 第 13 格（身宮錨點）
    body_anchor: Optional[str]       # 身宮宿主宮位
    meta: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        """匯出為 JSON 友善結構"""
        return {
            "meta": self.meta,
            "vector": [round(v, 6) for v in self.vector],
            "readings": {
                pc: r.to_dict() for pc, r in self.readings.items()
            },
            "body_reading": (self.body_reading.to_dict()
                             if self.body_reading else None),
            "body_anchor": self.body_anchor,
            "facts": {
                "stars": [
                    {
                        "star": f.star, "dim": f.dim_name,
                        "kind": f.kind,
                        "palace": f.palace, "branch": f.branch,
                        "brightness": f.brightness,
                        "brightness_factor": f.brightness_factor,
                        "voided": f.voided,
                        "void_factor": round(f.void_factor, 6),
                        "sihua_exempt": f.sihua_exempt,
                        "influence_bonus": round(f.influence_bonus, 6),
                        "E": round(f.E, 6),
                        "channels": {k: round(v, 6)
                                     for k, v in f.channels.items()},
                    }
                    for f in self.star_field.star_facts
                ],
                "transforms": [
                    {
                        "star": t.star, "sihua": t.sihua,
                        "layer": t.layer, "palace": t.palace,
                        "E": round(t.E, 6),
                        "channel_value": round(t.channel_value, 6),
                    }
                    for t in self.star_field.transform_facts
                ],
                "voids": [
                    {
                        "void_star": v.void_star, "palace": v.palace,
                        "affected": [
                            {"star": h.star, "palace": h.palace,
                             "relation": h.relation,
                             "factor": round(h.factor, 6)}
                            for h in v.affected
                        ],
                        "exempted": [
                            {"star": h.star, "palace": h.palace,
                             "relation": h.relation,
                             "factor": round(h.factor, 6)}
                            for h in v.exempted
                        ],
                    }
                    for v in self.star_field.void_events
                ],
            },
        }


class StarFieldEngine:
    """
    v3 高階 API。

    用法:
        engine = StarFieldEngine()
        result = engine.analyze(encoded_array)
        result.vector                # 87 維
        result.readings["1"].S       # 命宮讀數
        result.body_reading          # 身宮錨點讀數
    """

    def __init__(self, data_dir: str = None):
        self.registry = V3Registry(data_dir)
        self._computer = StarFieldComputer(data_dir, registry=self.registry)
        self._lens = PalaceLens(data_dir)
        self._parser = ChartParser()

    @property
    def total_dims(self) -> int:
        return self.registry.total_dims

    # -----------------------------------------------------------------

    def analyze(self, encoded_array: list,
                layers: dict = None) -> V3Result:
        """
        完整 v3 分析。

        Args:
            encoded_array: 命盤編碼陣列（與 v2 相同格式）
            layers: 選用層開關，預設 {"minor": False, "flow": False}

        Returns:
            V3Result
        """
        layers = dict(DEFAULT_LAYERS, **(layers or {}))
        enabled_optional = [k for k, v in layers.items() if v]
        if enabled_optional:
            raise ValueError(
                f"選用層 {enabled_optional} 尚未實作"
                "（規格書 §3.4 待決 #7：小星修正公式）")

        # 1. 解碼命盤（復用 v2 ChartParser）
        chart = self._parser.parse(encoded_array)

        # 1b. 盤別推斷（chart_scope 盤別取樣作用域用，2026-07-19 二）：
        #     流年/小限盤必帶該層運限四化 T-token；流曜小寫前綴為備援
        chart_kind = _infer_chart_kind(chart)

        # 2. 星場：87 維 ＋ 事實表
        field_result = self._computer.compute(chart)

        # 3. 宮位地支環（由星曜落點環狀補滿）——2026-07-19 三起為讀數的
        #    地支資訊真源（跨盤型疊映比對用：地支不動、宮位標籤旋轉）
        palace_branches = palace_stems.build_palace_branch_map(
            chart.placements)

        # 4. 鏡頭取樣：12 宮讀數（transform_facts＝四化場的場源）；
        #    每格回填中心宮位地支
        readings = {}
        for pc in PALACE_CODES:
            reading = self._lens.sample(pc, field_result.star_facts,
                                        palace_branches,
                                        field_result.transform_facts,
                                        chart_kind=chart_kind)
            reading.branch = palace_branches.get(pc)
            readings[pc] = reading

        # 5. 第 13 格：身宮錨點讀數（宿主宮位讀數的解引用複本）
        body_anchor = chart.body_palace or None
        body_reading = None
        if body_anchor in readings:
            body_reading = readings[body_anchor]

        # 6. 層簽章
        signature = "base" + "".join(
            f"+{k}" for k, v in sorted(layers.items()) if v)

        return V3Result(
            vector=field_result.vector,
            star_field=field_result,
            readings=readings,
            body_reading=body_reading,
            body_anchor=body_anchor,
            meta={
                "vector_version": VECTOR_VERSION,
                "total_dims": self.registry.total_dims,
                "layer_signature": signature,
                "chart_kind": chart_kind,
                "palace_branches": palace_branches,
                "gender": chart.gender,
                "body_anchor": body_anchor,
                "transform_count": len(field_result.transform_facts),
                "void_event_count": len(field_result.void_events),
            },
        )
