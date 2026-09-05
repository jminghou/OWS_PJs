"""
星場計算器 — v3 的基石層
Star Field Computer

計算 86 維星場向量（22 天格屬性 E ＋ 64 四化通道）與星曜事實表。
（流曜與本命同源星共用維：大羊/小羊/年羊併入煞星維…、
桃花＝紅鸞天喜八星一維；運限盤同組疊加＝突波偵測的訊號源；
2026-07-18 輔星整併：四煞合一「煞星」、全輔星維改名去「勢」）

公式（規格書 §3/§4；2026-07-13 計算方式改版）：
  E_主星   = 1.0 × 亮度 × 空劫衰減 × (1 + Σ 同宮輔助星影響)
  E_輔助星 = 1.0 × 亮度 × 空劫衰減
  E_空星   = 1.0 × 亮度              （空劫三星共用維；不吃 M、不被空劫衰減）
  通道值   = E_化星 × k_通道        （四化不修改 E，E 永遠是純強度）

空劫衰減（規格書 §3.3，2026-07-13 定案）：
  作用範圍 = 三方四正（同宮/對宮/三合；coefficients.void_scope_relations）
  衰減因子 = 1 − (1 − k_空劫) × w_關係（w 取自 sampling_window.json，同一真源）
  多重命中取最強單刀（factor 最小）不疊乘；帶四化的星豁免；空星互不砍

鐵則對應：
  - 基值恆為 1.0：任何星、任何類別，一律平等
  - E 剝離視角：星站在哪個宮，不影響 E（位置只存在事實表，供鏡頭取樣）
  - 空劫 = 純衰減；不反轉、不變負
"""

from dataclasses import dataclass, field
from typing import Optional

from .config import (
    V3Registry, SIHUA_CODES, PALACE_CODES,
    load_coefficients, load_influence_matrix, load_sampling_window,
)


# =====================================================================
# 事實結構
# =====================================================================

@dataclass
class StarFact:
    """單顆星曜的完整事實（E 與其推導過程可回溯）"""
    star: str                    # 星曜代碼
    dim_index: int               # 所屬 E 維
    dim_name: str
    kind: str                    # major / pair / solo / void（維度類別，讀數拆欄依據）
    palace: str                  # 落宮
    branch: Optional[str]        # 地支（可能無）
    brightness: Optional[str]    # 亮度碼（盤面明載才有，否則 None）
    brightness_factor: float     # 亮度倍率（無資料 = 1.0）
    voided: bool                 # 是否被空劫砍
    void_factor: float           # 空劫衰減因子（未被砍 = 1.0；最強單刀）
    sihua_exempt: bool           # 是否因帶四化而豁免空劫（實際在空劫射程內才標）
    influence_bonus: float       # (1 + Σ M×E_aux) 中的 Σ 部分（主星才有）
    E: float                     # 最終純強度
    channels: dict = field(default_factory=dict)   # {sihua碼: 通道值}


@dataclass
class VoidHit:
    """空劫的單筆命中（含關係與衰減因子，可回溯）"""
    star: str                    # 被命中的星
    palace: str                  # 被命中星所在宮
    relation: str                # main / opposite / trine（以空劫星所在宮起算）
    factor: float                # 1 − (1 − k_空劫) × w_關係


@dataclass
class VoidEvent:
    """空劫事件（一顆空劫星的全部射程）"""
    void_star: str               # EVO / MAE / INT
    palace: str                  # 空劫星所在宮
    affected: list = field(default_factory=list)   # [VoidHit] 被砍的星
    exempted: list = field(default_factory=list)   # [VoidHit] 四化豁免的星（factor=豁免前試算值）


@dataclass
class TransformFact:
    """四化事實（含層別，未來大限/流年/飛化疊加用）"""
    star: str
    sihua: str                   # FO / PW / HO / BI
    layer: str                   # natal（骨架僅本命層）
    palace: Optional[str]
    E: float                     # 承載星的純強度
    channel_value: float         # E × k
    dim_index: Optional[int]     # 寫入的通道維（不可化星曜 = None）


@dataclass
class StarFieldResult:
    """星場計算結果"""
    vector: list                 # 87 維
    star_facts: list             # [StarFact]
    void_events: list            # [VoidEvent]
    transform_facts: list        # [TransformFact]


# =====================================================================
# 星場計算器
# =====================================================================

class StarFieldComputer:
    """
    用法:
        computer = StarFieldComputer()
        result = computer.compute(chart)     # chart: ChartState
        result.vector                        # 87 維
        result.star_facts                    # 逐星事實（供鏡頭取樣）
    """

    def __init__(self, data_dir: str = None, registry: V3Registry = None):
        self.registry = registry or V3Registry(data_dir)
        self.coefficients = load_coefficients(data_dir)
        self.influence_matrix = load_influence_matrix(data_dir)
        self._void_stars = set(self.coefficients.get("void_stars", []))
        self._void_k = float(self.coefficients.get("void_k", 0.45))
        self._sihua_k = self.coefficients.get("sihua_k", {})
        # 亮度表（v3 自帶，唯一真源 coefficients.json；未載亮度 ×1.0）
        self._brightness = self.coefficients.get("brightness_factors", {})
        # 主星集合（影響矩陣的受方）
        self._major_stars = {
            s for d in self.registry.e_dims if d.kind == "major"
            for s in d.stars
        }
        # 空劫射程：關係清單（coefficients）＋ 偏移/權重（sampling_window，同一真源）
        window = load_sampling_window(data_dir)
        scope = self.coefficients.get("void_scope_relations", ["main"])
        self._void_reach = []   # [(關係名, 偏移, 衰減因子)]
        for rel in scope:
            w = float(window["weights"].get(rel, 0.0))
            factor = 1.0 - (1.0 - self._void_k) * w
            if factor >= 1.0:
                continue   # w=0 的關係無殺傷力
            for off in window.get("offsets", {}).get(rel, []):
                self._void_reach.append((rel, off, factor))

    # -----------------------------------------------------------------

    def compute(self, chart) -> StarFieldResult:
        """
        計算星場：兩趟掃描。
          Pass 1: 全部星曜的原始 E（base × 亮度 × 空劫縮放衰減）
          Pass 2: 主星套用同宮輔助星影響矩陣
        """
        exempt_stars = {t.star_code for t in chart.transforms}
        void_events = self._collect_void_events(chart, exempt_stars)
        # 多重命中取最強單刀：每顆星只留 factor 最小的一刀（不疊乘）
        void_factors = {}
        for ev in void_events:
            for hit in ev.affected:
                cur = void_factors.get(hit.star, 1.0)
                void_factors[hit.star] = min(cur, hit.factor)
        # 四化豁免：實際在空劫射程內、因帶四化而免砍的星
        exempted_in_reach = {hit.star for ev in void_events
                             for hit in ev.exempted}

        # ---- Pass 1: 原始 E ----
        raw_e = {}       # star -> E（未含影響矩陣）
        meta = {}        # star -> (palace, branch, brightness, factor)
        for p in chart.placements:
            star = p.star_code
            if star not in self.registry.star_to_dim:
                continue   # 小星、流曜：不佔維度（選用層）

            bcode = chart.brightness.get(star)   # 盤面明載才算，預設 ×1.0
            bfactor = float(self._brightness.get(bcode, 1.0))

            e = 1.0 * bfactor
            if star not in self._void_stars:     # 空星自身不受空劫衰減
                e *= void_factors.get(star, 1.0)

            raw_e[star] = e
            meta[star] = (p.palace_code, p.branch_code or None, bcode, bfactor)

        # ---- Pass 2: 主星的影響矩陣加成 ----
        facts = []
        for star, e in raw_e.items():
            palace, branch, bcode, bfactor = meta[star]
            dim_index = self.registry.star_to_dim[star]
            dim = self.registry.dims[dim_index]
            bonus = 0.0
            if star in self._major_stars:
                for co_star in chart.get_stars_in_palace(palace):
                    if co_star == star:
                        continue
                    row = self.influence_matrix.get(co_star)
                    if row is None:
                        continue
                    coeff = row.get(star, 0.0)
                    if coeff and co_star in raw_e:
                        # 影響強度 = 輔助星自身的 E（Pass 1 值，含亮度/空劫）
                        bonus += coeff * raw_e[co_star]
                e = e * (1.0 + bonus)

            facts.append(StarFact(
                star=star,
                dim_index=dim_index,
                dim_name=dim.name,
                kind=dim.kind,
                palace=palace,
                branch=branch,
                brightness=bcode,
                brightness_factor=bfactor,
                voided=star in void_factors,
                void_factor=void_factors.get(star, 1.0),
                sihua_exempt=star in exempted_in_reach,
                influence_bonus=bonus,
                E=e,
            ))

        fact_by_star = {f.star: f for f in facts}

        # ---- 四化通道 ----
        transform_facts = []
        for t in chart.transforms:
            f = fact_by_star.get(t.star_code)
            layer = getattr(t, "layer", "natal")
            if f is None:
                # 化星不在 23 維星場內（理論上不會發生，防禦性記錄）
                transform_facts.append(TransformFact(
                    star=t.star_code, sihua=t.sihua_code, layer=layer,
                    palace=t.palace_code or None,
                    E=0.0, channel_value=0.0, dim_index=None))
                continue

            ch_dim = self.registry.channel_index.get(
                (f.dim_index, t.sihua_code))
            k = float(self._sihua_k.get(t.sihua_code, 1.0))
            value = f.E * k if ch_dim is not None else 0.0

            if ch_dim is not None:
                # 通道疊加制：同通道多筆四化相加（雙忌 = 翻倍）
                f.channels[t.sihua_code] = (
                    f.channels.get(t.sihua_code, 0.0) + value)

            transform_facts.append(TransformFact(
                star=t.star_code, sihua=t.sihua_code, layer=layer,
                palace=f.palace, E=f.E,
                channel_value=value, dim_index=ch_dim))

        # ---- 組裝 87 維向量 ----
        vector = [0.0] * self.registry.total_dims
        for f in facts:
            vector[f.dim_index] += f.E          # 對星共用維 = 個別 E 相加
            for sihua, value in f.channels.items():
                ch_dim = self.registry.channel_index.get(
                    (f.dim_index, sihua))
                if ch_dim is not None:
                    vector[ch_dim] += value

        return StarFieldResult(
            vector=vector,
            star_facts=facts,
            void_events=void_events,
            transform_facts=transform_facts,
        )

    # -----------------------------------------------------------------

    def _collect_void_events(self, chart, exempt_stars) -> list:
        """
        空劫事件：空劫星砍射程內（三方四正）的星曜，衰減隨關係權重縮放。
        每顆空劫星一個事件，affected/exempted 逐筆帶關係與衰減因子（四化豁免）。
        """
        events = []
        for p in chart.placements:
            if p.star_code not in self._void_stars:
                continue
            try:
                base_idx = PALACE_CODES.index(p.palace_code)
            except ValueError:
                continue

            affected, exempted = [], []
            for rel, off, factor in self._void_reach:
                target_palace = PALACE_CODES[(base_idx + off) % 12]
                for s in chart.get_stars_in_palace(target_palace):
                    if s in self._void_stars:
                        continue   # 空星互不砍
                    if s not in self.registry.star_to_dim:
                        continue
                    hit = VoidHit(star=s, palace=target_palace,
                                  relation=rel, factor=factor)
                    if s in exempt_stars:
                        exempted.append(hit)
                    else:
                        affected.append(hit)

            events.append(VoidEvent(
                void_star=p.star_code, palace=p.palace_code,
                affected=affected, exempted=exempted))
        return events
