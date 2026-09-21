"""
星曜能量資料模型（A3 排序橫條／瀑布）
======================================

吃 `p_d_graph_v3.star_energy.build_star_energy()` 的 payload。**不重算任何係數**。

守恆檢核（違規丟 `ConservationError`，不出圖）：

    1. E ＝ 亮度倍率 × (1 + 影響 M) × 空劫衰減      ← 引擎自己宣告的等式
    2. 瀑布各步首尾相接：step[i].to == step[i+1].from
    3. 各步 delta 加總 ＝ E
    4. **不存在「四化」這一步**

第 4 條是這裡最重要的一條。四化**不乘進 E**——它在 E 這條鏈上唯一的作用是
讓帶四化的星豁免空劫，所以效果顯示在「空劫」那一步。若哪天 payload 裡冒出
一步四化，那代表有人憑空發明了一個係數，必須立刻炸掉而不是照畫。
"""

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from .config import CONSERVATION_TOL
from .data import ConservationError

# 瀑布步驟的合法 key（引擎產物的封閉集）。四化不在其中，且不可加。
KNOWN_STEP_KEYS = ("base", "brightness", "influence", "void", "total")

# 「四化被畫成獨立一步」的偵測字樣
_SIHUA_WORDS = ("四化", "化祿", "化權", "化科", "化忌", "sihua")


@dataclass
class Step:
    """瀑布的一步。"""
    key: str
    label: str
    frm: float
    to: float
    delta: float
    note: str = ""
    role: str = "step"      # step / total


@dataclass
class StarCard:
    """一顆星的能量卡。"""
    code: str
    name: str
    attr: str               # 所屬維度中文名
    kind: str
    group: str              # major / aux
    palace: str
    branch: str
    brightness: Optional[str]
    brightness_k: float
    m: float                # 同宮輔星影響加成
    void_state: str         # none / hit / exempt
    void_k: float
    e: float
    adjusted: bool
    steps: List[Step] = field(default_factory=list)
    sihua: Optional[Dict[str, Any]] = None
    counterfactual: Optional[Dict[str, Any]] = None

    @property
    def hua(self) -> str:
        return str((self.sihua or {}).get("hua") or "")


def pick_representative(cards: List["StarCard"]) -> Optional["StarCard"]:
    """一群星裡「代表這一宮的那顆」——沒指名時就畫它。

    **不可以只用 E 排序**（2026-08-12 修）。空劫與煞星是動手的那一方，自己不會
    被削弱（E 停在基準），同時把同宮主星砍下去——於是「該宮 E 最高」在有空劫的
    宮位**必然**是空劫，主星被它自己造成的傷害擠出畫面：

        兄弟宮  地空 1.00（未受任何調整）＞ 天機 0.47 ＞ 太陰 0.43
        官祿宮  鈴星 0.94 ＞ 廉貞 0.85 ＝ 七殺 0.85

    而空劫那張圖四步全平、註腳寫「本星未受任何調整」——它是所有候選裡最無法
    說明 E 怎麼算的一張。所以排序改成三層：

        ① 主星優先  ② 同層再避開空劫  ③ 最後才比 E

    ②的理由同①：空劫的瀑布恆定退化。真的要看空劫那張，指名它即可（``@地空``）。
    ③之所以留在最後而不是拿掉：同為主星時，E 高的那顆才是這一宮的主調。

    ⚠️ 這裡**不做借宮**：宮裡一顆主星都沒有時就是沒有，回退到非空劫的輔星。
    把對宮的主星畫在「命宮」的標題底下會是另一種說謊。
    """
    if not cards:
        return None
    return min(cards, key=lambda c: (c.group != "major", c.kind == "void", -c.e))


@dataclass
class StarEnergyData:
    """一次 analyze() 的星曜能量卡集合。"""

    stars: List[StarCard] = field(default_factory=list)
    formula: str = ""
    title: str = ""
    subtitle: str = ""
    engine_version: str = ""
    vector_version: str = ""

    # ── 便捷存取 ─────────────────────────────────────

    def by_group(self, group: str) -> List[StarCard]:
        return [s for s in self.stars if s.group == group]

    def find(self, code_or_name: str) -> Optional[StarCard]:
        key = str(code_or_name or "").strip()
        if not key:
            return None
        for s in self.stars:
            if s.code == key or s.name == key:
                return s
        return None

    def in_palace(self, palace: str) -> List[StarCard]:
        """某一宮裡的星，E 由大到小（``stars`` 本身已排序，篩選保序）。

        宮名（命宮）與地支（未）都認：報告與圖上兩種寫法都出現過，只認一種
        就會讓「照著圖上抄」的人拿到空清單。
        """
        key = str(palace or "").strip()
        if not key:
            return []
        return [s for s in self.stars if s.palace == key or s.branch == key]

    def palace_names(self) -> List[str]:
        """有星的宮名（依星的 E 由大到小首見序）。空宮不列——沒有星就畫不出瀑布。"""
        seen: List[str] = []
        for s in self.stars:
            if s.palace and s.palace not in seen:
                seen.append(s.palace)
        return seen

    def top(self) -> Optional[StarCard]:
        return self.stars[0] if self.stars else None

    # ── 建構 ─────────────────────────────────────────

    @classmethod
    def from_dict(cls, payload: dict) -> "StarEnergyData":
        meta = payload.get("meta") or {}
        raw = payload.get("stars") or []
        if not raw:
            raise ValueError(
                "payload.stars 為空。請確認 payload 來自 "
                "star_energy.build_star_energy()。")

        stars: List[StarCard] = []
        for s in raw:
            steps = [Step(
                key=str(st.get("key") or ""),
                label=str(st.get("label") or ""),
                frm=float(st.get("from") or 0.0),
                to=float(st.get("to") or 0.0),
                delta=float(st.get("delta") or 0.0),
                note=str(st.get("note") or ""),
                role=str(st.get("role") or "step"),
            ) for st in (s.get("steps") or [])]
            stars.append(StarCard(
                code=str(s.get("code") or ""),
                name=str(s.get("name") or ""),
                attr=str(s.get("attr") or ""),
                kind=str(s.get("kind") or ""),
                group=str(s.get("group") or "aux"),
                palace=str(s.get("palace") or ""),
                branch=str(s.get("branch") or ""),
                brightness=s.get("brightness"),
                brightness_k=float(s.get("brightness_k") or 0.0),
                m=float(s.get("m") or 0.0),
                void_state=str(s.get("void_state") or "none"),
                void_k=float(s.get("void_k") or 1.0),
                e=float(s.get("e") or 0.0),
                adjusted=bool(s.get("adjusted")),
                steps=steps,
                sihua=s.get("sihua"),
                counterfactual=s.get("counterfactual"),
            ))
        stars.sort(key=lambda c: -c.e)

        data = cls(
            stars=stars,
            formula=str(meta.get("formula") or ""),
            title=str(meta.get("title") or "").strip(),
            subtitle=str(meta.get("subtitle") or "").strip(),
            engine_version=str(meta.get("engine_version") or ""),
            vector_version=str(meta.get("vector_version") or ""),
        )
        data.verify_conservation()
        return data

    # ── 守恆檢核 ─────────────────────────────────────

    def verify_conservation(self, tol: float = CONSERVATION_TOL) -> None:
        bad: List[str] = []

        for s in self.stars:
            calc = s.brightness_k * (1 + s.m) * s.void_k
            if abs(calc - s.e) > tol:
                bad.append(
                    f"{s.name} E 分解對不上："
                    f"{s.brightness_k}×(1{s.m:+})×{s.void_k} = {calc:.4f} ≠ {s.e}")

            if not s.steps:
                bad.append(f"{s.name} 沒有瀑布步驟")
                continue

            for st in s.steps:
                if st.key not in KNOWN_STEP_KEYS:
                    bad.append(f"{s.name} 出現未知步驟「{st.key}」")
                if abs((st.to - st.frm) - st.delta) > tol:
                    bad.append(
                        f"{s.name}／{st.key} delta {st.delta} "
                        f"≠ {st.to} − {st.frm}")
                # 四化不乘進 E。冒出一步四化＝憑空發明了一個係數。
                low = f"{st.key}{st.label}".lower()
                if any(w.lower() in low for w in _SIHUA_WORDS):
                    bad.append(
                        f"{s.name} 的瀑布出現四化步驟「{st.label}」——"
                        f"四化不乘進 E，它唯一的作用是豁免空劫，"
                        f"效果應顯示在「空劫」那一步。")

            chain = [st for st in s.steps if st.role == "step"]
            for a, b in zip(chain, chain[1:]):
                if abs(a.to - b.frm) > tol:
                    bad.append(
                        f"{s.name} 瀑布斷鏈：{a.key}.to {a.to} ≠ {b.key}.from {b.frm}")
            if chain and abs(chain[-1].to - s.e) > tol:
                bad.append(f"{s.name} 瀑布末端 {chain[-1].to} ≠ E {s.e}")

            totals = [st for st in s.steps if st.role == "total"]
            if len(totals) != 2:
                bad.append(f"{s.name} 應有頭尾兩個 total 步，實得 {len(totals)}")

        if bad:
            raise ConservationError(
                "星曜能量守恆檢核未通過（共 %d 項）：\n  - %s"
                % (len(bad), "\n  - ".join(bad)))
