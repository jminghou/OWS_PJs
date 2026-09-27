#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
產生 @ows/ziwei-engine 的離線地點表與真太陽時黃金檔。

來源＝Python 引擎的 GeographicDataManager（geo-options 階層 ＋ 14 城離線座標，其餘走
Nominatim 線上查詢）。本腳本把「線上查一次」的結果固定成檔案，TS 引擎從此離線：

  packages/ziwei-engine/src/data/geo_cities.json   {hierarchy, cities: {"城市|國家": {...}}}
  packages/ziwei-engine/test/golden/solar.json     每城 × 若干時刻的真太陽時（Python 輸出）

用法：venv/Scripts/python.exe scripts/gen_ziwei_geo.py [--sleep 1.1]
（Nominatim 限速 1 req/s，約 330 城 → 6 分鐘）
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EXT_DIR = ROOT / "sites" / "Polaris_Parent" / "backend" / "extensions"
PKG = ROOT / "packages" / "ziwei-engine"

SAMPLE_TIMES = [
    (1980, 11, 17, 10, 0),
    (2000, 6, 21, 23, 45),   # 夏至、晚子時
    (1995, 2, 4, 0, 10),     # 立春前後、早子時
    (2024, 12, 21, 12, 0),   # 冬至
    (1950, 8, 1, 6, 30),
]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sleep", type=float, default=1.1)
    args = ap.parse_args()

    sys.path.insert(0, str(ROOT))
    sys.path.insert(0, str(EXT_DIR))
    import astrology.engine as eng  # noqa: WPS433

    mgr = eng.GeographicDataManager()
    hierarchy = mgr.get_geographic_hierarchy()
    cities: dict[str, dict] = {}
    solar_samples: list[dict] = []
    total = sum(len(cs) for c in hierarchy.values() for cs in c.values())
    n = 0
    for continent, countries in hierarchy.items():
        for country, city_list in countries.items():
            for city in city_list:
                n += 1
                info = eng.get_geo_info(city, country)
                key = f"{city}|{country}"
                cities[key] = {
                    "continent": continent, "country": country, "city": city,
                    "place_en": info["place_en"], "coordinates": info["coordinates"],
                    "timezone": info["timezone"],
                }
                place = f"{info['place_en']}, {info['coordinates']}"
                for (y, m, d, h, mi) in SAMPLE_TIMES:
                    clock = eng.build_clock_time_str(y, m, d, h, mi)
                    solar = eng.compute_solar_time(clock, place, info["timezone"])
                    solar_samples.append({
                        "city": city, "country": country, "clock": [y, m, d, h, mi],
                        "solar_str": solar,
                        "solar": list(eng.parse_time_str(solar)) if solar else None,
                    })
                if n % 20 == 0:
                    print(f"  geo {n}/{total} {key} → {info['coordinates']} {info['timezone']}", flush=True)
                # 只有走線上查詢的城市才需要限速；離線 14 城不用等
                time.sleep(args.sleep)

    (PKG / "src" / "data").mkdir(parents=True, exist_ok=True)
    out = {
        "_comment": "由 scripts/gen_ziwei_geo.py 產生：geo-options 階層＋每城座標／時區（Python GeographicDataManager 快照，勿手改）",
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "hierarchy": hierarchy,
        "cities": cities,
    }
    (PKG / "src" / "data" / "geo_cities.json").write_text(
        json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    (PKG / "test" / "golden").mkdir(parents=True, exist_ok=True)
    (PKG / "test" / "golden" / "solar.json").write_text(
        json.dumps({"sample_times": SAMPLE_TIMES, "samples": solar_samples}, ensure_ascii=False, indent=0) + "\n",
        encoding="utf-8")
    unresolved = [k for k, v in cities.items() if v["coordinates"] == "0n00, 0e00"]
    print(f"cities: {len(cities)}, solar samples: {len(solar_samples)}, unresolved(0,0): {len(unresolved)}")
    for k in unresolved:
        print("  unresolved:", k)


if __name__ == "__main__":
    main()
