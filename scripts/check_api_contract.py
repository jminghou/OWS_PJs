#!/usr/bin/env python3
"""
API 契約比對 —— @ows/platform-api 打的每一個端點，後端 core 都必須真的有。

## 為什麼需要這支腳本

模組化的目標是「後端改一次，所有站台前端跟著改一次」。要成立，前端與後端之間
必須有一條**能被檢查的**接縫。在此之前那條縫只存在於人的記憶裡：後端改了路由，
前端要等到執行期 404 才會知道，而且是在某個站台的某個頁面上才發現。

這支腳本把那條縫變成 CI 規則：
  1. 從 packages/platform-api/src/*.ts 抽出所有 request('/...') 的端點字面值
  2. 建立 Flask app（不連 DB），取得 core 實際註冊的 /api/v1 路由
  3. 兩邊比對，對不上就失敗

平台套件只該打 **core** 的端點。若出現只有站台擴充才有的路由（例如 Polaris 的
/astrology/*），那代表領域邏輯漏進了平台套件 —— 一樣視為失敗。

## 用法

    python scripts/check_api_contract.py          # 比對，不符時 exit 1
    python scripts/check_api_contract.py --list   # 列出前端端點與後端路由

退出碼：0 = 契約相符；1 = 有端點對不上後端路由。
"""

from __future__ import annotations

import argparse
import os
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
PKG_SRC = REPO / "packages" / "platform-api" / "src"

API_PREFIX = "/api/v1"

# 三種呼叫寫法。注意 REQUEST_RE 只吃單/雙引號 —— 若讓它也吃反引號，
# 它會在第一個 ${ 就停住，把 `/contents/slug/${slug}` 誤判成 /contents/slug。
REQUEST_RE = re.compile(r"""request<[^>]*>\(\s*['"](/[^'"]*)['"]""")
REQUEST_TEMPLATE_RE = re.compile(r"""request<[^>]*>\(\s*`(/[^`]*)`""")
FETCH_RE = re.compile(r"""fetch\(\s*`\$\{(?:getBaseUrl\(\)|API_URL)\}(/[^`]*)`""")

# 模板字面值裡的 ${...} 換成 Flask 的參數佔位，之後統一正規化
INTERP_RE = re.compile(r"\$\{[^}]*\}")
FLASK_PARAM_RE = re.compile(r"<[^>]+>")


def normalise(path: str) -> str:
    """把前端與後端的路徑都收斂成可比對的形狀（參數一律變成 *）。"""
    path = INTERP_RE.sub("*", path)
    path = FLASK_PARAM_RE.sub("*", path)
    path = path.split("?")[0].rstrip("/")
    return path or "/"


def collect_frontend_endpoints() -> dict[str, list[str]]:
    """回傳 {正規化路徑: [來源檔案:行號, ...]}。"""
    found: dict[str, list[str]] = {}
    for file in sorted(PKG_SRC.glob("*.ts")):
        text = file.read_text(encoding="utf-8", errors="replace")
        for regex in (REQUEST_RE, REQUEST_TEMPLATE_RE, FETCH_RE):
            for match in regex.finditer(text):
                raw = match.group(1)
                lineno = text[: match.start()].count("\n") + 1
                found.setdefault(normalise(raw), []).append(
                    f"{file.relative_to(REPO).as_posix()}:{lineno}"
                )
    return found


def collect_backend_routes() -> set[str]:
    """建立 Flask app（記憶體 SQLite，不連外部服務），取 /api/v1 底下的 core 路由。"""
    os.environ.setdefault("FLASK_CONFIG", "testing")
    sys.path.insert(0, str(REPO))

    # 用 Claire 當基準：它只掛 core + media_lib，沒有任何站台擴充，
    # 所以取到的就是「純 core 契約」—— 平台套件該打的正是這一組。
    from sites.Claire_Project.backend.app import app  # noqa: E402

    routes = set()
    for rule in app.url_map.iter_rules():
        if rule.rule.startswith(API_PREFIX):
            routes.add(normalise(rule.rule[len(API_PREFIX):]))
    return routes


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--list", action="store_true", help="列出兩邊清單後結束")
    args = parser.parse_args()

    if not PKG_SRC.exists():
        print(f"找不到 {PKG_SRC.relative_to(REPO).as_posix()}，跳過比對。")
        return 0

    frontend = collect_frontend_endpoints()
    backend = collect_backend_routes()

    if args.list:
        print("== @ows/platform-api 打的端點 ==")
        for path in sorted(frontend):
            print(f"  {path}")
        print(f"\n== core 註冊的 {API_PREFIX} 路由 ==")
        for path in sorted(backend):
            print(f"  {path}")
        return 0

    missing = {p: srcs for p, srcs in frontend.items() if p not in backend}

    print(f"平台 API 契約比對：")
    print(f"  前端端點  {len(frontend):>3}（packages/platform-api）")
    print(f"  後端路由  {len(backend):>3}（core + media_lib，取自 Claire 這個純 core 站台）\n")

    if missing:
        print(f"✗ {len(missing)} 個端點在後端找不到對應路由：\n")
        for path, srcs in sorted(missing.items()):
            print(f"  {path}")
            for src in srcs:
                print(f"      ← {src}")
        print(
            "\n可能原因："
            "\n  1. core 改了路由，但平台套件沒跟上（或反之）"
            "\n  2. 領域端點漏進了平台套件 —— 平台套件只該打 core 的 API，"
            "\n     站台擴充的端點（如 /astrology/*）要留在站台的 lib/api 下"
        )
        return 1

    print("✓ 平台套件打的每個端點，後端 core 都有對應路由。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
