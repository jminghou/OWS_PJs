#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
產生全球出生地資料：sites/Polaris_Parent/backend/extensions/astrology/world_places.json.gz

資料來源：GeoNames（https://www.geonames.org/，CC BY 4.0，網站上需註明出處）
  cities15000.zip         人口 1.5 萬以上的城市（約 3.4 萬個；含座標、IANA 時區、各語言別名）
  admin1CodesASCII.txt    一級行政區名稱（州、郡）
  countryInfo.txt         國家清單
下載：https://download.geonames.org/export/dump/ （放進同一個資料夾，用 --geonames-dir 指定）

中文名稱：
  * 國名：Node 的 Intl.DisplayNames（zh-Hant-TW）；現有出生地選單（birthplace_cities.json）已有的國家沿用原本的叫法。
  * 城市：現有 372 城在 30 公里內對到的 GeoNames 城市沿用原本的中文名（下拉與搜尋同名）；其餘從 GeoNames 的中文別名中
    挑繁體（能以 Big5 編碼者），沒有繁體就顯示原名。所有中文別名（含簡體）都進搜尋索引。
本檔只在開發期執行（需要 node）；正式環境只讀產出的 .json.gz。產出後會複製一份到 P_Union 給 PolarisUI 用。

用法：python scripts/gen_world_places.py --geonames-dir <下載資料夾>
"""
from __future__ import annotations

import argparse
import gzip
import io
import json
import math
import os
import re
import shutil
import subprocess
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import available_timezones

ROOT = Path(__file__).resolve().parent.parent
ASTRO = ROOT / 'sites' / 'Polaris_Parent' / 'backend' / 'extensions' / 'astrology'
CURATED = ASTRO / 'birthplace_cities.json'
OUT = ASTRO / 'world_places.json.gz'
PUNION_DIR = Path(os.environ.get('PUNION_DIR', r'D:\P_Polaris_Parent\1_run\P_Union'))
CJK = re.compile(r'[\u3400-\u9fff]')
# 現有選單與 Intl 叫法不同、要沿用的國名（其餘依 gen_ziwei_geo.ISO 對應）
COUNTRY_OVERRIDES = {'HK': '香港', 'MO': '澳門'}


def _big5(s):
    try:
        s.encode('big5')
        return True
    except UnicodeEncodeError:
        return False


def _km(lat1, lon1, lat2, lon2):
    p = math.pi / 180
    a = (math.sin((lat2 - lat1) * p / 2) ** 2
         + math.cos(lat1 * p) * math.cos(lat2 * p) * math.sin((lon2 - lon1) * p / 2) ** 2)
    return 12742 * math.asin(math.sqrt(a))


def country_names(codes):
    script = ("const dn=new Intl.DisplayNames(['zh-Hant-TW'],{type:'region'});const o={};"
              "for(const c of JSON.parse(process.argv[1])){try{o[c]=dn.of(c)}catch(e){}}"
              "process.stdout.write(JSON.stringify(o))")
    out = subprocess.run(['node', '-e', script, json.dumps(codes)], capture_output=True, check=True)
    return json.loads(out.stdout.decode('utf-8'))


GOLDEN = ROOT / 'packages' / 'ziwei-engine' / 'test' / 'golden' / 'world_solar.json'
GOLDEN_MAX = 200


def write_golden(rows, countries):
    """前後端比對用黃金檔：每個時區人口最多的城市（最多 GOLDEN_MAX 個）× 樣本時刻 × 兩種時間類型，
    由後端 birthplace.resolve(place={geonameid}) 算出；TS 以同一組 lat／lon／tz 呼叫 resolveBirthTime 逐筆比對。"""
    sys.path.insert(0, str(ROOT))
    from gen_ziwei_geo import SAMPLE_TIMES
    from sites.Polaris_Parent.backend.extensions.astrology import birthplace
    from sites.Polaris_Parent.backend.extensions.astrology import engine as eng

    birthplace._world.cache_clear()
    top = {}
    for r in rows:  # rows 已依人口排序
        top.setdefault(r[7], r)
    picked = sorted(top.values(), key=lambda r: r[7])
    step = max(1, len(picked) // GOLDEN_MAX)
    picked = picked[::step][:GOLDEN_MAX]
    samples = []
    for r in picked:
        bp = birthplace.world_place(r[0])
        for clock in SAMPLE_TIMES:
            for time_type in ('solar_time', 'clock_time'):
                t = birthplace.resolve(eng, clock, time_type, place={'geonameid': r[0]})
                samples.append({'geonameid': r[0], 'city': bp.city, 'country': bp.country, 'place_en': bp.place_en,
                                'lat': bp.lat, 'lon': bp.lon, 'tz': bp.tz, 'clock': list(clock), 'time_type': time_type,
                                'resolved': list(t.resolved), 'solar_str': t.solar_time, 'birthplace': t.birthplace,
                                'utc_offset_minutes': t.utc_offset_minutes, 'dst_minutes': t.dst_minutes})
    GOLDEN.write_text(json.dumps({'cities': len(picked), 'samples': samples}, ensure_ascii=False, indent=0),
                      encoding='utf-8')
    print(f'黃金檔 {GOLDEN.name}：{len(picked)} 城、{len(samples)} 筆')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--geonames-dir', required=True)
    args = ap.parse_args()
    src = Path(args.geonames_dir)
    zones = available_timezones()

    sys.path.insert(0, str(ROOT / 'scripts'))
    from gen_ziwei_geo import ISO  # 現有選單的「中文國名 → ISO」

    codes = [ln.split('\t')[0] for ln in (src / 'countryInfo.txt').read_text(encoding='utf-8').splitlines()
             if ln and not ln.startswith('#')]
    countries = country_names(codes)
    countries.update({iso: zh for zh, iso in ISO.items()})
    countries.update(COUNTRY_OVERRIDES)

    admin1 = {}
    for ln in (src / 'admin1CodesASCII.txt').read_text(encoding='utf-8').splitlines():
        key, name, *_ = ln.split('\t')
        admin1[key] = name

    curated = json.loads(CURATED.read_text(encoding='utf-8'))['cities']
    curated_pts = [(k.split('|')[0], ISO.get(k.split('|')[1]), v['lat'], v['lon']) for k, v in curated.items()]

    z = zipfile.ZipFile(src / 'cities15000.zip')
    rows = []
    skipped = 0
    for ln in io.TextIOWrapper(z.open(z.namelist()[0]), encoding='utf-8'):
        f = ln.rstrip('\n').split('\t')
        gid, name, ascii_, alts, lat, lon, cc, a1, tz, pop = (f[0], f[1], f[2], f[3], float(f[4]), float(f[5]),
                                                              f[8], f[10], f[17], int(f[14] or 0))
        if tz not in zones or cc not in countries:
            skipped += 1
            continue
        cjk = sorted({a for a in alts.split(',') if CJK.search(a)}, key=lambda a: (len(a), a))
        trad = [a for a in cjk if _big5(a)]
        zh = trad[0] if trad else ''
        rows.append([int(gid), name, ascii_, cc, admin1.get(f'{cc}.{a1}', ''), round(lat, 5), round(lon, 5), tz, pop,
                     zh, '|'.join(cjk)])

    # 現有 372 城：同國、30 公里內「最近」的那一個沿用原本的中文名；兩城搶同一筆時距離近的勝出
    # （不能用人口最多：基隆 30 公里內人口最多的是台北，會把台北改名成基隆）
    claims = {}  # row index → (距離, 中文名)
    for city, iso, clat, clon in curated_pts:
        best, best_d = None, None
        for i, r in enumerate(rows):
            if r[3] != iso or abs(r[5] - clat) > 0.5 or abs(r[6] - clon) > 0.8:
                continue
            d = _km(clat, clon, r[5], r[6])
            if d <= 30 and (best_d is None or d < best_d):
                best, best_d = i, d
        if best is not None and (best not in claims or best_d < claims[best][0]):
            claims[best] = (best_d, city)
    for i, (_d, city) in claims.items():
        r = rows[i]
        if city not in r[10].split('|'):
            r[10] = '|'.join(filter(None, [r[10], city]))
        r[9] = city
    matched = len(claims)

    rows.sort(key=lambda r: -r[8])
    data = {
        'source': 'GeoNames cities15000 (https://www.geonames.org/) — CC BY 4.0',
        'generated_at': datetime.now(timezone.utc).strftime('%Y-%m-%d'),
        'fields': ['geonameid', 'name', 'ascii', 'country_code', 'admin1', 'lat', 'lon', 'tz', 'population',
                   'name_zh', 'aliases_zh'],
        'countries': dict(sorted(countries.items())),
        'places': rows,
    }
    raw = json.dumps(data, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
    OUT.write_bytes(gzip.compress(raw, compresslevel=9, mtime=0))
    print(f'{len(rows)} 城（略過 {skipped}）；沿用現有中文名 {matched}/{len(curated_pts)}；'
          f'{OUT.name} {OUT.stat().st_size / 1e6:.2f} MB')

    write_golden(rows, data['countries'])

    target = PUNION_DIR / 'p01_count' / '02_scraper_updated'
    if target.is_dir():
        # birthplace.py 要一起帶過去：world_places 的讀取與搜尋都在裡面（舊副本讀不到新資料）
        for f in (OUT, ASTRO / 'birthplace.py'):
            shutil.copy2(f, target / f.name)
        print(f'已複製 {OUT.name}、birthplace.py 到 {target}')


if __name__ == '__main__':
    main()
