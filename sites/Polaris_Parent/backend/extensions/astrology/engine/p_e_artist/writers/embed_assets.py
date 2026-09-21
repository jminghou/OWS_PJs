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


# 內建圖示資料夾（assets/ 底下）。href 的上層目錄名在此清單內就照它找，其餘一律當星曜。
_ASSET_DIRS = ("stars", "palace")


def resolve_star_asset_path(href: str) -> Optional[str]:
    """
    由 href（例：../assets/stars/POL.svg、../assets/palace/1.svg）解析為
    p_e_artist/assets/<stars|palace> 內實體檔案。若不存在則回傳 None。
    """
    if not href or href.strip().lower().startswith("data:"):
        return None
    parts = href.replace("\\", "/").split("/")
    name = parts[-1]
    if not name:
        return None
    sub = parts[-2] if len(parts) >= 2 and parts[-2] in _ASSET_DIRS else "stars"
    p = os.path.join(_package_root(), "assets", sub, name)
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


# 白色＝鏤空色（四化徽章實心底上的反白字母），上色時保留不換。
_KNOCKOUT_COLORS = {"#fff", "#ffff", "#ffffff", "#ffffffff"}


def _recolor_svg_ink(markup: str, ink: str) -> str:
    """把 markup 內具體色值的 fill / stroke 換成 ink（白色除外）。

    星曜圖示皆為單色，換色後整個圖示即由主題／盤別的 star_ink 控制；
    none 與 url(#...) 不受影響。白色視為鏤空色原樣保留——四化徽章是
    「實心底＋白字」，連白字一起換成 ink 會與底同色而看不見字母。
    ink 為空時原樣返回。
    """
    if not ink:
        return markup

    def _sub(m):
        color = m.group(0)[m.group(0).index("#"):].rstrip('"').lower()
        if color in _KNOCKOUT_COLORS:
            return m.group(0)
        return f"{m.group(1)}{m.group(2)}{m.group(3)}{ink}{m.group(4)}"

    return _INK_COLOR_RE.sub(_sub, markup)


_FULL_FRAME = {"l": 0.0, "t": 0.0, "r": 1.0, "b": 1.0}
_ART_BOUNDS: dict | None = None


def star_art_bounds(href: str) -> dict:
    """圖示「實際圖形」佔畫框的比例 {"l","t","r","b"}（0–1）。

    畫框內有大量留白且每顆星不同，版面要貼著圖形放東西（四化徽章）時用。
    資料來自 assets/stars/_bounds.json（assets/gen_bounds.py 產生）；
    沒有對照表或查不到該圖示時回傳整個畫框，行為等同未量測。
    """
    global _ART_BOUNDS
    if _ART_BOUNDS is None:
        import json
        p = os.path.join(_package_root(), "assets", "stars", "_bounds.json")
        try:
            with open(p, "r", encoding="utf-8") as f:
                _ART_BOUNDS = json.load(f)
        except (OSError, ValueError):
            _ART_BOUNDS = {}
    code = os.path.splitext(os.path.basename((href or "").replace("\\", "/")))[0]
    return _ART_BOUNDS.get(code, _FULL_FRAME)


_VIEWBOX_CACHE: dict[str, Tuple[float, float]] = {}


def svg_viewbox(href: str, default=(260.0, 80.0)) -> Tuple[float, float]:
    """圖示畫框尺寸 (w, h)，讀自 viewBox（含快取）。

    版面要按圖示自己的比例排版時用——宮位圖有全寬 260×80 與疊盤半寬 128×68
    兩種，寫死常數等於逼呼叫端先知道拿到的是哪一種。解析不到時回 default。
    """
    path = resolve_asset_path(href)
    if not path:
        return default
    if path in _VIEWBOX_CACHE:
        return _VIEWBOX_CACHE[path]
    out = default
    try:
        with open(path, "r", encoding="utf-8-sig") as f:
            m = re.search(r"viewBox\s*=\s*(.)([^>]*?)\1", f.read(4096))
        if m:
            nums = [float(v) for v in m.group(2).replace(",", " ").split()]
            if len(nums) == 4 and nums[2] > 0 and nums[3] > 0:
                out = (nums[2], nums[3])
    except (OSError, ValueError):
        pass
    _VIEWBOX_CACHE[path] = out
    return out


_STROKE_WIDTH_RE = re.compile(r"(stroke-width\s*[:=]\s*\"?)([\d.]+)", flags=re.IGNORECASE)


def _scale_stroke_width(markup: str, scale: float) -> str:
    """把 markup 內的 stroke-width 乘上 scale（圖示縮小時補償線寬用）。"""
    return _STROKE_WIDTH_RE.sub(
        lambda m: f"{m.group(1)}{float(m.group(2)) * scale:.3g}", markup)


def load_star_svg_inner_for_inline(
    path: str, ink: str | None = None, stroke_scale: float = 1.0,
) -> Tuple[str, str]:
    """
    讀取星曜 .svg，回傳 (viewBox, 根 <svg> 內部 XML 字串)，供包進輸出圖的巢狀 <svg>。
    以文字擷取避免 ElementTree 序列化出 ns0: 前綴，提升 Illustrator 相容性。
    ink 非空時，將圖示所有具體色值換為 ink（主題／盤別上色）。
    stroke_scale ≠ 1 時，圖示內的線寬乘上該倍率（副星縮小後補回線條粗細）。
    """
    stroke_scale = round(float(stroke_scale or 1.0), 3)
    key = (path, ink, stroke_scale)
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
    # 線寬變體與 ink 同理：同一檔案以不同線寬內嵌時 class 名必須不同。
    variant = f"w{stroke_scale:g}".replace(".", "_") if stroke_scale != 1.0 else ""
    inner = _namespace_svg_classes(inner, path, ink, variant)
    inner = _recolor_svg_ink(inner, ink)
    if stroke_scale != 1.0:
        inner = _scale_stroke_width(inner, stroke_scale)

    _SVG_INNER_CACHE[key] = (vb, inner)
    return vb, inner


def _namespace_svg_classes(
    inner: str, path: str, ink: str | None = None, variant: str = "",
) -> str:
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
    if variant:
        prefix += "_" + variant
    return re.sub(r"cls-\d+", lambda mm: f"{prefix}-{mm.group(0)}", inner)


def embed_as_data_uri(href: str, ink: str | None = None,
                      stroke_scale: float = 1.0) -> str:
    """
    可解析為實體檔案（assets/stars 或絕對路徑）時，讀入並回傳
    data:image/...;base64,...；否則回傳原 href（保留外部連結或無法解析之情況）。
    ink 非空且為 SVG 時，先把圖示色值換為 ink 再編碼（主題／盤別上色）。
    """
    path = resolve_asset_path(href)
    if not path:
        return href
    stroke_scale = round(float(stroke_scale or 1.0), 3)
    key = (path, ink, stroke_scale)
    if key in _EMBED_CACHE:
        return _EMBED_CACHE[key]
    with open(path, "rb") as f:
        raw = f.read()
    lower = path.lower()
    if lower.endswith(".svg"):
        mime = "image/svg+xml"
        if ink or stroke_scale != 1.0:
            text = _recolor_svg_ink(raw.decode("utf-8-sig"), ink or "")
            if stroke_scale != 1.0:
                text = _scale_stroke_width(text, stroke_scale)
            raw = text.encode("utf-8")
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
