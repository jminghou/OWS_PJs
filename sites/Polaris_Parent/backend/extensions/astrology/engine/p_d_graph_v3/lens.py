"""
取樣鏡頭 — 宮位是流動的取樣，不是狀態
PalaceLens

sample(中心) = Σ_全部星曜  E_星 × w(星所在宮 → 中心的關係)

w 取樣窗權重表（唯一真源 sampling_window.json，使用者定案 2026-07-18 四修）：
  主宮 1.0 / 對宮 0.8 / 三方 0.5 / 其他 0
  （疾位/命疾同論已於 2026-07-13 移除；夾宮/暗合已於 2026-07-18 移除）

規則：
  - 關係不疊加：一顆星只取優先序最高的單一關係
    （主 > 對 > 三方 > 其他）
  - 讀數拆欄（2026-07-13 定案；2026-07-18 統稱改「輔星」）：S力=主星小計 /
    S輔=輔星（左右/魁鉞/昌曲/祿存/天馬/煞星/空劫/桃花）小計；S 總 = S力 + S輔 + S化
  - 類別權重（2026-07-14 定案）：S 貢獻 = E × w × 類權
    （coefficients.kind_s_weights，現值 力 1.0/輔星 0）；
    通道**不乘類權**——強度打折，性質不打折
  - 四化場（2026-07-14 二定案）：每筆四化＝場源，
    場強 = E_化星 × g_化 × w場（coefficients.sihua_field：g 與通道 k 分家、
    獨立五級空間表），落 S化 欄——四化的空間存在感；場只讀 E 不寫回
  - 四化通道以取樣窗 w 取樣，分欄記錄（不混入 S）
  - 四化層別作用域（2026-07-19，coefficients.sihua_layer_scope）：
    {層: [允許關係]}——流年/小限四化（通道與場一體適用）僅作用其所在宮位（main），
    對宮/三方不受其影響；未列出的層（生年/大限）不限縮。
    通道因此逐筆走 transform_facts 取樣（未傳 transform_facts 時退回
    星事實跨層加總，無法分層＝向後相容路徑）
  - 盤別取樣作用域（2026-07-19 二，sampling_window.chart_scope）：
    {盤別: [允許關係]}——流年/小限盤**全星曜與四化**僅取樣 主宮/對宮，
    三方退出；本命/大限盤走全窗。盤別由呼叫端傳入 chart_kind
    （engine 自運限四化層別推斷；預設 natal＝不限縮）
  - 欠 = S化 的「對宮 × 忌」分量（衍生註解；忌欠k/chong_k 已退役）
  - 湧現行為：空宮 → 讀數自然由對宮＋三方組成（借宮）
"""

from dataclasses import dataclass, field
from typing import Optional

from .config import (
    SIHUA_CODES, PALACE_CODES,
    load_sampling_window, load_coefficients,
)


@dataclass
class Contributor:
    """讀數的單筆貢獻（可回溯）"""
    star: str
    dim_name: str
    kind: str                # major / pair / solo / void（拆欄歸屬）
    palace: str
    relation: str            # main / opposite / trine
    weight: float            # w（取樣窗權重）
    kind_weight: float       # 類權（kind_s_weights；只作用於入總量，不作用於通道）
    E: float                 # 星曜純強度
    contribution: float      # 入總量 = E × w × 類權（勢類權 0 ⇒ 0）
    flow: float = 0.0        # 原始流量 = E × w（未乘類權；顯示層用，勢突波觀測）
    channels: dict = field(default_factory=dict)   # {sihua: 通道值×w，不乘類權}


@dataclass
class FieldSource:
    """四化場的單筆場源（可回溯）"""
    star: str                # 化星
    sihua: str               # FO / PW / HO / BI
    palace: str              # 化星所在宮
    relation: str            # 場源宮 → 中心 的關係
    weight: float            # w場（sihua_field.weights）
    gain: float              # g_化（sihua_field.gains）
    E: float                 # 化星純強度
    strength: float          # 場強 = E × g × w場
    layer: str = "natal"     # natal（生年四化）/ decade / year / small（運限四化）


@dataclass
class Reading:
    """一次取樣的完整讀數"""
    center: str                                    # 中心宮位代碼
    branch: Optional[str] = None                   # 中心宮位地支代碼（01=子…12=亥；engine 回填）
    S: float = 0.0                                 # 總強度 = S力 + S輔(入總) + S化
    S_major: float = 0.0                           # S力：主星貢獻小計
    S_aux: float = 0.0                             # S輔入總量小計（輔星類權 0 ⇒ 0，守恆用）
    S_aux_flow: float = 0.0                        # S輔原始流量小計（Σ E×w 未乘類權；觀測欄，不入 S總）
    S_sihua: float = 0.0                           # S化：四化場加成小計
    channels: dict = field(default_factory=dict)   # {FO/PW/HO/BI: 量}
    chong: float = 0.0                             # 忌欠＝S化的對宮忌分量（衍生註解）
    contributors: list = field(default_factory=list)
    field_sources: list = field(default_factory=list)   # [FieldSource]

    def to_dict(self) -> dict:
        return {
            "center": self.center,
            "branch": self.branch,
            "S": round(self.S, 6),
            "S_major": round(self.S_major, 6),
            "S_aux": round(self.S_aux, 6),
            "S_aux_flow": round(self.S_aux_flow, 6),
            "S_sihua": round(self.S_sihua, 6),
            "channels": {k: round(v, 6) for k, v in self.channels.items()},
            "chong": round(self.chong, 6),
            "contributors": [
                {
                    "star": c.star, "dim": c.dim_name, "kind": c.kind,
                    "palace": c.palace, "relation": c.relation,
                    "weight": c.weight, "kind_weight": c.kind_weight,
                    "E": round(c.E, 6),
                    "contribution": round(c.contribution, 6),
                    "flow": round(c.flow, 6),
                    "channels": {k: round(v, 6)
                                 for k, v in c.channels.items()},
                }
                for c in self.contributors
            ],
            "field_sources": [
                {
                    "star": s.star, "sihua": s.sihua, "palace": s.palace,
                    "relation": s.relation, "weight": s.weight,
                    "gain": s.gain, "E": round(s.E, 6),
                    "strength": round(s.strength, 6), "layer": s.layer,
                }
                for s in self.field_sources
            ],
        }


class PalaceLens:
    """
    用法:
        lens = PalaceLens()
        reading = lens.sample("1", star_facts, palace_branches)
        reading.S / reading.channels / reading.chong / reading.contributors
    """

    def __init__(self, data_dir: str = None):
        window = load_sampling_window(data_dir)
        self.weights = window["weights"]
        self.priority = window["priority"]
        # 盤別取樣作用域（2026-07-19 二）：{盤別: {允許關係}}；未列出的盤別不限縮
        self._chart_scope = {
            kind: set(rels)
            for kind, rels in window.get("chart_scope", {}).items()
        }
        # offset → 關係名（依 priority 順序建表，先到先贏）
        self._offset_relation = {}
        for rel in self.priority:
            for off in window.get("offsets", {}).get(rel, []):
                self._offset_relation.setdefault(off, rel)
        coefficients = load_coefficients(data_dir)
        # 類別權重（2026-07-14）：只作用於 S 貢獻，不作用於通道；缺項視為 1.0
        self._kind_weights = coefficients.get("kind_s_weights", {})
        # 四化場（2026-07-14 二）：g 增益＋獨立空間表；缺項視為 0（無場）
        sihua_field = coefficients.get("sihua_field", {})
        self._field_gains = sihua_field.get("gains", {})
        self._field_weights = sihua_field.get("weights", {})
        # 四化層別作用域（2026-07-19）：{層: {允許關係}}；未列出的層不限縮
        self._sihua_layer_scope = {
            layer: set(rels)
            for layer, rels in coefficients.get(
                "sihua_layer_scope", {}).items()
        }

    # -----------------------------------------------------------------

    def resolve_relation(self, star_palace: str, center: str,
                         palace_branches: dict = None) -> str:
        """
        判定星所在宮與中心的關係（不疊加，取優先序最高的單一關係）。

        位置關係（主/對/三方）由宮序偏移決定，彼此互斥；
        夾宮/暗合已於 2026-07-18 移除，palace_branches 參數保留
        僅為呼叫端簽章相容，不再參與判定。
        """
        try:
            offset = (PALACE_CODES.index(star_palace)
                      - PALACE_CODES.index(center)) % 12
        except ValueError:
            return "other"

        return self._offset_relation.get(offset, "other")

    # -----------------------------------------------------------------

    def sample(self, center: str, star_facts: list,
               palace_branches: dict = None,
               transform_facts: list = None,
               chart_kind: str = "natal") -> Reading:
        """
        對指定中心取樣一次。

        Args:
            center: 中心宮位代碼（"1"~"C"）
            star_facts: StarFieldComputer 輸出的 star_facts
            palace_branches: {宮位: 地支}（夾宮/暗合移除後不再使用，保留簽章相容）
            transform_facts: StarFieldComputer 輸出的 transform_facts
                             （四化場的場源；缺省則無場，S化=0、欠=0）
            chart_kind: 盤別（natal/decade/year/small）——
                        chart_scope 有列的盤別，全星曜與四化僅取樣允許關係

        Returns:
            Reading
        """
        reading = Reading(center=center,
                          channels={c: 0.0 for c in SIHUA_CODES})
        # 盤別作用域：None＝不限縮（本命/大限）
        chart_allowed = self._chart_scope.get(chart_kind)

        # 通道逐筆取樣的來源（層別作用域用）：star → [TransformFact]
        # 未傳 transform_facts（None）→ 退回星事實跨層加總（無法分層，向後相容）
        transforms_by_star = None
        if transform_facts is not None:
            transforms_by_star = {}
            for t in transform_facts:
                transforms_by_star.setdefault(t.star, []).append(t)

        for f in star_facts:
            rel = self.resolve_relation(f.palace, center, palace_branches)
            if chart_allowed is not None and rel not in chart_allowed:
                continue   # 盤別作用域：流年/小限盤三方不取樣（全星曜適用）
            w = float(self.weights.get(rel, 0.0))

            if w <= 0.0:
                continue

            kind = getattr(f, "kind", None) or "solo"
            kw = float(self._kind_weights.get(kind, 1.0))
            flow = f.E * w                 # 原始流量（未乘類權；顯示層/突波觀測）
            contribution = flow * kw       # 入總量（勢類權 0 ⇒ 不入 S總）
            reading.S += contribution
            if kind == "major":
                reading.S_major += contribution
            else:
                # 輔星系列（pair/solo/void 全類），一起記 S輔
                reading.S_aux += contribution
                reading.S_aux_flow += flow

            # 通道只乘 w、不乘類權——強度打折，性質不打折
            # 有 transform_facts 時逐筆取樣以套用層別作用域（流年/小限限本宮）
            ch_weighted = {}
            if transforms_by_star is None:
                for sihua, value in f.channels.items():
                    weighted = value * w
                    reading.channels[sihua] = (
                        reading.channels.get(sihua, 0.0) + weighted)
                    ch_weighted[sihua] = weighted
            else:
                for t in transforms_by_star.get(f.star, ()):
                    if not t.channel_value:
                        continue
                    scope = self._sihua_layer_scope.get(
                        getattr(t, "layer", "natal"))
                    if scope is not None and rel not in scope:
                        continue
                    weighted = t.channel_value * w
                    reading.channels[t.sihua] = (
                        reading.channels.get(t.sihua, 0.0) + weighted)
                    ch_weighted[t.sihua] = (
                        ch_weighted.get(t.sihua, 0.0) + weighted)

            reading.contributors.append(Contributor(
                star=f.star, dim_name=f.dim_name, kind=kind,
                palace=f.palace, relation=rel, weight=w, kind_weight=kw,
                E=f.E, contribution=contribution, flow=flow,
                channels=ch_weighted))

        # ---- 四化場（2026-07-14 二）----
        # 每筆四化＝場源：場強 = E_化星 × g_化 × w場（獨立空間表，關係幾何共用取樣窗）
        for t in (transform_facts or []):
            if not t.palace:
                continue
            rel = self.resolve_relation(t.palace, center, palace_branches)
            # 盤別作用域（全四化適用）＋層別作用域（流年/小限四化僅本宮）
            if chart_allowed is not None and rel not in chart_allowed:
                continue
            scope = self._sihua_layer_scope.get(getattr(t, "layer", "natal"))
            if scope is not None and rel not in scope:
                continue
            wf = float(self._field_weights.get(rel, 0.0))
            if wf <= 0.0:
                continue
            g = float(self._field_gains.get(t.sihua, 0.0))
            strength = t.E * g * wf
            if not strength:
                continue
            reading.S_sihua += strength
            reading.S += strength
            # 欠＝S化的「對宮 × 忌」分量（衍生註解，無獨立參數）
            if rel == "opposite" and t.sihua == "BI":
                reading.chong += strength
            reading.field_sources.append(FieldSource(
                star=t.star, sihua=t.sihua, palace=t.palace,
                relation=rel, weight=wf, gain=g, E=t.E,
                strength=strength, layer=getattr(t, "layer", "natal")))

        # 流量大者在前（主星類權 1.0 ⇒ 與入總量同序；勢列以原始流量排序）
        reading.contributors.sort(key=lambda c: c.flow, reverse=True)
        reading.field_sources.sort(key=lambda s: s.strength, reverse=True)
        return reading
