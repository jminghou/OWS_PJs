"""
十二宮讀數視圖 —— 給前端結構圖表（熱力圖／弦圖／桑基）的唯一真源
==================================================================

`StarFieldEngine.analyze()` 每次都會算出 12 宮讀數；本模組把它整成
**前端可以直接畫、不必再算任何東西**的形狀，不重算、不改動任何係數。

一次 analyze() 可同時餵三類圖：

  輔星流量熱力圖   `palaces[].aux_flow`（12 宮 × 8 輔星組）＋ `aux_totals`
  宮位取樣弦圖     `palaces[].contributors[]` 的 (from_code → code, flow)
  四化桑基         通道版走 `palaces[].channels`／逐星走 contributors[].channel
                   場強版走 `palaces[].field_sources[]`

## 三個容易畫錯的地方

1. **flow 與 contribution 不是同一個量。**
   `flow` ＝ E×w（原始流量，未乘類權）；`contribution` ＝ flow × 類權。
   主星類權 1.0 兩者相等；輔星類權 0 ⇒ contribution 恆為 0、flow 照列。
   熱力圖與弦圖看的是 **flow**；進 S總 的是 **contribution**。

2. **`aux_totals` 是欄合計，不是全盤總量。**
   取樣窗會讓同一顆星被多個宮取樣，所以它只能做組間相對比較。

3. **通道值與場強是兩組係數不同的量，排序會相反。**
   通道＝E×k×w（性質標記，進 86 維 channel 維）；場強＝E×g×w場（實際進 S總）。
   畫桑基前必須先決定講哪一個，不可混用。

## 用法

    from p_d_graph_v3.palace_readings import build_palace_readings
    payload = build_palace_readings(encoded_array)

    # 已經有 analyze() 結果時（與 star_energy 共用同一次運算）：
    from p_d_graph_v3.palace_readings import build_from_result
    payload = build_from_result(result, engine)
"""

from .config import ENGINE_VERSION, VECTOR_VERSION
from .names import Names

_ENGINE = None


def _round(v, nd=4):
    return None if v is None else round(float(v), nd)


def _aux_groups(registry):
    """輔星組顯示序＝維度註冊表裡 kind≠major 的順序（真源，不硬編）。

    輔星整併後（vv3.6）是左右／魁鉞／昌曲／祿存／天馬／煞星／空劫／桃花八組；
    日後若再整併，這裡自動跟著走。
    """
    seen, out = set(), []
    for d in registry.e_dims:
        if d.kind != "major" and d.name_zh not in seen:
            seen.add(d.name_zh)
            out.append(d.name_zh)
    return out


def _engine():
    global _ENGINE
    if _ENGINE is None:
        from .engine import StarFieldEngine
        _ENGINE = StarFieldEngine()
    return _ENGINE


def build_palace_readings(encoded_array, engine=None) -> dict:
    eng = engine or _engine()
    return build_from_result(eng.analyze(encoded_array), eng)


def build_from_result(result, engine=None) -> dict:
    """已經有 analyze() 結果時的入口（避免為了第二張圖重跑一次引擎）。"""
    eng = engine or _engine()
    names = Names(eng.registry)
    groups = _aux_groups(eng.registry)

    palaces = []
    aux_totals = {g: 0.0 for g in groups}

    for code, rd in result.readings.items():
        aux_flow = {g: 0.0 for g in groups}
        contributors = []

        for c in rd.contributors:
            dim_zh = names.dim_zh(c.dim_name)
            kind = c.kind
            if kind != "major" and dim_zh in aux_flow:
                aux_flow[dim_zh] += c.flow
                aux_totals[dim_zh] += c.flow
            contributors.append({
                "star": names.star(c.star),
                "star_code": c.star,
                "attr": dim_zh,
                "kind": kind,
                "group": "major" if kind == "major" else "aux",
                "from_palace": names.palace(c.palace),
                "from_code": c.palace,
                "relation": names.relation(c.relation),
                "relation_code": c.relation,
                "w": _round(c.weight),
                "kind_weight": _round(c.kind_weight),
                "e": _round(c.E),
                # flow＝原始流量（E×w）；contribution＝入 S總 的量（flow×類權）
                "flow": _round(c.flow),
                "contribution": _round(c.contribution),
                "channels": {names.sihua(k): _round(v)
                             for k, v in (c.channels or {}).items() if v},
            })

        field_sources = [{
            "star": names.star(fs.star),
            "star_code": fs.star,
            "hua": names.sihua(fs.sihua),
            "layer": names.layer_zh(fs.layer),
            "from_palace": names.palace(fs.palace),
            "from_code": fs.palace,
            "relation": names.relation(fs.relation),
            "w": _round(fs.weight),
            "g": _round(fs.gain),
            "e": _round(fs.E),
            "strength": _round(fs.strength),
        } for fs in (rd.field_sources or [])]

        palaces.append({
            "code": code,
            "name": names.palace(code),
            "branch": names.branch(rd.branch),
            # S總＝S力＋S化。輔星類權 0 ⇒ 不入總，但流量照列（s_aux_flow）。
            "s_total": _round(rd.S),
            "s_power": _round(rd.S_major),
            "s_hua": _round(rd.S_sihua),
            "s_aux_flow": _round(rd.S_aux_flow),
            "channels": {names.sihua(k): _round(v)
                         for k, v in (rd.channels or {}).items()},
            "owed": _round(rd.chong),
            "aux_flow": {g: _round(v) for g, v in aux_flow.items()},
            "contributors": contributors,
            "field_sources": field_sources,
        })

    palaces.sort(key=lambda p: p["code"])
    body = result.body_anchor

    return {
        "meta": {
            "engine_version": ENGINE_VERSION,
            "vector_version": VECTOR_VERSION,
            "aux_groups": groups,
            "notes": {
                "flow_vs_contribution":
                    "flow＝E×w（原始流量，未乘類權）；contribution＝flow×類權。"
                    "輔星類權為 0 ⇒ contribution 恆為 0，但 flow 照列——"
                    "熱力圖與弦圖看 flow，進 S總 的是 contribution。",
                "aux_totals":
                    "欄合計。取樣窗使同一顆星被多宮取樣，"
                    "**只能做組間相對比較，不是全盤總量**。",
                "sihua_two_quantities":
                    "channels＝通道值（E×k×w，進 86 維 channel 維）；"
                    "field_sources[].strength＝場強（E×g×w場，實際進 S總）。"
                    "兩組係數不同、排序會相反，畫圖前須先決定講哪一個。",
            },
        },
        "palaces": palaces,
        "aux_totals": {g: _round(v) for g, v in aux_totals.items()},
        "body_anchor": {"code": body, "name": names.palace(body)} if body else None,
    }
