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


_EMBED_CACHE: dict[str, str] = {}

# 已解析的星曜 SVG：viewBox + 根節點下子節點序列化字串（供巢狀內嵌）
_SVG_INNER_CACHE: dict[str, Tuple[str, str]] = {}


def load_star_svg_inner_for_inline(path: str) -> Tuple[str, str]:
    """
    讀取星曜 .svg，回傳 (viewBox, 根 <svg> 內部 XML 字串)，供包進輸出圖的巢狀 <svg>。
    以文字擷取避免 ElementTree 序列化出 ns0: 前綴，提升 Illustrator 相容性。
    """
    if path in _SVG_INNER_CACHE:
        return _SVG_INNER_CACHE[path]
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
    _SVG_INNER_CACHE[path] = (vb, inner)
    return vb, inner


def embed_as_data_uri(href: str) -> str:
    """
    可解析為 assets/stars 下檔案時，讀入並回傳 data:image/...;base64,...；
    否則回傳原 href（保留外部連結或無法解析之情況）。
    """
    path = resolve_star_asset_path(href)
    if not path:
        return href
    if path in _EMBED_CACHE:
        return _EMBED_CACHE[path]
    with open(path, "rb") as f:
        raw = f.read()
    lower = path.lower()
    if lower.endswith(".svg"):
        mime = "image/svg+xml"
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
    _EMBED_CACHE[path] = out
    return out
