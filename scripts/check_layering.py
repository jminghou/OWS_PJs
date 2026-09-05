#!/usr/bin/env python3
"""
分層邊界稽核 —— 確認 Polaris 的「平台層」沒有反向依賴「領域層」。

## 為什麼需要這支腳本

P1 的目標是把 Polaris 切成兩層：

    platform/  通用能力（後台、公開頁骨架、SEO、API client）
               → P2–P4 會原封不動抽進 packages/*，供第三個站台複用
    domain/    紫微斗數（排盤、星場、命盤表單、會員命盤生命週期）
               → 永遠留在 Polaris

模組化的真正定義不是「檔案分好目錄」，而是：
**把 domain/ 整個刪掉，platform/ 仍然能編譯。**

目錄分好之後，只要有人在平台元件裡 import 一個領域模組，這個性質就悄悄沒了，
而且要等到 P3 真的去抽套件時才會發現 —— 那時已經很貴。所以把它變成 CI 規則。

## 用法

    python scripts/check_layering.py           # 稽核，違規時 exit 1
    python scripts/check_layering.py --tree    # 印出目前的分層歸屬

退出碼：0 = 邊界乾淨；1 = 平台層依賴了領域層。
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
SRC = REPO / "sites" / "Polaris_Parent" / "frontend" / "src"

# --- 領域模組（紫微斗數）：平台層不得依賴 -------------------------------------
# 以 `@/` 別名之後的路徑前綴表示。
DOMAIN_PREFIXES = (
    "components/domain/",
    "lib/api/astrology",
    "lib/api/membership",
    "lib/pendingChart",
)

# --- 平台模組：抽進 packages/* 的候選，必須自給自足 ---------------------------
PLATFORM_PREFIXES = (
    "components/platform/",
    "lib/api/",       # 領域檔案由 DOMAIN_PREFIXES 先行排除
    "lib/utils",
    "lib/constants",
    "lib/currency",
    "lib/seo",
    "lib/contentBlocks",
    "lib/articleContent",
    "lib/relatedPosts",
    "hooks/",
    "types/",
)

# app/ 底下的頁面是「組裝層」：允許同時碰平台與領域，那正是它的工作。
# 例外：相容 shim（見該檔說明），不算平台實作。
EXEMPT = {
    "components/admin/MediaBrowser.tsx",
}

IMPORT_RE = re.compile(r"""from\s+['"]@/([\w./\-]+)['"]""")
SKIP_DIRS = {"node_modules", ".next", "__pycache__"}


def iter_sources():
    for path in SRC.rglob("*"):
        if path.suffix not in (".ts", ".tsx") or not path.is_file():
            continue
        if any(part in SKIP_DIRS for part in path.parts):
            continue
        yield path


def module_of(path: Path) -> str:
    return path.relative_to(SRC).as_posix()


def layer_of(module: str) -> str:
    """回傳 'domain' / 'platform' / 'app'。領域判定優先於平台。"""
    if module in EXEMPT:
        return "exempt"
    if module.startswith(DOMAIN_PREFIXES):
        return "domain"
    if module.startswith(PLATFORM_PREFIXES):
        return "platform"
    return "app"


def is_domain_import(target: str) -> bool:
    return target.startswith(DOMAIN_PREFIXES)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tree", action="store_true", help="印出分層歸屬後結束")
    args = parser.parse_args()

    if not SRC.exists():
        print(f"找不到 {SRC}，跳過稽核。")
        return 0

    counts = {"platform": 0, "domain": 0, "app": 0, "exempt": 0}
    violations: list[str] = []

    for path in iter_sources():
        module = module_of(path)
        layer = layer_of(module)
        counts[layer] += 1

        if layer != "platform":
            continue

        text = path.read_text(encoding="utf-8", errors="replace")
        for match in IMPORT_RE.finditer(text):
            target = match.group(1)
            if is_domain_import(target):
                lineno = text[: match.start()].count("\n") + 1
                violations.append(f"{module}:{lineno}  →  @/{target}")

    if args.tree:
        for layer in ("platform", "domain", "app", "exempt"):
            print(f"\n== {layer} ==")
            for path in sorted(iter_sources(), key=module_of):
                module = module_of(path)
                if layer_of(module) == layer:
                    print(f"  {module}")
        return 0

    print("Polaris 前端分層盤點：")
    print(f"  platform  {counts['platform']:>3} 檔   ← P2–P4 抽進 packages/*")
    print(f"  domain    {counts['domain']:>3} 檔   ← 紫微斗數，留在站台")
    print(f"  app       {counts['app']:>3} 檔   ← 頁面組裝層，可同時依賴兩者")
    print(f"  exempt    {counts['exempt']:>3} 檔   ← 相容 shim\n")

    if violations:
        print(f"✗ 平台層依賴了領域層（{len(violations)} 處）：\n")
        for v in violations:
            print(f"  {v}")
        print(
            "\n平台層必須自給自足 ——「把 domain/ 刪掉，platform/ 仍可編譯」"
            "\n是模組化的驗收條件，也是第三個站台能複用的前提。"
            "\n修法：把領域內容改成由頁面傳入的 slot / prop"
            "\n（範例：components/platform/public/HomePageContent.tsx 的 domainSection）。"
        )
        return 1

    print("✓ 平台層未依賴領域層 —— domain/ 可獨立移除。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
