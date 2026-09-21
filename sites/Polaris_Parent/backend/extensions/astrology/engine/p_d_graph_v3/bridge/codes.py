"""
codes.py — DB 編碼欄 → encoded_array 的**唯一**建構器

為什麼在這裡：`account.user_natal_codes.codes/special_codes` 轉 encoded_array 的
規則（特殊碼 G/Q/L/M 前置 ＋ 整數編碼逐一 decode）原本有三份複本：

  1. PolarisUI/backend/routes/graph_analysis.py::_build_encoded_array
  2. P_Union/p_d_graph_v3/tools/build_facet_population.py::_encoded_array
  3. PolarisUI/backend/modules/ziwei/logic/graph/wiki_builder.py::fetch_natal_encoded_array

三者各自實作、各自演化——任何一邊改了規則，另外兩邊就悄悄產出不同的向量。
2026-08-01（RM-260801-v1 M1 全庫向量化）收斂到本檔。

放在 `bridge/` 而非 backend logic 層的理由：母體工具（`tools/`）與 backend
都要用，而 P_Union 不可以反向依賴 PolarisUI。本檔只依賴 `p_a_foundation`
（與 bridge 其餘兩檔同一條線）。

**純函式、零 DB**：DB 讀取留在各呼叫端（executor／psycopg2 各有各的連線方式），
本檔只負責「拿到 codes 兩欄之後」的那段轉換。
"""

from __future__ import annotations

import json
from typing import Any, List, Optional

__all__ = ["encoded_array_from_codes"]

_GENDER_CODE = {"male": "M", "female": "F", "M": "M", "F": "F"}


def _as_obj(value: Any, default: Any) -> Any:
    """JSONB 欄位可能已是物件，也可能是字串（依驅動/查詢路徑而異）。"""
    if value is None:
        return default
    if isinstance(value, str):
        try:
            return json.loads(value)
        except (json.JSONDecodeError, ValueError):
            return default
    return value


def encoded_array_from_codes(
    codes: Any,
    special_codes: Any = None,
    *,
    natal: bool = True,
) -> List[str]:
    """
    把 DB 的編碼欄轉成分析引擎吃的 encoded_array。

    Args:
        codes: `codes` 欄（int 編碼與字串 token 混雜的陣列，或其 JSON 字串）
        special_codes: `special_codes` 欄（本命盤才有：gender/body_palace_location/
            life_master/body_master）；運限盤傳 None
        natal: True＝本命盤（前置 G/Q/L/M 特殊碼）；False＝運限盤
            （`user_fortune_codes` 只有 codes 欄，無特殊碼）

    Returns:
        encoded_array；`codes` 為空時回空 list（呼叫端自行判斷是否視為錯誤）。

    Note:
        整數編碼 decode 失敗一律略過（沿用既有行為：壞碼不阻斷整張盤）。
    """
    from p_a_foundation.core.coder import ZiweiBitmaskCoder

    coder = ZiweiBitmaskCoder()
    raw_codes = _as_obj(codes, []) or []

    arr: List[str] = []

    if natal:
        special = _as_obj(special_codes, {}) or {}
        gender = special.get("gender")
        if gender:
            gc = _GENDER_CODE.get(gender) or (gender[0].upper() if gender else "")
            if gc:
                arr.append(f"G{gc}")
        if q := special.get("body_palace_location"):
            arr.append(f"Q{q}")
        if lm := special.get("life_master"):
            arr.append(f"L{lm}")
        if bm := special.get("body_master"):
            arr.append(f"M{bm}")

    for x in raw_codes:
        if x is None:
            continue
        if isinstance(x, int):
            try:
                arr.append(coder.decode(x))
            except Exception:  # noqa: BLE001 — 壞碼略過，不阻斷整張盤
                pass
        else:
            arr.append(str(x))

    return arr
