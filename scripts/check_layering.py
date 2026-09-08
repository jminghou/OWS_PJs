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
import posixpath
import re
import sys
from pathlib import Path, PurePosixPath

REPO = Path(__file__).resolve().parent.parent
SRC = REPO / "sites" / "Polaris_Parent" / "frontend" / "src"

# --- 領域模組（紫微斗數）：平台層不得依賴 -------------------------------------
# 以 `@/` 別名之後的路徑前綴表示。
DOMAIN_PREFIXES = (
    "components/domain/",
    "lib/api/astrology",
    "lib/api/membership",
    # 打的是 membership 擴充的 /admin/order-submissions、/admin/product-types、
    # /admin/coupon-configs —— 站台擴充的端點，不是 core 契約。
    "lib/api/admin-commerce",
    "lib/pendingChart",
)

# 領域套件：平台檔案不得 import。紫微的站台層自 P-ziwei 起住在 packages/ziwei-app，
# 「刪掉 domain/ 仍可編譯」這條驗收現在等價於「平台層不依賴這些套件」。
DOMAIN_PACKAGES = ("@ows/ziwei-app", "@ows/ziwei-chart")

# --- 平台模組：抽進 packages/* 的候選，必須自給自足 ---------------------------
PLATFORM_PREFIXES = (
    "components/platform/",
    "lib/api/",       # 領域檔案由 DOMAIN_PREFIXES 先行排除
    "lib/utils",
    "lib/constants",
    "lib/currency",
    "lib/seo",
    "lib/relatedPosts",
    "hooks/",
    "types/",
)

# app/ 底下的頁面是「組裝層」：允許同時碰平台與領域，那正是它的工作。
# 例外：相容 shim（見該檔說明），不算平台實作。
# barrel 轉出的領域符號。
#
# lib/api/index.ts 是組裝層（見 EXEMPT），平台檔案可以 import 它 —— 但只能拿
# 平台的東西。實測 SaveArticleButton 就是這樣繞過稽核的：它是平台元件，
# 卻從 barrel 拿了 membershipApi。只看 import 路徑會漏掉這類違規，要看符號。
DOMAIN_SYMBOLS = {
    "astrologyApi",
    "membershipApi",
    "adminCommerceApi",
}

API_BARREL = "lib/api"

EXEMPT = {
    "components/admin/MediaBrowser.tsx",
    # API barrel：平台與領域的組裝點，等同 app/ 下的頁面。
    # 它本來就該同時引用兩層，見該檔案開頭的說明。
    "lib/api/index.ts",
}

IMPORT_RE = re.compile(r"""from\s+['"]@/([\w./\-]+)['"]""")
PKG_IMPORT_RE = re.compile(r"""from\s+['"](@ows/[\w\-]+)(?:/[\w./\-]*)?['"]""")
# 相對 import 也要看 —— lib/api 內部用的是 './astrology' 這種寫法，
# 只掃 @/ 別名會漏掉同目錄內的平台→領域依賴。
REL_IMPORT_RE = re.compile(r"""from\s+['"](\.{1,2}/[\w./\-]+)['"]""")
# 具名匯入的符號清單，用來檢查「從 barrel 拿了什麼」。
NAMED_IMPORT_RE = re.compile(
    r"""import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+['"]@/(lib/api)['"]""", re.S
)
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


def resolve_relative(module: str, target: str) -> str:
    """把 './astrology' 之類的相對 import 解析成 src 底下的模組路徑。

    一律用 posixpath.normpath —— os.path.normpath 在 Windows 會回傳反斜線路徑，
    前綴比對就會全部失效（而且是靜默失效，稽核照樣印綠燈）。
    """
    base = PurePosixPath(module).parent
    return posixpath.normpath(str(base / target))


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

        for match in PKG_IMPORT_RE.finditer(text):
            if match.group(1) in DOMAIN_PACKAGES:
                lineno = text[: match.start()].count("\n") + 1
                violations.append(f"{module}:{lineno}  →  {match.group(1)}（領域套件）")

        for match in NAMED_IMPORT_RE.finditer(text):
            names = {n.strip().split(" as ")[0].strip() for n in match.group(1).split(",")}
            for name in sorted(names & DOMAIN_SYMBOLS):
                lineno = text[: match.start()].count("\n") + 1
                violations.append(
                    f"{module}:{lineno}  →  {name}（經 @/{API_BARREL} 取得的領域 API）"
                )

        for match in REL_IMPORT_RE.finditer(text):
            resolved = resolve_relative(module, match.group(1))
            if is_domain_import(resolved):
                lineno = text[: match.start()].count("\n") + 1
                violations.append(
                    f"{module}:{lineno}  →  {match.group(1)}  （解析為 {resolved}）"
                )

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
