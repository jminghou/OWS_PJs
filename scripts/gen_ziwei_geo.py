#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
產生出生地資料（後端＋@ows/ziwei-engine）與前後端共用的出生時間黃金檔。

資料來源（唯一真相）：sites/Polaris_Parent/backend/extensions/astrology/birthplace_cities.json
  每城 place_en / lat / lon 由人維護（座標要改就改這裡）；tz（IANA 時區）由本腳本依座標算出寫回。
  城市清單＝vendored geo_manager 的 geo-options 階層；兩邊必須一一對應。

本腳本：
  1. 依座標查 IANA 時區（timezonefinder，僅開發期需要），並檢查時區屬於該國（tzdata 的 zone.tab）——
     2026-10 稽核時曾抓到 Nominatim 以中文名把柬埔寨的拜林配到柏林這種錯，這道檢查擋住同類問題。
  2. 寫回後端資料檔的 tz。
  3. 產生 packages/ziwei-engine/src/data/geo_cities.json（階層＋每城座標／時區）。
  4. 產生 packages/ziwei-engine/test/golden/solar.json：每城 × 樣本時刻 × 兩種時間類型，
     由後端 birthplace.resolve 算出，TS 的 resolveBirthTime 逐筆比對。
  5. 把 birthplace.py 與資料檔複製到 P_Union/p01_count/02_scraper_updated/（PolarisUI 建盤用，兩邊同一份）。

用法：venv/Scripts/python.exe -m pip install timezonefinder  （一次）
      venv/Scripts/python.exe scripts/gen_ziwei_geo.py
"""
from __future__ import annotations

import json
import os
import shutil
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EXT_DIR = ROOT / "sites" / "Polaris_Parent" / "backend" / "extensions"
DATA_FILE = EXT_DIR / "astrology" / "birthplace_cities.json"
PKG = ROOT / "packages" / "ziwei-engine"
# PolarisUI 建盤用的副本（同一個 birthplace.py＋資料檔）；目錄不存在就略過（例如 CI）
PUNION_DIR = Path(os.environ.get("PUNION_DIR", r"D:\P_Polaris_Parent\1_run\P_Union"))

SAMPLE_TIMES = [
    (1980, 11, 17, 10, 0),
    (2000, 6, 21, 23, 45),   # 夏至、晚子時
    (1995, 2, 4, 0, 10),     # 立春前後、早子時
    (2024, 12, 21, 12, 0),   # 冬至
    (1950, 8, 1, 6, 30),
    (1975, 7, 15, 10, 0),    # 台灣夏令時
    (1988, 7, 15, 23, 30),   # 中國夏令時、子時邊界
    (1979, 8, 1, 0, 30),     # 夏令時扣一小時會跨日
    (2010, 7, 15, 12, 0),    # 歐美夏令時
]

# 國名 → ISO 3166 代碼（zone.tab 的國碼）
ISO = {
    "中國": "CN", "台灣": "TW", "日本": "JP", "韓國": "KR", "印度": "IN", "新加坡": "SG", "泰國": "TH",
    "馬來西亞": "MY", "越南": "VN", "柬埔寨": "KH", "緬甸": "MM", "菲律賓": "PH", "印尼": "ID", "汶萊": "BN",
    "德國": "DE", "法國": "FR", "英國": "GB", "義大利": "IT", "西班牙": "ES", "荷蘭": "NL", "瑞士": "CH",
    "奧地利": "AT", "美國": "US", "加拿大": "CA", "墨西哥": "MX", "巴西": "BR", "阿根廷": "AR", "智利": "CL",
    "哥倫比亞": "CO", "澳大利亞": "AU", "紐西蘭": "NZ", "南非": "ZA", "埃及": "EG", "摩洛哥": "MA",
    "奈及利亞": "NG",
}
# timezonefinder 會回傳被併入他國的連結時區（例：馬來西亞新山 → Asia/Singapore），屬正常
SHARED_ZONES = {
    ("MY", "Asia/Singapore"), ("BN", "Asia/Kuching"), ("KH", "Asia/Bangkok"), ("VN", "Asia/Bangkok"),
    ("NG", "Africa/Lagos"), ("MM", "Asia/Yangon"), ("KH", "Asia/Phnom_Penh"), ("BN", "Asia/Brunei"),
}


def zone_countries() -> dict[str, set[str]]:
    import tzdata
    tab = Path(tzdata.__file__).parent / "zoneinfo" / "zone.tab"
    out: dict[str, set[str]] = {}
    for line in tab.read_text("utf-8").splitlines():
        if line and not line.startswith("#"):
            cc, _, zone = line.split("\t")[:3]
            out.setdefault(zone, set()).add(cc)
    return out


def main():
    try:
        from timezonefinder import TimezoneFinder
    except ImportError:
        sys.exit("需要 timezonefinder：venv/Scripts/python.exe -m pip install timezonefinder")

    sys.path.insert(0, str(ROOT))
    sys.path.insert(0, str(EXT_DIR))
    import astrology.engine as eng  # noqa: WPS433
    from astrology import birthplace  # noqa: WPS433

    hierarchy = eng.GeographicDataManager().get_geographic_hierarchy()
    data = json.loads(DATA_FILE.read_text("utf-8"))
    cities = data["cities"]
    expected = {f"{city}|{country}": (continent, country, city)
                for continent, countries in hierarchy.items()
                for country, city_list in countries.items() for city in city_list}
    missing, extra = expected.keys() - cities.keys(), cities.keys() - expected.keys()
    if missing or extra:
        sys.exit(f"城市清單與 geo-options 階層不一致：缺 {sorted(missing)}、多 {sorted(extra)}")

    tf, zcc = TimezoneFinder(), zone_countries()
    wrong = []
    for key, row in cities.items():
        _, country, _ = expected[key]
        tz = tf.timezone_at(lat=row["lat"], lng=row["lon"])
        if not tz or (ISO[country] not in zcc.get(tz, set()) and (ISO[country], tz) not in SHARED_ZONES):
            wrong.append(f"{key} ({row['lat']}, {row['lon']}) → {tz} {sorted(zcc.get(tz, []))}")
        row["tz"] = tz
    if wrong:
        sys.exit("座標落在別國的時區，請更正 birthplace_cities.json：\n  " + "\n  ".join(wrong))

    data["_comment"] = ("出生地：place_en/lat/lon 人工維護；tz 由 scripts/gen_ziwei_geo.py 依座標產生，勿手改")
    data["generated_at"] = datetime.now().isoformat(timespec="seconds")
    DATA_FILE.write_text(json.dumps({"_comment": data["_comment"], "generated_at": data["generated_at"],
                                     "cities": cities}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

    ts_cities, samples = {}, []
    for key, (continent, country, city) in expected.items():
        place = birthplace.lookup(city, country)
        ts_cities[key] = {"continent": continent, "country": country, "city": city,
                          "place_en": place.place_en, "coordinates": place.coordinates, "tz": place.tz}
        for clock in SAMPLE_TIMES:
            for time_type in ("solar_time", "clock_time"):
                b = birthplace.resolve(eng, clock, time_type, city, country)
                samples.append({"city": city, "country": country, "clock": list(clock), "time_type": time_type,
                                "resolved": list(b.resolved), "solar_str": b.solar_time,
                                "utc_offset_minutes": b.utc_offset_minutes, "dst_minutes": b.dst_minutes})

    (PKG / "src" / "data" / "geo_cities.json").write_text(json.dumps({
        "_comment": "由 scripts/gen_ziwei_geo.py 產生：geo-options 階層＋每城座標／IANA 時區（來源 birthplace_cities.json，勿手改）",
        "generated_at": data["generated_at"], "hierarchy": hierarchy, "cities": ts_cities,
    }, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    lines = ",\n".join(json.dumps(s, ensure_ascii=False, separators=(",", ":")) for s in samples)
    (PKG / "test" / "golden" / "solar.json").write_text(
        '{"sample_times":' + json.dumps(SAMPLE_TIMES) + ',"samples":[\n' + lines + "\n]}\n", encoding="utf-8")
    dst = sum(1 for s in samples if s["dst_minutes"])
    print(f"cities: {len(ts_cities)}, samples: {len(samples)} (含夏令時 {dst} 筆)")

    target = PUNION_DIR / "p01_count" / "02_scraper_updated"
    if target.is_dir():
        for src in (EXT_DIR / "astrology" / "birthplace.py", DATA_FILE):
            shutil.copyfile(src, target / src.name)
        print(f"已同步 birthplace.py 與 {DATA_FILE.name} 到 {target}")
    else:
        print(f"略過 P_Union 同步（找不到 {target}，可用環境變數 PUNION_DIR 指定）")


if __name__ == "__main__":
    main()
