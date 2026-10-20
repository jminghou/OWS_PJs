"""
出生地與出生時間換算（OWS 自有，不在 vendored engine 內，同步引擎不會覆蓋）。

為什麼不用 engine/geo/geo_manager.py 的 get_geo_info：
  它的時區是 round(經度/15) 推算的固定時差（成都算成 UTC+7、里昂 UTC+0、新德里少 30 分），
  沒有夏令時、沒有歷史時區；查不到的城市還會靜默落到 (0,0)/UTC 照樣排盤。
  這裡改成：每城一筆離線座標＋IANA 時區（birthplace_cities.json，scripts/gen_ziwei_geo.py 產生），
  依「出生當下」的實際 UTC 時差換算，查不到就報錯、絕不猜。

兩種時間：
  solar_time  真太陽時：依當下實際 UTC 時差（含夏令時）＋經度＋均時差換算（engine.compute_solar_time）
  clock_time  一般時間：有出生地時扣掉當下的夏令時差（例：台灣 1975-07-15 10:00 → 09:00）；
              沒給出生地（舊呼叫端）維持照填的時間。

前端 @ows/ziwei-engine 的 resolveBirthTime 與這裡逐條同義，黃金檔 test/golden/solar.json 互相比對。

出生地的三種來源（place_from）：
  * 常用城市（洲／國家／城市下拉）：birthplace_cities.json，以「城市|國家」中文名查。
  * 全球城市（搜尋）：world_places.json.gz（GeoNames 約 3.4 萬城，CC BY 4.0；scripts/gen_world_places.py 產生），
    以 geonameid 查。
  * 手動（只限後台代客建單）：直接給經緯度與 IANA 時區，給清單找不到的小鎮用。
三種最後都變成同一個 Birthplace，換算邏輯完全相同。

真源在 OWS（sites/Polaris_Parent/backend/extensions/astrology/）。scripts/gen_ziwei_geo.py 與 gen_world_places.py
會把本檔與資料檔原樣複製到 P_Union/p01_count/02_scraper_updated/ 給 PolarisUI 建盤用；
那邊的副本勿手改。本檔只依賴標準函式庫（＋tzdata），兩邊都能直接載入。
"""

import gzip
import json
import unicodedata
from dataclasses import dataclass
from datetime import datetime, timedelta
from functools import lru_cache
from pathlib import Path
from typing import Optional, Tuple
from zoneinfo import ZoneInfo, available_timezones

DATA_FILE = Path(__file__).resolve().parent / 'birthplace_cities.json'
WORLD_FILE = Path(__file__).resolve().parent / 'world_places.json.gz'
WORLD_SOURCE = 'GeoNames（geonames.org，CC BY 4.0）'

Clock = Tuple[int, int, int, int, int]


class BirthplaceError(ValueError):
    """出生地查不到或換算失敗；訊息可直接給使用者看。"""


@dataclass(frozen=True)
class Birthplace:
    city: str
    country: str
    place_en: str
    lat: float
    lon: float
    tz: str
    geonameid: Optional[int] = None

    @property
    def coordinates(self) -> str:
        """'25n01, 121e33'（分數截尾，與 geo_manager.convert_to_astro_format 相同）。"""
        def part(value, pos, neg):
            v = abs(value)
            deg = int(v)
            # 加 1e-6 分再截尾：資料檔的度數是「度＋分/60」存成小數，17/60 浮點換回來是 16.99999…
            return f"{deg}{pos if value >= 0 else neg}{int((v - deg) * 60 + 1e-6):02d}"
        return f"{part(self.lat, 'n', 's')}, {part(self.lon, 'e', 'w')}"

    @property
    def label(self) -> str:
        return f'{self.city}, {self.country}'


@dataclass(frozen=True)
class BirthTime:
    clock: Clock
    resolved: Clock
    time_type: str
    solar_time: Optional[str] = None
    birthplace: str = ''
    tz: Optional[str] = None
    utc_offset_minutes: Optional[int] = None
    dst_minutes: int = 0

    def as_dict(self) -> dict:
        y, mo, d, h, mi = self.resolved
        return {'time_type': self.time_type, 'used': f'{y:04d}-{mo:02d}-{d:02d} {h:02d}:{mi:02d}',
                'solar_time': self.solar_time, 'tz': self.tz, 'utc_offset_minutes': self.utc_offset_minutes,
                'dst_minutes': self.dst_minutes}


@lru_cache(maxsize=1)
def _cities():
    return json.loads(DATA_FILE.read_text(encoding='utf-8'))['cities']


def lookup(city: str, country: str) -> Birthplace:
    city, country = (city or '').strip(), (country or '').strip()
    row = _cities().get(f'{city}|{country}')
    if not row or not row.get('tz'):
        raise BirthplaceError(f'找不到出生地「{city}, {country}」，請從選單重新選擇')
    return Birthplace(city, country, row['place_en'], row['lat'], row['lon'], row['tz'])


# ── 全球城市（GeoNames）──────────────────────────────────────────────────────
def _fold(text: str) -> str:
    """搜尋用：小寫、去掉重音（Tromsø → tromso、Zürich → zurich）。"""
    text = unicodedata.normalize('NFKD', text or '').replace('\u00f8', 'o').replace('\u00d8', 'o')
    return ''.join(ch for ch in text if not unicodedata.combining(ch)).lower().strip()


@lru_cache(maxsize=1)
def _world():
    data = json.loads(gzip.decompress(WORLD_FILE.read_bytes()))
    by_id = {r[0]: r for r in data['places']}
    # 每城的搜尋詞：原名、ASCII 名、所有中文別名（含簡體）
    index = [(r, [_fold(t) for t in [r[1], r[2], *r[10].split('|')] if t]) for r in data['places']]
    return data['countries'], by_id, index


def _world_birthplace(row) -> Birthplace:
    countries = _world()[0]
    return Birthplace(row[9] or row[1], countries.get(row[3], row[3]), row[1], row[5], row[6], row[7], row[0])


def world_place(geonameid) -> Birthplace:
    try:
        row = _world()[1].get(int(geonameid))
    except (TypeError, ValueError):
        row = None
    if row is None:
        raise BirthplaceError('找不到這個出生地，請重新搜尋城市')
    return _world_birthplace(row)


def place_view(row) -> dict:
    countries = _world()[0]
    country = countries.get(row[3], row[3])
    city = row[9] or row[1]
    return {'geonameid': row[0], 'name': row[1], 'name_zh': row[9] or None, 'admin1': row[4],
            'country_code': row[3], 'country': country, 'lat': row[5], 'lon': row[6], 'tz': row[7],
            'population': row[8], 'label': f'{city}, {country}',
            'detail': ', '.join(x for x in ((row[1] if row[9] else ''), row[4]) if x)}


def search(query: str, limit: int = 10) -> list:
    """全球城市搜尋：完全相同 > 開頭相同 > 包含，同級依人口排序。"""
    q = _fold(query)
    if not q:
        return []
    hits = []
    for row, terms in _world()[2]:
        rank = min((0 if t == q else 1 if t.startswith(q) else 2 if q in t else 9) for t in terms)
        if rank < 9:
            hits.append((rank, -row[8], row))
    hits.sort(key=lambda h: (h[0], h[1]))
    return [place_view(row) for _, _, row in hits[:max(1, min(int(limit), 30))]]


def manual_place(lat, lon, tz, label='', country='') -> Birthplace:
    """手動輸入的出生地（後台代客建單用）：經緯度與 IANA 時區都要合理。"""
    try:
        lat, lon = float(lat), float(lon)
    except (TypeError, ValueError):
        raise BirthplaceError('請填寫正確的經緯度')
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        raise BirthplaceError('經緯度超出範圍')
    if tz not in available_timezones():
        raise BirthplaceError(f'時區「{tz}」不是有效的 IANA 時區（例：Europe/Oslo）')
    label, country = (label or '').strip()[:100], (country or '').strip()[:100]
    if not label:
        raise BirthplaceError('請填寫出生地名稱')
    return Birthplace(label, country, label, round(lat, 5), round(lon, 5), tz)


def place_from(place: Optional[dict], allow_manual: bool = False) -> Optional[Birthplace]:
    """依 place 內容挑來源；沒有任何出生地資訊回 None。"""
    place = place or {}
    if place.get('geonameid') not in (None, ''):
        return world_place(place['geonameid'])
    if place.get('manual'):
        if not allow_manual:
            raise BirthplaceError('請從選單選擇或搜尋出生地')
        return manual_place(place.get('lat'), place.get('lon'), place.get('tz'),
                            place.get('city') or place.get('label'), place.get('country'))
    city, country = (place.get('city') or '').strip(), (place.get('country') or '').strip()
    if city and country:
        return lookup(city, country)
    return None


def utc_offset_seconds(tz: str, wall: datetime) -> int:
    """當地牆上時間的 UTC 時差（秒）。fold=0：重疊時段取較早那次、跳過的時段取跳轉前的時差。"""
    return int(ZoneInfo(tz).utcoffset(wall.replace(fold=0)).total_seconds())


def dst_minutes(tz: str, clock: Clock) -> int:
    """夏令時差＝當下時差 − 當年 1/15 與 7/15 正午時差較小者（不用 ZoneInfo.dst()，前端 Intl 拿不到它）。"""
    year = clock[0]
    standard = min(utc_offset_seconds(tz, datetime(year, 1, 15, 12)), utc_offset_seconds(tz, datetime(year, 7, 15, 12)))
    return max(0, (utc_offset_seconds(tz, datetime(*clock)) - standard) // 60)


def offset_token(offset_seconds: int) -> str:
    """UTC 時差 → SolarTimeCalculator 的時區字串：'h8e'、'h5.5e'、'h3w'。"""
    hours = abs(offset_seconds) / 3600
    text = f'{hours:.6f}'.rstrip('0').rstrip('.')
    return f"h{text}{'w' if offset_seconds < 0 else 'e'}"


def timezone_label(tz: str, clock: Clock) -> str:
    """出生當下的時區字串（SolarTimeCalculator 可解析）：'h8e (is standard time)'、'h9e (daylight saving time)'。"""
    note = 'daylight saving time' if dst_minutes(tz, clock) else 'is standard time'
    return f'{offset_token(utc_offset_seconds(tz, datetime(*clock)))} ({note})'


def resolve(eng, clock: Clock, time_type: str, city: str = '', country: str = '',
            place: Optional[dict] = None, allow_manual: bool = False) -> BirthTime:
    """place（dict）優先：geonameid（全球城市）／manual（手動經緯度）／city＋country（常用城市）；
    沒給 place 時沿用舊的 city、country 參數。"""
    clock = tuple(int(x) for x in clock)
    bp = place_from(place if place is not None else {'city': city, 'country': country}, allow_manual)

    if time_type == 'solar_time':
        if bp is None:
            raise BirthplaceError('使用真太陽時需選擇出生的國家與城市')
        place = bp
        offset = utc_offset_seconds(place.tz, datetime(*clock))
        solar = eng.compute_solar_time(eng.build_clock_time_str(*clock),
                                       f'{place.place_en}, {place.coordinates}', offset_token(offset))
        if not solar:
            raise BirthplaceError(f'無法依出生地「{place.label}」換算真太陽時')
        return BirthTime(clock, tuple(eng.parse_time_str(solar)), time_type, solar, place.label, place.tz,
                         offset // 60, dst_minutes(place.tz, clock))

    if bp is None:
        return BirthTime(clock, clock, time_type)
    place = bp
    dst = dst_minutes(place.tz, clock)
    resolved = clock
    if dst:
        t = datetime(*clock) - timedelta(minutes=dst)
        resolved = (t.year, t.month, t.day, t.hour, t.minute)
    return BirthTime(clock, resolved, time_type, None, place.label, place.tz,
                     utc_offset_seconds(place.tz, datetime(*clock)) // 60, dst)
