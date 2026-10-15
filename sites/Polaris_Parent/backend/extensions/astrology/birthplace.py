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

真源在 OWS（sites/Polaris_Parent/backend/extensions/astrology/）。scripts/gen_ziwei_geo.py 會把本檔與
birthplace_cities.json 原樣複製到 P_Union/p01_count/02_scraper_updated/ 給 PolarisUI 建盤用；
那邊的副本勿手改。本檔只依賴標準函式庫（＋tzdata），兩邊都能直接載入。
"""

import json
from dataclasses import dataclass
from datetime import datetime, timedelta
from functools import lru_cache
from pathlib import Path
from typing import Optional, Tuple
from zoneinfo import ZoneInfo

DATA_FILE = Path(__file__).resolve().parent / 'birthplace_cities.json'

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


def resolve(eng, clock: Clock, time_type: str, city: str = '', country: str = '') -> BirthTime:
    clock = tuple(int(x) for x in clock)
    has_place = bool((city or '').strip() and (country or '').strip())

    if time_type == 'solar_time':
        if not has_place:
            raise BirthplaceError('使用真太陽時需選擇出生的國家與城市')
        place = lookup(city, country)
        offset = utc_offset_seconds(place.tz, datetime(*clock))
        solar = eng.compute_solar_time(eng.build_clock_time_str(*clock),
                                       f'{place.place_en}, {place.coordinates}', offset_token(offset))
        if not solar:
            raise BirthplaceError(f'無法依出生地「{place.label}」換算真太陽時')
        return BirthTime(clock, tuple(eng.parse_time_str(solar)), time_type, solar, place.label, place.tz,
                         offset // 60, dst_minutes(place.tz, clock))

    if not has_place:
        return BirthTime(clock, clock, time_type)
    place = lookup(city, country)
    dst = dst_minutes(place.tz, clock)
    resolved = clock
    if dst:
        t = datetime(*clock) - timedelta(minutes=dst)
        resolved = (t.year, t.month, t.day, t.hour, t.minute)
    return BirthTime(clock, resolved, time_type, None, place.label, place.tz,
                     utc_offset_seconds(place.tz, datetime(*clock)) // 60, dst)
