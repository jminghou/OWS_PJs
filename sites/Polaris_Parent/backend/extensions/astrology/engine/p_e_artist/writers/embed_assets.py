"""
將 composer 產生的相對圖檔路徑轉為 data URI，使 SVG/HTML 可離線開啟（Illustrator / Figma 等）。

說明：Adobe Illustrator 對 <image href="data:image/svg+xml;base64,..."> 支援很差，常顯示為
空白連結。產出 .svg 時應優先將星曜 SVG 以「巢狀 <svg>」內嵌（見 svg_writer）。
"""

from __future__ import annotations

import base64
import os
import re
from typing import Optional, Tuple

# 依 p_e_artist 套件根目錄解析 assets/stars（與 href 如 ../assets/stars/POL.svg 對應）


def _package_root() -> str:
    return os.path.normpath(os.path.join(os.path.dirname(__file__), ".."))


def resolve_star_asset_path(href: str) -> Optional[str]:
    """
    由 href（例：../assets/stars/POL.svg）解析為 p_e_artist/assets/stars 內實體檔案。
    若不存在則回傳 None。
    """
    if not href or href.strip().lower().startswith("data:"):
        return None
    name = os.path.basename(href.replace("\\", "/"))
    if not name:
        return None
    p = os.path.join(_package_root(), "assets", "stars", name)
    if os.path.isfile(p):
        return p
    return None


def resolve_asset_path(href: str) -> Optional[str]:
    """
    href → 實體檔案路徑。兩條路：
      1. 絕對路徑且檔案存在 → 直接用（供中宮 image 等任意圖檔）
      2. 否則退回 assets/stars 檔名解析
    皆不成立回 None。
    """
    if not href or href.strip().lower().startswith("data:"):
        return None
    p = href.replace("\\", "/")
    if os.path.isabs(p) and os.path.isfile(p):
        return os.path.normpath(p)
    return resolve_star_asset_path(href)


# 快取鍵含 ink：同一圖示不同上色（不同主題／盤別）各自快取。
_EMBED_CACHE: dict[tuple, str] = {}

# 已解析的星曜 SVG：viewBox + 根節點下子節點序列化字串（供巢狀內嵌）
_SVG_INNER_CACHE: dict[tuple, Tuple[str, str]] = {}

# 具體色值的 fill / stroke（保留 none 與 url(#...)）。
_INK_COLOR_RE = re.compile(
    r"(fill|stroke)(\s*[:=]\s*)(\"?)#[0-9a-fA-F]{3,8}(\"?)",
    flags=re.IGNORECASE,
)


def _recolor_svg_ink(markup: str, ink: str) -> str:
    """把 markup 內所有具體色值的 fill / stroke 換成 ink。

    星曜圖示皆為單色，換色後整個圖示即由主題／盤別的 star_ink 控制；
    none 與 url(#...) 不受影響。ink 為空時原樣返回。
    """
    if not ink:
        return markup
    return _INK_COLOR_RE.sub(
        lambda m: f"{m.group(1)}{m.group(2)}{m.group(3)}{ink}{m.group(4)}",
        markup,
    )


def load_star_svg_inner_for_inline(path: str, ink: str | None = None) -> Tuple[str, str]:
    """
    讀取星曜 .svg，回傳 (viewBox, 根 <svg> 內部 XML 字串)，供包進輸出圖的巢狀 <svg>。
    以文字擷取避免 ElementTree 序列化出 ns0: 前綴，提升 Illustrator 相容性。
    ink 非空時，將圖示所有具體色值換為 ink（主題／盤別上色）。
    """
    key = (path, ink)
    if key in _SVG_INNER_CACHE:
        return _SVG_INNER_CACHE[key]
    with open(path, "r", encoding="utf-8-sig") as f:
        raw = f.read()
    raw = re.sub(r"<\?xml[^>]*\?>\s*", "", raw, count=1, flags=re.IGNORECASE)
    m = re.search(
        r"<svg\b([^>]*)>(.*)</svg>\s*\Z",
        raw,
        flags=re.DOTALL | re.IGNORECASE,
    )
    if not m:
        raise ValueError(f"無法解析 SVG 根節點: {path}")
    open_attrs = m.group(1)
    inner = m.group(2)
    vb_m = re.search(
        r"\bviewBox\s*=\s*([\"'])([^\"']+)\1",
        open_attrs,
        flags=re.IGNORECASE,
    )
    if vb_m:
        vb = vb_m.group(2).strip()
    else:
        vb = "0 0 289 288.22"

    # 巢狀內嵌時，多個圖示會共處同一份輸出 SVG。Illustrator 匯出的 class
    # 一律叫 cls-1 / cls-2；SVG 的 CSS 是「全域」的，因此同名 class 會互相
    # 覆蓋（文件中最後宣告者套用到所有同名元素）——例如四化白字 (fill:#fff)
    # 會被線稿星 (fill:none;stroke) 蓋掉。故在此為每個來源檔的 class 名加上
    # 依檔名而來的唯一前綴，令各圖示樣式彼此隔離。
    inner = _namespace_svg_classes(inner, path, ink)
    inner = _recolor_svg_ink(inner, ink)

    _SVG_INNER_CACHE[key] = (vb, inner)
    return vb, inner


def _namespace_svg_classes(inner: str, path: str, ink: str | None = None) -> str:
    """把 inner 內所有 cls-N（含 <style> 選擇器與 class 屬性）加上唯一前綴，
    避免多圖示共處一份 SVG 時 CSS class 全域撞名。

    前綴同時依「檔名」與「ink」而定：同一檔案以不同顏色內嵌（例如四化紅、
    圖例近黑；或疊盤各層不同色）會產生不同 class 名，彼此不互相覆蓋。
    同一 (檔案, ink) 內嵌多次時前綴相同、規則一致，重複無害。
    """
    base = os.path.splitext(os.path.basename(path))[0]
    # 保證是合法且唯一的 CSS 識別字開頭（前置 's' 防數字開頭；非法字元換 '_'）
    prefix = "s" + re.sub(r"[^0-9A-Za-z_-]", "_", base)
    # 非 assets/stars 的外部圖檔（中宮 image 等）：檔名可能與星曜或彼此撞名，
    # 前綴再加完整路徑雜湊，確保唯一。
    stars_dir = os.path.normpath(os.path.join(_package_root(), "assets", "stars"))
    if os.path.normpath(os.path.dirname(path)) != stars_dir:
        import hashlib
        prefix += "_" + hashlib.md5(path.encode("utf-8")).hexdigest()[:4]
    if ink:
        prefix += "_" + re.sub(r"[^0-9A-Za-z]", "", ink)
    return re.sub(r"cls-\d+", lambda mm: f"{prefix}-{mm.group(0)}", inner)


def embed_as_data_uri(href: str, ink: str | None = None) -> str:
    """
    可解析為實體檔案（assets/stars 或絕對路徑）時，讀入並回傳
    data:image/...;base64,...；否則回傳原 href（保留外部連結或無法解析之情況）。
    ink 非空且為 SVG 時，先把圖示色值換為 ink 再編碼（主題／盤別上色）。
    """
    path = resolve_asset_path(href)
    if not path:
        return href
    key = (path, ink)
    if key in _EMBED_CACHE:
        return _EMBED_CACHE[key]
    with open(path, "rb") as f:
        raw = f.read()
    lower = path.lower()
    if lower.endswith(".svg"):
        mime = "image/svg+xml"
        if ink:
            raw = _recolor_svg_ink(raw.decode("utf-8-sig"), ink).encode("utf-8")
    elif lower.endswith(".png"):
        mime = "image/png"
    elif lower.endswith((".jpg", ".jpeg")):
        mime = "image/jpeg"
    elif lower.endswith(".webp"):
        mime = "image/webp"
    elif lower.endswith(".gif"):
        mime = "image/gif"
    else:
        mime = "application/octet-stream"
    b64 = base64.b64encode(raw).decode("ascii")
    out = f"data:{mime};base64,{b64}"
    _EMBED_CACHE[key] = out
    return out
