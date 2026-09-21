"""
四化雙量資料模型（A4 桑基對照）
================================

四化有**兩組係數不同的量**，而且排序會相反（交接文件 §2 事實③）：

    通道值 ＝ E × k × w      k：忌 1.6、權 1.4、祿 1.2、科 1.0
    場強　 ＝ E × g × w      g：權/科 1.2、祿 1.0、**忌 0.5**

通道值是**性質標記**（進 86 維向量的 channel 維）；場強是**實際加進 S總 的量**。
同一顆化忌用通道看可能是全盤最強之一，用場強看卻是四化裡最弱的。
**兩張圖都對，但講的是不同的事，不可混用。**

所以本模組刻意把兩者做成**一組資料的兩面**（`channel` / `field` 兩個 panel），
而不是兩份各自獨立的資料——要拿其中一面畫圖，就得先知道另一面存在。

守恆檢核（違規丟 `ConservationError`，不出圖）：

    1. 通道：Σ 各源合計 ＝ Σ 各宮 channels
    2. 場強：Σ 各源合計 ＝ Σ 各宮 S化
    3. 每個源：合計 ＝ Σ 其去向
    4. 兩面的 (星, 化) 集合必須相同——不同就不是同一組東西的兩面，
       並列對照會變成拿蘋果比橘子
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

from .config import CONSERVATION_TOL, FLOW_EPS
from .data import ConservationError

# 四化顯示序（源在圖上依各自的量排序，但同量時用這個序穩定下來）
HUA_ORDER = ("祿", "權", "科", "忌")

PANEL_CHANNEL = "channel"
PANEL_FIELD = "field"


@dataclass
class SihuaSource:
    """一個四化來源：某顆星帶的某一化。"""
    star: str
    hua: str                        # 祿／權／科／忌
    layer: str = ""                 # 生年／大限／流年／小限（單一層時才填）
    total: float = 0.0
    targets: Dict[str, float] = field(default_factory=dict)   # 宮名 → 量

    @property
    def key(self) -> Tuple[str, str]:
        return (self.star, self.hua)

    @property
    def label(self) -> str:
        """圖上的源標籤。生年不標層（本命盤全是生年，標了只是雜訊）。"""
        prefix = f"{self.layer}" if self.layer and self.layer != "生年" else ""
        return f"{prefix}{self.star} 化{self.hua}"


@dataclass
class SihuaPanel:
    """一面：通道值或場強。"""
    key: str
    label: str                      # 通道值／場強
    formula: str                    # E×k×w／E×g×w
    coefficients: str               # 顯示用的係數表
    meaning: str                    # 這個量在講什麼
    sources: List[SihuaSource] = field(default_factory=list)   # 已依 total 由大到小

    @property
    def grand(self) -> float:
        return sum(s.total for s in self.sources)

    def source(self, key: Tuple[str, str]) -> Optional[SihuaSource]:
        for s in self.sources:
            if s.key == key:
                return s
        return None

    def pct(self, src) -> float:
        """該來源在**本面**的佔比。

        ⚠️ 一律以 key 在本面重新查一次，不直接用傳進來的 ``total``——
        兩面的來源物件長得一樣，拿另一面的來源算本面的佔比會得到一個
        看起來很合理的錯數字（分子來自 A 面、分母來自 B 面）。
        這種錯不會報錯，只會讓圖說謊。
        """
        key = src.key if isinstance(src, SihuaSource) else tuple(src)
        s = self.source(key)
        if s is None:
            raise ValueError(
                f"{self.label} 沒有來源 {key[0]}化{key[1]}，算不出佔比")
        g = self.grand
        return (s.total / g * 100) if g else 0.0

    def rank(self, key: Tuple[str, str]) -> Optional[int]:
        for i, s in enumerate(self.sources, 1):
            if s.key == key:
                return i
        return None

    def targets_in(self, order: List[str]) -> List[str]:
        """本面用到的宮位，依給定的宮序（兩面同序才比得出流向差異）。"""
        used = {p for s in self.sources for p, v in s.targets.items()
                if v > FLOW_EPS}
        return [p for p in order if p in used]

    def target_total(self, palace: str) -> float:
        return sum(s.targets.get(palace, 0.0) for s in self.sources)


@dataclass
class SihuaData:
    """一次 analyze() 的四化雙量。"""

    channel: SihuaPanel = None
    field_: SihuaPanel = None
    palace_order: List[str] = field(default_factory=list)
    title: str = ""
    subtitle: str = ""
    chart_kind: str = "natal"

    @property
    def panels(self) -> List[SihuaPanel]:
        return [self.channel, self.field_]

    def panel(self, key: str) -> SihuaPanel:
        for p in self.panels:
            if p.key == key:
                return p
        raise ValueError(
            f"未知的面「{key}」（可用：{PANEL_CHANNEL}／{PANEL_FIELD}）")

    def rank_shift(self, key: Tuple[str, str]) -> Optional[int]:
        """通道排名 → 場強排名的名次變化（正數＝場強看比較前面）。"""
        a, b = self.channel.rank(key), self.field_.rank(key)
        return None if a is None or b is None else a - b

    @property
    def has_reversal(self) -> bool:
        """兩面的排序是否真的不同——這正是這張對照圖存在的理由。"""
        return ([s.key for s in self.channel.sources]
                != [s.key for s in self.field_.sources])

    # ── 建構 ─────────────────────────────────────────

    @classmethod
    def from_dict(cls, payload: dict) -> "SihuaData":
        meta = payload.get("meta") or {}
        raw = payload.get("palaces") or []
        if not raw:
            raise ValueError("payload.palaces 為空")

        order = [str(p.get("name") or "") for p in raw]
        chan: Dict[Tuple[str, str], SihuaSource] = {}
        fld: Dict[Tuple[str, str], SihuaSource] = {}
        layers: Dict[Tuple[str, str], set] = {}

        for p in raw:
            palace = str(p.get("name") or "")

            # 通道：逐個 contributor 的 channels（E×k×w，走取樣窗）
            for c in p.get("contributors") or []:
                for hua, v in (c.get("channels") or {}).items():
                    v = float(v or 0.0)
                    if v <= FLOW_EPS:
                        continue
                    key = (str(c.get("star") or ""), str(hua))
                    s = chan.setdefault(
                        key, SihuaSource(star=key[0], hua=key[1]))
                    s.total += v
                    s.targets[palace] = s.targets.get(palace, 0.0) + v

            # 場強：field_sources（E×g×w，實際進 S總）
            for f in p.get("field_sources") or []:
                v = float(f.get("strength") or 0.0)
                if v <= FLOW_EPS:
                    continue
                key = (str(f.get("star") or ""), str(f.get("hua") or ""))
                s = fld.setdefault(key, SihuaSource(star=key[0], hua=key[1]))
                s.total += v
                s.targets[palace] = s.targets.get(palace, 0.0) + v
                lay = str(f.get("layer") or "")
                if lay:
                    layers.setdefault(key, set()).add(lay)

        # 層別只在單一層時才標——混層時標任何一個都是謊
        for store in (chan, fld):
            for key, s in store.items():
                ls = layers.get(key) or set()
                s.layer = next(iter(ls)) if len(ls) == 1 else ""

        def _sorted(store):
            return sorted(
                store.values(),
                key=lambda s: (-s.total,
                               HUA_ORDER.index(s.hua)
                               if s.hua in HUA_ORDER else 9,
                               s.star))

        data = cls(
            channel=SihuaPanel(
                key=PANEL_CHANNEL, label="通道值", formula="E × k × w",
                coefficients="k：忌 1.6・權 1.4・祿 1.2・科 1.0",
                meaning="性質標記（進 86 維向量的 channel 維）",
                sources=_sorted(chan)),
            field_=SihuaPanel(
                key=PANEL_FIELD, label="場強", formula="E × g × w",
                coefficients="g：權 1.2・科 1.2・祿 1.0・忌 0.5",
                meaning="實際加進 S總 的量",
                sources=_sorted(fld)),
            palace_order=order,
            title=str(meta.get("title") or "").strip(),
            subtitle=str(meta.get("subtitle") or "").strip(),
            chart_kind=str(meta.get("chart_kind") or "natal"),
        )
        data.verify_conservation(payload)
        return data

    # ── 守恆檢核 ─────────────────────────────────────

    def verify_conservation(self, payload: dict,
                            tol: float = CONSERVATION_TOL) -> None:
        bad: List[str] = []
        raw = payload.get("palaces") or []

        want_chan = sum(float(v or 0.0)
                        for p in raw
                        for v in (p.get("channels") or {}).values())
        if abs(self.channel.grand - want_chan) > tol:
            bad.append(f"通道總量 {self.channel.grand:.4f} "
                       f"≠ 各宮 channels Σ {want_chan:.4f}")

        want_field = sum(float(p.get("s_hua") or 0.0) for p in raw)
        if abs(self.field_.grand - want_field) > tol:
            bad.append(f"場強總量 {self.field_.grand:.4f} "
                       f"≠ 各宮 S化 Σ {want_field:.4f}")

        for panel in self.panels:
            for s in panel.sources:
                got = sum(s.targets.values())
                if abs(got - s.total) > tol:
                    bad.append(f"{panel.label}／{s.label} 去向加總 {got:.4f} "
                               f"≠ 合計 {s.total:.4f}")

        # 兩面必須是同一組東西的兩面
        a = {s.key for s in self.channel.sources}
        b = {s.key for s in self.field_.sources}
        if a != b:
            only_a = "、".join(f"{x[0]}化{x[1]}" for x in sorted(a - b))
            only_b = "、".join(f"{x[0]}化{x[1]}" for x in sorted(b - a))
            bad.append(
                "通道與場強的四化來源不一致——並列對照會變成拿蘋果比橘子。"
                + (f"只在通道：{only_a}。" if only_a else "")
                + (f"只在場強：{only_b}。" if only_b else ""))

        # 逐宮核對通道（另一條聚合路徑）
        for p in raw:
            palace = str(p.get("name") or "")
            want = sum(float(v or 0.0) for v in (p.get("channels") or {}).values())
            got = self.channel.target_total(palace)
            if abs(got - want) > tol:
                bad.append(f"{palace} 通道流入 {got:.4f} ≠ channels Σ {want:.4f}")
            want_f = float(p.get("s_hua") or 0.0)
            got_f = self.field_.target_total(palace)
            if abs(got_f - want_f) > tol:
                bad.append(f"{palace} 場強流入 {got_f:.4f} ≠ S化 {want_f:.4f}")

        if bad:
            raise ConservationError(
                "四化雙量守恆檢核未通過（共 %d 項）：\n  - %s"
                % (len(bad), "\n  - ".join(bad)))
