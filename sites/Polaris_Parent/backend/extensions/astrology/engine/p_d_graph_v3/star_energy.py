"""
星曜能量卡（E 的可回溯分解）—— 給前端瀑布圖的唯一真源
======================================================

`StarFieldEngine.analyze()` 的產物很豐富（86 維向量、13 格讀數、全部事實表），
但「點一顆星看它的 E 怎麼來的」只需要其中很小一塊。本模組把那一塊抽成
**前端可以直接畫、不必再算任何東西**的形狀。

    E = 亮度倍率 × (1 + Σ 同宮輔星影響 M) × 空劫衰減

三個係數各自的真源：
    亮度倍率  coefficients.json / brightness_factors
    影響 M    influence_matrix.csv（受方限主星）
    空劫衰減  coefficients.json / void_k ＋ sampling_window.json（射程與關係權重）

## 四化在這裡的位置（重要，別畫錯）

四化**不乘進 E**。它在 E 這條鏈上只有一個作用：
**帶四化的星豁免空劫**（`star_field.compute` 的 `exempt_stars`）。
所以四化的效果會顯示在「空劫」那一步——不是多加一步「四化」。
引擎有留豁免前的試算因子（`VoidEvent.exempted[].factor`），
本模組據此算出反事實（`counterfactual.without_sihua`），這是誠實呈現四化影響的唯一方式。

四化另外兩個量（通道值 E×k、場強 E×g×w場）都是 **E 之後**的事，
放在 `sihua.downstream`，前端要另開區塊，不可混進瀑布。

## 用法

    from p_d_graph_v3.star_energy import build_star_energy
    payload = build_star_energy(encoded_array)          # 全部星
    payload = build_star_energy(encoded_array, kinds=["major"])   # 只要主星

輸出是純 JSON-safe dict。實測全量 analyze 約 0.36 ms/張（純查表算術，
無 DB / 無網路 / 無母體），可直接掛在排盤 API 的同一次請求裡。
"""

from .config import ENGINE_VERSION, VECTOR_VERSION
from .names import Names

#: 維度類別 → 顯示分組（前端篩選用）。major＝十四主星；其餘皆為輔星。
KIND_GROUP = {"major": "major", "pair": "aux", "solo": "aux", "void": "aux"}

#: 未受任何調整時的說明（M＝0 且空劫未生效）
DEGENERATE_NOTE = "本星未受任何調整，E ＝ 亮度倍率"

_ENGINE = None


def _engine():
    global _ENGINE
    if _ENGINE is None:
        from .engine import StarFieldEngine
        _ENGINE = StarFieldEngine()
    return _ENGINE


def _round(v, nd=4):
    return None if v is None else round(float(v), nd)


def _disp(v, nd=2):
    """顯示用數字：四捨五入到 nd 位並去掉尾隨 0（1.20→1.2、0.00→0）。
    給人看的字串一律走這裡，避免同一個數字在標籤與等式裡出現兩種精度。"""
    s = f"{float(v):.{nd}f}".rstrip("0").rstrip(".")
    return s or "0"


def build_star_energy(encoded_array, engine=None, kinds=None) -> dict:
    """
    Args:
        encoded_array: 命盤編碼陣列（與排盤 API 的 include_encoding 產物同格式）
        engine:        可傳入既有的 StarFieldEngine 重用（省去重載係數表）
        kinds:         要哪些類別；None＝全部。可給 ["major"] 或 ["major","pair"]…
                       也接受分組名 "aux"（＝pair+solo+void）

    Returns:
        {"meta": {...}, "stars": [星曜能量卡, ...]}
    """
    eng = engine or _engine()
    result = eng.analyze(encoded_array)
    return build_from_result(result, eng, kinds=kinds)


def build_from_result(result, engine=None, kinds=None) -> dict:
    """已經有 analyze() 結果時的入口（避免重算）。"""
    eng = engine or _engine()
    sf = result.star_field

    names = Names(eng.registry)

    # 豁免前的試算衰減因子（多刀取最強＝factor 最小），供四化反事實
    pre_exempt = {}
    for ev in sf.void_events:
        for hit in ev.exempted:
            cur = pre_exempt.get(hit.star)
            pre_exempt[hit.star] = hit.factor if cur is None else min(cur, hit.factor)

    # 被砍的星：記下是哪一顆空劫星、什麼關係（可回溯）
    hit_by = {}
    for ev in sf.void_events:
        for hit in ev.affected:
            cur = hit_by.get(hit.star)
            if cur is None or hit.factor < cur["factor"]:
                hit_by[hit.star] = {"void_star": names.star(ev.void_star),
                                    "void_palace": names.palace(ev.palace),
                                    "relation": hit.relation,
                                    "factor": hit.factor}

    # 四化：星 → (中文化名, 層, 通道值)
    sihua_of = {}
    for t in sf.transform_facts:
        sihua_of[t.star] = {
            "hua": names.sihua(t.sihua),
            "layer": names.layer_zh(t.layer),
            "channel_value": _round(t.channel_value),
        }

    wanted = _expand_kinds(kinds)
    cards = []
    for f in sf.star_facts:
        if wanted is not None and f.kind not in wanted:
            continue
        cards.append(_card(f, names, eng, pre_exempt, hit_by, sihua_of))

    cards.sort(key=lambda c: -c["e"])
    return {
        "meta": {
            "engine_version": ENGINE_VERSION,
            "vector_version": VECTOR_VERSION,
            "formula": "E = 亮度倍率 × (1 + 影響加成 M) × 空劫衰減",
            "sihua_note": "四化不乘進 E；它在 E 這條鏈上的唯一作用是豁免空劫。"
                          "通道值與場強屬於 E 之後的量，見各星 sihua.downstream。",
            "degenerate_note": DEGENERATE_NOTE,
            "star_count": len(cards),
        },
        "stars": cards,
    }


def _expand_kinds(kinds):
    if not kinds:
        return None
    out = set()
    for k in kinds:
        if k == "aux":
            out.update(x for x, g in KIND_GROUP.items() if g == "aux")
        else:
            out.add(k)
    return out


def _card(f, names, eng, pre_exempt, hit_by, sihua_of) -> dict:
    bk = float(f.brightness_factor)
    m = float(f.influence_bonus)
    vk = float(f.void_factor)

    p1 = 1.0
    p2 = bk
    p3 = bk * (1 + m)
    p4 = p3 * vk

    void_state = ("exempt" if f.sihua_exempt
                  else ("hit" if f.voided else "none"))
    hua = sihua_of.get(f.star)

    if void_state == "hit":
        h = hit_by.get(f.star, {})
        void_note = f"×{_disp(vk)}"
        void_detail = h
    elif void_state == "exempt":
        void_note = f"豁免（帶化{hua['hua']}）" if hua else "豁免"
        void_detail = None
    else:
        void_note = "未命中"
        void_detail = None

    steps = [
        {"key": "base", "label": "基準", "from": 0.0, "to": _round(p1),
         "delta": _round(p1), "note": None, "role": "total"},
        {"key": "brightness", "label": f"亮度 {f.brightness or '—'}",
         "from": _round(p1), "to": _round(p2), "delta": _round(p2 - p1),
         "note": f"×{_disp(bk)}", "role": "step"},
        {"key": "influence", "label": "影響加成",
         "from": _round(p2), "to": _round(p3), "delta": _round(p3 - p2),
         "note": ("＋" if m > 0 else "−" if m < 0 else "")
                 + _disp(abs(m)), "role": "step"},
        {"key": "void", "label": "空劫",
         "from": _round(p3), "to": _round(p4), "delta": _round(p4 - p3),
         "note": void_note, "role": "step"},
        {"key": "total", "label": "E", "from": 0.0, "to": _round(f.E),
         "delta": _round(f.E), "note": None, "role": "total"},
    ]

    # 豁免也算「有事發生」：vk 雖然是 1.0，但它本來會被砍，有反事實可講。
    # 只有 M＝0、未被砍、也不在任何空劫射程內的星，才是真正的退化案例。
    adjusted = (abs(m) > 1e-9 or abs(vk - 1.0) > 1e-9
                or void_state == "exempt")
    counterfactual = {}
    if void_state == "hit":
        counterfactual["without_void"] = {
            "e": _round(p3),
            "gain": _round(p3 - p4),
            "pct": _round((p3 - p4) / p3 * 100, 1) if p3 else None,
            "text": f"若未被空劫命中，E 會是 {_disp(p3)}",
        }
    if void_state == "exempt":
        wv = pre_exempt.get(f.star, 1.0)
        we = p3 * wv
        counterfactual["without_sihua"] = {
            "would_be_void_k": _round(wv, 4),
            "e": _round(we),
            "gain": _round(f.E - we),
            "pct": _round((f.E / we - 1) * 100, 1) if we else None,
            "text": (f"四化豁免了空劫；若未帶化{hua['hua']}，"
                     f"會被 ×{_disp(wv)} 砍到 {_disp(we)}") if hua else None,
        }

    return {
        "code": f.star,
        "name": names.star(f.star),
        "attr": names.dim_zh(f.dim_name),
        "kind": f.kind,
        "group": KIND_GROUP.get(f.kind, "aux"),
        "palace": names.palace(f.palace),
        # 原始宮位代碼（1…C）：前端互動命盤的 onPalaceClick 給的是這個，
        # 保留它才能把「點宮位」和「星曜卡」對起來，不必在前端做中文名反查。
        "palace_code": f.palace,
        "branch": names.branch(f.branch),
        "brightness": f.brightness,
        "brightness_k": _round(bk, 4),
        "m": _round(m, 4),
        "void_state": void_state,
        "void_k": _round(vk, 4),
        "void_detail": void_detail,
        "sihua": hua,
        "e": _round(f.E),
        "adjusted": adjusted,
        "degenerate_note": None if adjusted else DEGENERATE_NOTE,
        "steps": steps,
        "counterfactual": counterfactual or None,
    }
