#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
產生 @ows/ziwei-engine（TS 排盤引擎）的黃金檔。

Python 引擎（sites/Polaris_Parent/backend/extensions/astrology/engine，vendored 自 P_Union）
是真相來源；本腳本把它的輸出固定成檔案，TS 引擎的測試逐項比對。

輸出（預設到 packages/ziwei-engine/test/golden/）：
  lunar.csv                 1900–2100 每一天的 sxtwl 農曆輸出（農曆層驗證用）
  charts/NNNN.json.gz       每張盤：輸入、chart_id、曆法數據、本命/大限編碼、
                            流年/小限編碼取樣＋全量雜湊、chart_json、flow（大限全量＋
                            流年/小限取樣＋全量雜湊）、star_energy、readings
  charts/index.json         清單（輸入摘要），方便測試列舉
  VERSION.json              產生時間、引擎版本、抽樣種子、取樣年齡

用法：
  venv/Scripts/python.exe scripts/gen_ziwei_golden.py            # 全部
  venv/Scripts/python.exe scripts/gen_ziwei_golden.py --lunar-only
  venv/Scripts/python.exe scripts/gen_ziwei_golden.py --count 300 --seed 20260927 --full-first 5

Python 引擎改動後重跑本腳本，再跑 TS 測試，就是兩邊不分岔的防線。
"""
from __future__ import annotations

import argparse
import csv
import gzip
import hashlib
import json
import random
import sys
from datetime import date, datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EXT_DIR = ROOT / "sites" / "Polaris_Parent" / "backend" / "extensions"
DEFAULT_OUT = ROOT / "packages" / "ziwei-engine" / "test" / "golden"

# 流年／小限的取樣年齡（全量 120 筆各 1.7MB，只留代表點＋全量雜湊）
SAMPLE_AGES = (1, 2, 10, 30, 60, 90, 120)

# 固定邊界案例：農曆新年前後、立春日、閏月、子時邊界、極早／極晚年份
EDGE_CASES = [
    # (year, month, day, hour, minute, gender, name, note)
    (1980, 2, 15, 12, 0, "男", "邊界甲", "1980 農曆除夕"),
    (1980, 2, 16, 0, 30, "女", "邊界乙", "1980 農曆正月初一 子時"),
    (1980, 2, 5, 23, 45, "男", "邊界丙", "1980 立春日 晚子時"),
    (1980, 2, 4, 1, 0, "女", "邊界丁", "1980 立春前一日"),
    (2020, 5, 23, 10, 0, "男", "邊界戊", "2020 閏四月初一"),
    (2020, 6, 20, 15, 0, "女", "邊界己", "2020 閏四月廿九"),
    (1900, 1, 31, 8, 0, "男", "邊界庚", "1900 農曆正月初一"),
    (2099, 12, 31, 23, 59, "女", "邊界辛", "2099 年末"),
    (1985, 6, 1, 23, 0, "男", "", "23:00 晚子時 無名"),
    (1985, 6, 1, 0, 0, "女", "", "00:00 早子時 無名"),
    (2001, 1, 23, 12, 0, "男", "邊界壬", "2001 農曆除夕"),
    (2001, 1, 24, 12, 0, "男", "邊界癸", "2001 農曆正月初一"),
]

NAMES = ["", "王小明", "李美玲", "Chen Wei", "張三", "陳大文", "Alice", "林", "測試"]


def _bootstrap_engine():
    # astrology 套件本身 import core.backend_engine（OWS 根），engine 子套件則自帶 sys.path bootstrap
    sys.path.insert(0, str(ROOT))
    sys.path.insert(0, str(EXT_DIR))
    import astrology.engine as eng  # noqa: WPS433
    from astrology import _build_v3_views  # noqa: WPS433
    from astrology.flow_contract import build_flow_layers  # noqa: WPS433

    return eng, _build_v3_views, build_flow_layers


def _canon_floats(obj):
    """整數值的 float 轉 int，讓 Python 與 JS 的 JSON 字串一致（1.0 vs 1）。"""
    if isinstance(obj, float):
        return int(obj) if obj.is_integer() else obj
    if isinstance(obj, dict):
        return {k: _canon_floats(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_canon_floats(v) for v in obj]
    return obj


def canonical_json(obj) -> str:
    """與 TS 端 canonicalJson() 對應：鍵排序、無空白、非 ASCII 原樣。"""
    return json.dumps(_canon_floats(obj), ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def sha256_of(obj) -> str:
    return hashlib.sha256(canonical_json(obj).encode("utf-8")).hexdigest()


# ── 農曆表 ─────────────────────────────────────────────────────

def gen_lunar_csv(out_path: Path, y0: int = 1900, y1: int = 2100) -> int:
    import sxtwl  # noqa: WPS433

    stems = "甲乙丙丁戊己庚辛壬癸"
    branches = "子丑寅卯辰巳午未申酉戌亥"
    n = 0
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", encoding="utf-8", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["y", "m", "d", "ly", "lm", "ld", "leap", "month_gz", "day_gz", "jieqi", "week"])
        cur = date(y0, 1, 1)
        end = date(y1, 12, 31)
        while cur <= end:
            L = sxtwl.fromSolar(cur.year, cur.month, cur.day)
            mgz = L.getMonthGZ()
            dgz = L.getDayGZ()
            jq = L.getJieQi()
            w.writerow([
                cur.year, cur.month, cur.day,
                L.getLunarYear(), L.getLunarMonth(), L.getLunarDay(),
                1 if L.isLunarLeap() else 0,
                stems[mgz.tg] + branches[mgz.dz],
                stems[dgz.tg] + branches[dgz.dz],
                -1 if jq == 255 else jq,
                L.getWeek(),
            ])
            n += 1
            cur += timedelta(days=1)
    return n


# ── 命盤黃金檔 ─────────────────────────────────────────────────

def _random_inputs(count: int, seed: int):
    rng = random.Random(seed)
    out = []
    for _ in range(count):
        y = rng.randint(1920, 2025)
        m = rng.randint(1, 12)
        d = rng.randint(1, 28 if m == 2 else 30)
        h = rng.randint(0, 23)
        mi = rng.choice([0, 0, 0, 15, 30, 45, rng.randint(0, 59)])
        g = rng.choice(["男", "女"])
        name = rng.choice(NAMES)
        out.append((y, m, d, h, mi, g, name, ""))
    return out


def _sample_by_age(entries, key="age"):
    picked = []
    seen = set()
    for e in entries:
        a = int(e.get(key))
        if a in SAMPLE_AGES and a not in seen:
            picked.append(e)
            seen.add(a)
    return picked


def build_golden_chart(eng, build_v3, build_flow, spec, full: bool) -> dict:
    y, m, d, h, mi, g, name, note = spec
    chart = eng.calculate_chart(
        birth_date=(y, m, d, h, mi), gender=g, name=name, birthplace="",
        time_type="clock_time", include_flow=True, include_encoding=True,
    )
    chart_id = str(chart.get("chart_id", ""))
    enc = chart["快速條件編碼"]
    chart_json = eng.chart_to_artist_dict(chart)
    chart_json["chart_id"] = chart_id
    flow = build_flow(chart, eng.ChartParser(), eng.serialize_chart)
    star_energy, readings = build_v3(chart, star_energy=True, readings=True)

    small = enc["small_limit_encoding"]
    year = enc["year_flow_encoding"]
    rec = {
        "input": {"year": y, "month": m, "day": d, "hour": h, "minute": mi,
                  "gender": g, "name": name, "note": note},
        "chart_id": chart_id,
        "calendar": chart["曆法數據"],
        "basic": chart["基本資料"],
        "encoding": {
            "version": enc["encoding_version"],
            "type": enc["encoding_type"],
            "natal": enc["natal_chart_encoding"],
            "decade": enc["decade_chart_encoding"],
            "small_limit_sha256": sha256_of(small),
            "year_flow_sha256": sha256_of(year),
            "small_limit_sample": small if full else _sample_by_age(small),
            "year_flow_sample": year if full else _sample_by_age(year),
            "small_limit_count": len(small),
            "year_flow_count": len(year),
        },
        "chart_json": chart_json,
        "flow": {
            "decades": flow["decades"],
            "years_sha256": sha256_of(flow["years"]),
            "smallLimits_sha256": sha256_of(flow["smallLimits"]),
            "years_sample": flow["years"] if full else _sample_by_age(flow["years"]),
            "smallLimits_sample": flow["smallLimits"] if full else _sample_by_age(flow["smallLimits"]),
            "years_count": len(flow["years"]),
            "smallLimits_count": len(flow["smallLimits"]),
        },
        "star_energy": star_energy,
        "readings": readings,
        "full": full,
    }
    return rec


def gen_charts(out_dir: Path, count: int, seed: int, full_first: int) -> list[dict]:
    eng, build_v3, build_flow = _bootstrap_engine()
    specs = EDGE_CASES + _random_inputs(count, seed)
    charts_dir = out_dir / "charts"
    charts_dir.mkdir(parents=True, exist_ok=True)
    for old in charts_dir.glob("*.json.gz"):
        old.unlink()
    index = []
    for i, spec in enumerate(specs):
        rec = build_golden_chart(eng, build_v3, build_flow, spec, full=(i < full_first))
        fname = f"{i:04d}.json.gz"
        with gzip.open(charts_dir / fname, "wt", encoding="utf-8") as fh:
            json.dump(_canon_floats(rec), fh, ensure_ascii=False, separators=(",", ":"))
        index.append({"file": fname, "chart_id": rec["chart_id"], **rec["input"], "full": rec["full"]})
        if (i + 1) % 25 == 0 or i + 1 == len(specs):
            print(f"  charts {i + 1}/{len(specs)}", flush=True)
    (charts_dir / "index.json").write_text(
        json.dumps(index, ensure_ascii=False, indent=1), encoding="utf-8")
    return index


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT)
    ap.add_argument("--count", type=int, default=300, help="隨機盤數（另加固定邊界案例）")
    ap.add_argument("--seed", type=int, default=20260927)
    ap.add_argument("--full-first", type=int, default=5, help="前 N 張存流年／小限全量")
    ap.add_argument("--lunar-only", action="store_true")
    ap.add_argument("--charts-only", action="store_true")
    args = ap.parse_args()

    args.out.mkdir(parents=True, exist_ok=True)
    version = {"generated_at": datetime.now().isoformat(timespec="seconds"),
               "seed": args.seed, "count": args.count, "full_first": args.full_first,
               "sample_ages": list(SAMPLE_AGES), "edge_cases": len(EDGE_CASES)}
    vendor = EXT_DIR / "astrology" / "engine" / "VENDOR_VERSION.txt"
    if vendor.exists():
        version["vendor_version"] = vendor.read_text(encoding="utf-8").strip()

    if not args.charts_only:
        n = gen_lunar_csv(args.out / "lunar.csv")
        print(f"lunar.csv: {n} days")
        version["lunar_days"] = n
    if not args.lunar_only:
        idx = gen_charts(args.out, args.count, args.seed, args.full_first)
        print(f"charts: {len(idx)} files")
        version["charts"] = len(idx)

    (args.out / "VERSION.json").write_text(json.dumps(version, ensure_ascii=False, indent=1), encoding="utf-8")
    print("done ->", args.out)


if __name__ == "__main__":
    main()
