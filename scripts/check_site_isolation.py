#!/usr/bin/env python3
"""
站台隔離檢查 —— 共用套件與新站台的建置產物，不得含任何特定站台的字串。

## 為什麼需要這支腳本

P3 把後台抽成 @ows/admin-app 時，共用的 AdminLayout 裡留著 Polaris 的三個領域
選單（訂單審核 / 外部商品 / 折扣碼）和「親紫之間 管理後台」這個標題。P6 產生的
Demo 站台**建置通過、驗收通過**，但它的後台側邊欄會出現折扣碼、標題寫著親紫之間。

「建置能過」抓不到這種洩漏。這支腳本補上那個缺口：直接掃字串。

## 兩層檢查

  1. 原始碼層（預設）：packages/*/src 的 .ts / .tsx，**剝掉註解後**掃描。
     註解裡合理地會提到「Polaris 用後綴、Claire 用前綴」這類設計說明，不算洩漏；
     只有會進到程式碼（也就是會進到畫面）的才算。

  2. 建置層（--built <dir>）：掃 .next 產出。minify 會拿掉註解、保留字串字面值，
     所以這一層不用剝註解，而且能抓到跨套件的間接洩漏。CI 的第三站台關卡用它。

## 禁止清單

列在 FORBIDDEN 裡，每一條都要寫清楚它是哪個站台的什麼。新增站台時把它的品牌、
專屬路由、網域加進來 —— 這份清單就是「什麼東西不准進共用層」的明確定義。

## 用法

    python scripts/check_site_isolation.py                        # 原始碼層
    python scripts/check_site_isolation.py --built sites/X/frontend/.next
    python scripts/check_site_isolation.py --list                 # 印出禁止清單

退出碼：0 = 乾淨；1 = 發現洩漏。
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
PACKAGES = REPO / "packages"

# (字串, 說明)。說明要講清楚「這是誰的、什麼」—— 清單本身就是文件。
FORBIDDEN: list[tuple[str, str]] = [
    # ── Polaris_Parent ──────────────────────────────────────────────────
    ("親紫",                    "Polaris 品牌（親紫之間）"),
    ("polaris-parent.com",      "Polaris 網域"),
    ("折扣碼",                  "Polaris membership 擴充的後台頁面標籤"),
    ("訂單審核",                "Polaris membership 擴充的後台頁面標籤"),
    ("外部商品",                "Polaris membership 擴充的後台頁面標籤"),
    ("/admin/coupons",          "Polaris membership 擴充的路由"),
    ("/admin/order-reviews",    "Polaris membership 擴充的路由"),
    ("/admin/product-types",    "Polaris membership 擴充的路由"),
    ("/api/v1/astrology",       "Polaris 紫微擴充的 API 前綴"),
    ("/api/v1/membership",      "Polaris membership 擴充的 API 前綴"),
    # ── Claire_Project ──────────────────────────────────────────────────
    ("clairelab.tw",            "Claire 網域"),
    ("Claire Project",          "Claire 站名"),
]

# 這幾個套件是刻意的站台專屬／凍結層，不受此檢查約束：
#   ui           凍結，只服務 Claire（docs/FROZEN_CONTRACT.md）
#   ziwei-chart  紫微斗數的互動命盤，本來就是 Polaris 領域
EXEMPT_PACKAGES = {"ui", "ziwei-chart"}

SKIP_DIRS = {"node_modules", ".next", "__pycache__", "dist", "cache"}

# 剝註解：// 到行尾、/* … */ 區塊。夠用；建置層檢查是後盾。
_LINE_COMMENT = re.compile(r"(?m)^\s*//.*$|(?<=[\s;{}])//(?!/).*$")
_BLOCK_COMMENT = re.compile(r"/\*.*?\*/", re.S)


def strip_comments(text: str) -> str:
    text = _BLOCK_COMMENT.sub(lambda m: "\n" * m.group(0).count("\n"), text)
    return _LINE_COMMENT.sub("", text)


def scan_text(text: str, where: str, hits: list[str]) -> None:
    for needle, why in FORBIDDEN:
        start = 0
        while True:
            idx = text.find(needle, start)
            if idx == -1:
                break
            lineno = text.count("\n", 0, idx) + 1
            hits.append(f"{where}:{lineno}  「{needle}」—— {why}")
            start = idx + len(needle)


def scan_sources() -> list[str]:
    hits: list[str] = []
    for pkg in sorted(PACKAGES.iterdir()):
        if not pkg.is_dir() or pkg.name in EXEMPT_PACKAGES:
            continue
        src = pkg / "src"
        if not src.exists():
            continue
        for path in src.rglob("*"):
            if path.suffix not in (".ts", ".tsx") or not path.is_file():
                continue
            if any(part in SKIP_DIRS for part in path.parts):
                continue
            text = strip_comments(path.read_text(encoding="utf-8", errors="replace"))
            scan_text(text, path.relative_to(REPO).as_posix(), hits)
    return hits


def scan_built(root: Path) -> list[str]:
    """掃建置產物。只看會送到瀏覽器或用來渲染的檔案。"""
    hits: list[str] = []
    if not root.exists():
        return [f"{root} 不存在 —— 先建置再檢查"]
    for path in root.rglob("*"):
        if not path.is_file() or path.suffix not in (".js", ".html", ".json", ".rsc", ".body"):
            continue
        if "cache" in path.parts:
            continue
        try:
            text = path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        scan_text(text, path.relative_to(REPO).as_posix() if path.is_relative_to(REPO) else str(path), hits)
    return hits


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--built", type=Path, help="掃這個 .next 目錄（建置層）")
    ap.add_argument("--list", action="store_true", help="印出禁止清單後結束")
    args = ap.parse_args()

    if args.list:
        print("共用層禁止出現的站台專屬字串：")
        for needle, why in FORBIDDEN:
            print(f"  {needle:26} {why}")
        print(f"\n豁免的套件：{', '.join(sorted(EXEMPT_PACKAGES))}")
        return 0

    if args.built:
        target = args.built if args.built.is_absolute() else REPO / args.built
        print(f"建置層檢查：{target.relative_to(REPO) if target.is_relative_to(REPO) else target}")
        hits = scan_built(target)
    else:
        scanned = [p.name for p in sorted(PACKAGES.iterdir()) if p.is_dir() and p.name not in EXEMPT_PACKAGES]
        print(f"原始碼層檢查：packages/{{{', '.join(scanned)}}}/src（已剝註解）")
        hits = scan_sources()

    if hits:
        print(f"\n✗ 發現 {len(hits)} 處站台專屬字串洩漏到共用層：\n")
        for h in hits:
            print(f"    {h}")
        print(
            "\n共用層不該知道任何一個站台是誰。修法：\n"
            "  - 品牌／站名 → configureAdminApp / configureSiteKit 注入\n"
            "  - 站台專屬頁面與選單 → 站台的 extraNav\n"
            "  - 站台專屬 API → 留在站台的 lib/api，不進 @ows/platform-api"
        )
        return 1

    print("✓ 乾淨 —— 共用層不含任何站台專屬字串。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
