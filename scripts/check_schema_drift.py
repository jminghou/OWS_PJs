#!/usr/bin/env python3
"""
Schema 漂移偵測 —— 各站的 migration 鏈，跑完之後跟 models 對得上嗎？

## 為什麼需要這支腳本

兩個站台各有一條 migration 鏈，但它們不是同一條鏈的不同進度，而是**兩套不同的
實體設計**：

  Claire   0001_baseline_schema  —— 用 db.metadata.create_all()「照 models 建」
  Polaris  0001_phase2_identity  —— 手寫 DDL，schema 寫死 'blog'，
                                    users/roles 等交給紫微系統，media_lib 完全沒提

Claire 那條特別危險：`create_all()` 跟著 models 走，所以**新裝的庫拿到最新 schema、
線上的庫停在當初那版，而 alembic 認為兩者都在 0001_baseline_schema**。版本號一樣、
schema 不一樣，沒有任何工具會發現，差距隨每次改 models 擴大。

這支腳本用 alembic 自己的 `compare_metadata()`：起一個乾淨的資料庫、跑完該站的
migration 鏈、把結果跟 core/models.py 的 metadata 對比，把差異列出來。

**它不碰任何線上資料庫**，只在本機建暫時的庫，跑完就刪。

## 前置

本機要有 Postgres。連線資訊由 --dsn 或環境變數 DRIFT_DSN 指定，預設
postgresql://postgres:postgres@127.0.0.1:5432/postgres。

## 用法

    python scripts/check_schema_drift.py                    # 兩站都檢查
    python scripts/check_schema_drift.py --site Polaris_Parent
    python scripts/check_schema_drift.py --keep             # 保留暫時庫供人工檢查
    python scripts/check_schema_drift.py --dump-dir out/    # 另存 schema 快照

退出碼：0 = 沒有偵測到漂移；1 = 有差異（或 migration 鏈跑不起來）。
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
import uuid
from contextlib import contextmanager
from importlib import import_module
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO))

DEFAULT_DSN = os.environ.get(
    "DRIFT_DSN", "postgresql://postgres:postgres@127.0.0.1:5432/postgres"
)

# 各站跑 migration 需要的環境變數與前置條件。
#
# Polaris 的鏈有**未載明的前置條件**：它硬 FK 指向 account.app_users
# （紫微系統擁有的表），也不自己建 blog / shop schema。線上庫剛好都有，
# 所以一直沒人發現這條鏈其實無法在空庫上跑。這裡把前置補上，
# 讓「從零重建」這件事第一次真的被驗證。
# ignore：**刻意**不歸該站 alembic 管的表。列在這裡不是為了讓報告好看，
# 而是為了讓「真正的漂移」不被已知的架構決定淹沒 —— 每一條都要寫清楚原因。
SITES = {
    "Claire_Project": {
        # Claire 在模組化期間凍結（docs/FROZEN_CONTRACT.md），沒有遷移到共用的
        # core 鏈 —— 它維持原本「一條鏈建全部」的做法。
        "chains": ["sites/Claire_Project/backend/migrations"],
        "env": {"COMMERCE_ENABLED": "true"},
        "prelude": [],
        "ignore": set(),
    },
    "Polaris_Parent": {
        # P5-C 起分成兩條鏈：平台表走共用的 core 鏈，站台擴充表走自己的鏈。
        # 順序不能反 —— 站台的 FK 指向平台表。
        "chains": ["core/migrations", "packages/commerce/migrations", "sites/Polaris_Parent/backend/migrations"],
        "env": {
            "COMMERCE_ENABLED": "true",
            "OWS_BLOG_SCHEMA": "blog",
            "OWS_SHOP_SCHEMA": "shop",
            "OWS_IDENTITY_MODE": "external",
            # 對應 env.py 的 _BLOG_UNMANAGED_TABLES：這些由站台 SQL 自管。
            "OWS_CORE_UNMANAGED_TABLES":
                "users,roles,permissions,role_permissions,user_roles,member_profiles",
        },
        "prelude": [
            "CREATE SCHEMA IF NOT EXISTS blog",
            "CREATE SCHEMA IF NOT EXISTS shop",
            # account.app_users 由紫微系統擁有，本 repo 的 migration 只參照不建立。
            # 這裡建一個結構等價的替身，讓跨 schema FK 能成立。
            "CREATE SCHEMA IF NOT EXISTS account",
            """CREATE TABLE IF NOT EXISTS account.app_users (
                   id BIGSERIAL PRIMARY KEY,
                   username TEXT NOT NULL,
                   password_hash TEXT NOT NULL,
                   display_name TEXT,
                   role TEXT NOT NULL,
                   is_active BOOLEAN NOT NULL DEFAULT TRUE,
                   permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
                   allowed_collectors JSONB NOT NULL DEFAULT '[]'::jsonb,
                   created_at TIMESTAMPTZ DEFAULT now(),
                   updated_at TIMESTAMPTZ DEFAULT now()
               )""",
        ],
        # 對應 migrations/env.py 的 _BLOG_UNMANAGED_TABLES。
        # 第二期起 blog.users 是指向 account.app_users 的 view、RBAC 四表淘汰
        # （權限走紫微系統的 app_users.permissions JSONB）、member_profiles 由
        # init_member_profiles.sql 自管。這些由 SQL 建立，不歸 alembic。
        "ignore": {
            "blog.users", "blog.roles", "blog.permissions",
            "blog.role_permissions", "blog.user_roles", "blog.member_profiles",
            # 紫微系統擁有的身分表；本 repo 只參照不建立。
            "account.app_users",
        },
    },
}

# 所有站台都要忽略的：alembic 自己的版本表不是應用 schema。
GLOBAL_IGNORE = {
    "alembic_version", "blog.alembic_version", "public.alembic_version",
    "alembic_version_core", "blog.alembic_version_core",
    "alembic_version_commerce", "blog.alembic_version_commerce", "shop.alembic_version_commerce",
}


def discover_sites() -> dict:
    """把 SITES 沒列出的站台自動補上預設設定。

    產生器（scripts/create_site.py）開出來的站台開箱就要被漂移偵測納管 ——
    否則新站台會是唯一沒人檢查的那個，而它恰好是最需要檢查的（沒有歷史包袱，
    任何漂移都是現在犯的）。預設值就是產生器的預設：兩條鏈、public schema、
    無前置條件、無忽略項。
    """
    found = dict(SITES)
    sites_dir = REPO / "sites"
    if not sites_dir.exists():
        return found
    for path in sorted(sites_dir.iterdir()):
        if not path.is_dir() or path.name in found:
            continue
        if not (path / "backend" / "migrations").is_dir():
            continue
        found[path.name] = {
            "chains": ["core/migrations", f"sites/{path.name}/backend/migrations"],
            "env": {"COMMERCE_ENABLED": "false"},   # 產生器的預設
            "prelude": [],
            "ignore": set(),
        }
    return found


def _connect(dsn: str):
    try:
        import psycopg  # noqa: F401

        import psycopg as driver
    except ImportError:  # pragma: no cover
        import psycopg2 as driver
    conn = driver.connect(dsn)
    conn.autocommit = True
    return conn


@contextmanager
def temp_database(dsn: str, keep: bool):
    """建一個乾淨的暫時資料庫，用完刪掉。"""
    name = f"ows_drift_{uuid.uuid4().hex[:10]}"
    admin = _connect(dsn)
    with admin.cursor() as cur:
        cur.execute(f'CREATE DATABASE "{name}"')
    admin.close()

    target = dsn.rsplit("/", 1)[0] + "/" + name
    try:
        yield name, target
    finally:
        if keep:
            print(f"    （--keep：保留暫時庫 {name}）")
        else:
            admin = _connect(dsn)
            with admin.cursor() as cur:
                cur.execute(
                    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity "
                    "WHERE datname = %s AND pid <> pg_backend_pid()",
                    (name,),
                )
                cur.execute(f'DROP DATABASE IF EXISTS "{name}"')
            admin.close()


def run_prelude(target_dsn: str, statements: list[str]) -> None:
    conn = _connect(target_dsn)
    with conn.cursor() as cur:
        for sql in statements:
            cur.execute(sql)
    conn.close()


def run_worker(site: str, target_dsn: str, extra_env: dict, ignore: set, chains: list) -> tuple[bool, str]:
    """在子行程裡跑 migration 並比對。

    為什麼要子行程、而且不經過站台的 app.py：

      1. 站台 config 會 load_dotenv 自己的 .env，而 Claire 還帶 override=True ——
         也就是 .env 會**蓋掉**我們指定的 DATABASE_URL，migration 會跑到真正的
         開發庫上（第一版就是這樣，alembic 回報成功卻建了 0 張表，因為它連到
         早已是 head 的另一個庫）。順帶一提，Polaris 沒有 override=True，
         兩站對環境變數的優先順序相反，這件事本身值得修。

      2. core/models.py 是在 **import 當下**讀 OWS_BLOG_SCHEMA 決定 __table_args__，
         同一個行程裡先後檢查兩個站台會拿到污染的 metadata。

    所以每個站台一個乾淨行程，直接用自己建的 Flask app 驅動 flask-migrate。
    """
    env = os.environ.copy()
    env.update(extra_env)
    env["PYTHONPATH"] = str(REPO)
    env["PYTHONIOENCODING"] = "utf-8"
    env["OWS_DRIFT_TARGET"] = target_dsn.replace(
        "postgresql://", "postgresql+psycopg://", 1
    )
    env["OWS_DRIFT_SITE"] = site
    env["OWS_DRIFT_IGNORE"] = "|".join(sorted(ignore))
    env["OWS_DRIFT_CHAINS"] = "|".join(chains)

    result = subprocess.run(
        [sys.executable, str(Path(__file__).resolve()), "--_worker"],
        cwd=REPO, env=env, capture_output=True, text=True, encoding="utf-8",
    )
    return result.returncode == 0, (result.stdout or "") + (result.stderr or "")


def worker_main() -> int:
    """子行程本體：建 app → upgrade → compare_metadata。"""
    site = os.environ["OWS_DRIFT_SITE"]
    target = os.environ["OWS_DRIFT_TARGET"]

    from flask import Flask
    from flask_migrate import Migrate, upgrade
    from alembic.autogenerate import compare_metadata
    from alembic.migration import MigrationContext
    from sqlalchemy import create_engine

    from core.backend_engine.factory import db
    import core.backend_engine.models  # noqa: F401  註冊 core models
    import packages.media_lib.models   # noqa: F401  註冊媒體庫 models
    # 電商是選用模組：跟 factory 同一條規則（預設掛載，明確 false 才不掛）。
    # 不掛就不 import —— 它的表不在 metadata，比對時自然不會被要求存在。
    if (os.environ.get("COMMERCE_ENABLED") or "true").strip().lower() not in ("0", "false", "no", "off"):
        import packages.commerce.models  # noqa: F401
    # 站台專屬 models（有才匯入）
    try:
        import_module(f"sites.{site}.backend.models")
    except ModuleNotFoundError:
        pass

    app = Flask(__name__)
    app.config["SQLALCHEMY_DATABASE_URI"] = target
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    db.init_app(app)

    print(f"MODELS_REGISTERED={len(db.metadata.tables)}")

    # 依序跑每一條鏈。順序有意義：平台鏈先建表，站台鏈的 FK 才指得到。
    chains = os.environ["OWS_DRIFT_CHAINS"].split("|")
    for chain in chains:
        print(f"CHAIN={chain}")
        Migrate(app, db, directory=str(REPO / chain))
        with app.app_context():
            upgrade()

    owned = {v for v in (os.environ.get("OWS_BLOG_SCHEMA"),
                         os.environ.get("OWS_SHOP_SCHEMA")) if v}
    allowed = owned | {"media_lib", "public"}

    engine = create_engine(target)
    with engine.connect() as conn:
        ctx = MigrationContext.configure(
            conn,
            opts={
                "include_schemas": True,
                # 只比對本站擁有的 schema；account 是紫微系統的，不該進來。
                "include_name": lambda name, type_, parents: (
                    (name or "public") in allowed if type_ == "schema" else True
                ),
            },
        )
        diffs = compare_metadata(ctx, db.metadata)
    engine.dispose()

    ignore = set(os.environ.get("OWS_DRIFT_IGNORE", "").split("|")) - {""}

    kept, skipped = [], 0
    for d in diffs:
        text = describe(d)
        if any(name in text for name in ignore):
            skipped += 1
            continue
        kept.append(text)

    print("DIFF_IGNORED=%d" % skipped)
    print("DIFF_COUNT=%d" % len(kept))
    for text in kept:
        print("DIFF|" + text)
    return 0


def describe(diff) -> str:
    """把 alembic 的 diff tuple 轉成人看得懂的一行。"""
    if isinstance(diff, list):
        return "; ".join(describe(d) for d in diff)
    kind = diff[0]
    if kind == "add_table":
        t = diff[1]
        return f"models 有、DB 沒有的表：{t.schema or 'public'}.{t.name}"
    if kind == "remove_table":
        t = diff[1]
        return f"DB 有、models 沒有的表：{t.schema or 'public'}.{t.name}"
    if kind == "add_column":
        _, schema, table, col = diff
        return f"models 有、DB 沒有的欄位：{schema or 'public'}.{table}.{col.name}"
    if kind == "remove_column":
        _, schema, table, col = diff
        return f"DB 有、models 沒有的欄位：{schema or 'public'}.{table}.{col.name}"
    if kind in ("add_index", "remove_index", "add_constraint", "remove_constraint"):
        obj = diff[1]
        # 帶上所屬的表 —— 沒有表名，ignore 清單就過濾不掉「已忽略的表」身上的索引，
        # 那些索引會以雜訊的形式留在報告裡，把真正的漂移淹掉。
        table = getattr(obj, "table", None)
        where = f"{table.schema or 'public'}.{table.name}" if table is not None else "?"
        verb = "models 有、DB 沒有的" if kind.startswith("add") else "DB 有、models 沒有的"
        what = "索引" if "index" in kind else "約束"
        return f"{verb}{what}：{where} 的 {getattr(obj, 'name', obj)}"
    if kind == "modify_nullable":
        _, schema, table, col, _, old, new = diff
        return f"nullable 不同：{schema or 'public'}.{table}.{col} {old} → {new}"
    if kind == "modify_type":
        _, schema, table, col, _, old, new = diff
        return f"型別不同：{schema or 'public'}.{table}.{col} {old} → {new}"
    return str(diff)


def check_site(site: str, dsn: str, keep: bool, dump_dir: Path | None,
               registry: dict) -> bool:
    spec = registry[site]
    print(f"\n{'═' * 62}")
    print(f"  {site}")
    print(f"{'═' * 62}")

    with temp_database(dsn, keep) as (name, target):
        print(f"  暫時資料庫：{name}")

        if spec["prelude"]:
            print(f"  前置條件：{len(spec['prelude'])} 條 SQL"
                  f"（此鏈無法在完全空的庫上跑，見腳本說明）")
            run_prelude(target, spec["prelude"])

        print(f"  跑 {len(spec['chains'])} 條 migration 鏈並比對 models …")
        for c in spec["chains"]:
            print(f"      {c}")
        ignore = spec["ignore"] | GLOBAL_IGNORE
        ok, output = run_worker(site, target, spec["env"], ignore, spec["chains"])

        registered = next(
            (l.split("=", 1)[1] for l in output.splitlines()
             if l.startswith("MODELS_REGISTERED=")), None
        )
        if registered:
            print(f"  models 註冊了 {registered} 張表")
            if registered == "0":
                print("  ⚠ metadata 是空的 —— 用 create_all() 的 baseline 會靜默建 0 張表")

        if not ok:
            print("\n  ✗ migration 鏈跑不起來：\n")
            # 只印關鍵行：Python traceback 對這件事沒有診斷價值，
            # 有價值的是「哪個 SQL、什麼資料庫錯誤」。
            interesting = [
                l.strip() for l in output.splitlines()
                if l.strip().startswith(("sqlalchemy.exc.", "psycopg.", "[SQL:", "alembic.util"))
                or "Running upgrade" in l
            ]
            for line in (interesting or output.strip().splitlines()[-12:]):
                print(f"      {line}")
            return False
        print("  ✓ migration 鏈跑完")

        ignored = next((l.split("=", 1)[1] for l in output.splitlines()
                        if l.startswith("DIFF_IGNORED=")), "0")
        if ignored != "0":
            print(f"  （略過 {ignored} 項刻意不歸 alembic 管的差異，見 SITES[...]['ignore']）")

        diffs = [l[len("DIFF|"):] for l in output.splitlines() if l.startswith("DIFF|")]

        if dump_dir:
            dump_dir.mkdir(parents=True, exist_ok=True)
            out = dump_dir / f"{site}.schema.sql"
            r = subprocess.run(
                ["pg_dump", "--schema-only", "--no-owner", "--no-privileges", target],
                capture_output=True, text=True,
            )
            if r.returncode == 0:
                out.write_text(r.stdout, encoding="utf-8")
                print(f"  schema 快照 → {out.relative_to(REPO) if out.is_relative_to(REPO) else out}")
            else:
                print(f"  （pg_dump 不可用，略過快照：{r.stderr.strip()[:60]}）")

    if not diffs:
        print("\n  ✓ 沒有漂移 —— migration 鏈跑完的 schema 與 models 一致")
        return True

    print(f"\n  ✗ 偵測到 {len(diffs)} 項差異：\n")
    for d in diffs:
        print(f"      {d}")
    return False


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--site", help="只檢查單一站台")
    parser.add_argument("--dsn", default=DEFAULT_DSN, help="Postgres 連線字串（管理用）")
    parser.add_argument("--keep", action="store_true", help="保留暫時資料庫")
    parser.add_argument("--dump-dir", type=Path, help="輸出 schema 快照的目錄")
    parser.add_argument("--_worker", action="store_true",
                        help=argparse.SUPPRESS)  # 內部用：子行程入口
    args = parser.parse_args()

    if args._worker:
        return worker_main()

    all_sites = discover_sites()
    if args.site and args.site not in all_sites:
        print(f"✗ 不認得的站台：{args.site}（可用：{', '.join(sorted(all_sites))}）")
        return 1
    sites = [args.site] if args.site else sorted(all_sites)
    print("Schema 漂移偵測（不碰任何線上資料庫）")
    print(f"管理連線：{args.dsn.rsplit('@', 1)[-1]}")

    results = {}
    for site in sites:
        try:
            results[site] = check_site(site, args.dsn, args.keep, args.dump_dir, all_sites)
        except Exception as exc:  # noqa: BLE001
            print(f"\n  ✗ {site} 檢查中斷：{exc}")
            results[site] = False

    print(f"\n{'═' * 62}")
    for site, ok in results.items():
        print(f"  {'✓' if ok else '✗'}  {site}")
    return 0 if all(results.values()) else 1


if __name__ == "__main__":
    sys.exit(main())
