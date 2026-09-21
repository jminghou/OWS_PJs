"""
星場圖表資料模型
================

吃 `p_d_graph_v3.palace_readings.build_palace_readings()` 的 payload，
整成各 composer 直接可用的形狀。**不重算任何係數**——所有數值逐字取自 payload。

⚠️ 刻意不吃讀數報告 .md。原型（`tools/build_reading_viz.py`）是解析 markdown
   反推數值，那是原型期的權宜；正式路徑走 JSON 視圖層，少一層字串解析就少一類錯。

守恆檢核（交接文件 §8 的紀律：對不上就報錯，不是靜默出圖）在 `from_dict()`
就跑完，違規丟 `ConservationError`。
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

from .config import CONSERVATION_TOL, FLOW_EPS


class ConservationError(ValueError):
    """守恆恆等式不成立——資料整形過程弄丟或重複計算了流量。"""


@dataclass
class AuxStar:
    """熱力圖一格底下的單顆輔星（下鑽明細）。"""
    star: str
    from_palace: str        # 星實際所在宮
    relation: str           # 取樣關係：主宮／對宮／三方
    e: float
    flow: float             # E×w，未乘類權


@dataclass
class FlowStar:
    """一條有向邊底下的單顆星。"""
    star: str
    attr: str
    flow: float


@dataclass
class FlowEdge:
    """弦圖的一條有向邊：星所在宮 → 被取樣宮。

    ``relation`` 對同一組 (src, dst) 是唯一的——取樣關係由兩宮的幾何位置決定，
    不因星而異。所以整條邊可以只塗一個顏色。
    """
    src: str                # 來源宮名（星實際所在宮）
    dst: str                # 被取樣宮名
    relation: str           # 主宮／對宮／三方
    flow: float
    stars: List[FlowStar] = field(default_factory=list)

    @property
    def is_self(self) -> bool:
        return self.src == self.dst


@dataclass
class PalaceRow:
    """一宮的讀數摘要。"""
    code: str
    name: str
    branch: str
    s_total: float
    s_power: float
    s_hua: float
    s_aux_flow: float       # 輔星流量合計；不入 S總（類權 0），但流量照列


@dataclass
class StarfieldData:
    """一次 analyze() 的十二宮讀數，整成圖表可直接消費的形狀。"""

    palaces: List[PalaceRow] = field(default_factory=list)
    aux_groups: List[str] = field(default_factory=list)
    # {宮名: {輔星組: 流量}}；0 代表無流入
    aux_flow: Dict[str, Dict[str, float]] = field(default_factory=dict)
    # {輔星組: 欄合計}（含重複取樣，非全盤總量）
    aux_totals: Dict[str, float] = field(default_factory=dict)
    # {宮名: {輔星組: [AuxStar]}}
    aux_detail: Dict[str, Dict[str, List[AuxStar]]] = field(default_factory=dict)
    # 主星側（同一張熱力圖的另一半：欄位是十四主星維度「力」，不是星名）
    major_dims: List[str] = field(default_factory=list)
    major_flow: Dict[str, Dict[str, float]] = field(default_factory=dict)
    major_totals: Dict[str, float] = field(default_factory=dict)
    major_detail: Dict[str, Dict[str, List[AuxStar]]] = field(default_factory=dict)
    # {類別: {(來源宮, 被取樣宮): FlowEdge}}；類別＝major／aux／all
    flows: Dict[str, Dict[Tuple[str, str], FlowEdge]] = field(default_factory=dict)
    title: str = ""
    subtitle: str = ""
    chart_kind: str = "natal"     # natal / decade / year / minor
    engine_version: str = ""
    vector_version: str = ""

    # ── 便捷存取 ─────────────────────────────────────

    @property
    def order(self) -> List[str]:
        """宮名顯示序（＝ payload 的宮位碼序）。"""
        return [p.name for p in self.palaces]

    def branch_of(self, palace_name: str) -> str:
        for p in self.palaces:
            if p.name == palace_name:
                return p.branch
        return ""

    def row(self, palace_name: str) -> Optional[PalaceRow]:
        for p in self.palaces:
            if p.name == palace_name:
                return p
        return None

    def aux_grand_total(self) -> float:
        return sum(self.aux_totals.values())

    # ── 熱力圖的兩半（輔星／主星）共用存取 ─────────────

    def columns(self, group: str) -> List[str]:
        """該側的欄位（輔星＝八組；主星＝十四個「力」維度）。"""
        return self.major_dims if group == "major" else self.aux_groups

    def matrix(self, group: str) -> Dict[str, Dict[str, float]]:
        return self.major_flow if group == "major" else self.aux_flow

    def col_totals(self, group: str) -> Dict[str, float]:
        return self.major_totals if group == "major" else self.aux_totals

    def detail(self, group: str) -> Dict[str, Dict[str, List[AuxStar]]]:
        return self.major_detail if group == "major" else self.aux_detail

    def row_total(self, palace: str, group: str) -> float:
        """該宮該側的合計＝主星 S力／輔星 S輔。"""
        row = self.row(palace)
        if row is None:
            return 0.0
        return row.s_power if group == "major" else row.s_aux_flow

    def grand_total(self, group: str) -> float:
        return sum(self.col_totals(group).values())

    def edges(self, kind: str = "major") -> List[FlowEdge]:
        """該類別的所有有向邊（流量由大到小）。"""
        if kind not in self.flows:
            raise ValueError(
                f"未知的流量類別「{kind}」（可用：{'、'.join(self.flows)}）")
        return sorted(self.flows[kind].values(), key=lambda e: -e.flow)

    def inflow(self, palace: str, kind: str = "major") -> float:
        """流入該宮的總量（含主宮自給）。"""
        return sum(e.flow for e in self.flows[kind].values() if e.dst == palace)

    def self_flow(self, palace: str, kind: str = "major") -> float:
        e = self.flows[kind].get((palace, palace))
        return e.flow if e else 0.0

    # ── 建構 ─────────────────────────────────────────

    @classmethod
    def from_dict(cls, payload: dict) -> "StarfieldData":
        meta = payload.get("meta") or {}
        groups = list(meta.get("aux_groups") or [])
        if not groups:
            raise ValueError(
                "payload.meta.aux_groups 為空——輔星組顯示序的真源是引擎的維度"
                "註冊表，不可由圖表端硬編。請確認 payload 來自 "
                "palace_readings.build_palace_readings()。")
        # 主星維度序同理取自 meta。舊 payload 沒有這個欄位時留空，
        # 只有主星熱力圖畫不出來，其餘圖表照常。
        major_dims = list(meta.get("major_dims") or [])

        raw_palaces = payload.get("palaces") or []
        if not raw_palaces:
            raise ValueError("payload.palaces 為空")

        palaces: List[PalaceRow] = []
        aux_flow: Dict[str, Dict[str, float]] = {}
        aux_detail: Dict[str, Dict[str, List[AuxStar]]] = {}
        # 主星矩陣由 contributors 現算（payload 不另帶——它已經在 contributors
        # 裡了，再存一份只是把同一件事說兩遍）。守恆檢核會把它對回 S力。
        major_flow: Dict[str, Dict[str, float]] = {}
        major_detail: Dict[str, Dict[str, List[AuxStar]]] = {}
        major_totals: Dict[str, float] = {d: 0.0 for d in major_dims}
        # 有向邊：來源＝星實際所在宮，匯＝被取樣宮。
        # ⚠️ 用 flow（E×w）不是 contribution——輔星類權為 0，
        #    拿 contribution 建的弦圖，輔星那一版會整片是 0。
        flows: Dict[str, Dict[Tuple[str, str], FlowEdge]] = {
            "major": {}, "aux": {}, "all": {},
        }

        def _edge(kind: str, src: str, dst: str, rel: str, c: dict) -> None:
            key = (src, dst)
            e = flows[kind].get(key)
            if e is None:
                e = FlowEdge(src=src, dst=dst, relation=rel, flow=0.0)
                flows[kind][key] = e
            elif e.relation != rel:
                raise ConservationError(
                    f"{src} → {dst} 同時被標成「{e.relation}」與「{rel}」——"
                    f"取樣關係由兩宮的幾何位置決定，同一組宮位不可有兩種關係。")
            e.flow += float(c.get("flow") or 0.0)
            e.stars.append(FlowStar(
                star=str(c.get("star") or ""),
                attr=str(c.get("attr") or ""),
                flow=float(c.get("flow") or 0.0)))

        for p in raw_palaces:
            name = p["name"]
            palaces.append(PalaceRow(
                code=p["code"],
                name=name,
                branch=p.get("branch", ""),
                s_total=float(p.get("s_total") or 0.0),
                s_power=float(p.get("s_power") or 0.0),
                s_hua=float(p.get("s_hua") or 0.0),
                s_aux_flow=float(p.get("s_aux_flow") or 0.0),
            ))

            row = p.get("aux_flow") or {}
            aux_flow[name] = {g: float(row.get(g) or 0.0) for g in groups}

            cells: Dict[str, List[AuxStar]] = {g: [] for g in groups}
            m_row = {d: 0.0 for d in major_dims}
            m_cells: Dict[str, List[AuxStar]] = {d: [] for d in major_dims}
            for c in p.get("contributors") or []:
                src = str(c.get("from_palace") or "")
                rel = str(c.get("relation") or "")
                if src:
                    grp = "major" if c.get("group") == "major" else "aux"
                    _edge(grp, src, name, rel, c)
                    _edge("all", src, name, rel, c)

                if c.get("group") == "major" and major_dims:
                    attr = str(c.get("attr") or "")
                    if attr not in m_row:
                        raise ValueError(
                            f'{name}／{c.get("star")} 的主星維度「{attr}」不在 '
                            f'major_dims 內：{major_dims}')
                    v = float(c.get("flow") or 0.0)
                    m_row[attr] += v
                    major_totals[attr] += v
                    m_cells[attr].append(AuxStar(
                        star=str(c.get("star") or ""),
                        from_palace=src, relation=rel,
                        e=float(c.get("e") or 0.0), flow=v))

                if c.get("group") != "aux":
                    continue
                attr = c.get("attr")
                if attr not in cells:
                    raise ValueError(
                        f'{name}／{c.get("star")} 的輔星組「{attr}」不在 '
                        f'aux_groups 內：{groups}')
                # 引擎不變量：輔星類權為 0 ⇒ contribution 恆為 0。
                # 這條若破了，「熱力圖看 flow」的前提就變了，必須立刻炸掉
                # 而不是繼續畫一張看似正常的圖。
                contrib = c.get("contribution")
                if contrib is not None and abs(float(contrib)) > FLOW_EPS:
                    raise ConservationError(
                        f'{name}／{c.get("star")}（{attr}）輔星 contribution '
                        f'= {contrib}，應恆為 0。輔星類權不再是 0 的話，'
                        f'A1「看 flow 不看 contribution」的前提需重新確認。')
                cells[attr].append(AuxStar(
                    star=c.get("star", ""),
                    from_palace=c.get("from_palace", ""),
                    relation=c.get("relation", ""),
                    e=float(c.get("e") or 0.0),
                    flow=float(c.get("flow") or 0.0),
                ))
            aux_detail[name] = cells
            major_flow[name] = m_row
            major_detail[name] = m_cells

        data = cls(
            palaces=palaces,
            aux_groups=groups,
            aux_flow=aux_flow,
            aux_totals={g: float((payload.get("aux_totals") or {}).get(g) or 0.0)
                        for g in groups},
            aux_detail=aux_detail,
            major_dims=major_dims,
            major_flow=major_flow,
            major_totals=major_totals,
            major_detail=major_detail,
            flows=flows,
            title=str(meta.get("title") or "").strip(),
            subtitle=str(meta.get("subtitle") or "").strip(),
            chart_kind=str(meta.get("chart_kind") or "natal"),
            engine_version=str(meta.get("engine_version") or ""),
            vector_version=str(meta.get("vector_version") or ""),
        )
        data.verify_conservation()
        return data

    # ── 守恆檢核 ─────────────────────────────────────

    def verify_conservation(self, tol: float = CONSERVATION_TOL) -> None:
        """驗四條恆等式，任一不成立就報錯（不出圖）。

        1. 每宮：Σ 各輔星組流量 = S輔
        2. 每組：Σ 各宮流量 = 該組欄合計
        3. 每格：Σ 下鑽逐星流量 = 該格流量
        4. 全盤：Σ 欄合計 = Σ 各宮 S輔
        5. 弦圖：流入每宮的主星流量 = S力；輔星流量 = S輔
           （與 1–4 走不同的聚合路徑，對得上才代表兩張圖講的是同一件事）
        6. 弦圖：major + aux 的邊 = all 的邊
        """
        bad: List[str] = []

        for p in self.palaces:
            got = sum(self.aux_flow[p.name].values())
            if abs(got - p.s_aux_flow) > tol:
                bad.append(f"{p.name} 列加總 {got:.4f} ≠ S輔 {p.s_aux_flow:.4f}")

        for g in self.aux_groups:
            got = sum(self.aux_flow[p.name][g] for p in self.palaces)
            want = self.aux_totals[g]
            if abs(got - want) > tol:
                bad.append(f"{g} 欄加總 {got:.4f} ≠ aux_totals {want:.4f}")

        for p in self.palaces:
            for g in self.aux_groups:
                got = sum(s.flow for s in self.aux_detail[p.name][g])
                want = self.aux_flow[p.name][g]
                if abs(got - want) > tol:
                    bad.append(
                        f"{p.name}／{g} 逐星加總 {got:.4f} ≠ 格值 {want:.4f}")

        grand_cols = self.aux_grand_total()
        grand_rows = sum(p.s_aux_flow for p in self.palaces)
        if abs(grand_cols - grand_rows) > tol:
            bad.append(
                f"全盤：欄合計 Σ {grand_cols:.4f} ≠ 各宮 S輔 Σ {grand_rows:.4f}")

        # 主星側：熱力圖的另一半。主星類權為 1 ⇒ flow 即入 S力 的量，
        # 所以每列加總應等於該宮 S力（與弦圖走不同的聚合路徑，兩邊都要對）。
        if self.major_dims:
            for p in self.palaces:
                got = sum(self.major_flow[p.name].values())
                if abs(got - p.s_power) > tol:
                    bad.append(
                        f"{p.name} 主星列加總 {got:.4f} ≠ S力 {p.s_power:.4f}")
                for d in self.major_dims:
                    cell = sum(s.flow for s in self.major_detail[p.name][d])
                    if abs(cell - self.major_flow[p.name][d]) > tol:
                        bad.append(
                            f"{p.name}／{d} 逐星加總 {cell:.4f} "
                            f"≠ 格值 {self.major_flow[p.name][d]:.4f}")
            for d in self.major_dims:
                got = sum(self.major_flow[p.name][d] for p in self.palaces)
                if abs(got - self.major_totals[d]) > tol:
                    bad.append(
                        f"{d} 欄加總 {got:.4f} ≠ major_totals {self.major_totals[d]:.4f}")

        # 弦圖：流入量對回讀數總表。主星類權為 1 ⇒ flow 與 contribution 相等，
        # 故主星流入量應等於 S力；輔星流入量應等於 S輔。
        for p in self.palaces:
            got_major = self.inflow(p.name, "major")
            if abs(got_major - p.s_power) > tol:
                bad.append(
                    f"{p.name} 主星流入 {got_major:.4f} ≠ S力 {p.s_power:.4f}")
            got_aux = self.inflow(p.name, "aux")
            if abs(got_aux - p.s_aux_flow) > tol:
                bad.append(
                    f"{p.name} 輔星流入 {got_aux:.4f} ≠ S輔 {p.s_aux_flow:.4f}")

        for key, e in self.flows["all"].items():
            parts = (self.flows["major"].get(key), self.flows["aux"].get(key))
            got = sum(x.flow for x in parts if x)
            if abs(got - e.flow) > tol:
                bad.append(
                    f"{e.src} → {e.dst}：主星＋輔星 {got:.4f} ≠ 合計 {e.flow:.4f}")

        if bad:
            raise ConservationError(
                "輔星流量守恆檢核未通過（共 %d 項）：\n  - %s"
                % (len(bad), "\n  - ".join(bad)))
