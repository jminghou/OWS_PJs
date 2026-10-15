/**
 * 離線地點表：geo/geo_manager.py（GeographicDataManager）的對應物。
 *
 * 每城座標與 IANA 時區來自後端 extensions/astrology/birthplace_cities.json（人工維護座標、
 * 依座標算出時區並檢查屬於該國），由 scripts/gen_ziwei_geo.py 複製成 data/geo_cities.json，
 * 執行期零網路。座標字串格式與 Python convert_to_astro_format 相同（'25n02, 121e33'）。
 */
import geoJson from "../data/geo_cities.json";

export interface GeoCity {
  continent: string; country: string; city: string;
  /** 'Taipei, Taiwan' */
  place_en: string;
  /** '25n02, 121e33' */
  coordinates: string;
  /** IANA 時區（'Asia/Taipei'）；出生當下的時差由 birth/resolveBirthTime 依日期求得 */
  tz: string;
}

const DATA = geoJson as unknown as {
  hierarchy: Record<string, Record<string, string[]>>;
  cities: Record<string, GeoCity>;
};

/** 洲 → 國家 → 城市（＝ GET /geo-options 的 hierarchy） */
export function geographicHierarchy(): Record<string, Record<string, string[]>> {
  return DATA.hierarchy;
}

/** 依中文城市＋國家查表；查不到回 null（呼叫端決定要不要退回鐘錶時） */
export function getGeoInfo(city: string, country: string): GeoCity | null {
  return DATA.cities[`${city.trim()}|${country.trim()}`] ?? null;
}

/** 所有城市（供搜尋／自動完成） */
export function allCities(): GeoCity[] {
  return Object.values(DATA.cities);
}

/** geo_manager.calculate_timezone：經度 → 'h8e'。只是經度推算的近似值，不含夏令時；出生時間換算請用 birth/resolveBirthTime */
export function calculateTimezone(lon: number): string {
  let off = Math.round(lon / 15);
  off = Math.max(-12, Math.min(14, off));
  if (off === 0) return "h0e";
  return off > 0 ? `h${off}e` : `h${Math.abs(off)}w`;
}

/** geo_manager.convert_to_astro_format：(25.033, 121.5654) → '25n02, 121e33'（分數截尾） */
export function toAstroFormat(lat: number, lon: number): string {
  const latAbs = Math.abs(lat), lonAbs = Math.abs(lon);
  const latDeg = Math.trunc(latAbs), lonDeg = Math.trunc(lonAbs);
  const latMin = Math.trunc((latAbs - latDeg) * 60), lonMin = Math.trunc((lonAbs - lonDeg) * 60);
  return `${latDeg}${lat >= 0 ? "n" : "s"}${String(latMin).padStart(2, "0")}, ${lonDeg}${lon >= 0 ? "e" : "w"}${String(lonMin).padStart(2, "0")}`;
}
