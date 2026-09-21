"""
星場圖表共用的版面小工具
========================

每張圖都要量化座標、估字寬、折行、格式化數字。這些一旦各自複製一份，
就會出現「同一個數字在兩張圖上顯示成兩種精度」「同一段文字在兩張圖折行位置不同」
——本專案避免的正是這一類重複，所以放同一支。
"""

from ...core.path import q as _q_coord

# 座標量化（與 core.path 同一個實作，避免兩套捨入規則）
q = _q_coord


def fmt(v, nd: int = 2) -> str:
    """數值顯示：固定小數位（不去尾零——同一欄的數字要對得齊）。"""
    return f"{round(float(v), nd):.{nd}f}"


def fmt_trim(v, nd: int = 2) -> str:
    """數值顯示：去掉尾隨零（1.20→1.2、0.00→0）。標籤內嵌時用。"""
    s = f"{float(v):.{nd}f}".rstrip("0").rstrip(".")
    return s or "0"


def est_w(s: str, fs: float) -> float:
    """估算字寬：CJK ≈ 字級寬、拉丁 ≈ 0.55 字級。"""
    return sum(fs if ord(ch) > 0x2E80 else fs * 0.55 for ch in str(s))


def wrap(text: str, max_w: float, fs: float) -> list:
    """依估算字寬折行（CJK 逐字）。"""
    lines, cur, cur_w = [], "", 0.0
    for ch in str(text or ""):
        w = fs if ord(ch) > 0x2E80 else fs * 0.55
        if cur and cur_w + w > max_w:
            lines.append(cur)
            cur, cur_w = "", 0.0
        cur += ch
        cur_w += w
    if cur:
        lines.append(cur)
    return lines or [""]


def wrap_all(texts, max_w: float, fs: float) -> list:
    out = []
    for t in texts:
        out.extend(wrap(t, max_w, fs))
    return out
