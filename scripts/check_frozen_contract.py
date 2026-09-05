#!/usr/bin/env python3
"""
凍結契約稽核 —— 確認 Claire_Project 沒有長出 docs/FROZEN_CONTRACT.md 未記載的共用層依賴。

平台模組化以 Polaris 為母體進行，Claire 維持現狀。安全邊界靠這份可稽核清單，
而不是靠重構時「小心一點」。任何讓 Claire 綁到更多共用碼上的改動都會被這裡擋下。

用法：
    python scripts/check_frozen_contract.py          # 稽核，違規時 exit 1
    python scripts/check_frozen_contract.py --list   # 列出目前實際的依賴面

退出碼：0 = 契約相符；1 = 發現未記載的依賴（或記載的依賴消失了）。
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
CLAIRE = REPO / "sites" / "Claire_Project"
CONTRACT = REPO / "docs" / "FROZEN_CONTRACT.md"

# --- A 節：允許的 Python 匯入來源（模組路徑前綴 → 允許匯入的名稱）-----------------
# 值為 None 表示該模組下的任何名稱都允許（目前不使用，保留給未來放寬）。
ALLOWED_PY = {
    "core.backend_engine.factory": {"create_app", "BlueprintConfig", "db"},
    "core.backend_engine.models": {"User"},
    "packages.media_lib": {"register_media_lib"},
}

# --- B 節：允許的 TypeScript 共用模組（相對 packages/ 的路徑，不含副檔名）--------
ALLOWED_TS = {
    "ui/src/admin",
    "ui/src/admin/DropZone",
    "ui/src/admin/NotionTitleInput",
    "ui/src/admin/SimpleTextEditor",
    "ui/src/admin/UploadProgress",
    "ui/src/editor/TiptapEditor",
    "ui/src/hooks",
    "ui/src/lib/constants",
    "ui/src/lib/currency",
    "ui/src/lib/utils",
    "ui/src/types",
    "ui/src/ui/Button",
    "ui/src/ui/Card",
    "ui/src/ui/CollapsibleSection",
    "ui/src/ui/Input",
    "ui/src/ui/Popover",
}

SKIP_DIRS = {"__pycache__", "node_modules", ".next", ".git", "venv", ".venv", "logs", "uploads"}

PY_IMPORT_RE = re.compile(
    r"^\s*from\s+((?:core|packages)[\w.]*)\s+import\s+(.+?)(?:\s*#.*)?$", re.MULTILINE
)
PY_PLAIN_IMPORT_RE = re.compile(r"^\s*import\s+((?:core|packages)[\w.]*)", re.MULTILINE)
# 兩種形式：相對路徑 ../../../packages/ui/src/... 或 bare specifier @ows/ui
TS_REL_RE = re.compile(r"""['"](?:\.\./)+packages/([\w./\-]+?)['"]""")
TS_BARE_RE = re.compile(r"""['"](@ows/[\w./\-]+)['"]""")


def iter_files(root: Path, suffixes: tuple[str, ...]):
    for path in root.rglob("*"):
        if not path.is_file() or path.suffix not in suffixes:
            continue
        if any(part in SKIP_DIRS for part in path.parts):
            continue
        yield path


def rel(path: Path) -> str:
    try:
        return path.relative_to(REPO).as_posix()
    except ValueError:
        return path.as_posix()


def scan_python() -> list[tuple[str, int, str, str]]:
    """回傳 (檔案, 行號, 模組, 名稱) 的清單。"""
    found = []
    for path in iter_files(CLAIRE, (".py",)):
        text = path.read_text(encoding="utf-8", errors="replace")
        lines = text.splitlines()

        for match in PY_IMPORT_RE.finditer(text):
            module, names = match.group(1), match.group(2)
            lineno = text[: match.start()].count("\n") + 1
            for name in re.split(r"\s*,\s*", names.strip().strip("()")):
                name = name.split(" as ")[0].strip()
                if name:
                    found.append((rel(path), lineno, module, name))

        for match in PY_PLAIN_IMPORT_RE.finditer(text):
            lineno = text[: match.start()].count("\n") + 1
            # 排除已被 from-import 規則涵蓋的行
            if lineno <= len(lines) and lines[lineno - 1].lstrip().startswith("from "):
                continue
            found.append((rel(path), lineno, match.group(1), "<module>"))

    return found


def scan_typescript() -> list[tuple[str, int, str]]:
    """回傳 (檔案, 行號, 模組) 的清單。"""
    found = []
    for path in iter_files(CLAIRE / "frontend" / "src", (".ts", ".tsx")):
        text = path.read_text(encoding="utf-8", errors="replace")
        for regex in (TS_REL_RE, TS_BARE_RE):
            for match in regex.finditer(text):
                lineno = text[: match.start()].count("\n") + 1
                found.append((rel(path), lineno, match.group(1)))
    return found


def normalise_ts(module: str) -> str:
    """把 @ows/ui 與相對路徑統一成契約清單的表示法。"""
    if module.startswith("@ows/"):
        rest = module[len("@ows/") :]
        head, _, tail = rest.partition("/")
        return f"{head}/src/{tail}" if tail else f"{head}/src"
    return module.rstrip("/")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--list", action="store_true", help="列出實際依賴面後結束")
    args = parser.parse_args()

    if not CLAIRE.exists():
        print(f"找不到 {rel(CLAIRE)}，跳過稽核。")
        return 0

    py_hits = scan_python()
    ts_hits = scan_typescript()

    if args.list:
        print("== Claire → 共用層（Python）==")
        for file, line, module, name in sorted(set(py_hits)):
            print(f"  {file}:{line}  {module}.{name}")
        print("\n== Claire → 共用層（TypeScript）==")
        for module in sorted({normalise_ts(m) for _, _, m in ts_hits}):
            print(f"  packages/{module}")
        return 0

    violations: list[str] = []

    for file, line, module, name in py_hits:
        allowed = ALLOWED_PY.get(module)
        if allowed is None:
            violations.append(
                f"{file}:{line}  Python 模組不在契約內：{module}（匯入 {name}）"
            )
        elif name != "<module>" and name not in allowed:
            violations.append(
                f"{file}:{line}  Python 名稱不在契約內：{module}.{name}"
            )

    for file, line, module in ts_hits:
        norm = normalise_ts(module)
        if norm not in ALLOWED_TS:
            violations.append(f"{file}:{line}  TS 模組不在契約內：packages/{norm}")

    # 反向檢查：契約列了但實際已不存在 → 契約過期，應該收斂
    actual_py = {(m, n) for _, _, m, n in py_hits}
    stale_py = [
        f"{module}.{name}"
        for module, names in ALLOWED_PY.items()
        for name in names
        if (module, name) not in actual_py
    ]
    actual_ts = {normalise_ts(m) for _, _, m in ts_hits}
    stale_ts = sorted(ALLOWED_TS - actual_ts)

    print(f"稽核對象：{rel(CLAIRE)}")
    print(f"  Python 共用層引用：{len(py_hits)} 處")
    print(f"  TypeScript 共用層引用：{len(ts_hits)} 處\n")

    if stale_py or stale_ts:
        print("提示：契約記載但實際已無人使用（可考慮從契約移除，縮小凍結面）：")
        for item in stale_py + [f"packages/{m}" for m in stale_ts]:
            print(f"  - {item}")
        print()

    if violations:
        print(f"✗ 發現 {len(violations)} 項未記載的依賴：\n")
        for v in violations:
            print(f"  {v}")
        print(
            f"\nClaire 不應長出新的共用層依賴。若這是刻意的，請同步更新："
            f"\n  {rel(CONTRACT)}\n  {rel(Path(__file__))} 的 ALLOWED_PY / ALLOWED_TS"
        )
        return 1

    print("✓ 凍結契約相符 —— Claire 的依賴面未擴大。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
